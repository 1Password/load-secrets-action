import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// See https://www.1password.dev/cli/verify.
export const APPLE_DEVELOPER_TEAM_ID = "2BUA8C4S2C";

// Append-only: old certs stay listed so historical `op` versions still verify.
// See https://www.1password.dev/cli/verify.
export const ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS = [
	"CAB578061B0209FB70934DA344EF6FEBCD3279B1C074C54B0D7D555743B9D89F",
	"141DD87B2B231211F1440849798007DF621DE6EB3DAB985BC964EE9704C4A1C1",
];

const defaultPkgutilRunner = async (pkgPath: string): Promise<string> => {
	const { stdout } = await execFileAsync("pkgutil", [
		"--check-signature",
		pkgPath,
	]);
	return stdout;
};

// Returns just entry 1 (the signer cert) from the chain.
const extractSignerCertSection = (pkgutilOutput: string): string | null => {
	const chainStart = pkgutilOutput.indexOf("Certificate Chain:");
	if (chainStart === -1) {
		return null;
	}
	const chainBody = pkgutilOutput.slice(chainStart);
	const secondCert = /\n\s*2\.\s/.exec(chainBody);
	return secondCert ? chainBody.slice(0, secondCert.index) : chainBody;
};

const parseSignerFingerprint = (signerSection: string): string | null => {
	const match = /SHA256 Fingerprint:\s*\n((?:[ \t]+[0-9A-Fa-f ]+\n?)+)/.exec(
		signerSection,
	);
	const captured = match?.[1];
	return captured ? captured.replace(/\s+/g, "").toUpperCase() : null;
};

// Hard-fails if the .pkg at pkgPath is not signed by AgileBits Inc.
// (2BUA8C4S2C) with a certificate on the allowlist above. Must run
// before any extraction of the .pkg contents.
export const verifyMacOsPackageSignature = async (
	pkgPath: string,
	runPkgutil: (pkgPath: string) => Promise<string> = defaultPkgutilRunner,
): Promise<void> => {
	const stdout = await runPkgutil(pkgPath);

	const signerSection = extractSignerCertSection(stdout);
	if (!signerSection) {
		throw new Error(
			`1Password CLI signature verification failed: could not locate certificate chain in pkgutil output.\npkgutil output:\n${stdout}`,
		);
	}

	if (!signerSection.includes(`(${APPLE_DEVELOPER_TEAM_ID})`)) {
		throw new Error(
			`1Password CLI signature verification failed: expected developer team ID ${APPLE_DEVELOPER_TEAM_ID} not found in signer certificate.\npkgutil output:\n${stdout}`,
		);
	}

	const signerFingerprint = parseSignerFingerprint(signerSection);
	if (!signerFingerprint) {
		throw new Error(
			`1Password CLI signature verification failed: could not parse signer cert SHA-256 fingerprint.\npkgutil output:\n${stdout}`,
		);
	}

	if (!ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS.includes(signerFingerprint)) {
		throw new Error(
			`1Password CLI signature verification failed: signer cert SHA-256 fingerprint ${signerFingerprint} is not on the allowlist. ` +
				"If 1Password has rotated their installer signing cert, this action needs to be updated — please file an issue at https://github.com/1Password/load-secrets-action/issues.",
		);
	}
};
