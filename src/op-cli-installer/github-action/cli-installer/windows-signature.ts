import { execFile } from "child_process";
import { promisify } from "util";

import semver from "semver";

const execFileAsync = promisify(execFile);

// Identifying fields of 1Password's Authenticode signing cert for op.exe.
// See https://www.1password.dev/cli/verify.
export const WINDOWS_SIGNER_SUBJECT_CN = "Agilebits";
export const WINDOWS_ISSUER_CN_PREFIX = "Microsoft ID Verified CS AOC CA";
export const WINDOWS_PUBLISHER_EKU =
	"1.3.6.1.4.1.311.97.661420558.769123285.207353056.500447802";

// First op.exe version signed via Azure Trusted Signing (v2.31.0-beta.01,
// April 2025). Earlier versions are Sectigo-signed and verified via GPG.
export const AZURE_SIGNING_CUTOFF = "2.31.0-0";

export const isAzureSignedEra = (cliVersion: string): boolean => {
	try {
		const normalized = cliVersion
			.replace(/^v/, "")
			.replace(/-beta\.0*(\d+)/, "-beta.$1");
		return semver.gte(normalized, AZURE_SIGNING_CUTOFF);
	} catch {
		// Unrecognized version format — default to modern (strict) verification.
		return true;
	}
};

const defaultPowerShellRunner = async (script: string): Promise<string> => {
	const { stdout } = await execFileAsync("powershell.exe", [
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		script,
	]);
	return stdout;
};

// Authenticode check against 1Password's signing cert.
//
// Strict mode (default, for Azure Trusted Signing era): throws unless Status
// is Valid, signer is AgileBits, issuer is a Microsoft CS AOC CA, and the
// publisher EKU is present.
//
// Loose mode (for Sectigo era, pre-v2.31.0): only checks Status is Valid and
// signer is AgileBits. The Sectigo-issued cert has no Microsoft issuer and no
// publisher EKU, so the strict checks don't apply.
export const verifyAuthenticodeSignature = async (
	opExePath: string,
	runPowerShell: (script: string) => Promise<string> = defaultPowerShellRunner,
	strict = true,
): Promise<void> => {
	// Read the four Authenticode fields we validate below.
	const escapedPath = opExePath.replace(/'/g, "''");
	const script = [
		`$sig = Get-AuthenticodeSignature -FilePath '${escapedPath}'`,
		`"Status=$($sig.Status)"`,
		`"Subject=$($sig.SignerCertificate.Subject)"`,
		`"Issuer=$($sig.SignerCertificate.Issuer)"`,
		`$sig.SignerCertificate.EnhancedKeyUsageList | %{ "EKU=$($_.ObjectId)" }`,
	].join("; ");

	const output = await runPowerShell(script);
	// TEMPORARY DEBUG — remove before merging.
	console.info(`Authenticode raw output:\n${output}`);
	const outputLines = output.split("\n").map((l) => l.trim());

	const fieldValue = (prefix: string): string | undefined => {
		const matchingLine = outputLines.find((l) => l.startsWith(prefix));
		if (!matchingLine) {
			return undefined;
		}
		return matchingLine.slice(prefix.length);
	};

	// Reject unsigned or tampered binaries.
	const status = fieldValue("Status=");
	if (status !== "Valid") {
		throw new Error(
			`Authenticode status is ${status ?? "unknown"}, expected Valid.\nGet-AuthenticodeSignature output:\n${output}`,
		);
	}

	// Confirm the signer is AgileBits, not some other publisher.
	const subject = fieldValue("Subject=") ?? "";
	if (!subject.includes(`CN=${WINDOWS_SIGNER_SUBJECT_CN}`)) {
		throw new Error(
			`signer Subject (${subject}) does not contain CN=${WINDOWS_SIGNER_SUBJECT_CN}.`,
		);
	}

	// Loose mode (Sectigo era) stops here. Sectigo certs aren't issued by a
	// Microsoft CS AOC CA, so the strict issuer check below doesn't apply.
	if (!strict) {
		return;
	}

	// Confirm the cert was issued by Microsoft's expected code signing CA.
	const issuer = fieldValue("Issuer=") ?? "";
	if (!issuer.includes(`CN=${WINDOWS_ISSUER_CN_PREFIX}`)) {
		throw new Error(
			`issuer (${issuer}) does not contain CN=${WINDOWS_ISSUER_CN_PREFIX}.`,
		);
	}

	const ekus = outputLines
		.filter((l) => l.startsWith("EKU="))
		.map((l) => l.slice("EKU=".length));
	if (!ekus.includes(WINDOWS_PUBLISHER_EKU)) {
		throw new Error(
			`expected publisher EKU ${WINDOWS_PUBLISHER_EKU} not found in (${ekus.join(", ") || "none"}).`,
		);
	}
};
