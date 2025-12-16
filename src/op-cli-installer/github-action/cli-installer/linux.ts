import {
	CliInstaller,
	cliUrlBuilder,
	type SupportedPlatform,
} from "./cli-installer";
import type { Installer } from "./installer";

export class LinuxInstaller extends CliInstaller implements Installer {
	private readonly platform: SupportedPlatform = "linux"; // Node.js platform identifier for Linux

	public constructor(version: string) {
		super(version);
	}

	public async installCli(): Promise<void> {
		const urlBuilder = cliUrlBuilder[this.platform];
		await super.install(urlBuilder(this.version, this.arch));
	}
}
