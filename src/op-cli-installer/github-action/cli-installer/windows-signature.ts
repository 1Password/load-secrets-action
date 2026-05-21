import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Identifying field of 1Password's Authenticode signing cert for op.exe.
// See https://www.1password.dev/cli/verify.
export const WINDOWS_SIGNER_SUBJECT_CN = "Agilebits";

const defaultPowerShellRunner = async (script: string): Promise<string> => {
	const { stdout } = await execFileAsync("powershell.exe", [
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		script,
	]);
	return stdout;
};

// Verifies op.exe's Authenticode signature against 1Password's signing cert.
// Throws unless the signature is cryptographically valid and the signer is
// AgileBits.
export const verifyAuthenticodeSignature = async (
	opExePath: string,
	runPowerShell: (script: string) => Promise<string> = defaultPowerShellRunner,
): Promise<void> => {
	const escapedPath = opExePath.replace(/'/g, "''");
	const script = [
		`$sig = Get-AuthenticodeSignature -FilePath '${escapedPath}'`,
		`"Status=$($sig.Status)"`,
		`"Subject=$($sig.SignerCertificate.Subject)"`,
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
};
