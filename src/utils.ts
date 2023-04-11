import * as core from "@actions/core";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envServiceAccountToken,
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
