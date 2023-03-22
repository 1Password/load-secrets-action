import * as core from "@actions/core";
import * as exec from "@actions/exec";
import path from "path";
async function run() {
    try {
        const parentDir = path.resolve(__dirname, "..");
        // Get action inputs
        process.env.INPUT_UNSET_PREVIOUS = core.getInput("unset-previous");
        process.env.INPUT_EXPORT_ENV = core.getInput("export-env");
        // Execute bash script
        await exec.exec(`sh -c "` + parentDir + `/entrypoint.sh"`);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
run();
