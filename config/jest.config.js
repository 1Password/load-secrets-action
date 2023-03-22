const jestConfig = {
	// https://stackoverflow.com/questions/69567201/coveragepathignorepatterns-ignore-files-with-specific-ending
	coveragePathIgnorePatterns: ["node_modules/"],
	/**
	 * Jest docs: "We recommend placing the extensions most commonly used in your project
	 *             on the left, so if you are using TypeScript, you may want to consider
	 *             moving 'ts' to the beginning of the array."
	 *
	 * https://jestjs.io/docs/configuration#modulefileextensions-arraystring
	 */
	moduleFileExtensions: ["ts", "js", "json"],
	rootDir: "../src/",
	testEnvironment: "node",
	testRegex: "<rootDir>(/__tests__/.*|(\\.|/)test)\\.ts",
	transform: {
		".ts": [
			"ts-jest",
			// required due to custom location of tsconfig.json configuration file
			// https://kulshekhar.github.io/ts-jest/docs/getting-started/options/tsconfig/
			{ tsconfig: "config/tsconfig.json" },
		],
	},
	verbose: true,
};

export default jestConfig;
