import semver from "semver";

import { ReleaseChannel } from "./constants";

// Validates if the provided version type is a valid enum value or a valid semver version.
export const validateVersion = (input: string): void => {
	if (Object.values(ReleaseChannel).includes(input as ReleaseChannel)) {
		return;
	}

	// 1Password beta releases (aka 2.19.0-beta.01) are not semver compliant.
	// According to semver, it should be "2.19.0-beta.1".
	// That's why we need to normalize them before validating.
	// Accepts valid semver versions like "2.18.0" or beta-releases like "2.19.0-beta.01"
	// or versions with 'v' prefix like "v2.19.0"
	const normalized = input.replace(/-beta\.0*(\d+)/, "-beta.$1");
	const normInput = new semver.SemVer(normalized);
	if (semver.valid(normInput)) {
		return;
	}

	throw new Error(`Invalid version input: ${input}`);
};
