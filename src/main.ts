import * as core from "@actions/core";
import { getAuth, loadSecrets, unsetPrevious } from "./utils";

export const run = async (): Promise<void> => {
	try {
		// Get action inputs
		const shouldUnsetPrevious = core.getBooleanInput("unset-previous");
		const shouldExportEnv = core.getBooleanInput("export-env");

		// Unset all secrets managed by 1Password if `unset-previous` is set.
		if (shouldUnsetPrevious) {
			unsetPrevious();
		}

		// Validate that a proper authentication configuration is set for the SDK, and return proper instance.
		const auth = getAuth();

		// Load secrets
		await loadSecrets(auth, shouldExportEnv);
	} catch (error) {
		// It's possible for the Error constructor to be modified to be anything
		// in JavaScript, so the following code accounts for this possibility.
		// https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript
		let message: string;
		if (error instanceof Error) {
			message = error.message;
		} else {
			message = String(error);
		}
		core.setFailed(message);
	}
};
