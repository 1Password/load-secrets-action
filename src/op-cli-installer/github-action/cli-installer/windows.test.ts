import fs from "fs";
import os from "os";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import {
	archMap,
	cliUrlBuilder,
	type SupportedPlatform,
} from "./cli-installer";
import { WindowsInstaller } from "./windows";

jest.mock("fs");

afterEach(() => {
	jest.restoreAllMocks();
});

describe("WindowsInstaller", () => {
	const version = "1.2.3";
	const arch: NodeJS.Architecture = "x64";

	it("should construct with given version and architecture", () => {
		jest.spyOn(os, "arch").mockReturnValue(arch);
		const installer = new WindowsInstaller(version);
		expect(installer.version).toEqual(version);
		expect(installer.arch).toEqual(archMap[arch]);
	});

	it("should call install with correct URL", async () => {
		const installer = new WindowsInstaller(version);
		const installMock = jest.spyOn(installer, "install").mockResolvedValue();

		await installer.installCli();

		const builder = cliUrlBuilder["win32" as SupportedPlatform];
		const url = builder(version, installer.arch);
		expect(installMock).toHaveBeenCalledWith(url);
	});

	it("should rename downloaded file with .zip extension before extracting", async () => {
		const downloadPath = "/tmp/abc-123";
		const extractedPath = "/tmp/extracted";

		(tc.downloadTool as jest.Mock).mockResolvedValue(downloadPath);
		(tc.extractZip as jest.Mock).mockResolvedValue(extractedPath);

		const installer = new WindowsInstaller(version);
		await installer.installCli();

		expect(tc.downloadTool).toHaveBeenCalled();
		expect(fs.renameSync).toHaveBeenCalledWith(
			downloadPath,
			`${downloadPath}.zip`,
		);
		expect(tc.extractZip).toHaveBeenCalledWith(`${downloadPath}.zip`);
		expect(core.addPath).toHaveBeenCalledWith(extractedPath);
	});
});
