import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// 1Password's code-signing GPG key fingerprint. Used to verify the detached
// `op.sig` inside the Linux release zip.
// See https://www.1password.dev/cli/verify.
export const ONEPASSWORD_GPG_KEY_FINGERPRINT =
	"3FEF9748469ADBE15DA7CA80AC2D62742012EA22";
export const ONEPASSWORD_GPG_KEYSERVER = "keyserver.ubuntu.com";

const defaultGpgRunner = async (args: readonly string[]): Promise<string> => {
	const { stdout } = await execFileAsync("gpg", args);
	return stdout;
};

// Throws unless the binary at opPath carries a valid GPG signature (at
// sigPath) from the pinned 1Password key.
//
//   gpg --keyserver keyserver.ubuntu.com --recv-keys <fingerprint>
//   gpg --verify <sigPath> <opPath>
export const verifyLinuxSignature = async (
	opPath: string,
	sigPath: string,
	runGpg: (args: readonly string[]) => Promise<string> = defaultGpgRunner,
): Promise<void> => {
	const gpgHome = fs.mkdtempSync(path.join(os.tmpdir(), "op-verify-"));
	try {
		const baseArgs = ["--homedir", gpgHome, "--batch", "--no-tty"];

		// Fetch the 1Password public key by fingerprint. gpg only accepts a
		// key whose fingerprint matches the requested value.
		await runGpg([
			...baseArgs,
			"--keyserver",
			ONEPASSWORD_GPG_KEYSERVER,
			"--recv-keys",
			ONEPASSWORD_GPG_KEY_FINGERPRINT,
		]);

		await runGpg([...baseArgs, "--verify", sigPath, opPath]);
	} finally {
		fs.rmSync(gpgHome, { recursive: true, force: true });
	}
};
