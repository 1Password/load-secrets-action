const core = require("@actions/core");

const configure = () => {
	const OP_CONNECT_HOST =
		process.env.INPUT_CONNECT_HOST || process.env.OP_CONNECT_HOST;
	const OP_CONNECT_TOKEN =
		process.env.INPUT_CONNECT_TOKEN || process.env.CONNECT_TOKEN;
	const OP_SERVICE_ACCOUNT_TOKEN =
		process.env.INPUT_SERVICE_ACCOUNT_TOKEN ||
		process.env.SERVICE_ACCOUNT_TOKEN;

	if (OP_CONNECT_HOST) {
		core.exportVariable("OP_CONNECT_HOST", OP_CONNECT_HOST);
	}

	if (OP_CONNECT_TOKEN) {
		core.exportVariable("OP_CONNECT_TOKEN", OP_CONNECT_TOKEN);
	}

	if (OP_SERVICE_ACCOUNT_TOKEN) {
		core.exportVariable("OP_SERVICE_ACCOUNT_TOKEN", OP_SERVICE_ACCOUNT_TOKEN);
	}
};

configure();
