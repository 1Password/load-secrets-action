import * as path from "path";

import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import {
	CliInstaller,
	cliUrlBuilder,
	type SupportedPlatform,
} from "./cli-installer";
import type { Installer } from "./installer";
import { verifyLinuxSignature } from "./linux-signature";

export class LinuxInstaller extends CliInstaller implements Installer {
	private readonly platform: SupportedPlatform = "linux"; // Node.js platform identifier for Linux

	public constructor(version: string) {
		super(version);
	}

	public async installCli(): Promise<void> {
		const urlBuilder = cliUrlBuilder[this.platform];
		await this.install(urlBuilder(this.version, this.arch));
	}

	public override async install(url: string): Promise<void> {
		console.info(`Downloading 1Password CLI from: ${url}`);
		const downloadPath = await tc.downloadTool(url);
		console.info("Installing 1Password CLI");
		const extractedPath = await tc.extractZip(downloadPath);

		core.info("Verifying 1Password CLI signature");
		await verifyLinuxSignature(
			path.join(extractedPath, "op"),
			path.join(extractedPath, "op.sig"),
		);
		core.info("1Password CLI signature verified");

		core.addPath(extractedPath);
		core.info("1Password CLI installed");
	}
}
