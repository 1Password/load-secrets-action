const lintStagedConfig = {
	// run formatting and linting on all supported file types
	"*.{js,json,md,ts,yaml,yml}": "npm run format:write",
	"*.{js,ts}": ["npm run lint:fix"],
	// run testing on all supported file types within the src/ directory
	"src/**/*.{js,ts}": ["npm run test -- --findRelatedTests"],
};

export default lintStagedConfig;
