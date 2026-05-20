import {
	ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS,
	APPLE_DEVELOPER_TEAM_ID,
	verifyMacOsPackageSignature,
} from "./signature";

const FIRST_ALLOWED_FINGERPRINT = ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS[0]!;
const SECOND_ALLOWED_FINGERPRINT = ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS[1]!;

const fingerprintAsPkgutilLine = (hex: string): string => {
	const bytes = hex.match(/.{2}/g);
	if (!bytes) {
		throw new Error("invalid hex");
	}
	const first = bytes.slice(0, 24).join(" ");
	const second = bytes.slice(24).join(" ");
	return `           ${first}\n           ${second}`;
};

const buildPkgutilOutput = ({
	teamId = APPLE_DEVELOPER_TEAM_ID,
	signerFingerprint = FIRST_ALLOWED_FINGERPRINT,
	includeChain = true,
	includeSignerFingerprint = true,
}: {
	teamId?: string;
	signerFingerprint?: string;
	includeChain?: boolean;
	includeSignerFingerprint?: boolean;
} = {}): string => {
	const signerFingerprintBlock = includeSignerFingerprint
		? `       SHA256 Fingerprint:\n${fingerprintAsPkgutilLine(signerFingerprint)}\n`
		: "";

	const chain = includeChain
		? `   Certificate Chain:
    1. Developer ID Installer: AgileBits Inc. (${teamId})
       Expires: 2027-02-01 22:12:15 +0000
${signerFingerprintBlock}       ------------------------------------------------------------------------
    2. Developer ID Certification Authority
       Expires: 2027-02-01 22:12:15 +0000
       SHA256 Fingerprint:
           7A FC 9D 01 A6 2F 03 A2 DE 96 37 93 6D 4A FE 68 09 0D 2D E1 8D 03 F2 9C
           88 CF B0 B1 BA 63 58 7F
       ------------------------------------------------------------------------
    3. Apple Root CA
`
		: "";

	return `Package "op_apple_universal_v2.30.3.pkg":
   Status: signed by a developer certificate issued by Apple for distribution
   Signed with a trusted timestamp on: 2024-06-28 16:08:41 +0000
${chain}`;
};

describe("verifyMacOsPackageSignature", () => {
	it("passes for a pkg signed with the first allowlisted fingerprint", async () => {
		const runner = jest.fn<Promise<string>, [string]>().mockResolvedValue(
			buildPkgutilOutput({
				signerFingerprint: FIRST_ALLOWED_FINGERPRINT,
			}),
		);
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).resolves.toBeUndefined();
		expect(runner).toHaveBeenCalledWith("/tmp/op.pkg");
	});

	it("passes for a pkg signed with the second allowlisted fingerprint", async () => {
		const runner = jest.fn<Promise<string>, [string]>().mockResolvedValue(
			buildPkgutilOutput({
				signerFingerprint: SECOND_ALLOWED_FINGERPRINT,
			}),
		);
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).resolves.toBeUndefined();
	});

	it("normalizes whitespace and case when comparing fingerprints", async () => {
		const lowered = FIRST_ALLOWED_FINGERPRINT.toLowerCase();
		const runner = jest
			.fn<Promise<string>, [string]>()
			.mockResolvedValue(buildPkgutilOutput({ signerFingerprint: lowered }));
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).resolves.toBeUndefined();
	});

	it("throws if pkgutil exits non-zero", async () => {
		const runner = jest
			.fn<Promise<string>, [string]>()
			.mockRejectedValue(new Error("not a package"));
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).rejects.toThrow(/pkgutil --check-signature errored.*not a package/);
	});

	it("throws if the output has no certificate chain", async () => {
		const runner = jest
			.fn<Promise<string>, [string]>()
			.mockResolvedValue('Package "op.pkg":\n   Status: no signature\n');
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).rejects.toThrow(/could not locate certificate chain/);
	});

	it("throws if the signer cert is not under the AgileBits team ID", async () => {
		const runner = jest
			.fn<Promise<string>, [string]>()
			.mockResolvedValue(buildPkgutilOutput({ teamId: "ATTACKER123" }));
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).rejects.toThrow(/expected developer team ID 2BUA8C4S2C not found/);
	});

	it("throws if the signer cert fingerprint is missing from the output", async () => {
		const runner = jest
			.fn<Promise<string>, [string]>()
			.mockResolvedValue(buildPkgutilOutput({ includeSignerFingerprint: false }));
		await expect(
			verifyMacOsPackageSignature("/tmp/op.pkg", runner),
		).rejects.toThrow(/could not parse signer cert SHA-256 fingerprint/);
	});

	it("throws if the signer cert fingerprint is not on the allowlist", async () => {
		const runner = jest.fn<Promise<string>, [string]>().mockResolvedValue(
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
