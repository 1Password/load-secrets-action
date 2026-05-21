import {
	ONEPASSWORD_GPG_KEY_FINGERPRINT,
	verifyLinuxSignature,
} from "./linux-signature";

describe("verifyLinuxSignature", () => {
	const OP_PATH = "/tmp/op";
	const SIG_PATH = `${OP_PATH}.sig`;
	const CORRECT_FPR = `fpr:::::::::${ONEPASSWORD_GPG_KEY_FINGERPRINT}:\n`;
	const WRONG_FPR = `fpr:::::::::DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF:\n`;

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

	it("imports the bundled key and verifies the signature", async () => {
		const runner = gpgRunner("", CORRECT_FPR, "");
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner),
		).resolves.toBeUndefined();

		expect(subcommandsCalled(runner)).toEqual([
			"--import",
			"--list-keys",
			"--verify",
		]);
	});

	it("throws and skips --verify when the imported key has the wrong fingerprint", async () => {
		const runner = gpgRunner("", WRONG_FPR);
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner),
		).rejects.toThrow(/does not match expected/);
		expect(subcommandsCalled(runner)).toEqual(["--import", "--list-keys"]);
	});

	it("throws when gpg --verify rejects the signature", async () => {
		const runner = gpgRunner("", CORRECT_FPR, new Error("BAD signature"));
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner),
		).rejects.toThrow(/BAD signature/);
	});
});
