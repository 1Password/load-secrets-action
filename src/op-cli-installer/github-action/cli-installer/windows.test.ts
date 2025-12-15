import os from "os";

import {
	archMap,
	CliInstaller,
	cliUrlBuilder,
	type SupportedPlatform,
} from "./cli-installer";
import { WindowsInstaller } from "./windows";

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
		const installMock = jest
			.spyOn(CliInstaller.prototype, "install")
			.mockResolvedValue();

		await installer.installCli();

		const builder = cliUrlBuilder["win32" as SupportedPlatform];
		const url = builder(version, installer.arch);
		expect(installMock).toHaveBeenCalledWith(url);
	});
});
