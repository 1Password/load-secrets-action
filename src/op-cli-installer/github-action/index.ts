import * as core from "@actions/core";

import { ReleaseChannel, VersionResolver } from "../version";

import { newCliInstaller } from "./cli-installer";

// Installs the 1Password CLI on a GitHub Action runner.
export const installCliOnGithubActionRunner = async (
	version?: string,
): Promise<void> => {
	// Get the version from parameter, if not passed - from the job input. Defaults to latest if no version is provided
	const providedVersion =
		version || core.getInput("version") || ReleaseChannel.latest;
	const versionResolver = new VersionResolver(providedVersion);
	await versionResolver.resolve();
	const installer = newCliInstaller(versionResolver.get());
	await installer.installCli();
};
