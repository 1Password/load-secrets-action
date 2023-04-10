import path from "path";
import url from "url";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

const envConnectHost = "OP_CONNECT_HOST";
const envConnectToken = "OP_CONNECT_TOKEN";
const envServiceAccountToken = "OP_SERVICE_ACCOUNT_TOKEN";

const run = async () => {
	try {
		// Validate that a proper authentication configuration is set for the CLI
		validateAuth();

		// Get action inputs
		process.env.INPUT_UNSET_PREVIOUS = core.getInput("unset-previous");
		process.env.INPUT_EXPORT_ENV = core.getInput("export-env");

		// Execute bash script
		await executeScript();
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

const validateAuth = () => {
	let authType = "Connect";
	if (!process.env[envConnectHost] || !process.env[envConnectToken]) {
		if (!process.env[envServiceAccountToken]) {
			throw new Error(
				`(${envConnectHost} and ${envConnectToken}) or ${envServiceAccountToken} must be set`,
			);
		}
		authType = "Service account";
	}

	// Adjust Connect host to have a protocol
	if (
		process.env[envConnectHost] &&
		/* eslint-disable no-restricted-syntax */
		(!process.env[envConnectHost]?.startsWith("http://") ||
			!process.env[envConnectHost].startsWith("https://"))
	) {
		process.env[envConnectHost] = `http://${process.env[envConnectHost]}`;
	}

	core.debug(`Authenticated with ${authType}.`);
};

const executeScript = async (): Promise<void> => {
	const currentFile = url.fileURLToPath(import.meta.url);
	const currentDir = path.dirname(currentFile);
	const parentDir = path.resolve(currentDir, "..");

	// Execute bash script
	await exec.exec(`sh -c "` + parentDir + `/entrypoint.sh"`);
};

void run();
