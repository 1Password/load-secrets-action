import {
	verifyAuthenticodeSignature,
	WINDOWS_SIGNER_SUBJECT_CN,
} from "./windows-signature";

describe("verifyAuthenticodeSignature", () => {
	const OP_EXE = "C:\\op\\op.exe";

	const buildAuthenticodeOutput = ({
		status = "Valid",
		subject = `CN=${WINDOWS_SIGNER_SUBJECT_CN}, O=Agilebits, C=CA`,
	}: { status?: string; subject?: string } = {}): string =>
		[`Status=${status}`, `Subject=${subject}`].join("\n") + "\n";

	const powershellRunner = (output: string) =>
		jest.fn<Promise<string>, [string]>().mockResolvedValue(output);

	it("passes for a valid AgileBits-signed binary", async () => {
		const runner = powershellRunner(buildAuthenticodeOutput());
		await expect(
			verifyAuthenticodeSignature(OP_EXE, runner),
		).resolves.toBeUndefined();
	});

	it("throws if Status is not Valid (unsigned or tampered)", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({ status: "HashMismatch" }),
		);
		await expect(verifyAuthenticodeSignature(OP_EXE, runner)).rejects.toThrow(
			/Authenticode status is HashMismatch/,
		);
	});

	it("throws if the signer is not AgileBits", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({ subject: "CN=Attacker, O=Attacker, C=US" }),
		);
		await expect(verifyAuthenticodeSignature(OP_EXE, runner)).rejects.toThrow(
			/does not contain CN=Agilebits/,
		);
	});
});
