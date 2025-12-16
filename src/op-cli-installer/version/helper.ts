import * as core from "@actions/core";

import { ReleaseChannel, type VersionResponse } from "./constants";

// Returns the latest version of the 1Password CLI based on the specified channel.
export const getLatestVersion = async (
	channel: ReleaseChannel,
): Promise<string> => {
	core.info(`Getting ${channel} version number`);
	const res = await fetch("https://app-updates.agilebits.com/latest");
	const json = (await res.json()) as VersionResponse;
	const latestStable = json?.CLI2?.release?.version;
	const latestBeta = json?.CLI2?.beta?.version;
	const version =
		channel === ReleaseChannel.latestBeta ? latestBeta : latestStable;

	if (!version) {
		core.error(`No ${channel} versions found`);
		throw new Error(`No ${channel} versions found`);
	}

	return version;
};
