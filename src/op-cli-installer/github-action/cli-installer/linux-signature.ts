import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import * as tc from "@actions/tool-cache";

const execFileAsync = promisify(execFile);

// 1Password's code-signing GPG key. Used to verify the detached `op.sig`
// inside the Linux release zip. See https://www.1password.dev/cli/verify.
export const ONEPASSWORD_GPG_KEY_FINGERPRINT =
	"3FEF9748469ADBE15DA7CA80AC2D62742012EA22";
export const ONEPASSWORD_GPG_KEY_URL =
	"https://downloads.1password.com/linux/keys/1password.asc";

const defaultGpgRunner = async (args: readonly string[]): Promise<string> => {
	const { stdout } = await execFileAsync("gpg", args);
	return stdout;
};

const defaultKeyDownloader = async (url: string): Promise<string> =>
	tc.downloadTool(url);

// Throws unless the binary at opPath carries a valid GPG signature (at
// sigPath) from the pinned 1Password key.
export const verifyLinuxSignature = async (
	opPath: string,
	sigPath: string,
	runGpg: (args: readonly string[]) => Promise<string> = defaultGpgRunner,
	downloadKey: (url: string) => Promise<string> = defaultKeyDownloader,
): Promise<void> => {
	const gpgHome = fs.mkdtempSync(path.join(os.tmpdir(), "op-verify-"));
	try {
		// Fetch the 1Password public key so gpg can import it.
		const keyPath = await downloadKey(ONEPASSWORD_GPG_KEY_URL);
		const baseArgs = ["--homedir", gpgHome, "--batch", "--no-tty"];

		await runGpg([...baseArgs, "--import", keyPath]);

		// Confirm gpg imported the pinned key.
		const keyringListing = await runGpg([
			...baseArgs,
			"--list-keys",
			"--with-colons",
		]);
		if (!keyringListing.includes(`${ONEPASSWORD_GPG_KEY_FINGERPRINT}:`)) {
			throw new Error(
				`1Password CLI signature verification failed: downloaded GPG key does not match expected fingerprint ${ONEPASSWORD_GPG_KEY_FINGERPRINT}. The key endpoint may have been tampered with.\nKeyring contents:\n${keyringListing}`,
			);
		}

		await runGpg([...baseArgs, "--verify", sigPath, opPath]);
	} finally {
		fs.rmSync(gpgHome, { recursive: true, force: true });
	}
};
