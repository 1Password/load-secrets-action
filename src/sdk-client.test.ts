import * as core from "@actions/core";
import { createClient } from "@1password/sdk";
import { envManagedVariables } from "./constants";
import { getOIDCToken, loadSecretsFromSDK } from "./sdk-client";

jest.mock("@1password/sdk");

const mockGetVariables = jest.fn();

beforeEach(() => {
	jest.clearAllMocks();
	(createClient as jest.Mock).mockResolvedValue({
		environments: {
			getVariables: mockGetVariables,
		},
	});
});

describe("getOIDCToken", () => {
	it("delegates to core.getIDToken", async () => {
		(core.getIDToken as jest.Mock).mockResolvedValue("oidc-token");

		await expect(getOIDCToken("test-audience")).resolves.toBe("oidc-token");
		expect(core.getIDToken).toHaveBeenCalledWith("test-audience");
	});
});

describe("loadSecretsFromSDK", () => {
	const workloadId = "workload-uuid";
	const environmentId = "environment-uuid";
	const integrationKey = "integration-key";

	const variables = [
		{ name: "DOCKERHUB_USERNAME", value: "myuser" },
		{ name: "DOCKERHUB_TOKEN", value: "mypassword" },
	];

	beforeEach(() => {
		mockGetVariables.mockResolvedValue({ variables });
	});

	it("sets secrets as step outputs by default", async () => {
		await loadSecretsFromSDK(workloadId, environmentId, integrationKey, false);

		expect(core.setOutput).toHaveBeenCalledWith("DOCKERHUB_USERNAME", "myuser");
		expect(core.setOutput).toHaveBeenCalledWith(
			"DOCKERHUB_TOKEN",
			"mypassword",
		);
		expect(core.exportVariable).not.toHaveBeenCalledWith(
			"DOCKERHUB_USERNAME",
			"myuser",
		);
		expect(core.setSecret).toHaveBeenCalledWith("myuser");
		expect(core.setSecret).toHaveBeenCalledWith("mypassword");
		expect(core.exportVariable).not.toHaveBeenCalledWith(
			envManagedVariables,
			expect.any(String),
		);
	});

	it("exports secrets as environment variables when shouldExportEnv is true", async () => {
		await loadSecretsFromSDK(workloadId, environmentId, integrationKey, true);

		expect(core.exportVariable).toHaveBeenCalledWith(
			"DOCKERHUB_USERNAME",
			"myuser",
		);
		expect(core.exportVariable).toHaveBeenCalledWith(
			"DOCKERHUB_TOKEN",
			"mypassword",
		);
		expect(core.setOutput).not.toHaveBeenCalled();
		expect(core.exportVariable).toHaveBeenCalledWith(
			envManagedVariables,
			"DOCKERHUB_USERNAME,DOCKERHUB_TOKEN",
		);
	});

	describe("when secret value is empty string", () => {
		beforeEach(() => {
			mockGetVariables.mockResolvedValue({
				variables: [{ name: "EMPTY_SECRET", value: "" }],
			});
		});

		it("sets empty string as step output", async () => {
			await loadSecretsFromSDK(
				workloadId,
				environmentId,
				integrationKey,
				false,
			);

			expect(core.setOutput).toHaveBeenCalledWith("EMPTY_SECRET", "");
			expect(core.setSecret).not.toHaveBeenCalledWith("");
		});

		it("sets empty string as environment variable", async () => {
			await loadSecretsFromSDK(workloadId, environmentId, integrationKey, true);

			expect(core.exportVariable).toHaveBeenCalledWith("EMPTY_SECRET", "");
			expect(core.setSecret).not.toHaveBeenCalledWith("");
		});
	});

	it("does not export OP_MANAGED_VARIABLES when no variables are returned", async () => {
		mockGetVariables.mockResolvedValue({ variables: [] });

		await loadSecretsFromSDK(workloadId, environmentId, integrationKey, true);

		expect(core.exportVariable).not.toHaveBeenCalled();
	});
});
