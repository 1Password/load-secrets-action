import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// 1Password's code-signing GPG key fingerprint. See
// https://www.1password.dev/cli/verify.
export const ONEPASSWORD_GPG_KEY_FINGERPRINT =
	"3FEF9748469ADBE15DA7CA80AC2D62742012EA22";

// Bundled 1Password code-signing public key `linux-signing-key.asc` in
// this directory. Bundled to avoid a runtime keyserver/URL dependency.
// Source: https://downloads.1password.com/linux/keys/1password.asc
const ONEPASSWORD_GPG_PUBLIC_KEY_PATH = path.join(
	__dirname,
	"linux-signing-key.asc",
);

const defaultGpgRunner = async (args: readonly string[]): Promise<string> => {
	const { stdout } = await execFileAsync("gpg", args);
	return stdout;
};

// Throws unless the binary at opPath carries a valid GPG signature (at
// sigPath) from the pinned 1Password key. The key is bundled with the action
export const verifyLinuxSignature = async (
	opPath: string,
	sigPath: string,
	runGpg: (args: readonly string[]) => Promise<string> = defaultGpgRunner,
): Promise<void> => {
	const gpgHome = fs.mkdtempSync(path.join(os.tmpdir(), "op-verify-"));
	try {
		const baseArgs = ["--homedir", gpgHome, "--batch", "--no-tty"];

		// Import the bundled key into the temp keyring.
		await runGpg([...baseArgs, "--import", ONEPASSWORD_GPG_PUBLIC_KEY_PATH]);

		// Confirm we imported the pinned key.
		const keyringListing = await runGpg([
			...baseArgs,
			"--list-keys",
			"--with-colons",
		]);
		if (!keyringListing.includes(`${ONEPASSWORD_GPG_KEY_FINGERPRINT}:`)) {
			throw new Error(
				`bundled GPG key does not match expected fingerprint ${ONEPASSWORD_GPG_KEY_FINGERPRINT}.`,
			);
		}

		// Verify op.sig against op using the imported key.
		await runGpg([...baseArgs, "--verify", sigPath, opPath]);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(
			`1Password CLI signature verification failed: ${message}. ` +
				"If 1Password has rotated their GPG signing key, this action needs to be updated — please file an issue at https://github.com/1Password/load-secrets-action/issues.",
		);
	} finally {
		fs.rmSync(gpgHome, { recursive: true, force: true });
	}
};
