import path from "path";
import url from "url";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { setClientInfo, validateCli } from "@1password/op-js";
import { version } from "../package.json";
import {
	extractSecret,
	semverToInt,
	unsetPrevious,
	validateAuth,
} from "./utils";
import { envManagedVariables } from "./constants";

const run = async () => {
	try {
		// Get action inputs
		const shouldUnsetPrevious = core.getBooleanInput("unset-previous");
		const shouldExportEnv = core.getBooleanInput("export-env");

		// Unset all secrets managed by 1Password if `unset-previous` is set.
		if (shouldUnsetPrevious) {
			unsetPrevious();
		}

		// Validate that a proper authentication configuration is set for the CLI
		validateAuth();

		// Download and install the CLI
		await installCLI();

		// Load secrets
		await loadSecrets(shouldExportEnv);
	} catch (error) {
		// It's possible for the Error constructor to be modified to be anything
		// in JavaScript, so the following code accounts for this possibility.
		// https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript
		let message = "Unknown Error";
		if (error instanceof Error) {
			message = error.message;
		} else {
			String(error);
		}
		core.setFailed(message);
	}
};

// This function's name is an exception from the naming convention
// since we refer to the 1Password CLI here.
// eslint-disable-next-line @typescript-eslint/naming-convention
const installCLI = async (): Promise<void> => {
	await validateCli().catch(async () => {
		const currentFile = url.fileURLToPath(import.meta.url);
		const currentDir = path.dirname(currentFile);
		const parentDir = path.resolve(currentDir, "..");

		// Execute bash script
		const cmdOut = await exec.getExecOutput(
			`sh -c "` + parentDir + `/install_cli.sh"`,
		);

		// Add path to 1Password CLI to $PATH
		const outArr = cmdOut.stdout.split("\n");
		if (outArr[0] && process.env.PATH) {
			const cliPath = outArr[0]?.replace(/^(::debug::OP_INSTALL_DIR: )/, "");
			core.addPath(cliPath);
		}
	});
};

const loadSecrets = async (shouldExportEnv: boolean) => {
	// Pass User-Agent Information to the 1Password CLI
	setClientInfo({
		name: "1Password GitHub Action",
		id: "GHA",
		build: semverToInt(version),
	});

	// Load secrets from environment variables using 1Password CLI.
	// Iterate over them to find 1Password references, extract the secret values,
	// and make them available in the next steps either as step outputs or as environment variables.
	const res = await exec.getExecOutput(`sh -c "op env ls"`);
	const envs = res.stdout.replace(/\n+$/g, "").split(/\r?\n/);
	for (const envName of envs) {
		extractSecret(envName, shouldExportEnv);
	}
	if (shouldExportEnv) {
		core.exportVariable(envManagedVariables, envs.join());
	}
};

void run();
