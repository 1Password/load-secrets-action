import * as core from "@actions/core";
import { validateCli } from "@1password/op-js";
import { install } from "@1password/install-cli-action/dist";
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
	// validateCli checks if there's an existing 1Password CLI installed on the runner.
	// If there's no CLI installed, then validateCli will throw an error, which we will use
	// as an indicator that we need to execute the installation script.
	await validateCli().catch(async () => {
		await install()
	});
};

void loadSecretsAction();
