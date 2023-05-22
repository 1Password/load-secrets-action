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
				// Note: We shouldn't need to include `isolatedModules` here because it's a deprecated config option in TS 5,
				// but setting it to `true` fixes the `ESM syntax is not allowed in a CommonJS module when
				// 'verbatimModuleSyntax' is enabled` error that we're seeing when running our Jest tests.
				isolatedModules: true,
				useESM: true,
			},
		],
	},
	verbose: true,
};

export default jestConfig;
