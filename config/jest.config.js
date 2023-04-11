const jestConfig = {
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
	testRegex: "(/__tests__/.*|(\\.|/)test)\\.ts",
	transform: {
		".ts": [
			"ts-jest",
			{
				isolatedModules: true,
				useESM: true,
			},
		],
	},
	verbose: true,
};

export default jestConfig;
