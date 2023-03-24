import path from "path";
import url from "url";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

const run = async () => {
	try {
		const currentFile = url.fileURLToPath(import.meta.url);
		const currentDir = path.dirname(currentFile);
		const parentDir = path.resolve(currentDir, "..");

		// Get action inputs
		process.env.INPUT_UNSET_PREVIOUS = core.getInput("unset-previous");
		process.env.INPUT_EXPORT_ENV = core.getInput("export-env");

		// Execute bash script
		await exec.exec(`sh -c "` + parentDir + `/entrypoint.sh"`);
	} catch (error) {
		// https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript
		let message = "Unknown Error";
		if (error instanceof Error) {
			message = error.message;
		}
		core.setFailed(message);
	}
};

void run();
