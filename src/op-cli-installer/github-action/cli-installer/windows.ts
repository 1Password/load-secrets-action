import * as fs from "fs";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import {
	CliInstaller,
	cliUrlBuilder,
	type SupportedPlatform,
} from "./cli-installer";
import type { Installer } from "./installer";

export class WindowsInstaller extends CliInstaller implements Installer {
	private readonly platform: SupportedPlatform = "win32"; // Node.js platform identifier for Windows

	public constructor(version: string) {
		super(version);
	}

	public async installCli(): Promise<void> {
		const urlBuilder = cliUrlBuilder[this.platform];
		await this.install(urlBuilder(this.version, this.arch));
	}

	// Windows PowerShell's Expand-Archive requires files to have a .zip extension.
	// tc.downloadTool saves to a UUID filename with no extension, so we rename it.
	public override async install(url: string): Promise<void> {
		console.info(`Downloading 1Password CLI from: ${url}`);
		const downloadPath = await tc.downloadTool(url);
		const zipPath = `${downloadPath}.zip`;
		fs.renameSync(downloadPath, zipPath);
		console.info("Installing 1Password CLI");
		const extractedPath = await tc.extractZip(zipPath);
		core.addPath(extractedPath);
		core.info("1Password CLI installed");
	}
}
