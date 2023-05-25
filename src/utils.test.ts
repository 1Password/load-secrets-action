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

jest.mock("@actions/core");

beforeEach(() => {
	jest.clearAllMocks();
});

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

	beforeEach(() => {
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "";
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
		// The following lint error is not an issue because we are checking for the presence of the `http://` prefix;
		// we are not using it as an insecure connection protocol to link out to another resource.
		// eslint-disable-next-line no-restricted-syntax
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
		expect(core.debug).toBeCalledWith("Authenticated with Connect.");
	});

	it("should be authenticated as a service account", () => {
		process.env[envServiceAccountToken] = "ops_token";
		expect(validateAuth).not.toThrowError(authErr);
		expect(core.debug).toBeCalledWith("Authenticated with Service account.");
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
		expect(core.exportVariable).not.toBeCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setOutput).toBeCalledWith(envTestSecretEnv, testSecretValue);
		expect(core.setSecret).toBeCalledWith(testSecretValue);
	});

	it("should set secret as environment variable", () => {
		extractSecret(envTestSecretEnv, true);
		expect(core.exportVariable).toBeCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setOutput).not.toBeCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setSecret).toBeCalledWith(testSecretValue);
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
		expect(core.debug).toHaveBeenCalledWith("Unsetting previous values ...");
		expect(core.debug).toHaveBeenCalledWith("Unsetting TEST_SECRET");
		expect(core.exportVariable).toHaveBeenCalledWith("TEST_SECRET", "");
	});
});
