import path from "path";
import url from "url";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo } from "@1password/op-js";

const envConnectHost = "OP_CONNECT_HOST";
const envConnectToken = "OP_CONNECT_TOKEN";
const envServiceAccountToken = "OP_SERVICE_ACCOUNT_TOKEN";

const run = async () => {
	try {
		// Validate that a proper authentication configuration is set for the CLI
		validateAuth();

		// Download and install the CLI
		await installCLI();

		// Get action inputs
		const unsetPrevious = core.getBooleanInput("unset-previous");
		const exportEnv = core.getBooleanInput("export-env");

		// Unset all secrets managed by 1Password if `unset-previous` is set.
		if (unsetPrevious && process.env.OP_MANAGED_VARIABLES) {
			core.debug(`Unsetting previous values ...`);
			const managedEnvs = process.env.OP_MANAGED_VARIABLES.split(",");
			for (const envName of managedEnvs) {
				core.debug(`Unsetting ${envName}`);
				core.exportVariable(envName, "");
			}
		}

		await extractSecrets(exportEnv);
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
		process.env.PATH = `${cliPath}:${process.env.PATH}`;
	}
};

const extractSecrets = async (exportEnv: boolean) => {
	// Pass User-Agent Inforomation to the 1Password CLI
	setClientInfo({
		name: "1Password GitHub Action",
		id: "GHA",
		build: "1020000",
	});

	// Load environment variables using 1Password CLI. Iterate over them to find 1Password references,
	// load the secret values, and make them available either as step output or as environment variables
	// in the next steps.
	const res = await exec.getExecOutput(`sh -c "op env ls"`);
	const envs = res.stdout.replace(/\n+$/g, "").split(/\r?\n/);
	for (const envName of envs) {
		core.debug(`Populating variable: ${envName}`);
		const ref = process.env[envName];
		if (ref) {
			const secretValue = read.parse(ref);
			if (secretValue) {
				if (exportEnv) {
					core.exportVariable(envName, secretValue);
				} else {
					core.setOutput(envName, secretValue);
				}
				core.setSecret(secretValue);
			}
		}
	}
	if (exportEnv) {
		core.exportVariable("OP_MANAGED_VARIABLES", envs.join());
	}
};

void run();
