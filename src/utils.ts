import * as core from "@actions/core";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envManagedVariables,
	envServiceAccountToken,
} from "./constants";
import type { SecretReferenceResolver } from "./auth/types";
import { ServiceAccount } from "./auth/service-account";
import { Connect } from "./auth/connect";
import process from "node:process";

export const validateAuth = (): void => {
	const isConnect = process.env[envConnectHost] && process.env[envConnectToken];
	const isServiceAccount = process.env[envServiceAccountToken];

	if (isConnect && isServiceAccount) {
		core.warning(
			"WARNING: Both service account and Connect credentials are provided. Connect credentials will take priority.",
		);
	}

	if (!isConnect && !isServiceAccount) {
		throw new Error(authErr);
	}

	const authType = isConnect ? "Connect" : "Service account";

	core.info(`Authenticated with ${authType}.`);
};

export const extractSecret = async (
	resolver: SecretReferenceResolver,
	envName: string,
	shouldExportEnv: boolean,
): Promise<void> => {
	core.info(`Populating variable: ${envName}`);

	const ref = process.env[envName];
	if (!ref) {
		return;
	}

	const secretValue = await resolver.resolve(ref);
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

export const buildSecretResolver = (): SecretReferenceResolver => {
	if (process.env[envServiceAccountToken]) {
		return new ServiceAccount();
	} else {
		return new Connect();
	}
};

export const loadSecrets = async (shouldExportEnv: boolean): Promise<void> => {
	const refs = loadSecretRefsFromEnv();

	if (refs.length === 0) {
		return;
	}

	const resolver = buildSecretResolver();

	for (const key of refs) {
		await extractSecret(resolver, key, shouldExportEnv);
	}

	if (shouldExportEnv) {
		core.exportVariable(envManagedVariables, refs.join());
	}
};

export const loadSecretRefsFromEnv = (): string[] => {
	// secret references `op://<vault-name>/<item-name>/[section-name/]<field-name>`
	return Object.entries(process.env)
		.filter(([, v]) => v && v.startsWith("op://"))
		.map(([k]) => k);
};

export const unsetPrevious = (): void => {
	if (process.env[envManagedVariables]) {
		core.info("Unsetting previous values ...");
		const managedEnvs = process.env[envManagedVariables].split(",");
		for (const envName of managedEnvs) {
			core.info(`Unsetting ${envName}`);
			core.exportVariable(envName, "");
		}
	}
};
