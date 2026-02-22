import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { read } from "@1password/op-js";
import { createClient, Secrets } from "@1password/sdk";
import { OnePasswordConnect, FullItem } from "@1password/connect";
import {
	extractSecret,
	loadSecrets,
	unsetPrevious,
	validateAuth,
	findMatchingFieldAndFile,
	findSectionIdsByQuery,
	parseOpRef,
	getEnvVarNamesWithSecretRefs,
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
	// eslint-disable-next-line @typescript-eslint/naming-convention
	Secrets: {
		validateSecretReference: jest.fn(),
	},
}));
jest.mock("@1password/connect");

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
	beforeEach(() => {
		process.env[envConnectHost] = "https://connect.example";
		process.env[envConnectToken] = "test-token";
		process.env[envServiceAccountToken] = "";

		Object.keys(process.env).forEach((key) => {
			if (
				typeof process.env[key] === "string" &&
				process.env[key]?.startsWith("op://")
			) {
				delete process.env[key];
			}
		});
		process.env.MY_SECRET = "op://vault/item/field";

		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: jest.fn().mockResolvedValue({ id: "vault-id-123" }),
			getItem: jest.fn().mockResolvedValue({
				fields: [
					{ label: "field", value: "resolved-via-connect", section: undefined },
				],
				sections: [],
			}),
		});
	});

	it("resolves ref via Connect SDK and exports secret", async () => {
		await loadSecrets(true);

		expect(core.exportVariable).toHaveBeenCalledWith(
			"MY_SECRET",
			"resolved-via-connect",
		);
		expect(core.exportVariable).toHaveBeenCalledWith(
			envManagedVariables,
			"MY_SECRET",
		);
	});

	it("return early if no env vars with secrets found", async () => {
		delete process.env.MY_SECRET;
		await loadSecrets(true);

		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	it("sets step output when shouldExportEnv is false", async () => {
		await loadSecrets(false);

		expect(core.setOutput).toHaveBeenCalledWith(
			"MY_SECRET",
			"resolved-via-connect",
		);
		expect(core.exportVariable).not.toHaveBeenCalled();
	});

	it("masks resolved secret with setSecret", async () => {
		await loadSecrets(true);

		expect(core.setSecret).toHaveBeenCalledWith("resolved-via-connect");
	});

	it("calls getVault with vault segment from ref", async () => {
		process.env.MY_SECRET = "op://my-vault-name/my-item/field";
		const mockGetVault = jest.fn().mockResolvedValue({ id: "vault-uuid" });
		const mockGetItem = jest.fn().mockResolvedValue({
			fields: [{ label: "field", value: "secret-value", section: undefined }],
			sections: [],
		});
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: mockGetItem,
		});

		await loadSecrets(false);

		expect(mockGetVault).toHaveBeenCalledWith("my-vault-name");
	});

	it("throws when getVault returns vault without id", async () => {
		const mockGetVault = jest.fn().mockResolvedValue({});
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: jest.fn(),
		});

		await expect(loadSecrets(true)).rejects.toThrow(
			/Could not find valid vault "vault" for ref "op:\/\/vault\/item\/field"/,
		);
		expect(mockGetVault).toHaveBeenCalledWith("vault");
	});

	it("resolves vault by name and uses returned id for getItem", async () => {
		process.env.MY_SECRET = "op://My Vault/My Item/field";
		const mockGetVault = jest
			.fn()
			.mockResolvedValue({ id: "uuid-for-my-vault" });
		const mockGetItem = jest.fn().mockResolvedValue({
			fields: [
				{
					label: "field",
					value: "secret-from-named-vault",
					section: undefined,
				},
			],
			sections: [],
		});
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: mockGetItem,
		});

		await loadSecrets(true);

		expect(mockGetVault).toHaveBeenCalledWith("My Vault");
		expect(mockGetItem).toHaveBeenCalledWith("uuid-for-my-vault", "My Item");
		expect(core.exportVariable).toHaveBeenCalledWith(
			"MY_SECRET",
			"secret-from-named-vault",
		);
	});

	it("calls getItem with vault id from getVault, not ref vault segment", async () => {
		const mockGetVault = jest
			.fn()
			.mockResolvedValue({ id: "resolved-vault-id" });
		const mockGetItem = jest.fn().mockResolvedValue({
			fields: [
				{ label: "field", value: "resolved-via-connect", section: undefined },
			],
			sections: [],
		});
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: mockGetItem,
		});

		await loadSecrets(true);

		expect(mockGetVault).toHaveBeenCalledWith("vault");
		expect(mockGetItem).toHaveBeenCalledWith("resolved-vault-id", "item");
	});

	it("rejects when getItem fails", async () => {
		const mockGetVault = jest.fn().mockResolvedValue({ id: "vault-id-123" });
		const mockGetItem = jest
			.fn()
			.mockRejectedValue(new Error("Item not found"));
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: mockGetItem,
		});

		await expect(loadSecrets(true)).rejects.toThrow("Item not found");
	});

	it("resolves refs in different vaults using each vault id", async () => {
		delete process.env.MY_SECRET;
		process.env.SECRET_A = "op://vault-a/item1/field1";
		process.env.SECRET_B = "op://vault-b/item2/field2";
		const mockGetVault = jest
			.fn()
			.mockImplementation(async (vaultName: string) =>
				Promise.resolve({
					id: vaultName === "vault-a" ? "id-a" : "id-b",
				}),
			);
		const mockGetItem = jest
			.fn()
			.mockResolvedValueOnce({
				fields: [{ label: "field1", value: "value-a", section: undefined }],
				sections: [],
			})
			.mockResolvedValueOnce({
				fields: [{ label: "field2", value: "value-b", section: undefined }],
				sections: [],
			});
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: mockGetItem,
		});

		await loadSecrets(true);

		expect(mockGetVault).toHaveBeenCalledWith("vault-a");
		expect(mockGetVault).toHaveBeenCalledWith("vault-b");
		expect(mockGetItem).toHaveBeenNthCalledWith(1, "id-a", "item1");
		expect(mockGetItem).toHaveBeenNthCalledWith(2, "id-b", "item2");
		expect(core.exportVariable).toHaveBeenCalledWith("SECRET_A", "value-a");
		expect(core.exportVariable).toHaveBeenCalledWith("SECRET_B", "value-b");
	});

	it("throws on invalid ref before calling Connect", async () => {
		delete process.env.MY_SECRET;
		process.env.BAD_REF = "op://x";
		const mockGetVault = jest.fn();
		const mockGetItem = jest.fn();
		(OnePasswordConnect as jest.Mock).mockReturnValue({
			getVault: mockGetVault,
			getItem: mockGetItem,
		});

		await expect(loadSecrets(true)).rejects.toThrow(/invalid|reference/i);
		expect(mockGetVault).not.toHaveBeenCalled();
		expect(mockGetItem).not.toHaveBeenCalled();
	});

	describe("core.exportVariable", () => {
		it("is called when shouldExportEnv is true", async () => {
			await loadSecrets(true);

			expect(core.exportVariable).toHaveBeenCalledTimes(2);
			expect(core.exportVariable).toHaveBeenCalledWith(
				"MY_SECRET",
				"resolved-via-connect",
			);
			expect(core.exportVariable).toHaveBeenCalledWith(
				envManagedVariables,
				"MY_SECRET",
			);
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

	it("wraps createClient errors with a descriptive message", async () => {
		(createClient as jest.Mock).mockRejectedValue(
			new Error("invalid token format"),
		);
		await expect(loadSecrets(false)).rejects.toThrow(
			"Service account authentication failed: invalid token format",
		);
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

	describe("secret reference validation", () => {
		it("fails with clear message when a secret reference is invalid", async () => {
			process.env.MY_SECRET = "op://x";
			(Secrets.validateSecretReference as jest.Mock).mockImplementationOnce(
				() => {
					throw new Error("invalid reference format");
				},
			);

			await expect(loadSecrets(true)).rejects.toThrow(
				"Invalid secret reference(s): MY_SECRET",
			);
			expect(mockResolve).not.toHaveBeenCalled();
		});

		it("validates all refs before resolving any secrets", async () => {
			process.env.MY_SECRET = "op://vault/item/field";
			process.env.OTHER = "op://vault/other/item";
			(Secrets.validateSecretReference as jest.Mock).mockImplementation(
				(ref: string) => {
					if (ref === "op://vault/other/item") {
						throw new Error("invalid");
					}
				},
			);

			await expect(loadSecrets(false)).rejects.toThrow(
				"Invalid secret reference(s): OTHER",
			);
			expect(mockResolve).not.toHaveBeenCalled();
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

describe("findMatchingFieldAndFile", () => {
	interface TestField {
		id?: string;
		label?: string;
		value?: string | null;
		section?: { id: string } | null | undefined;
	}
	interface TestFile {
		id?: string;
		name?: string;
		section?: { id: string } | null | undefined;
	}

	const item = (opts: { fields?: TestField[]; files?: TestFile[] }): FullItem =>
		({
			fields: opts.fields ?? [],
			files: opts.files ?? [],
			sections: [],
		}) as unknown as FullItem;

	const find = (
		opts: { fields?: TestField[]; files?: TestFile[] },
		sectionIds: string[] = [],
	) => findMatchingFieldAndFile(item(opts), "password", sectionIds);

	describe("when section filter is used (sectionIds.length > 0)", () => {
		it.each<{
			name: string;
			itemOpts: { fields?: TestField[]; files?: TestFile[] };
			expected: { fieldValue?: string; fileId?: string };
		}>([
			{
				name: "returns field value when one field matches query and is in ref sections",
				itemOpts: {
					fields: [
						{
							id: "f1",
							label: "password",
							value: "secret123",
							section: { id: "section-1" },
						},
					],
				},
				expected: { fieldValue: "secret123" },
			},
			{
				name: "returns file id when one file matches query and is in ref sections",
				itemOpts: {
					files: [
						{
							id: "file-uuid",
							name: "password",
							section: { id: "section-1" },
						},
					],
				},
				expected: { fileId: "file-uuid" },
			},
			{
				name: "returns empty object when no field or file matches",
				itemOpts: {
					fields: [
						{ label: "other", value: "x", section: { id: "section-1" } },
					],
					files: [],
				},
				expected: {},
			},
			{
				name: "returns field value when field matches by id",
				itemOpts: {
					fields: [
						{
							id: "password",
							label: "Password Label",
							value: "secret-by-id",
							section: { id: "section-1" },
						},
					],
				},
				expected: { fieldValue: "secret-by-id" },
			},
		])("$name", ({ itemOpts, expected }) => {
			expect(find(itemOpts, ["section-1"])).toEqual(expected);
		});

		it.each<{
			name: string;
			itemOpts: { fields?: TestField[]; files?: TestFile[] };
			error: RegExp;
		}>([
			{
				name: "throws when multiple fields match",
				itemOpts: {
					fields: [
						{ label: "password", value: "a", section: { id: "section-1" } },
						{ label: "password", value: "b", section: { id: "section-1" } },
					],
				},
				error: /Multiple matches/,
			},
			{
				name: "throws when multiple files match",
				itemOpts: {
					files: [
						{ id: "id1", name: "password", section: { id: "section-1" } },
						{ id: "id2", name: "password", section: { id: "section-1" } },
					],
				},
				error: /Multiple matches/,
			},
			{
				name: "throws when both a field and a file match",
				itemOpts: {
					fields: [
						{ label: "password", value: "v", section: { id: "section-1" } },
					],
					files: [
						{ id: "fid", name: "password", section: { id: "section-1" } },
					],
				},
				error: /Both a field and a file match/,
			},
			{
				name: "throws when field has no value",
				itemOpts: {
					fields: [
						{ label: "password", value: null, section: { id: "section-1" } },
					],
				},
				error: /has no value/,
			},
		])("$name", ({ itemOpts, error }) => {
			expect(() => find(itemOpts, ["section-1"])).toThrow(error);
		});
	});

	describe("when no section filter (sectionIds.length === 0)", () => {
		const sectionIds: string[] = [];

		it.each<{
			name: string;
			itemOpts: { fields?: TestField[]; files?: TestFile[] };
			expected: { fieldValue?: string; fileId?: string };
		}>([
			{
				name: "returns field value when one field has no section and matches query",
				itemOpts: {
					fields: [{ label: "password", value: "secret", section: undefined }],
				},
				expected: { fieldValue: "secret" },
			},
			{
				name: "returns file id when one file has no section and matches query",
				itemOpts: {
					files: [{ id: "file-id", name: "password", section: undefined }],
				},
				expected: { fileId: "file-id" },
			},
			{
				name: "returns field value from fallback (any section) when no field with no section matches",
				itemOpts: {
					fields: [
						{ label: "other", value: "x", section: undefined },
						{
							label: "password",
							value: "from-any-section",
							section: { id: "sec" },
						},
					],
				},
				expected: { fieldValue: "from-any-section" },
			},
			{
				name: "returns file id from fallback (any section) when no file with no section matches",
				itemOpts: {
					files: [
						{ id: "other", name: "x", section: undefined },
						{ id: "file-any", name: "password", section: { id: "sec" } },
					],
				},
				expected: { fileId: "file-any" },
			},
			{
				name: "returns empty object when no match",
				itemOpts: {
					fields: [{ label: "other", value: "x", section: undefined }],
					files: [],
				},
				expected: {},
			},
		])("$name", ({ itemOpts, expected }) => {
			expect(find(itemOpts, sectionIds)).toEqual(expected);
		});

		it.each<{
			name: string;
			itemOpts: { fields?: TestField[]; files?: TestFile[] };
			error: RegExp;
		}>([
			{
				name: "throws when multiple fields with no section match",
				itemOpts: {
					fields: [
						{ label: "password", value: "a", section: undefined },
						{ label: "password", value: "b", section: undefined },
					],
				},
				error: /Multiple matches/,
			},
			{
				name: "throws when multiple files with no section match",
				itemOpts: {
					files: [
						{ id: "1", name: "password", section: undefined },
						{ id: "2", name: "password", section: undefined },
					],
				},
				error: /Multiple matches/,
			},
			{
				name: "throws when both field and file match",
				itemOpts: {
					fields: [{ label: "password", value: "value", section: undefined }],
					files: [{ id: "fid", name: "password", section: undefined }],
				},
				error: /Both a field and a file match/,
			},
		])("$name", ({ itemOpts, error }) => {
			expect(() => find(itemOpts, sectionIds)).toThrow(error);
		});
	});
});

describe("findSectionIdsByQuery", () => {
	it("throws when sections is empty", () => {
		expect(() => findSectionIdsByQuery([], "section-1")).toThrow(
			/Item has no sections; cannot resolve section "section-1"/,
		);
	});

	it("throws when sections is null/undefined", () => {
		expect(() =>
			findSectionIdsByQuery(undefined as unknown as FullItem["sections"], "x"),
		).toThrow(/Item has no sections; cannot resolve section "x"/);
	});

	it("throws when section query matches no section", () => {
		const sections = [{ id: "sec-1", label: "Other" }];
		expect(() =>
			findSectionIdsByQuery(sections as FullItem["sections"], "nonexistent"),
		).toThrow(/No section matching "nonexistent" found in specified item/);
	});

	it("returns section id when section matches by label", () => {
		const sections = [{ id: "sec-1", label: "My Section" }];
		expect(
			findSectionIdsByQuery(sections as FullItem["sections"], "My Section"),
		).toEqual(["sec-1"]);
	});

	it("throws when section query matches no section", () => {
		const sections = [{ id: "sec-1", label: "Other" }];
		expect(() =>
			findSectionIdsByQuery(sections as FullItem["sections"], "nonexistent"),
		).toThrow(/No section matching "nonexistent" found in specified item/);
	});

	it("returns multiple ids when multiple sections match", () => {
		const sections = [
			{ id: "sec-1", label: "A" },
			{ id: "sec-2", label: "A" },
		];
		expect(
			findSectionIdsByQuery(sections as FullItem["sections"], "A"),
		).toEqual(["sec-1", "sec-2"]);
	});
});

describe("parseOpRef", () => {
	it("parses 3-segment ref (vault/item/field)", () => {
		expect(parseOpRef("op://vault/item/field")).toEqual({
			vault: "vault",
			item: "item",
			field: "field",
			section: undefined,
		});
	});

	it("parses 4-segment ref (vault/item/section/field)", () => {
		expect(parseOpRef("op://vault/item/MySection/password")).toEqual({
			vault: "vault",
			item: "item",
			section: "MySection",
			field: "password",
		});
	});

	it("decodes URI-encoded segments", () => {
		expect(parseOpRef("op://my%20vault/my%20item/field")).toEqual({
			vault: "my vault",
			item: "my item",
			field: "field",
			section: undefined,
		});
	});

	it("throws when ref does not start with op://", () => {
		expect(() => parseOpRef("invalid-ref")).toThrow(
			/Invalid op reference: invalid-ref/,
		);
	});

	it("throws when segment count is invalid", () => {
		expect(() => parseOpRef("op://vault/item")).toThrow(
			/use op:\/\/<vault>\/<item>\/<field>/,
		);
		expect(() => parseOpRef("op://a/b/c/d/e")).toThrow(
			/use op:\/\/<vault>\/<item>\/<field>/,
		);
	});

	it("throws when vault or item or field is empty", () => {
		expect(() => parseOpRef("op:///item/field")).toThrow(/vault is required/);
		expect(() => parseOpRef("op://vault//field")).toThrow(/item is required/);
		expect(() => parseOpRef("op://vault/item/")).toThrow(/field is required/);
	});

	it("throws when 4-segment ref has empty section", () => {
		expect(() => parseOpRef("op://vault/item//field")).toThrow(
			/section is required when using 4 path segments/,
		);
	});

	it("throws when last segment is empty (trailing slash)", () => {
		expect(() => parseOpRef("op://vault/item/field/")).toThrow(
			/field is required/,
		);
	});
});

describe("getEnvVarNamesWithSecretRefs", () => {
	it("returns only env var names whose value is a string starting with op://", () => {
		process.env.OP_REF = "op://vault/item/field";
		process.env.NOT_OP_REF = "https://example.com";
		process.env.EMPTY_REF = "";
		process.env.OP_REF_OTHER = "op://other/vault/item/secret";

		const result = getEnvVarNamesWithSecretRefs();

		expect(result).toContain("OP_REF");
		expect(result).toContain("OP_REF_OTHER");
		expect(result).not.toContain("NOT_OP_REF");
		expect(result).not.toContain("EMPTY_REF");
	});
});
