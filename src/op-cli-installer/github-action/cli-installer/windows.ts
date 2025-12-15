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
		await super.install(urlBuilder(this.version, this.arch));
	}
}
