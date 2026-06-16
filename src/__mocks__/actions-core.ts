module.exports = {
	getInput: jest.fn(() => ""),
	getBooleanInput: jest.fn(() => false),
	setOutput: jest.fn(),
	setSecret: jest.fn(),
	exportVariable: jest.fn(),
	setFailed: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	addPath: jest.fn(),
	isDebug: jest.fn(() => false),
	// eslint-disable-next-line @typescript-eslint/naming-convention
	getIDToken: jest.fn().mockResolvedValue("mock-oidc-token"),
};
