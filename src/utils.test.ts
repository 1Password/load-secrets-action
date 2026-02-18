import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read, setClientInfo } from "@1password/op-js";
import { createClient } from "@1password/sdk";
import {
	extractSecret,
	loadSecrets,
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

jest.mock("@actions/core");
jest.mock("@actions/exec", () => ({
	getExecOutput: jest.fn(() => ({
		stdout: "MOCK_SECRET",
	})),
}));
jest.mock("@1password/op-js");
jest.mock("@1password/sdk", () => ({
	createClient: jest.fn(),
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

describe("loadSecrets when using Connect", () => {
	it("sets the client info and gets the executed output", async () => {
		await loadSecrets(true);

		expect(setClientInfo).toHaveBeenCalledWith({
			name: "1Password GitHub Action",
			id: "GHA",
		});
		expect(exec.getExecOutput).toHaveBeenCalledWith('sh -c "op env ls"');
		expect(core.exportVariable).toHaveBeenCalledWith(
			"OP_MANAGED_VARIABLES",
			"MOCK_SECRET",
		);
	});

	it("return early if no env vars with secrets found", async () => {
		(exec.getExecOutput as jest.Mock).mockReturnValueOnce({ stdout: "" });
		await loadSecrets(true);

		expect(exec.getExecOutput).toHaveBeenCalledWith('sh -c "op env ls"');
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

describe("loadSecrets when using Service Account", () => {
	const mockResolve = jest.fn();

	beforeEach(() => {
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "ops_token";

		Object.keys(process.env).forEach((key) => {
			if (
				typeof process.env[key] === "string" &&
				process.env[key]?.startsWith("op://")
			) {
				delete process.env[key];
			}
		});
		process.env.MY_SECRET = "op://vault/item/field";

		(createClient as jest.Mock).mockResolvedValue({
			secrets: { resolve: mockResolve },
		});

		mockResolve.mockResolvedValue("resolved-secret-value");
	});

	it("does not call op env ls when using Service Account", async () => {
		await loadSecrets(false);
		expect(exec.getExecOutput).not.toHaveBeenCalled();
	});

	it("sets step output with resolved value when export-env is false", async () => {
		await loadSecrets(false);
		expect(core.setOutput).toHaveBeenCalledTimes(1);
		expect(core.setOutput).toHaveBeenCalledWith(
			"MY_SECRET",
			"resolved-secret-value",
		);
	});

	it("masks secret with setSecret when export-env is false", async () => {
		await loadSecrets(false);
		expect(core.setSecret).toHaveBeenCalledTimes(1);
		expect(core.setSecret).toHaveBeenCalledWith("resolved-secret-value");
	});

	it("does not call exportVariable when export-env is false", async () => {
		await loadSecrets(false);
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	it("exports env and sets OP_MANAGED_VARIABLES when export-env is true", async () => {
		await loadSecrets(true);
		expect(core.exportVariable).toHaveBeenCalledWith(
			"MY_SECRET",
			"resolved-secret-value",
		);
		expect(core.exportVariable).toHaveBeenCalledWith(
			envManagedVariables,
			"MY_SECRET",
		);
	});

	it("does not set step output when export-env is true", async () => {
		await loadSecrets(true);
		expect(core.setOutput).not.toHaveBeenCalledWith(
			"MY_SECRET",
			expect.anything(),
		);
	});

	it("masks secret with setSecret when export-env is true", async () => {
		await loadSecrets(true);
		expect(core.setSecret).toHaveBeenCalledTimes(1);
		expect(core.setSecret).toHaveBeenCalledWith("resolved-secret-value");
	});

	it("returns early when no env vars have op:// refs", async () => {
		Object.keys(process.env).forEach((key) => {
			if (
				typeof process.env[key] === "string" &&
				process.env[key]?.startsWith("op://")
			) {
				delete process.env[key];
			}
		});
		await loadSecrets(true);
		expect(exec.getExecOutput).not.toHaveBeenCalled();
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	describe("multiple refs", () => {
		const ref1 = "op://vault/item/field";
		const ref2 = "op://vault/other/item";
		const ref3 = "op://vault/file/secret";

		beforeEach(() => {
			process.env.MY_SECRET = ref1;
			process.env.ANOTHER_SECRET = ref2;
			process.env.FILE_SECRET = ref3;

			mockResolve
				.mockResolvedValueOnce("value1")
				.mockResolvedValueOnce("value2")
				.mockResolvedValueOnce("value3");
		});

		it("resolves each ref and sets step output for each when export-env is false", async () => {
			await loadSecrets(false);

			expect(mockResolve).toHaveBeenCalledTimes(3);
			expect(mockResolve).toHaveBeenCalledWith(ref1);
			expect(mockResolve).toHaveBeenCalledWith(ref2);
			expect(mockResolve).toHaveBeenCalledWith(ref3);

			expect(core.setOutput).toHaveBeenCalledTimes(3);
			expect(core.setOutput).toHaveBeenCalledWith("MY_SECRET", "value1");
			expect(core.setOutput).toHaveBeenCalledWith("ANOTHER_SECRET", "value2");
			expect(core.setOutput).toHaveBeenCalledWith("FILE_SECRET", "value3");

			expect(core.setSecret).toHaveBeenCalledTimes(3);
		});

		it("resolves each ref and exports each and sets OP_MANAGED_VARIABLES when export-env is true", async () => {
			await loadSecrets(true);

			expect(mockResolve).toHaveBeenCalledTimes(3);

			expect(core.exportVariable).toHaveBeenCalledWith("MY_SECRET", "value1");
			expect(core.exportVariable).toHaveBeenCalledWith(
				"ANOTHER_SECRET",
				"value2",
			);
			expect(core.exportVariable).toHaveBeenCalledWith("FILE_SECRET", "value3");

			const exportVariableCalls = (core.exportVariable as jest.Mock).mock
				.calls as [string, string][];
			const managedVarsCall = exportVariableCalls.find(
				([name]) => name === envManagedVariables,
			);
			expect(managedVarsCall).toBeDefined();
			const managedList = (managedVarsCall as [string, string])[1].split(",");
			expect(managedList).toContain("MY_SECRET");
			expect(managedList).toContain("ANOTHER_SECRET");
			expect(managedList).toContain("FILE_SECRET");
			expect(managedList).toHaveLength(3);

			expect(core.setSecret).toHaveBeenCalledTimes(3);
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
