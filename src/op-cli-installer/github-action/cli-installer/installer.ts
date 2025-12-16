import os from "os";

import { LinuxInstaller } from "./linux";
import { MacOsInstaller } from "./macos";
import { WindowsInstaller } from "./windows";

export interface Installer {
	installCli(): Promise<void>;
}

export const newCliInstaller = (version: string): Installer => {
	const platform = os.platform();
	switch (platform) {
		case "linux":
			return new LinuxInstaller(version);
		case "darwin":
			return new MacOsInstaller(version);
		case "win32":
			return new WindowsInstaller(version);
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}
};
