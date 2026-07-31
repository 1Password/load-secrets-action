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
	envWorkloadId,
	envEnvironmentId,
	envIntegrationKey,
} from "./constants";

export interface WorkloadIdentityConfig {
	workloadId: string;
	environmentId: string;
	integrationKey: string;
}

// Returns the Workload Identity configuration when all variables are set,
// or null when none are set (so the CLI auth path can be used instead).
// Throws if the configuration is only partially set, or if it is combined
// with the CLI auth methods (Connect / service account).
export const getWorkloadIdentityConfig = (): WorkloadIdentityConfig | null => {
	const workloadId = process.env[envWorkloadId];
	const environmentId = process.env[envEnvironmentId];
	const integrationKey = process.env[envIntegrationKey];

	// None set: fall back to the CLI auth path.
	if (!workloadId && !environmentId && !integrationKey) {
		return null;
	}

	// Some but not all set: configuration is incomplete.
	if (!workloadId || !environmentId || !integrationKey) {
		throw new Error(
			`Incomplete Workload Identity configuration. To use Workload Identity, set all of ${envWorkloadId}, ${envEnvironmentId}, and ${envIntegrationKey}.`,
		);
	}

	// Workload Identity is fully configured, so it must not be combined with the
	// CLI auth methods (Connect / service account), which are mutually exclusive.
	if (
		process.env[envConnectHost] ||
		process.env[envConnectToken] ||
		process.env[envServiceAccountToken]
	) {
		throw new Error(
			`Conflicting authentication configuration: Workload Identity cannot be combined with Connect (${envConnectHost}/${envConnectToken}) or a service account (${envServiceAccountToken}). Set only one authentication method.`,
		);
	}

	return { workloadId, environmentId, integrationKey };
};

// Whether CLI authentication (1Password Connect or a service account) is
// configured via environment variables.
export const hasCliAuth = (): boolean =>
	Boolean(
		(process.env[envConnectHost] && process.env[envConnectToken]) ||
			process.env[envServiceAccountToken],
	);

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

export const loadSecrets = async (shouldExportEnv: boolean): Promise<void> => {
	// Strip any prerelease suffix; semverToInt only accepts MAJOR.MINOR.PATCH.
	const [releaseVersion] = version.split("-");
	setClientInfo({
		name: "1Password GitHub Action",
		id: "GHA",
		build: semverToInt(releaseVersion ?? version),
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
