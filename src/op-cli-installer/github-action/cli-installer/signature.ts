import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import * as tc from "@actions/tool-cache";

const execFileAsync = promisify(execFile);

// See https://www.1password.dev/cli/verify.
export const APPLE_DEVELOPER_TEAM_ID = "2BUA8C4S2C";

// Append-only: old certs stay listed so historical `op` versions still verify.
// See https://www.1password.dev/cli/verify.
export const ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS = [
	"CAB578061B0209FB70934DA344EF6FEBCD3279B1C074C54B0D7D555743B9D89",
	"141DD87B2B231211F1440849798007DF621DE6EB3DAB985BC964EE9704C4A1C",
];

// 1Password's code-signing GPG key. Used to verify the detached `op.sig`
// inside the Linux release zip. See https://www.1password.dev/cli/verify.
export const ONEPASSWORD_GPG_KEY_FINGERPRINT =
	"3FEF9748469ADBE15DA7CA80AC2D62742012EA2";
export const ONEPASSWORD_GPG_KEY_URL =
	"https://downloads.1password.com/linux/keys/1password.asc";

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
	let stdout: string;
	try {
		stdout = await runPkgutil(pkgPath);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(
			`1Password CLI signature verification failed: pkgutil --check-signature errored: ${message}`,
		);
	}

	// Get the certificate chain section of the pkgutil output, which contains the relevant info about the signer cert.
	// If this is missing, the output is in an unexpected format and we can't verify the signature.
	const signerSection = extractSignerCertSection(stdout);
	if (!signerSection) {
		throw new Error(
			`1Password CLI signature verification failed: could not locate certificate chain in pkgutil output.\npkgutil output:\n${stdout}`,
		);
	}

	// Check that the signer cert is under the expected Apple Developer Team ID.
	if (!signerSection.includes(`(${APPLE_DEVELOPER_TEAM_ID})`)) {
		throw new Error(
			`1Password CLI signature verification failed: expected developer team ID ${APPLE_DEVELOPER_TEAM_ID} not found in signer certificate.\npkgutil output:\n${stdout}`,
		);
	}

	// Parse the signer cert's SHA-256 fingerprint and check it against the allowlist.
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

const defaultGpgRunner = async (args: readonly string[]): Promise<string> => {
	const { stdout } = await execFileAsync("gpg", args);
	return stdout;
};

const defaultKeyDownloader = async (url: string): Promise<string> =>
	tc.downloadTool(url);

// Throws unless `op` carries a valid GPG signature from the pinned 1Password
// key.
export const verifyLinuxSignature = async (
	opPath: string,
	sigPath: string,
	runGpg: (args: readonly string[]) => Promise<string> = defaultGpgRunner,
	downloadKey: (url: string) => Promise<string> = defaultKeyDownloader,
): Promise<void> => {
	const gpgHome = fs.mkdtempSync(path.join(os.tmpdir(), "op-verify-"));
	try {
		const keyPath = await downloadKey(ONEPASSWORD_GPG_KEY_URL);
		const baseArgs = ["--homedir", gpgHome, "--batch", "--no-tty"];

		try {
			await runGpg([...baseArgs, "--import", keyPath]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(
				`1Password CLI signature verification failed: gpg --import failed: ${message}`,
			);
		}

		const keyringListing = await runGpg([
			...baseArgs,
			"--list-keys",
			"--with-colons",
		]);
		if (!keyringListing.includes(ONEPASSWORD_GPG_KEY_FINGERPRINT)) {
			throw new Error(
				`1Password CLI signature verification failed: downloaded GPG key does not match expected fingerprint ${ONEPASSWORD_GPG_KEY_FINGERPRINT}. The key endpoint may have been tampered with.\nKeyring contents:\n${keyringListing}`,
			);
		}

		try {
			await runGpg([...baseArgs, "--verify", sigPath, opPath]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(
				`1Password CLI signature verification failed: gpg --verify rejected the signature: ${message}`,
			);
		}
	} finally {
		fs.rmSync(gpgHome, { recursive: true, force: true });
	}
};
