import {
	isAzureSignedEra,
	verifyAuthenticodeSignature,
	WINDOWS_ISSUER_CN_PREFIX,
	WINDOWS_PUBLISHER_EKU,
	WINDOWS_SIGNER_SUBJECT_CN,
} from "./windows-signature";

describe("verifyAuthenticodeSignature", () => {
	const OP_EXE = "C:\\op\\op.exe";

	const buildAuthenticodeOutput = ({
		status = "Valid",
		subject = `CN=${WINDOWS_SIGNER_SUBJECT_CN}, O=Agilebits, L=Toronto, S=Ontario, C=CA`,
		issuer = `CN=${WINDOWS_ISSUER_CN_PREFIX} 03, O=Microsoft Corporation, C=US`,
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

	it("passes for an Azure-signed op.exe", async () => {
		const runner = powershellRunner(buildAuthenticodeOutput());
		await expect(
			verifyAuthenticodeSignature(OP_EXE, runner),
		).resolves.toBeUndefined();
	});

	it("throws if the signer Subject is not AgileBits", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({ subject: "CN=Attacker, O=Attacker, C=US" }),
		);
		await expect(verifyAuthenticodeSignature(OP_EXE, runner)).rejects.toThrow(
			/does not contain CN=Agilebits/,
		);
	});

	it("throws if the Issuer is not the expected Microsoft CA", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({
				issuer:
					"CN=Sectigo Public Code Signing CA R36, O=Sectigo Limited, C=GB",
			}),
		);
		await expect(verifyAuthenticodeSignature(OP_EXE, runner)).rejects.toThrow(
			/does not contain CN=Microsoft ID Verified/,
		);
	});

	it("throws if the publisher EKU is missing", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({
				ekus: ["1.3.6.1.4.1.311.97.1.0", "1.3.6.1.5.5.7.3.3"],
			}),
		);
		await expect(verifyAuthenticodeSignature(OP_EXE, runner)).rejects.toThrow(
			/expected publisher EKU.*not found/,
		);
	});

	it("loose mode passes for a Sectigo-issued cert (no Microsoft CS AOC CA issuer)", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({
				issuer:
					"CN=Sectigo Public Code Signing CA R36, O=Sectigo Limited, C=GB",
				ekus: ["1.3.6.1.5.5.7.3.3"],
			}),
		);
		await expect(
			verifyAuthenticodeSignature(OP_EXE, runner, false),
		).resolves.toBeUndefined();
	});

	it("loose mode still rejects an unsigned or wrong-publisher binary", async () => {
		const runner = powershellRunner(
			buildAuthenticodeOutput({ subject: "CN=Attacker, O=Attacker, C=US" }),
		);
		await expect(
			verifyAuthenticodeSignature(OP_EXE, runner, false),
		).rejects.toThrow(/does not contain CN=Agilebits/);
	});
});

describe("isAzureSignedEra", () => {
	it("returns true for the cutoff version (2.31.0)", () => {
		expect(isAzureSignedEra("2.31.0")).toBe(true);
	});

	it("returns true for the first Azure beta (2.31.0-beta.01)", () => {
		expect(isAzureSignedEra("2.31.0-beta.01")).toBe(true);
	});

	it("returns true for versions newer than the cutoff", () => {
		expect(isAzureSignedEra("2.34.0")).toBe(true);
		expect(isAzureSignedEra("v3.0.0")).toBe(true);
	});

	it("returns false for the last Sectigo version (2.30.3)", () => {
		expect(isAzureSignedEra("2.30.3")).toBe(false);
	});

	it("returns false for older versions", () => {
		expect(isAzureSignedEra("2.20.0")).toBe(false);
		expect(isAzureSignedEra("v2.0.0")).toBe(false);
	});

	it("returns true for unrecognized version formats (fail closed)", () => {
		expect(isAzureSignedEra("not-a-version")).toBe(true);
	});
});
