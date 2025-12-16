import os from "os";

import {
	archMap,
	cliUrlBuilder,
	type SupportedPlatform,
} from "./cli-installer";
import { MacOsInstaller } from "./macos";

afterEach(() => {
	jest.restoreAllMocks();
});

describe("MacOsInstaller", () => {
	const version = "1.2.3";
	const arch: NodeJS.Architecture = "x64";

	it("should construct with given version and architecture", () => {
		jest.spyOn(os, "arch").mockReturnValue(arch);
		const installer = new MacOsInstaller(version);
		expect(installer.version).toEqual(version);
		expect(installer.arch).toEqual(archMap[arch]);
	});

	it("should call install with correct URL", async () => {
		const installer = new MacOsInstaller(version);
		const installMock = jest.spyOn(installer, "install").mockResolvedValue();

		await installer.installCli();

		const builder = cliUrlBuilder["darwin" as SupportedPlatform];
		const url = builder(version, installer.arch);
		expect(installMock).toHaveBeenCalledWith(url);
	});
});
