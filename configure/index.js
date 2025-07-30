const fs = require("fs");
const os = require("os");
const core = require("@actions/core");

// configure manually appends env vars to GITHUB_ENV variable
// We cannot use `core.exportVariable` because it will set env var for the current process
// therefore those env vars will not be available for the next steps in the workflow
const configure = () => {
	const OP_CONNECT_HOST = core.getInput("connect-host", { required: false }) || process.env.OP_CONNECT_HOST;
	const OP_CONNECT_TOKEN = core.getInput("connect-token", { required: false }) || process.env.OP_CONNECT_TOKEN;
	const OP_SERVICE_ACCOUNT_TOKEN = core.getInput("service-account-token", { required: false }) || process.env.OP_SERVICE_ACCOUNT_TOKEN;

	const githubEnvPath = process.env["GITHUB_ENV"];
	if (!githubEnvPath) {
		core.setFailed("GITHUB_ENV is not defined");
		return;
	}

	const setEnv = (key, value) => {
		if (value) {
			fs.appendFileSync(githubEnvPath, `${key}=${value}${os.EOL}`, {
				encoding: "utf8",
			});
		}
	};

	setEnv("OP_CONNECT_HOST", OP_CONNECT_HOST);
	setEnv("OP_CONNECT_TOKEN", OP_CONNECT_TOKEN);
	setEnv("OP_SERVICE_ACCOUNT_TOKEN", OP_SERVICE_ACCOUNT_TOKEN);
};

configure();
