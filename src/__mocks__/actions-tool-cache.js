module.exports = {
	downloadTool: jest.fn(),
	extractTar: jest.fn(),
	extractZip: jest.fn(),
	cacheDir: jest.fn((dir) => Promise.resolve(dir)),
	find: jest.fn(() => ""),
};
