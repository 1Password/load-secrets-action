import * as core from "@actions/core";
import { read } from "@1password/op-js";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envServiceAccountToken,
	envManagedVariables,
} from "./constants";

export const semverToInt = (input: string): string =>
	input
		.split(".")
		.map((n) => n.padStart(2, "0"))
		.join("");

export const validateAuth = (): void => {
	const isConnect = process.env[envConnectHost] && process.env[envConnectToken];
	const isServiceAccount = process.env[envServiceAccountToken];

	if (!isConnect && !isServiceAccount) {
		throw new Error(authErr);
	}

	const authType = isConnect ? "Connect" : "Service account";

	// Adjust Connect host to have a protocol
	if (
		process.env[envConnectHost] &&
		// The following lint error is not an issue because we are checking for the presence of the `http://` prefix;
		// we are not using it as an insecure connection protocol to link out to another resource.
		// eslint-disable-next-line no-restricted-syntax
		!process.env[envConnectHost].startsWith("http://") &&
		!process.env[envConnectHost].startsWith("https://")
	) {
		process.env[envConnectHost] = `http://${process.env[envConnectHost]}`;
	}

	core.debug(`Authenticated with ${authType}.`);
};

export const extractSecret = (
	envName: string,
	shouldExportEnv: boolean,
): void => {
	core.debug(`Populating variable: ${envName}`);

	const ref = process.env[envName];
	if (!ref) {
		return;
	}

	const secretValue = read.parse(ref);
	if (!secretValue) {
		return;
	}

	if (shouldExportEnv) {
		core.exportVariable(envName, secretValue);
	} else {
		core.setOutput(envName, secretValue);
	}
	core.setSecret(secretValue);
};

export const unsetPrevious = (): void => {
	if (process.env[envManagedVariables]) {
		core.debug("Unsetting previous values ...");
		const managedEnvs = process.env[envManagedVariables].split(",");
		for (const envName of managedEnvs) {
			core.debug(`Unsetting ${envName}`);
			core.exportVariable(envName, "");
		}
	}
};
