import {
	verifyWindowsBinarySignature,
	WINDOWS_ISSUER_CN,
	WINDOWS_PUBLISHER_EKU,
	WINDOWS_SIGNER_SUBJECT_CN,
} from "./windows-signature";

describe("verifyWindowsBinarySignature", () => {
	const OP_EXE = "C:\\op\\op.exe";

	const buildAuthenticodeOutput = ({
		status = "Valid",
		subject = `CN=${WINDOWS_SIGNER_SUBJECT_CN}, O=Agilebits, L=Toronto, S=Ontario, C=CA`,
		issuer = `CN=${WINDOWS_ISSUER_CN}, O=Microsoft Corporation, C=US`,
		ekus = [
			"1.3.6.1.4.1.311.97.1.0",
			"1.3.6.1.5.5.7.3.3",
			WINDOWS_PUBLISHER_EKU,
		],
	}: {
		status?: string;
		subject?: string;
		issuer?: string;
		ekus?: string[];
	} = {}): string =>
		[
			`Status=${status}`,
			`Subject=${subject}`,
			`Issuer=${issuer}`,
			...ekus.map((e) => `EKU=${e}`),
		].join("\n") + "\n";

	const powershellRunner = (output: string) =>
		jest.fn<Promise<string>, [string]>().mockResolvedValue(output);

	it("passes for op.exe signed by AgileBits with the expected EKU", async () => {
		const runner = powershellRunner(buildAuthenticodeOutput());
		await expect(
			verifyWindowsBinarySignature(OP_EXE, runner),
		).resolves.toBeUndefined();
	});

	it("throws if the signer Subject is not AgileBits", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({
				subject: "CN=Attacker, O=Attacker, C=US",
			}),
		);
		await expect(
			verifyWindowsBinarySignature(OP_EXE, runner),
		).rejects.toThrow(/does not contain CN=Agilebits/);
	});

	it("throws if the Issuer is not the expected Microsoft CA", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({
				issuer: "CN=Some Other CA, O=Someone, C=US",
			}),
		);
		await expect(
			verifyWindowsBinarySignature(OP_EXE, runner),
		).rejects.toThrow(/does not contain CN=Microsoft ID Verified/);
	});

	it("throws if the publisher EKU is missing", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({
				ekus: ["1.3.6.1.4.1.311.97.1.0", "1.3.6.1.5.5.7.3.3"],
			}),
		);
		await expect(
			verifyWindowsBinarySignature(OP_EXE, runner),
		).rejects.toThrow(/expected publisher EKU.*not found/);
	});
});
