import os from "os";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

export type SupportedPlatform = Extract<
	NodeJS.Platform,
	"linux" | "darwin" | "win32"
>;

// maps OS architecture names to 1Password CLI installer architecture names
export const archMap: Record<string, string> = {
	ia32: "386",
	x64: "amd64",
	arm: "arm",
	arm64: "arm64",
};

// Builds the download URL for the 1Password CLI based on the platform and version.
export const cliUrlBuilder: Record<
	SupportedPlatform,
	(version: string, arch?: string) => string
> = {
	linux: (version, arch) =>
		`https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_linux_${arch}_${version}.zip`,
	darwin: (version) =>
		`https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_apple_universal_${version}.pkg`,
	win32: (version, arch) =>
		`https://cache.agilebits.com/dist/1P/op2/pkg/${version}/op_windows_${arch}_${version}.zip`,
};

export class CliInstaller {
	public readonly version: string;
	public readonly arch: string;

	public constructor(version: string) {
		this.version = version;
		this.arch = this.getArch();
	}

	public async install(url: string): Promise<void> {
		console.info(`Downloading 1Password CLI from: ${url}`);
		const downloadPath = await tc.downloadTool(url);
		console.info("Installing 1Password CLI");
		const extractedPath = await tc.extractZip(downloadPath);
		core.addPath(extractedPath);
		core.info("1Password CLI installed");
	}

	private getArch(): string {
		const arch = archMap[os.arch()];
		if (!arch) {
			throw new Error("Unsupported architecture");
		}

		return arch;
	}
}
