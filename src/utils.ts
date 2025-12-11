import { writeFileSync, readFileSync, unlinkSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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

export const isPkcsPrivateKey = (pem: string): boolean =>
	pem.includes("-----BEGIN PRIVATE KEY-----");

export const isOpenSshPrivateKey = (pem: string): boolean =>
	pem.includes("-----BEGIN OPENSSH PRIVATE KEY-----");

/**
 * Detects if a PEM string contains an encrypted private key.
 * Encrypted keys cannot be converted without a passphrase.
 *
 * Indicators of encryption:
 * - "-----BEGIN ENCRYPTED PRIVATE KEY-----" header
 * - "Proc-Type: 4,ENCRYPTED" in the PEM headers (case-insensitive)
 * - "DEK-Info:" in the PEM headers (encryption algorithm info)
 *
 * @param pem - The PEM-encoded string to check
 * @returns true if the string appears to be an encrypted private key
 */
export const isEncryptedPem = (pem: string): boolean => {
	// Check only the first few lines for encryption markers
	const header = pem.split(/\r?\n/).slice(0, 8).join("\n");
	return (
		header.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----") ||
		/Proc-Type:\s*4\s*,\s*ENCRYPTED/i.test(header) ||
		/DEK-Info:/i.test(header)
	);
};

/**
 * Converts a PKCS8/PKCS1 format SSH private key to OpenSSH format using ssh-keygen.
 *
 * This function:
 * 1. Writes the key to a temporary file with secure permissions (0600)
 * 2. Uses ssh-keygen to convert the key in-place to OpenSSH format
 * 3. Reads the converted key back
 * 4. Cleans up the temporary file
 *
 * Security considerations:
 * - Temp file has 0600 permissions to prevent unauthorized access
 * - ssh-keygen output is suppressed to prevent key leakage in logs
 * - Temp file is always deleted, even if conversion fails
 *
 * @param pkcsKey - The PKCS-format private key to convert
 * @returns The OpenSSH-format private key
 * @throws Error if ssh-keygen is not available or conversion fails
 */
export const convertPkcsToOpenSsh = async (
	pkcsKey: string,
): Promise<string> => {
	const tempFileName = `op-ssh-key-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	const tempFilePath = join(tmpdir(), tempFileName);

	try {
		// Write the PKCS key to a temporary file with secure permissions
		writeFileSync(tempFilePath, pkcsKey, { mode: 0o600 });

		// Ensure permissions are set correctly (some systems may not respect mode in writeFileSync)
		chmodSync(tempFilePath, 0o600);

		// Convert the key to OpenSSH format using ssh-keygen
		// -p: Change passphrase of a private key file
		// -f: Specifies the filename of the key file
		// -N "": New passphrase (empty string for no passphrase)
		// -P "": Old passphrase (empty string for no passphrase)
		// This rewrites the file in OpenSSH format by default on modern OpenSSH
		const result = await exec.getExecOutput(
			"ssh-keygen",
			["-p", "-f", tempFilePath, "-N", "", "-P", ""],
			{
				silent: true, // Prevent key material from appearing in logs
				ignoreReturnCode: false,
			},
		);

		if (result.exitCode !== 0) {
			throw new Error(
				`ssh-keygen conversion failed with exit code ${result.exitCode}`,
			);
		}

		// Read the converted key
		const convertedKey = readFileSync(tempFilePath, "utf-8");

		return convertedKey;
	} finally {
		// Always clean up the temporary file, even if an error occurred
		try {
			unlinkSync(tempFilePath);
		} catch (cleanupError) {
			// Log cleanup failure but don't throw - the conversion may have succeeded
			core.warning(
				`Failed to clean up temporary key file at ${tempFilePath}: ${cleanupError}`,
			);
		}
	}
};

/**
 * Extracts a secret from 1Password and optionally converts SSH keys to OpenSSH format.
 *
 * This function:
 * 1. Retrieves the secret value using the 1Password CLI
 * 2. Optionally converts PKCS-format SSH keys to OpenSSH format
 * 3. Exports the secret as an environment variable or step output
 * 4. Marks the secret as sensitive to prevent it from appearing in logs
 *
 * SSH Key Conversion:
 * When convert-ssh-keys is enabled, this function will automatically detect
 * PKCS-format SSH private keys and convert them to OpenSSH format. This is
 * necessary because 1Password stores SSH keys in PKCS8/PKCS1 format, but
 * many tools (like ssh, scp, etc.) expect OpenSSH format.
 *
 * The conversion is skipped for:
 * - Keys already in OpenSSH format
 * - Encrypted keys (require a passphrase)
 * - Non-SSH PEM data (certificates, etc.)
 *
 * @param envName - The environment variable name containing the secret reference
 * @param shouldExportEnv - Whether to export as environment variable (true) or step output (false)
 * @param shouldConvertSshKeys - Whether to convert PKCS SSH keys to OpenSSH format
 */
export const extractSecret = async (
	envName: string,
	shouldExportEnv: boolean,
	shouldConvertSshKeys: boolean,
): Promise<void> => {
	core.info(`Populating variable: ${envName}`);

	const ref = process.env[envName];
	if (!ref) {
		return;
	}

	const secretValue = read.parse(ref);
	if (!secretValue) {
		return;
	}

	// Mark the secret as sensitive immediately to prevent any accidental leakage during conversion
	core.setSecret(secretValue);

	let finalValue = secretValue;

	// Convert SSH keys if enabled and applicable
	if (shouldConvertSshKeys) {
		// Check if this is a PKCS private key that needs conversion
		const needsConversion =
			isPkcsPrivateKey(secretValue) &&
			!isOpenSshPrivateKey(secretValue) &&
			!isEncryptedPem(secretValue);

		if (needsConversion) {
			try {
				core.info(`Converting ${envName} from PKCS to OpenSSH format...`);
				finalValue = await convertPkcsToOpenSsh(secretValue);
				core.info(`Successfully converted ${envName} to OpenSSH format`);
			} catch (error) {
				// If conversion fails, log a warning but continue with the original value
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				core.warning(
					`Failed to convert SSH key ${envName} to OpenSSH format: ${errorMessage}. Using original PKCS format.`,
				);
				// Keep finalValue as secretValue
			}
		} else if (isEncryptedPem(secretValue)) {
			core.warning(
				`Skipping conversion for ${envName}: encrypted private keys require a passphrase`,
			);
		}
	}

	// Export the secret as environment variable or step output
	if (shouldExportEnv) {
		core.exportVariable(envName, finalValue);
	} else {
		core.setOutput(envName, finalValue);
	}

	// Mark the final value as sensitive as well (if conversion changed it)
	if (finalValue !== secretValue) {
		core.setSecret(finalValue);
	}
};

/**
 * Loads secrets from 1Password and makes them available to the workflow.
 *
 * This function:
 * 1. Lists all environment variables that contain 1Password secret references
 * 2. Extracts each secret value from 1Password
 * 3. Optionally converts SSH keys to OpenSSH format
 * 4. Makes secrets available as environment variables or step outputs
 *
 * @param shouldExportEnv - Whether to export secrets as environment variables (true) or step outputs (false)
 * @param shouldConvertSshKeys - Whether to convert PKCS SSH keys to OpenSSH format
 */
export const loadSecrets = async (
	shouldExportEnv: boolean,
	shouldConvertSshKeys: boolean,
): Promise<void> => {
	// Pass User-Agent Information to the 1Password CLI
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

	// Process secrets sequentially to ensure proper async handling
	for (const envName of envs) {
		await extractSecret(envName, shouldExportEnv, shouldConvertSshKeys);
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
