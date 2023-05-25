import path from "path";
import url from "url";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { validateCli } from "@1password/op-js";
import { loadSecrets, unsetPrevious, validateAuth } from "./utils";

const loadSecretsAction = async () => {
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

void loadSecretsAction();
