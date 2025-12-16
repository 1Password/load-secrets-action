import os from "os";

import { newCliInstaller } from "./installer";
import { LinuxInstaller } from "./linux";
import { MacOsInstaller } from "./macos";
import { WindowsInstaller } from "./windows";

afterEach(() => {
	jest.restoreAllMocks();
});

describe("newCliInstaller", () => {
	const version = "1.0.0";

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("should return LinuxInstaller for linux platform", () => {
		jest.spyOn(os, "platform").mockReturnValue("linux");
		const installer = newCliInstaller(version);
		expect(installer).toBeInstanceOf(LinuxInstaller);
	});

	it("should return MacOsInstaller for darwin platform", () => {
		jest.spyOn(os, "platform").mockReturnValue("darwin");
		const installer = newCliInstaller(version);
		expect(installer).toBeInstanceOf(MacOsInstaller);
	});

	it("should return WindowsInstaller for win32 platform", () => {
		jest.spyOn(os, "platform").mockReturnValue("win32");
		const installer = newCliInstaller(version);
		expect(installer).toBeInstanceOf(WindowsInstaller);
	});

	it("should throw error for unsupported platform", () => {
		jest.spyOn(os, "platform").mockReturnValue("sunos");
		expect(() => newCliInstaller(version)).toThrow(
			"Unsupported platform: sunos",
		);
	});
});
