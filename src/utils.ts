import fs from "node:fs";
import dotenv from "dotenv";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo, semverToInt } from "@1password/op-js";
import { version } from "../package.json";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envServiceAccountToken,
	envManagedVariables,
} from "./constants";

const envFileKeysEnvVar = "OP_KEYS_JSON";

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

export const extractSecret = (
	envName: string,
	shouldExportEnv: boolean,
): void => {
	core.info(`Populating variable: ${envName}`);

	const ref = process.env[envName];
	if (!ref) {
		return;
	}

	const secretValue = read.parse(ref);
	if (secretValue === null || secretValue === undefined) {
		return;
	}

	if (shouldExportEnv) {
		core.exportVariable(envName, secretValue);
	} else {
		core.setOutput(envName, secretValue);
	}
	// Skip setSecret for empty strings to avoid the warning:
	// "Can't add secret mask for empty string in ##[add-mask] command."
	if (secretValue) {
		core.setSecret(secretValue);
	}
};

const exportResolvedSecret = (
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
	// Skip setSecret for empty strings to avoid the warning:
	// "Can't add secret mask for empty string in ##[add-mask] command."
	if (secretValue) {
		core.setSecret(secretValue);
	}
};

export const loadSecretsFromEnvFileBatched = async (
	envFile: string,
	shouldExportEnv: boolean,
): Promise<void> => {
	const envFileBuf = fs.readFileSync(envFile);
	const envFileVars = dotenv.parse(envFileBuf);
	const envNames = Object.keys(envFileVars);
	if (envNames.length === 0) {
		return;
	}

	// Pass User-Agent Information to the 1Password CLI
	setClientInfo({
		name: "1Password GitHub Action",
		id: "GHA",
		build: semverToInt(version),
	});

	// Resolve all secrets in a single `op run --env-file` call, then emit just the
	// keys we care about as JSON. `silent: true` ensures values never hit logs.
	const nodeScript =
		'const keys=JSON.parse(process.env.OP_KEYS_JSON||"[]");const out={};for(const k of keys){out[k]=process.env[k]??"";}process.stdout.write(JSON.stringify(out));';

	const res = await exec.getExecOutput(
		"op",
		[
			"run",
			`--env-file=${envFile}`,
			"--no-masking",
			"--",
			"node",
			"-e",
			nodeScript,
		],
		{
			silent: true,
			env: {
				...process.env,
				[envFileKeysEnvVar]: JSON.stringify(envNames),
			},
		},
	);

	let resolved: Record<string, string> = {};
	try {
		resolved = JSON.parse(res.stdout) as Record<string, string>;
	} catch {
		throw new Error("Failed to parse secrets resolved from 1Password CLI.");
	}

	for (const envName of envNames) {
		const secretValue = resolved[envName] ?? "";
		exportResolvedSecret(envName, secretValue, shouldExportEnv);
	}

	if (shouldExportEnv) {
		core.exportVariable(envManagedVariables, envNames.join());
	}
};

export const loadSecrets = async (shouldExportEnv: boolean): Promise<void> => {
	// Pass User-Agent Information to the 1Password CLI
	setClientInfo({
		name: "1Password GitHub Action",
		id: "GHA",
		build: semverToInt(version),
	});

	// Load secrets from environment variables using 1Password CLI.
	// Iterate over them to find 1Password references, extract the secret values,
	// and make them available in the next steps either as step outputs or as environment variables.
	const res = await exec.getExecOutput("op", ["env", "ls"]);

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
