export enum ReleaseChannel {
	latest = "latest",
	latestBeta = "latest-beta",
}

export interface VersionResponse {
	// eslint disabled next line as CLI2 is expected in getting CLI versions response
	/* eslint-disable-next-line @typescript-eslint/naming-convention */
	CLI2: {
		release: { version: string };
		beta: { version: string };
	};
}
