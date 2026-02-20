import * as core from "@actions/core";
import { read } from "@1password/op-js";
import { createClient, Secrets } from "@1password/sdk";
import { OnePasswordConnect, FullItem, OPConnect } from "@1password/connect";
import { version } from "../package.json";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envServiceAccountToken,
	envManagedVariables,
} from "./constants";

// #region Op ref parsing
interface ParsedOpRef {
	vault: string;
	item: string;
	section: string | undefined;
	field: string;
}

const parseOpRef = (ref: string): ParsedOpRef => {
	// Safety check: refs are validated by validateSecretRefs before this runs
	// this guards against parseOpRef being called directly with invalid input
	if (!ref.startsWith("op://")) {
		throw new Error(`Invalid op reference: ${ref}`);
	}

	const segments = ref
		.slice("op://".length)
		.split("/")
		.map((s) => decodeURIComponent(s));

	if (segments.length < 3 || segments.length > 4) {
		throw new Error(
			`Invalid op reference: use op://<vault>/<item>/<field> or op://<vault>/<item>/<section>/<field>. Got: ${ref}`,
		);
	}

	const vault = segments[0] ?? "";
	if (!vault) {
		throw new Error(`Invalid op reference: vault is required`);
	}

	const item = segments[1] ?? "";
	if (!item) {
		throw new Error(`Invalid op reference: item is required`);
	}

	// Last segment is always the field
	const field = segments[segments.length - 1] ?? "";
	if (!field) {
		throw new Error(`Invalid op reference: field is required`);
	}

	// Second to last segment is the section if it exists
	let section: string | undefined;
	if (segments.length === 4) {
		section = segments[2];
		if (!section) {
			throw new Error(`Invalid op reference: section is required when using 4 path segments`);
		}
	}

	return {
		vault,
		item,
		field,
		section,
	};
}
// #endregion

// #region Connect item resolution
const getSecretFromConnectItem = async (
	client: OPConnect,
	item: FullItem,
	parsed: ParsedOpRef,
): Promise<string> => {
	const sectionIds = parsed.section ? findSectionIdsByQuery(item.sections, parsed.section) : [];
	const { fieldValue, fileId } = findMatchingFieldAndFile(item, parsed.field, sectionIds);

	if (fieldValue !== undefined) {
		return fieldValue;
	}

	// If a file was found, get the content of the file
	if (fileId) {
		const content = await client.getFileContent(
			parsed.vault,
			parsed.item,
			fileId,
		);
		return content;
	}

	if (parsed.section) {
		throw new Error(
			`could not find field or file ${parsed.field} in section ${parsed.section} on item ${parsed.item} in vault ${parsed.vault}`,
		);
	}

	throw new Error(
		`could not find field or file ${parsed.field} on item ${parsed.item} in vault ${parsed.vault}`,
	);
}

const findSectionIdsByQuery = (
	sections: FullItem["sections"],
	sectionQuery: string | undefined,
): string[] => {
	// If no sections were returned with the item throw an error
	if (!sections || sections.length === 0) {
		throw new Error(
			`section ${sectionQuery} could not be found in specified item`,
		);
	}

	const ids = sections
	.filter((s) => s.id === sectionQuery || s.label === sectionQuery)
	.map((s) => s.id!)
	.filter(Boolean);

	// If no sections were found with the given query throw an error
	if (ids.length === 0) {
		throw new Error(
			`section ${sectionQuery} could not be found in specified item`,
		);
	}

	return ids;
};

const findMatchingFieldAndFile = (
	item: FullItem,
	fieldOrFileQuery: string,
	sectionIds: string[],
): { fieldValue?: string; fileId?: string } => {
	const errMultiple = `multiple fields ${fieldOrFileQuery} that match the provided reference have been found`;

	const fields = item.fields ?? [];
	const files = item.files ?? [];
	const sectionFilter = sectionIds.length > 0;

	let matchedField: (typeof fields)[0] | undefined;
	let matchedFile: (typeof files)[0] | undefined;

	if (sectionFilter) {
		// Filter fields by section
		const matchingFields = fields.filter((f) => {
			const fieldIdOrLabelMatchesQuery = f.id === fieldOrFileQuery || f.label === fieldOrFileQuery;
			const sectionId = f.section?.id;
			const fieldSectionIsInRefSections = sectionId !== null && sectionId !== undefined && sectionIds.includes(sectionId);
			return fieldIdOrLabelMatchesQuery && fieldSectionIsInRefSections;
		});

		// If multiple fields match the query throw an error otherwise set first matching field
		if (matchingFields.length > 1) {
			throw new Error(errMultiple);
		}
		matchedField = matchingFields[0];

		const matchingFiles = files.filter((f) => {
			const fileIdOrNameMatchesQuery = f.id === fieldOrFileQuery || f.name === fieldOrFileQuery;
			const sectionId = f.section?.id;
			const fileSectionIsInRefSections = sectionId !== null && sectionId !== undefined && sectionIds.includes(sectionId);
			return fileIdOrNameMatchesQuery && fileSectionIsInRefSections;
		});

		// If multiple files match the query throw an error otherwise set first matching file
		if (matchingFiles.length > 1) {
			throw new Error(errMultiple);
		}
		matchedFile = matchingFiles[0];
	} else {
		const matchingFields = fields.filter((f) => {
			const fieldIdOrLabelMatchesQuery = f.id === fieldOrFileQuery || f.label === fieldOrFileQuery;
			const fieldHasNoSection = (f.section?.id === null || f.section?.id === undefined);
			return fieldIdOrLabelMatchesQuery && fieldHasNoSection;
		});

		// If multiple fields match the query throw an error otherwise set first matching field
		if (matchingFields.length > 1) {
			throw new Error(errMultiple);
		}
		matchedField = matchingFields[0];

		// If no field was found with no section, find a field in any section
		if (!matchedField) {
			const matchingFieldsInAnySection = fields.filter((f) => {
				const fieldIdOrLabelMatchesQuery = f.id === fieldOrFileQuery || f.label === fieldOrFileQuery;
				return fieldIdOrLabelMatchesQuery;
			});

			if (matchingFieldsInAnySection.length > 1) {
				throw new Error(errMultiple);
			}
			matchedField = matchingFieldsInAnySection[0];
		}

		const matchingFiles = files.filter((f) => {
			const fileIdOrNameMatchesQuery = f.id === fieldOrFileQuery || f.name === fieldOrFileQuery;
			const fileHasNoSection = (f.section?.id === null || f.section?.id === undefined);
			return fileIdOrNameMatchesQuery && fileHasNoSection;
		});

		// If multiple files match the query throw an error otherwise set first matching file
		if (matchingFiles.length > 1) {
			throw new Error(errMultiple);
		}
		matchedFile = matchingFiles[0];

		// If no file was found with no section, find a file in any section
		if (!matchedFile) {
			const matchingFilesInAnySection = files.filter((f) => {
				const fileIdOrNameMatchesQuery = f.id === fieldOrFileQuery || f.name === fieldOrFileQuery;
				return fileIdOrNameMatchesQuery;
			});

			if (matchingFilesInAnySection.length > 1) {
				throw new Error(errMultiple);
			}
			matchedFile = matchingFilesInAnySection[0];
		}
	}

	if (matchedField && matchedFile) {
		throw new Error(
			`you cannot query fields/files that are identically named.`,
		);
	}

	if (matchedField) {
		if (matchedField.value === undefined || matchedField.value === null) {
			throw new Error(
				`field ${fieldOrFileQuery} has no value in specified item`,
			);
		}
		return { fieldValue: matchedField.value };
	}

	if (matchedFile?.id) {
		const fileId = matchedFile.id;
		return { fileId };
	}

	return {};
}
// #endregion

// #region Shared helpers and auth
const getEnvVarNamesWithSecretRefs = (): string[] =>
	Object.keys(process.env).filter(
		(key) =>
			typeof process.env[key] === "string" &&
			process.env[key]?.startsWith("op://"),
	);

const validateSecretRefs = (envNames: string[]): void => {
	const invalid: string[] = [];

	for (const envName of envNames) {
		const ref = process.env[envName];
		if (!ref) {
			continue;
		}

		try {
			Secrets.validateSecretReference(ref);
		} catch {
			invalid.push(envName);
		}
	}

	// Throw an error if any secret references are invalid
	if (invalid.length > 0) {
		const names = invalid.join(", ");
		throw new Error(`Invalid secret reference(s): ${names}`);
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
// #endregion

// #region Load secrets
// Connect loads secrets via the Connect JS SDK
const loadSecretsViaConnect = async (
	shouldExportEnv: boolean,
): Promise<void> => {
	const envs = getEnvVarNamesWithSecretRefs();
	if (envs.length === 0) {
		return;
	}

	validateSecretRefs(envs);

	const host = process.env[envConnectHost];
	const token = process.env[envConnectToken];
	if (!host || !token) {
		throw new Error(authErr);
	}

	// Authenticate with the Connect SDK
	let client;
	try {
		client = OnePasswordConnect({
			// eslint-disable-next-line @typescript-eslint/naming-convention
			serverURL: host,
			token,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Connect authentication failed: ${message}`);
	}

	for (const envName of envs) {
		const ref = process.env[envName];
		if (!ref) {
			continue;
		}

		// Parse the op ref and get the item from the Connect SDK
		const parsed = parseOpRef(ref);
		const item = await client.getItem(parsed.vault, parsed.item);

		// Get the secret value from the item as Connect returns a full item object
		const secretValue = await getSecretFromConnectItem(client, item, parsed);
		setResolvedSecret(envName, secretValue, shouldExportEnv);
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
// #endregion
