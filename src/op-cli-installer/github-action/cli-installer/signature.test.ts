import {
	ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS,
	APPLE_DEVELOPER_TEAM_ID,
	ONEPASSWORD_GPG_KEY_FINGERPRINT,
	ONEPASSWORD_GPG_KEY_URL,
	verifyLinuxSignature,
	verifyMacOsPackageSignature,
} from "./signature";

const VALID_FINGERPRINT = ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS[0]!;

const buildPkgutilOutput = ({
	teamId = APPLE_DEVELOPER_TEAM_ID,
	signerFingerprint = VALID_FINGERPRINT,
}: {
	teamId?: string;
	signerFingerprint?: string;
} = {}): string => {
	const bytes = signerFingerprint.match(/.{2}/g)!;
	const fprLines = `           ${bytes.slice(0, 24).join(" ")}\n           ${bytes.slice(24).join(" ")}`;
	return `Package "op.pkg":
   Certificate Chain:
    1. Developer ID Installer: AgileBits Inc. (${teamId})
       SHA256 Fingerprint:
${fprLines}
       ------------------------------------------------------------------------
    2. Developer ID Certification Authority
`;
};

const pkgutilRunner = (output: string) =>
	jest.fn<Promise<string>, [string]>().mockResolvedValue(output);

describe("verifyMacOsPackageSignature", () => {
	it("passes for a pkg signed by AgileBits with an allowlisted cert", async () => {
		const runner = pkgutilRunner(buildPkgutilOutput());
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).resolves.toBeUndefined();
	});

	it("throws if the signer is not under the AgileBits team ID", async () => {
		const runner = pkgutilRunner(buildPkgutilOutput({ teamId: "ATTACKER" }));
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).rejects.toThrow(/expected developer team ID 2BUA8C4S2C not found/);
	});

	it("throws if the signer cert fingerprint is not on the allowlist", async () => {
		const runner = pkgutilRunner(
			buildPkgutilOutput({
				signerFingerprint:
					"DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
			}),
		);
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).rejects.toThrow(/not on the allowlist/);
	});
});

describe("verifyLinuxSignature", () => {
	const OP_PATH = "/tmp/op";
	const SIG_PATH = "/tmp/op.sig";
	const CORRECT_FPR = `fpr:::::::::${ONEPASSWORD_GPG_KEY_FINGERPRINT}:\n`;
	const WRONG_FPR = `fpr:::::::::DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF:\n`;
	const downloadKey = jest
		.fn<Promise<string>, [string]>()
		.mockResolvedValue("/tmp/key.asc");

	beforeEach(() => downloadKey.mockClear());

	const gpgRunner = (...responses: (string | Error)[]) => {
		const runner = jest.fn<Promise<string>, [readonly string[]]>();
		for (const r of responses) {
			if (r instanceof Error) {
				runner.mockRejectedValueOnce(r);
			} else {
				runner.mockResolvedValueOnce(r);
			}
		}
		return runner;
	};

	const subcommandsCalled = (runner: ReturnType<typeof gpgRunner>) =>
		runner.mock.calls.map(([args]: [readonly string[]]) =>
			args.find(
				(a) => a === "--import" || a === "--list-keys" || a === "--verify",
			),
		);

	it("passes when the imported key matches and gpg --verify succeeds", async () => {
		const runner = gpgRunner("", CORRECT_FPR, "");
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner, downloadKey),
		).resolves.toBeUndefined();

		expect(downloadKey).toHaveBeenCalledWith(ONEPASSWORD_GPG_KEY_URL);
		expect(subcommandsCalled(runner)).toEqual([
			"--import",
			"--list-keys",
			"--verify",
		]);
	});

	it("throws and skips --verify when the imported key fingerprint is wrong", async () => {
		const runner = gpgRunner("", WRONG_FPR);
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner, downloadKey),
		).rejects.toThrow(/does not match expected/);
		expect(subcommandsCalled(runner)).toEqual(["--import", "--list-keys"]);
	});

	it("throws when gpg --verify rejects the signature", async () => {
		const runner = gpgRunner("", CORRECT_FPR, new Error("BAD signature"));
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner, downloadKey),
		).rejects.toThrow(/gpg --verify rejected.*BAD signature/);
	});
});
