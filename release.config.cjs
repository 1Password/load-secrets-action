/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
	// TODO: This branch is for PR testing purposes, update to "main" if we proceed with this PR.
	branches: ["ruetz-automate-releases"],
	// TODO: Remove `dryRun` configuration if we proceed with this PR.
	dryRun: true,
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/github",
	],
};
