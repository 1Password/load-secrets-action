import path from "path";
import url from "url";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo } from "@1password/op-js";
import { version } from "../package.json";
import { semverToInt } from "./utils";
import {
	envConnectHost,
	envConnectToken,
	envServiceAccountToken,
	envManagedVariables,
	authErr,
} from "./constants";

const run = async () => {
	try {
		// Get action inputs
		const shouldUnsetPrevious = core.getBooleanInput("unset-previous");
		const shouldExportEnv = core.getBooleanInput("export-env");

		// Unset all secrets managed by 1Password if `unset-previous` is set.
		unsetPrevious(shouldUnsetPrevious);

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

const unsetPrevious = (shouldUnsetPrevious: boolean) => {
	if (shouldUnsetPrevious && process.env[envManagedVariables]) {
		core.debug(`Unsetting previous values ...`);
		const managedEnvs = process.env[envManagedVariables].split(",");
		for (const envName of managedEnvs) {
			core.debug(`Unsetting ${envName}`);
			core.exportVariable(envName, "");
		}
	}
};

const validateAuth = () => {
	let authType = "Connect";
	if (!process.env[envConnectHost] || !process.env[envConnectToken]) {
		if (!process.env[envServiceAccountToken]) {
			throw new Error(authErr);
		}
		authType = "Service account";
	}

	// Adjust Connect host to have a protocol
	if (
		process.env[envConnectHost] &&
		/* eslint-disable no-restricted-syntax */
		!process.env[envConnectHost].startsWith("http://") &&
		!process.env[envConnectHost].startsWith("https://")
	) {
		process.env[envConnectHost] = `http://${process.env[envConnectHost]}`;
	}

	core.debug(`Authenticated with ${authType}.`);
};

/* eslint-disable @typescript-eslint/naming-convention */
const installCLI = async (): Promise<void> => {
	const currentFile = url.fileURLToPath(import.meta.url);
	const currentDir = path.dirname(currentFile);
	const parentDir = path.resolve(currentDir, "..");

	// Execute bash script
	const cmdOut = await exec.getExecOutput(
		`sh -c "` + parentDir + `/entrypoint.sh"`,
	);

	// Add path to 1Password CLI to $PATH
	const outArr = cmdOut.stdout.split("\n");
	if (outArr[0] && process.env.PATH) {
		const cliPath = outArr[0]?.replace(/^(::debug::OP_INSTALL_DIR: )/, "");
		core.addPath(cliPath);
	}
};

const loadSecrets = async (shouldExportEnv: boolean) => {
	// Pass User-Agent Inforomation to the 1Password CLI
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
		core.debug(`Populating variable: ${envName}`);
		const ref = process.env[envName];
		if (ref) {
			const secretValue = read.parse(ref);
			if (secretValue) {
				if (shouldExportEnv) {
					core.exportVariable(envName, secretValue);
				} else {
					core.setOutput(envName, secretValue);
				}
				core.setSecret(secretValue);
			}
		}
	}
	if (shouldExportEnv) {
		core.exportVariable(envManagedVariables, envs.join());
	}
};

void run();
