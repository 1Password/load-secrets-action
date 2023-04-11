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

export const extractSecret = (
	envName: string,
	shouldExportEnv: boolean,
): void => {
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
};

export const unsetPrevious = (shouldUnsetPrevious: boolean): void => {
	if (shouldUnsetPrevious && process.env[envManagedVariables]) {
		core.debug(`Unsetting previous values ...`);
		const managedEnvs = process.env[envManagedVariables].split(",");
		for (const envName of managedEnvs) {
			core.debug(`Unsetting ${envName}`);
			core.exportVariable(envName, "");
		}
	}
};
