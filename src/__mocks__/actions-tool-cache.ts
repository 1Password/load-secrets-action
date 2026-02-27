module.exports = {
	downloadTool: jest.fn(),
	extractTar: jest.fn(),
	extractZip: jest.fn(),
	cacheDir: jest.fn<Promise<string>, [string]>(async (dir) => {
		await Promise.resolve();
		return dir;
	}),
	find: jest.fn<string, [string, string?, string?]>(() => ""),
};
