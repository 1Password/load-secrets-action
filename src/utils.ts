import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo, semverToInt } from "@1password/op-js";
import { createClient, Secrets } from "@1password/sdk";
import { version } from "../package.json";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envServiceAccountToken,
	envManagedVariables,
} from "./constants";

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

const getEnvVarNamesWithSecretRefs = (): string[] =>
	Object.keys(process.env).filter(
		(key) =>
			typeof process.env[key] === "string" &&
			process.env[key]?.startsWith("op://"),
	);

const validateSecretRefs = (envNames: string[]): void => {
	const invalid: { name: string; message: string }[] = [];

	for (const envName of envNames) {
		const ref = process.env[envName];
		if (!ref) {
			continue;
		}

		try {
			Secrets.validateSecretReference(ref);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			invalid.push({ name: envName, message });
		}
	}

	// Throw an error if any secret references are invalid
	if (invalid.length > 0) {
		const details = invalid
			.map(({ name, message }) => `${name}: ${message}`)
			.join("; ");
		throw new Error(`Invalid secret reference(s): ${details}`);
	}
};

const setResolvedSecret = (
	envName: string,
	secretValue: string,
	shouldExportEnv: boolean,
): void => {
	core.info(`Populating variable: ${envName}`);

	if (shouldExportEnv) {
		core.exportVariable(envName, secretValue);
	} else {
		core.setOutput(envName, secretValue);
	}
	if (secretValue) {
		core.setSecret(secretValue);
	}
};

export const extractSecret = (
	envName: string,
	shouldExportEnv: boolean,
): void => {
	const ref = process.env[envName];
	if (!ref) {
		return;
	}

	const secretValue = read.parse(ref);
	if (secretValue === null || secretValue === undefined) {
		return;
	}

	setResolvedSecret(envName, secretValue, shouldExportEnv);
};

// Connect loads secrets via the 1Password CLI
const loadSecretsViaConnect = async (
	shouldExportEnv: boolean,
): Promise<void> => {
	setClientInfo({
		name: "1Password GitHub Action",
		id: "GHA",
		build: semverToInt(version),
	});

	// Load secrets from environment variables using 1Password CLI.
	// Iterate over them to find 1Password references, extract the secret values,
	// and make them available in the next steps either as step outputs or as environment variables.
	const res = await exec.getExecOutput(`sh -c "op env ls"`);

	if (res.stdout === "") {
		return;
	}

	const envs = res.stdout.replace(/\n+$/g, "").split(/\r?\n/);
	for (const envName of envs) {
		extractSecret(envName, shouldExportEnv);
	}
	if (shouldExportEnv) {
		core.exportVariable(envManagedVariables, envs.join());
	}
};

// Service Account loads secrets via the 1Password SDK
const loadSecretsViaServiceAccount = async (
	shouldExportEnv: boolean,
): Promise<void> => {
	const envs = getEnvVarNamesWithSecretRefs();
	if (envs.length === 0) {
		return;
	}

	validateSecretRefs(envs);

	const token = process.env[envServiceAccountToken];
	if (!token) {
		throw new Error(authErr);
	}

	// Authenticate with the 1Password SDK
	let client;
	try {
		client = await createClient({
			auth: token,
			integrationName: "1Password GitHub Action",
			integrationVersion: version,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Service account authentication failed: ${message}`);
	}

	for (const envName of envs) {
		const ref = process.env[envName];
		if (!ref) {
			continue;
		}

		// Resolve the secret value using the 1Password SDK
		// and make it available either as step outputs or as environment variables
		const secretValue = await client.secrets.resolve(ref);
		setResolvedSecret(envName, secretValue, shouldExportEnv);
	}

	if (shouldExportEnv) {
		core.exportVariable(envManagedVariables, envs.join());
	}
};

export const loadSecrets = async (shouldExportEnv: boolean): Promise<void> => {
	const isConnect = process.env[envConnectHost] && process.env[envConnectToken];

	if (isConnect) {
		await loadSecretsViaConnect(shouldExportEnv);
		return;
	}

	await loadSecretsViaServiceAccount(shouldExportEnv);
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
