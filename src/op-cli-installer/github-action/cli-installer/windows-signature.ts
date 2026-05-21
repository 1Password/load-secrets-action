import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Identifying fields of 1Password's Authenticode signing cert for op.exe.
// See https://www.1password.dev/cli/verify.
export const WINDOWS_SIGNER_SUBJECT_CN = "Agilebits";
export const WINDOWS_ISSUER_CN = "Microsoft ID Verified CS AOC CA 02";
export const WINDOWS_PUBLISHER_EKU =
	"1.3.6.1.4.1.311.97.661420558.769123285.207353056.500447802";

const defaultPowerShellRunner = async (script: string): Promise<string> => {
	const { stdout } = await execFileAsync("powershell.exe", [
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		script,
	]);
	return stdout;
};

// Throws unless op.exe at opExePath carries a valid Authenticode signature
// from 1Password (AgileBits) issued by Microsoft, with the publisher EKU.
export const verifyWindowsBinarySignature = async (
	opExePath: string,
	runPowerShell: (script: string) => Promise<string> = defaultPowerShellRunner,
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
			`1Password CLI signature verification failed: Authenticode status is ${status ?? "unknown"}, expected Valid.\nGet-AuthenticodeSignature output:\n${output}`,
		);
	}

	// Confirm the signer is AgileBits, not some other publisher.
	const subject = fieldValue("Subject=") ?? "";
	if (!subject.includes(`CN=${WINDOWS_SIGNER_SUBJECT_CN},`)) {
		throw new Error(
			`1Password CLI signature verification failed: signer Subject (${subject}) does not contain CN=${WINDOWS_SIGNER_SUBJECT_CN}.`,
		);
	}

	// Confirm the cert was issued by Microsoft's expected code signing CA.
	const issuer = fieldValue("Issuer=") ?? "";
	if (!issuer.includes(`CN=${WINDOWS_ISSUER_CN},`)) {
		throw new Error(
			`1Password CLI signature verification failed: issuer (${issuer}) does not contain CN=${WINDOWS_ISSUER_CN}.`,
		);
	}

	const ekus = outputLines
		.filter((l) => l.startsWith("EKU="))
		.map((l) => l.slice("EKU=".length));
	if (!ekus.includes(WINDOWS_PUBLISHER_EKU)) {
		throw new Error(
			`1Password CLI signature verification failed: expected publisher EKU ${WINDOWS_PUBLISHER_EKU} not found in (${ekus.join(", ") || "none"}).`,
		);
	}
};
