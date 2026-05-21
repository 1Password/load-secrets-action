import {
	ONEPASSWORD_GPG_KEY_FINGERPRINT,
	ONEPASSWORD_GPG_KEYSERVER,
	verifyLinuxSignature,
} from "./linux-signature";

describe("verifyLinuxSignature", () => {
	const OP_PATH = "/tmp/op";
	const SIG_PATH = `${OP_PATH}.sig`;

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
			args.find((a) => a === "--recv-keys" || a === "--verify"),
		);

	it("fetches the pinned key by fingerprint and verifies the signature", async () => {
		const runner = gpgRunner("", "");
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner),
		).resolves.toBeUndefined();

		expect(subcommandsCalled(runner)).toEqual(["--recv-keys", "--verify"]);

		const recvKeysArgs = runner.mock.calls[0]![0];
		expect(recvKeysArgs).toEqual(
			expect.arrayContaining([
				"--keyserver",
				ONEPASSWORD_GPG_KEYSERVER,
				"--recv-keys",
				ONEPASSWORD_GPG_KEY_FINGERPRINT,
			]),
		);
	});

	it("throws if recv-keys fails (e.g., wrong fingerprint or keyserver unreachable)", async () => {
		const runner = gpgRunner(new Error("No data"));
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner),
		).rejects.toThrow(/No data/);
		expect(subcommandsCalled(runner)).toEqual(["--recv-keys"]);
	});

	it("throws if gpg --verify rejects the signature", async () => {
		const runner = gpgRunner("", new Error("BAD signature"));
		await expect(
			verifyLinuxSignature(OP_PATH, SIG_PATH, runner),
		).rejects.toThrow(/BAD signature/);
	});
});
