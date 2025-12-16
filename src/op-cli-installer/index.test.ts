import * as core from "@actions/core";

import { newCliInstaller } from "./github-action/cli-installer";
import {
	installCliOnGithubActionRunner,
	ReleaseChannel,
	VersionResolver,
} from "./index";

jest.mock("./github-action/cli-installer", () => ({
	newCliInstaller: jest.fn().mockImplementation((_resolved: string) => ({
		installCli: jest.fn(),
	})),
}));

beforeEach(() => {
	jest.restoreAllMocks();
});

describe("installCliOnGithubActionRunner", () => {
	it("should defaults to `latest` when nothing is passed", async () => {
		jest.spyOn(core, "getInput").mockReturnValue("");
		jest.spyOn(VersionResolver.prototype, "resolve").mockResolvedValue();
		jest
			.spyOn(VersionResolver.prototype, "get")
			.mockReturnValue(ReleaseChannel.latest);

		await installCliOnGithubActionRunner();

		expect(newCliInstaller).toHaveBeenCalledWith(ReleaseChannel.latest);
	});

	it("should defaults to `latest` when undefined is passed", async () => {
		jest.spyOn(core, "getInput").mockReturnValue("");
		jest.spyOn(VersionResolver.prototype, "resolve").mockResolvedValue();
		jest
			.spyOn(VersionResolver.prototype, "get")
			.mockReturnValue(ReleaseChannel.latest);

		await installCliOnGithubActionRunner(undefined);

		expect(newCliInstaller).toHaveBeenCalledWith(ReleaseChannel.latest);
	});

	it("should set provided explicit version", async () => {
		const providedVersion = "1.2.3";
		jest.spyOn(core, "getInput").mockReturnValue("");
		jest.spyOn(VersionResolver.prototype, "resolve").mockResolvedValue();
		jest
			.spyOn(VersionResolver.prototype, "get")
			.mockReturnValue(providedVersion);

		await installCliOnGithubActionRunner(providedVersion);

		expect(newCliInstaller).toHaveBeenCalledWith(providedVersion);
	});

	it("should set version provided as job input", async () => {
		const providedVersion = "3.0.0";
		jest.spyOn(core, "getInput").mockReturnValue(providedVersion);
		jest.spyOn(VersionResolver.prototype, "resolve").mockResolvedValue();
		jest
			.spyOn(VersionResolver.prototype, "get")
			.mockReturnValue(providedVersion);

		await installCliOnGithubActionRunner();

		expect(newCliInstaller).toHaveBeenCalledWith(providedVersion);
	});

	it("should throw error for invalid version", async () => {
		const providedVersion = "invalid";
		jest.spyOn(core, "getInput").mockReturnValue(providedVersion);
		jest.spyOn(VersionResolver.prototype, "resolve").mockResolvedValue();
		jest
			.spyOn(VersionResolver.prototype, "get")
			.mockReturnValue(providedVersion);

		await expect(installCliOnGithubActionRunner()).rejects.toThrow();
	});
});
