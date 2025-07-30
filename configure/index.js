const core = require("@actions/core");

const configure = () => {
	const OP_CONNECT_HOST =
		core.getInput("connect-host", { required: false }) ||
		process.env.OP_CONNECT_HOST;
	const OP_CONNECT_TOKEN =
		core.getInput("connect-token", { required: false }) ||
		process.env.OP_CONNECT_TOKEN;
	const OP_SERVICE_ACCOUNT_TOKEN =
		core.getInput("service-account-token", { required: false }) ||
		process.env.OP_SERVICE_ACCOUNT_TOKEN;

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
