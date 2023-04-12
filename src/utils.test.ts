import * as core from "@actions/core";
import { read } from "@1password/op-js";
import {
	extractSecret,
	semverToInt,
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

describe("semverToInt", () => {
	it("converts a semver string to build number", () => {
		expect(semverToInt("0.1.2")).toBe("000102");
		expect(semverToInt("1.2.3")).toBe("010203");
		expect(semverToInt("12.2.39")).toBe("120239");
		expect(semverToInt("2.1.284")).toBe("0201284");
	});
});

describe("validateAuth", () => {
	const testConnectHost = "https://localhost:8000";
	const mockCoreDebug = jest.spyOn(core, "debug");

	beforeEach(() => {
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "";
		jest.clearAllMocks();
	});

	it("should throw an error when no config is provided", () => {
		expect(validateAuth).toThrowError(authErr);
	});

	it("should throw an error when partial Connect config is provided", () => {
		process.env[envConnectHost] = testConnectHost;
		expect(validateAuth).toThrowError(authErr);
	});

	it("should append protocol if Connect host doesn't have it", () => {
		process.env[envConnectHost] = "localhost:8080";
		process.env[envConnectToken] = "token";
		expect(validateAuth).not.toThrowError(authErr);
		/* eslint-disable no-restricted-syntax */
		expect(process.env[envConnectHost]).toBe("http://localhost:8080");
	});

	it("should not append protocol if Connect host has one", () => {
		process.env[envConnectHost] = testConnectHost;
		process.env[envConnectToken] = "token";
		expect(validateAuth).not.toThrowError(authErr);
		expect(process.env[envConnectHost]).toBe(testConnectHost);
	});

	it("should be authenticated as a Connect client", () => {
		process.env[envConnectHost] = testConnectHost;
		process.env[envConnectToken] = "token";
		expect(validateAuth).not.toThrowError(authErr);
		expect(mockCoreDebug).toBeCalledWith("Authenticated with Connect.");
	});

	it("should be authenticated as a service account", () => {
		process.env[envServiceAccountToken] = "ops_token";
		expect(validateAuth).not.toThrowError(authErr);
		expect(mockCoreDebug).toBeCalledWith("Authenticated with Service account.");
	});
});

describe("extractSecret", () => {
	const envTestSecretEnv = "TEST_SECRET";
	const testSecretRef = "op://vault/item/secret";
	const testSecretValue = "Secret1@3$";

	const mockCoreExportVariable = jest.spyOn(core, "exportVariable");
	const mockCoreSetOutput = jest.spyOn(core, "setOutput");
	const mockCoreSetSecret = jest.spyOn(core, "setSecret");
	read.parse = jest.fn().mockReturnValue(testSecretValue);

	process.env[envTestSecretEnv] = testSecretRef;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should set secret as step output", () => {
		extractSecret(envTestSecretEnv, false);
		expect(mockCoreExportVariable).not.toBeCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(mockCoreSetOutput).toBeCalledWith(envTestSecretEnv, testSecretValue);
		expect(mockCoreSetSecret).toBeCalledWith(testSecretValue);
	});

	it("should set secret as environment variable", () => {
		extractSecret(envTestSecretEnv, true);
		expect(mockCoreExportVariable).toBeCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(mockCoreSetOutput).not.toBeCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(mockCoreSetSecret).toBeCalledWith(testSecretValue);
	});
});

describe("unsetPrevious", () => {
	const testManagedEnv = "TEST_SECRET";
	const testSecretValue = "MyS3cr#T";

	beforeEach(() => {
		jest.clearAllMocks();
		process.env[testManagedEnv] = testSecretValue;
		process.env[envManagedVariables] = testManagedEnv;
	});

	it("should unset the environment variable if user wants it", () => {
		unsetPrevious(true);
		expect(process.env[testManagedEnv]).toBe("");
	});

	it("shouldn't unset the environment variable if user doesn't want it", () => {
		unsetPrevious(false);
		expect(process.env[testManagedEnv]).toBe(testSecretValue);
	});
});
