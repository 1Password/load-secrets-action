/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
	// TODO: This branch is for PR testing purposes; update branch to "main" if we proceed with this PR.
	branches: ["ruetz-automate-releases"],
	// TODO: Remove `dryRun` configuration if we proceed with this PR.
	dryRun: true,
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/github",
	],
	// Use the `https` Git protocol here to prevent semantic-release from erroring
	// on the SSH protocol used in `repository.url` in the package.json file.
	repositoryUrl: "https://github.com/1Password/load-secrets-action.git",
};
