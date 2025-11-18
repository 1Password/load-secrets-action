import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo } from "@1password/op-js";
import {
	extractSecret,
	loadSecrets,
	unsetPrevious,
	validateAuth,
	isPkcsPrivateKey,
	isOpenSshPrivateKey,
	isEncryptedPem,
} from "./utils";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envManagedVariables,
	envServiceAccountToken,
} from "./constants";

jest.mock("@actions/core");
jest.mock("@actions/exec", () => ({
	getExecOutput: jest.fn(() => ({
		stdout: "MOCK_SECRET",
		exitCode: 0,
	})),
}));
jest.mock("@1password/op-js");
jest.mock("fs", () => ({
	writeFileSync: jest.fn(),
	readFileSync: jest.fn(),
	unlinkSync: jest.fn(),
	chmodSync: jest.fn(),
	promises: {
		access: jest.fn(),
		appendFile: jest.fn(),
		writeFile: jest.fn(),
	},
}));

beforeEach(() => {
	jest.clearAllMocks();
});

describe("validateAuth", () => {
	const testConnectHost = "https://localhost:8000";
	const testConnectToken = "token";
	const testServiceAccountToken = "ops_token";

	beforeEach(() => {
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "";
	});

	it("should throw an error when no config is provided", () => {
		expect(validateAuth).toThrow(authErr);
	});

	it("should throw an error when partial Connect config is provided", () => {
		process.env[envConnectHost] = testConnectHost;
		expect(validateAuth).toThrow(authErr);
	});

	it("should be authenticated as a Connect client", () => {
		process.env[envConnectHost] = testConnectHost;
		process.env[envConnectToken] = testConnectToken;
		expect(validateAuth).not.toThrow(authErr);
		expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
	});

	it("should be authenticated as a service account", () => {
		process.env[envServiceAccountToken] = testServiceAccountToken;
		expect(validateAuth).not.toThrow(authErr);
		expect(core.info).toHaveBeenCalledWith(
			"Authenticated with Service account.",
		);
	});

	it("should prioritize Connect over service account if both are configured", () => {
		process.env[envServiceAccountToken] = testServiceAccountToken;
		process.env[envConnectHost] = testConnectHost;
		process.env[envConnectToken] = testConnectToken;
		expect(validateAuth).not.toThrow(authErr);
		expect(core.warning).toHaveBeenCalled();
		expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
	});
});

describe("SSH Key Detection", () => {
	describe("isPkcsPrivateKey", () => {
		it("should detect PKCS8 private key", () => {
			const pkcs8Key = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...";
			expect(isPkcsPrivateKey(pkcs8Key)).toBe(true);
		});

		it("should detect PKCS1 RSA private key", () => {
			const pkcs1Key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...";
			expect(isPkcsPrivateKey(pkcs1Key)).toBe(true);
		});

		it("should detect EC private key", () => {
			const ecKey = "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEII...";
			expect(isPkcsPrivateKey(ecKey)).toBe(true);
		});

		it("should not detect OpenSSH private key", () => {
			const sshKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...";
			expect(isPkcsPrivateKey(sshKey)).toBe(false);
		});

		it("should not detect non-key content", () => {
			const cert = "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJ...";
			expect(isPkcsPrivateKey(cert)).toBe(false);
		});
	});

	describe("isOpenSshPrivateKey", () => {
		it("should detect OpenSSH private key", () => {
			const sshKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...";
			expect(isOpenSshPrivateKey(sshKey)).toBe(true);
		});

		it("should not detect PKCS8 private key", () => {
			const pkcs8Key = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...";
			expect(isOpenSshPrivateKey(pkcs8Key)).toBe(false);
		});
	});

	describe("isEncryptedPem", () => {
		it("should detect encrypted private key", () => {
			const encryptedKey = "-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFHDBOBgkqhk...";
			expect(isEncryptedPem(encryptedKey)).toBe(true);
		});

		it("should detect Proc-Type encryption marker", () => {
			const encryptedKey = "-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info...";
			expect(isEncryptedPem(encryptedKey)).toBe(true);
		});

		it("should detect DEK-Info encryption marker", () => {
			const encryptedKey = "-----BEGIN RSA PRIVATE KEY-----\nDEK-Info: AES-256-CBC,12345...";
			expect(isEncryptedPem(encryptedKey)).toBe(true);
		});

		it("should not detect unencrypted key", () => {
			const plainKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...";
			expect(isEncryptedPem(plainKey)).toBe(false);
		});
	});
});

describe("extractSecret", () => {
	const envTestSecretEnv = "TEST_SECRET";
	const testSecretRef = "op://vault/item/secret";
	const testSecretValue = "Secret1@3$";

	read.parse = jest.fn().mockReturnValue(testSecretValue);

	process.env[envTestSecretEnv] = testSecretRef;

	it("should set secret as step output", async () => {
		await extractSecret(envTestSecretEnv, false, false);
		expect(core.exportVariable).not.toHaveBeenCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setOutput).toHaveBeenCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
	});

	it("should set secret as environment variable", async () => {
		await extractSecret(envTestSecretEnv, true, false);
		expect(core.exportVariable).toHaveBeenCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setOutput).not.toHaveBeenCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
	});

	it("should not convert non-SSH secrets", async () => {
		const regularSecret = "just-a-password";
		read.parse = jest.fn().mockReturnValue(regularSecret);
		
		await extractSecret(envTestSecretEnv, false, true);
		
		expect(core.setOutput).toHaveBeenCalledWith(envTestSecretEnv, regularSecret);
		expect(core.info).not.toHaveBeenCalledWith(expect.stringContaining("Converting"));
	});

	it("should skip conversion for OpenSSH keys", async () => {
		const openSSHKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...";
		read.parse = jest.fn().mockReturnValue(openSSHKey);
		
		await extractSecret(envTestSecretEnv, false, true);
		
		expect(core.setOutput).toHaveBeenCalledWith(envTestSecretEnv, openSSHKey);
		expect(core.info).not.toHaveBeenCalledWith(expect.stringContaining("Converting"));
	});

	it("should warn about encrypted keys", async () => {
		const encryptedKey = "-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFHDBOBgkqhk...";
		read.parse = jest.fn().mockReturnValue(encryptedKey);
		
		await extractSecret(envTestSecretEnv, false, true);
		
		expect(core.warning).toHaveBeenCalledWith(
			expect.stringContaining("encrypted private keys require a passphrase"),
		);
	});

	it("should convert PKCS key to OpenSSH format (success path)", async () => {
		const pkcsKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...";
		const openSSHKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjE...";
		
		read.parse = jest.fn().mockReturnValue(pkcsKey);
		
		// Mock fs operations
		const fs = require("fs");
		fs.writeFileSync = jest.fn();
		fs.chmodSync = jest.fn();
		fs.readFileSync = jest.fn().mockReturnValue(openSSHKey);
		fs.unlinkSync = jest.fn();
		
		// Mock ssh-keygen execution success
		(exec.getExecOutput as jest.Mock).mockResolvedValue({
			stdout: "",
			exitCode: 0,
		});
		
		await extractSecret(envTestSecretEnv, false, true);
		
		// Should log conversion
		expect(core.info).toHaveBeenCalledWith(expect.stringContaining("Converting"));
		expect(core.info).toHaveBeenCalledWith(expect.stringContaining("Successfully converted"));
		
		// Should call ssh-keygen
		expect(exec.getExecOutput).toHaveBeenCalledWith(
			"ssh-keygen",
			expect.arrayContaining(["-p", "-f"]),
			expect.objectContaining({ silent: true }),
		);
		
		// Should output the converted key
		expect(core.setOutput).toHaveBeenCalledWith(envTestSecretEnv, openSSHKey);
		
		// Should mask both original and converted
		expect(core.setSecret).toHaveBeenCalledWith(pkcsKey);
		expect(core.setSecret).toHaveBeenCalledWith(openSSHKey);
		
		// Should clean up temp file
		expect(fs.unlinkSync).toHaveBeenCalled();
	});

	it("should handle conversion failure gracefully", async () => {
		const pkcsKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...";
		
		read.parse = jest.fn().mockReturnValue(pkcsKey);
		
		// Mock fs operations
		const fs = require("fs");
		fs.writeFileSync = jest.fn();
		fs.chmodSync = jest.fn();
		fs.unlinkSync = jest.fn();
		
		// Mock ssh-keygen execution failure
		(exec.getExecOutput as jest.Mock).mockResolvedValue({
			stdout: "",
			exitCode: 1,
		});
		
		await extractSecret(envTestSecretEnv, false, true);
		
		// Should log warning about failure
		expect(core.warning).toHaveBeenCalledWith(
			expect.stringContaining("Failed to convert SSH key"),
		);
		
		// Should use original PKCS key
		expect(core.setOutput).toHaveBeenCalledWith(envTestSecretEnv, pkcsKey);
		
		// Should still mask the original
		expect(core.setSecret).toHaveBeenCalledWith(pkcsKey);
		
		// Should still clean up temp file
		expect(fs.unlinkSync).toHaveBeenCalled();
	});
});

describe("loadSecrets", () => {
	beforeEach(() => {
		// Mock environment variable with secret reference
		process.env.MOCK_SECRET = "op://vault/item/secret";
		read.parse = jest.fn().mockReturnValue("secret-value");
		// Reset the exec mock to return MOCK_SECRET
		(exec.getExecOutput as jest.Mock).mockResolvedValue({
			stdout: "MOCK_SECRET",
			exitCode: 0,
		});
	});

	it("sets the client info and gets the executed output", async () => {
		await loadSecrets(true, false);

		expect(setClientInfo).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "1Password GitHub Action",
				id: "GHA",
			}),
		);
		expect(exec.getExecOutput).toHaveBeenCalledWith('sh -c "op env ls"');
		// Should export the secret value
		expect(core.exportVariable).toHaveBeenCalledWith(
			"MOCK_SECRET",
			"secret-value",
		);
		// Should export managed variables list
		expect(core.exportVariable).toHaveBeenCalledWith(
			"OP_MANAGED_VARIABLES",
			"MOCK_SECRET",
		);
	});

	it("return early if no env vars with secrets found", async () => {
		(exec.getExecOutput as jest.Mock).mockReturnValueOnce({ stdout: "" });
		await loadSecrets(true, false);

		expect(exec.getExecOutput).toHaveBeenCalledWith('sh -c "op env ls"');
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	describe("core.exportVariable", () => {
		it("is called when shouldExportEnv is true", async () => {
			await loadSecrets(true, false);

			// Should be called twice: once for the secret value, once for managed variables
			expect(core.exportVariable).toHaveBeenCalledTimes(2);
		});

		it("is not called when shouldExportEnv is false", async () => {
			await loadSecrets(false, false);

			expect(core.exportVariable).not.toHaveBeenCalled();
		});
	});
});

describe("unsetPrevious", () => {
	const testManagedEnv = "TEST_SECRET";
	const testSecretValue = "MyS3cr#T";

	beforeEach(() => {
		process.env[testManagedEnv] = testSecretValue;
		process.env[envManagedVariables] = testManagedEnv;
	});

	it("should unset the environment variable if user wants it", () => {
		unsetPrevious();
		expect(core.info).toHaveBeenCalledWith("Unsetting previous values ...");
		expect(core.info).toHaveBeenCalledWith("Unsetting TEST_SECRET");
		expect(core.exportVariable).toHaveBeenCalledWith("TEST_SECRET", "");
	});
});
