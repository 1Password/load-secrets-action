import * as core from "@actions/core";
import { expect } from "@jest/globals";
import {
	authErr,
	envConnectHost,
	envConnectToken,
	envManagedVariables,
	envServiceAccountToken,
} from "../src/constants";
import * as utils from "../src/utils";
import type { SecretReferenceResolver } from "../src/auth/types";

jest.mock("@actions/core");

beforeEach(() => {
	jest.clearAllMocks();
});

describe("getAuth", () => {
	const testConnectHost = "https://localhost:8000";
	const testConnectToken = "token";
	const testServiceAccountToken = "ops_token";

	beforeEach(() => {
		process.env[envConnectHost] = "";
		process.env[envConnectToken] = "";
		process.env[envServiceAccountToken] = "";
	});

	it("should throw an error when no config is provided", () => {
		expect(utils.getAuth).toThrow(authErr);
	});

	it("should throw an error when partial Connect config is provided", () => {
		process.env[envConnectHost] = testConnectHost;
		expect(utils.getAuth).toThrow(authErr);
	});

	it("should be authenticated as a Connect client", () => {
		process.env[envConnectHost] = testConnectHost;
		process.env[envConnectToken] = testConnectToken;
		expect(utils.getAuth).not.toThrow(authErr);
		expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
	});

	it("should be authenticated as a service account", () => {
		process.env[envServiceAccountToken] = testServiceAccountToken;
		expect(utils.getAuth).not.toThrow(authErr);
		expect(core.info).toHaveBeenCalledWith(
			"Authenticated with Service account.",
		);
	});

	it("should prioritize Connect over service account if both are configured", () => {
		process.env[envServiceAccountToken] = testServiceAccountToken;
		process.env[envConnectHost] = testConnectHost;
		process.env[envConnectToken] = testConnectToken;
		expect(utils.getAuth).not.toThrow(authErr);
		expect(core.warning).toHaveBeenCalled();
		expect(core.info).toHaveBeenCalledWith("Authenticated with Connect.");
	});
});

describe("extractSecret", () => {
	const envTestSecretEnv = "TEST_SECRET";
	const testSecretRef = "op://vault/item/secret";
	const testSecretValue = "Secret1@3$";

	class DumbResolver implements SecretReferenceResolver {
		public async resolve(): Promise<string> {
			return Promise.resolve(testSecretValue);
		}
	}

	const OLD_ENV = process.env;

	afterAll(() => {
		process.env = OLD_ENV; // Restore old environment
	});

	beforeEach(() => {
		process.env[envTestSecretEnv] = testSecretRef;
	});

	it("should set secret as step output", async () => {
		await utils.extractSecret(new DumbResolver(), envTestSecretEnv, false);
		expect(core.exportVariable).not.toHaveBeenCalled();

		expect(core.setOutput).toHaveBeenCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
	});

	it("should set secret as environment variable", async () => {
		await utils.extractSecret(new DumbResolver(), envTestSecretEnv, true);
		expect(core.exportVariable).toHaveBeenCalledWith(
			envTestSecretEnv,
			testSecretValue,
		);
		expect(core.setOutput).not.toHaveBeenCalled();
		expect(core.setSecret).toHaveBeenCalledWith(testSecretValue);
	});
});

describe("loadSecrets", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(utils, "loadSecretRefsFromEnv").mockReturnValue(["MOCK_SECRET"]);
		jest.spyOn(utils, "getAuth").mockImplementation();
	});

	it("sets the client info and gets the executed output", async () => {
		await utils.loadSecrets(utils.getAuth(), true);

		expect(core.exportVariable).toHaveBeenCalledWith(
			"OP_MANAGED_VARIABLES",
			"MOCK_SECRET",
		);
	});

	it("return early if no env vars with secrets found", async () => {
		jest.spyOn(utils, "loadSecretRefsFromEnv").mockReturnValue([]);
		jest.spyOn(utils, "extractSecret");

		await utils.loadSecrets(utils.getAuth(), true);

		expect(utils.extractSecret).not.toHaveBeenCalled();
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	describe("core.exportVariable", () => {
		it("is called when shouldExportEnv is true", async () => {
			await utils.loadSecrets(utils.getAuth(), true);

			expect(core.exportVariable).toHaveBeenCalledTimes(1);
		});

		it("is not called when shouldExportEnv is false", async () => {
			await utils.loadSecrets(utils.getAuth(), false);

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
		utils.unsetPrevious();
		expect(core.info).toHaveBeenCalledWith("Unsetting previous values ...");
		expect(core.info).toHaveBeenCalledWith("Unsetting TEST_SECRET");
		expect(core.exportVariable).toHaveBeenCalledWith("TEST_SECRET", "");
	});
});

describe("loadSecretRefsFromEnv", () => {
	const OLD_ENV = process.env;
	let spy: jest.SpiedFunction<typeof core.warning>;

	beforeAll(() => {
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		spy = jest.spyOn(core, "warning");
		process.env = {
			...OLD_ENV,
		};
	});

	afterAll(() => {
		process.env = OLD_ENV;
	});

	it("load from env", () => {
		process.env.TEST_SECRET = "op://vault/item/section/field";
		const paths = utils.loadSecretRefsFromEnv();
		expect(paths).toStrictEqual(["TEST_SECRET"]);
		expect(spy).toHaveBeenCalledTimes(0);
	});

	it("exist invalid secret ref", () => {
		process.env.TEST_SECRET = "op://vault/item/section/something-else/field/a";
		const paths = utils.loadSecretRefsFromEnv();
		expect(paths).toStrictEqual([]);
		expect(spy).toHaveBeenCalledWith(
			"omitted 'op://vault/item/section/something-else/field/a' seems not a valid secret reference, please check https://developer.1password.com/docs/cli/secret-references",
		);
	});

	it("mixed valid and invalid secret refs", () => {
		process.env.TEST_SECRET = "op://vault/item/section/field";
		process.env.INVALID_SECRET =
			"op://vault/item/section/something-else/field/a";
		const paths = utils.loadSecretRefsFromEnv();
		expect(paths).toStrictEqual(["TEST_SECRET"]);
		expect(spy).toHaveBeenCalledTimes(1);
	});
});

describe("parseSecretRef", () => {
	it("valid reference", () => {
		const spaceRef = "op:// / / / ";
		expect(utils.parseSecretRef(spaceRef)).toEqual({
			vaultName: " ",
			itemName: " ",
			sectionName: " ",
			fieldName: " ",
		});

		const spaceRef2 = "op://vault/Secure Note/          field";
		expect(utils.parseSecretRef(spaceRef2)).toEqual({
			vaultName: "vault",
			itemName: "Secure Note",
			sectionName: undefined,
			fieldName: "          field",
		});

		const spaceRef3 = "op://vault/Secure Note/ section/          field";
		expect(utils.parseSecretRef(spaceRef3)).toEqual({
			vaultName: "vault",
			itemName: "Secure Note",
			sectionName: " section",
			fieldName: "          field",
		});

		const spaceRef4 = "op://vault/Secure Note/field";
		expect(utils.parseSecretRef(spaceRef4)).toEqual({
			vaultName: "vault",
			itemName: "Secure Note",
			sectionName: undefined,
			fieldName: "field",
		});

		const underscoreRef = "op://___/___/___/___";
		expect(utils.parseSecretRef(underscoreRef)).toEqual({
			vaultName: "___",
			itemName: "___",
			sectionName: "___",
			fieldName: "___",
		});

		const underscoreRef2 = "op://vault/item/section/text_with_underscore";
		expect(utils.parseSecretRef(underscoreRef2)).toEqual({
			vaultName: "vault",
			itemName: "item",
			sectionName: "section",
			fieldName: "text_with_underscore",
		});

		const withSection = "op://vault/item/section/text";
		expect(utils.parseSecretRef(withSection)).toEqual({
			vaultName: "vault",
			itemName: "item",
			sectionName: "section",
			fieldName: "text",
		});
	});

	it("invalid references", () => {
		const empty = "";
		expect(utils.parseSecretRef(empty)).toBeNull();

		const tooLong = "op://vault/item/section/text/other";
		expect(utils.parseSecretRef(tooLong)).toBeNull();

		const tooShort = "op://vault/item";
		expect(utils.parseSecretRef(tooShort)).toBeNull();

		// https://1password.community/discussion/128319/how-to-reference-a-secret-with-its-field-name-including-unsupported-characters
		const withUnsupportedCharacter = "op://Private/Github/私密金鑰";
		expect(utils.parseSecretRef(withUnsupportedCharacter)).toBeNull();
	});
});
