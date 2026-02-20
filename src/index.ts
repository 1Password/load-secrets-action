import dotenv from "dotenv";
import * as core from "@actions/core";
import { loadSecrets, unsetPrevious, validateAuth } from "./utils";
import { envFilePath } from "./constants";

const loadSecretsAction = async () => {
	try {
		// Get action inputs
		const shouldUnsetPrevious = core.getBooleanInput("unset-previous");
		const shouldExportEnv = core.getBooleanInput("export-env");

		// Unset all secrets managed by 1Password if `unset-previous` is set.
		if (shouldUnsetPrevious) {
			unsetPrevious();
		}

		// Validate that a proper authentication configuration is set (Connect or service account)
		validateAuth();

		// Set environment variables from OP_ENV_FILE
		const file = process.env[envFilePath];
		if (file) {
			core.info(`Loading environment variables from file: ${file}`);
			dotenv.config({ path: file });
		}

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
			message = String(error);
		}
		core.setFailed(message);
	}
};

void loadSecretsAction();
