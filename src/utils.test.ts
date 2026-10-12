import * as core from "@actions/core";
import { read, setClientInfo } from "@1password/op-js";
import {
	extractSecret,
	getWorkloadIdentityConfig,
	hasCliAuth,
	loadSecrets,
	unsetPrevious,
	validateAuth,
	getSecretReferenceEnvNames,
} from "./utils";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envEnvironmentId,
	envIntegrationKey,
	envManagedVariables,
	envServiceAccountToken,
	envWorkloadId,
} from "./constants";

jest.mock("@1password/op-js");

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

describe("getWorkloadIdentityConfig", () => {
	const testWorkloadId = "workload-id";
	const testEnvironmentId = "environment-id";
	const testIntegrationKey = "integration-key";

	beforeEach(() => {
		process.env[envWorkloadId] = "";
		process.env[envEnvironmentId] = "";
		process.env[envIntegrationKey] = "";
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "";
	});

	it("should return null when no variables are set", () => {
		expect(getWorkloadIdentityConfig()).toBeNull();
	});

	it("should return the config when all variables are set", () => {
		process.env[envWorkloadId] = testWorkloadId;
		process.env[envEnvironmentId] = testEnvironmentId;
		process.env[envIntegrationKey] = testIntegrationKey;

		expect(getWorkloadIdentityConfig()).toEqual({
			workloadId: testWorkloadId,
			environmentId: testEnvironmentId,
			integrationKey: testIntegrationKey,
		});
	});

	it("should throw an error when only some variables are set", () => {
		process.env[envWorkloadId] = testWorkloadId;

		expect(getWorkloadIdentityConfig).toThrow(
			/Incomplete Workload Identity configuration/,
		);
	});

	it("should throw an error when combined with Connect credentials", () => {
		process.env[envWorkloadId] = testWorkloadId;
		process.env[envEnvironmentId] = testEnvironmentId;
		process.env[envIntegrationKey] = testIntegrationKey;
		process.env[envConnectHost] = "https://localhost:8000";
		process.env[envConnectToken] = "token";

		expect(getWorkloadIdentityConfig).toThrow(
			/Conflicting authentication configuration/,
		);
	});

	it("should throw an error when combined with a service account token", () => {
		process.env[envWorkloadId] = testWorkloadId;
		process.env[envEnvironmentId] = testEnvironmentId;
		process.env[envIntegrationKey] = testIntegrationKey;
		process.env[envServiceAccountToken] = "ops_token";

		expect(getWorkloadIdentityConfig).toThrow(
			/Conflicting authentication configuration/,
		);
	});
});

describe("hasCliAuth", () => {
	beforeEach(() => {
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "";
	});

	it("returns false when no CLI auth is configured", () => {
		expect(hasCliAuth()).toBe(false);
	});

	it("returns false when only the Connect host is set", () => {
		process.env[envConnectHost] = "https://localhost:8000";
		expect(hasCliAuth()).toBe(false);
	});

	it("returns true with both Connect host and token", () => {
		process.env[envConnectHost] = "https://localhost:8000";
		process.env[envConnectToken] = "token";
		expect(hasCliAuth()).toBe(true);
	});

	it("returns true with a service account token", () => {
		process.env[envServiceAccountToken] = "ops_token";
		expect(hasCliAuth()).toBe(true);
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
	const originalEnv = process.env;
	const testSecretRef = "op://vault/item/field";
	const testSecretValue = "Secret1@3$";

	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		process.env = { MOCK_SECRET: testSecretRef };
		read.parse = jest.fn().mockReturnValue(testSecretValue);
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("sets the client info and resolves secret references", () => {
		loadSecrets(true);

		expect(setClientInfo).toHaveBeenCalledWith({
			name: "1Password GitHub Action",
			id: "GHA",
		});
		expect(read.parse).toHaveBeenCalledWith(testSecretRef);
		expect(core.exportVariable).toHaveBeenCalledWith(
			envManagedVariables,
			"MOCK_SECRET",
		);
	});

	it("returns early if no env vars contain secret references", () => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		process.env = { PATH: "/usr/bin" };

		loadSecrets(true);

		expect(read.parse).not.toHaveBeenCalled();
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	it("throws when a secret reference cannot be read", () => {
		(read.parse as jest.Mock).mockImplementation(() => {
			throw new Error("item not found");
		});

		expect(() => loadSecrets(true)).toThrow("item not found");
	});

	describe("core.exportVariable", () => {
		it("is called when shouldExportEnv is true", () => {
			loadSecrets(true);

			expect(core.exportVariable).toHaveBeenCalledWith(
				"MOCK_SECRET",
				testSecretValue,
			);
			expect(core.exportVariable).toHaveBeenCalledTimes(2);
		});

		it("is not called when shouldExportEnv is false", () => {
			loadSecrets(false);

			expect(core.setOutput).toHaveBeenCalledWith(
				"MOCK_SECRET",
				testSecretValue,
			);
			expect(core.exportVariable).not.toHaveBeenCalled();
		});
	});
});

describe("getSecretReferenceEnvNames", () => {
	it.each([
		["op://vault/item/field"],
		["op://vault/item/section/field"],
		["op://vault/item/field?attribute=otp"],
		["op://my vault/my item/private key"],
		[" op://vault/item/field "],
	])("includes %j", (value) => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		expect(getSecretReferenceEnvNames({ TEST: value })).toEqual(["TEST"]);
	});

	it.each([
		[""],
		["not-a-reference"],
		["OP://vault/item/field"],
		["prefix op://vault/item/field"],
		["op://"],
		["op://vault/item"],
		["op://vault//field"],
		["op://vault/item/section/field/extra"],
		["op://vault/item/field\nmore"],
	])("excludes %j", (value) => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		expect(getSecretReferenceEnvNames({ TEST: value })).toEqual([]);
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

	it("should unset every variable listed in OP_MANAGED_VARIABLES", () => {
		process.env[envManagedVariables] = "TEST_SECRET,ANOTHER_TEST,SUPER_SECRET";

		unsetPrevious();

		expect(core.exportVariable).toHaveBeenCalledWith("TEST_SECRET", "");
		expect(core.exportVariable).toHaveBeenCalledWith("ANOTHER_TEST", "");
		expect(core.exportVariable).toHaveBeenCalledWith("SUPER_SECRET", "");
		expect(core.exportVariable).toHaveBeenCalledTimes(3);
	});

	it("should do nothing when no variables are managed", () => {
		process.env[envManagedVariables] = "";

		unsetPrevious();

		expect(core.exportVariable).not.toHaveBeenCalled();
		expect(core.info).not.toHaveBeenCalledWith("Unsetting previous values ...");
	});
});
