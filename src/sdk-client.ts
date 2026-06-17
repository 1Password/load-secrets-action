import * as core from "@actions/core";
import { createClient } from "@1password/sdk";
import { version } from "../package.json";
import { envManagedVariables } from "./constants";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const getOIDCToken = async (audience: string): Promise<string> =>
	core.getIDToken(audience);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const loadSecretsFromSDK = async (
	workloadId: string,
	environmentId: string,
	integrationKey: string,
	shouldExportEnv: boolean,
): Promise<void> => {
	// Temporary fix: strip base64 padding from integrationKey — this will eventually be handled by the SDK core itself
	const customerManagedSecret = integrationKey.replace(/=+$/, "");
	core.setSecret(customerManagedSecret);

	const client = await createClient({
		integrationName: "1Password GitHub Action",
		integrationVersion: version,
		oidcFetcher: getOIDCToken,
		workloadDetails: {
			customerManagedSecret,
			workloadUuid: workloadId,
		},
	});

	core.info("Authenticated with Workload Identity.");

	const { variables } = await client.environments.getVariables(environmentId);

	const envNames: string[] = [];
	for (const { name, value } of variables) {
		core.info(`Populating variable: ${name}`);
		if (shouldExportEnv) {
			core.exportVariable(name, value);
		} else {
			core.setOutput(name, value);
		}
		if (value) {
			core.setSecret(value);
		}
		envNames.push(name);
	}

	if (shouldExportEnv && envNames.length > 0) {
		core.exportVariable(envManagedVariables, envNames.join());
	}
};
