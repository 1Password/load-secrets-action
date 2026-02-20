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

		// Validate that a proper authentication configuration is set for the CLI
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
		let message = "Unknown Error";
		if (error instanceof Error) {
			message = error.message;
			if (message === "Unknown Error" && error.cause instanceof Error) {
				message = error.cause.message;
			}
		} else if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
			message = (error as { message: string }).message;
		} else if (error !== null && error !== undefined) {
			message = typeof error === "string" ? error : JSON.stringify(error);
		}
		core.setFailed(message);
	}
};

void loadSecretsAction();
