import {
	ALLOWED_MACOS_SIGNING_CERT_FINGERPRINTS,
	APPLE_DEVELOPER_TEAM_ID,
	verifyMacOsPackageSignature,
} from "./macos-signature";

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
