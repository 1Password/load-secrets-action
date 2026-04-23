import fs from "node:fs";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo } from "@1password/op-js";
import {
	extractSecret,
	loadSecrets,
	loadSecretsFromEnvFileBatched,
	unsetPrevious,
	validateAuth,
} from "./utils";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envManagedVariables,
	envServiceAccountToken,
} from "./constants";

jest.mock("@1password/op-js");
jest.mock("node:fs", () => ({
	// eslint-disable-next-line @typescript-eslint/naming-convention
	__esModule: true,
	default: {
		readFileSync: jest.fn(),
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

describe("extractSecret", () => {
	const envTestSecretEnv = "TEST_SECRET";
	const testSecretRef = "op://vault/item/secret";
	const testSecretValue = "Secret1@3$";

	read.parse = jest.fn().mockReturnValue(testSecretValue);

	process.env[envTestSecretEnv] = testSecretRef;

	it("should set secret as step output", () => {
		extractSecret(envTestSecretEnv, false);
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

	it("should set secret as environment variable", () => {
		extractSecret(envTestSecretEnv, true);
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

	describe("when secret value is empty string", () => {
		const emptySecretValue = "";

		beforeEach(() => {
			(read.parse as jest.Mock).mockReturnValue(emptySecretValue);
		});

		afterEach(() => {
			(read.parse as jest.Mock).mockReturnValue(testSecretValue);
		});

		it("should set empty string as step output", () => {
			extractSecret(envTestSecretEnv, false);
			expect(core.setOutput).toHaveBeenCalledWith(
				envTestSecretEnv,
				emptySecretValue,
			);
			expect(core.exportVariable).not.toHaveBeenCalled();
		});

		it("should set empty string as environment variable", () => {
			extractSecret(envTestSecretEnv, true);
			expect(core.exportVariable).toHaveBeenCalledWith(
				envTestSecretEnv,
				emptySecretValue,
			);
			expect(core.setOutput).not.toHaveBeenCalled();
		});

		it("should not call setSecret for empty string", () => {
			extractSecret(envTestSecretEnv, false);
			expect(core.setSecret).not.toHaveBeenCalled();
		});
	});
});

describe("loadSecrets", () => {
	it("sets the client info and gets the executed output", async () => {
		await loadSecrets(true);

		expect(setClientInfo).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "1Password GitHub Action",
				id: "GHA",
			}),
		);
		expect(exec.getExecOutput).toHaveBeenCalledWith("op", ["env", "ls"]);
		expect(core.exportVariable).toHaveBeenCalledWith(
			"OP_MANAGED_VARIABLES",
			"MOCK_SECRET",
		);
	});

	it("return early if no env vars with secrets found", async () => {
		(exec.getExecOutput as jest.Mock).mockReturnValueOnce({ stdout: "" });
		await loadSecrets(true);

		expect(exec.getExecOutput).toHaveBeenCalledWith("op", ["env", "ls"]);
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	describe("core.exportVariable", () => {
		it("is called when shouldExportEnv is true", async () => {
			await loadSecrets(true);

			expect(core.exportVariable).toHaveBeenCalledTimes(1);
		});

		it("is not called when shouldExportEnv is false", async () => {
			await loadSecrets(false);

			expect(core.exportVariable).not.toHaveBeenCalled();
		});
	});
});

describe("loadSecretsFromEnvFileBatched", () => {
	const envFilePath = "/tmp/test.env";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("loads secrets from env file and sets them as outputs", async () => {
		(fs.readFileSync as unknown as jest.Mock).mockReturnValue(
			Buffer.from("FOO=op://vault/item/foo\nBAR=op://vault/item/bar\n"),
		);
		(exec.getExecOutput as jest.Mock).mockReturnValueOnce({
			stdout: JSON.stringify({ FOO: "foo-value", BAR: "bar-value" }),
		});

		await loadSecretsFromEnvFileBatched(envFilePath, false);

		expect(exec.getExecOutput).toHaveBeenCalledWith(
			"op",
			expect.arrayContaining([
				"run",
				`--env-file=${envFilePath}`,
				"--no-masking",
			]),
			expect.anything(),
		);
		expect(core.setOutput).toHaveBeenCalledWith("FOO", "foo-value");
		expect(core.setOutput).toHaveBeenCalledWith("BAR", "bar-value");
		expect(core.exportVariable).not.toHaveBeenCalledWith(
			"OP_MANAGED_VARIABLES",
			expect.anything(),
		);
		expect(core.setSecret).toHaveBeenCalledWith("foo-value");
		expect(core.setSecret).toHaveBeenCalledWith("bar-value");
	});

	it("loads secrets from env file and exports them as env vars (including managed list)", async () => {
		(fs.readFileSync as unknown as jest.Mock).mockReturnValue(
			Buffer.from("FOO=op://vault/item/foo\nBAR=op://vault/item/bar\n"),
		);
		(exec.getExecOutput as jest.Mock).mockReturnValueOnce({
			stdout: JSON.stringify({ FOO: "foo-value", BAR: "bar-value" }),
		});

		await loadSecretsFromEnvFileBatched(envFilePath, true);

		expect(core.exportVariable).toHaveBeenCalledWith("FOO", "foo-value");
		expect(core.exportVariable).toHaveBeenCalledWith("BAR", "bar-value");
		expect(core.exportVariable).toHaveBeenCalledWith(
			envManagedVariables,
			"FOO,BAR",
		);
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
