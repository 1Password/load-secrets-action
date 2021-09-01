import * as core from '@actions/core';
import * as exec from '@actions/exec';
import path from 'path';

async function run(): Promise<void> {
  try {
    const parentDir = path.resolve(__dirname, '..');
    
    // Get action inputs
    const unsetPrevious = core.getInput('unset-previous');
    const exportEnv = core.getInput('export-env');

    // Execute bash script
    await exec.exec(`sh -c "` +
      `INPUT_UNSET_PREVIOUS=` + unsetPrevious + ` ` +
      `INPUT_EXPORT_ENV=` + exportEnv + ` ` + 
      parentDir + `/entrypoint.sh"`);

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
