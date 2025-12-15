import * as core from "@actions/core";

import { ReleaseChannel } from "./constants";
import { getLatestVersion } from "./helper";
import { validateVersion } from "./validate";

export class VersionResolver {
	private version: string;

	public constructor(version: string) {
		this.validate(version);
		this.version = version;
	}

	public get(): string {
		return this.version;
	}

	public async resolve(): Promise<void> {
		core.info(`Resolving version: ${this.version}`);
		if (!this.version) {
			core.error("Version is not provided");
			throw new Error("Version is not provided");
		}

		if (this.isReleaseChannel(this.version)) {
			this.version = await getLatestVersion(this.version);
		}

		// add `v` prefix if not already present
		this.version = this.version.startsWith("v")
			? this.version
			: `v${this.version}`;
	}

	private validate(version: string) {
		core.info(`Validating version number: '${version}'`);
		validateVersion(version);
		core.info(`Version number '${version}' is valid`);
	}

	private isReleaseChannel(value: string): value is ReleaseChannel {
		return Object.values(ReleaseChannel).includes(value as ReleaseChannel);
	}
}
