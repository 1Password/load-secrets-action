# Load Secrets from 1Password - GitHub Action

`load-secrets-action` loads secrets from 1Password into GitHub Actions using [1Password Connect](https://developer.1password.com/docs/connect).

Specify in your workflow YAML file which secrets from 1Password should be loaded into your job, and the action will make them available as environment variables for the next steps.

## Requirements

Before you get started, you'll need to:

- [Deploy 1Password Connect](https://developer.1password.com/docs/connect/get-started#step-2-deploy-1password-connect-server) in your infrastructure.
- Set the `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` environment variables to your Connect instance's credentials, so it'll be used to load secrets.

### Supported runners

You can run the action on Mac and Linux runners. Windows is currently not supported.

## 1Password configuration

By default, you'll need to set the environment variables for your Connect instance in the step that uses `load-secrets-action`.

If you're using the action more than once in a single job, [you can use the `configure` action](https://developer.1password.com/docs/connect/github-actions/#1password-configuration) to set the environment variables instead, so you don't have to set them separately in each `load-secrets-action` step.

## Usage

You can load secrets using the action in two ways:

1. [Use secrets from the action's output](https://developer.1password.com/docs/connect/github-actions/#use-secrets-from-the-actions-output)
2. [Export secrets as environment variables](https://developer.1password.com/docs/connect/github-actions/#export-secrets-as-environment-variables)

## Masking

Similar to regular GitHub repository secrets, fields from 1Password will automatically be masked in GitHub Actions logs. If one of these values accidentally gets printed, it'll be replaced with `***`.

## Security

1Password requests you practice responsible disclosure if you discover a vulnerability.

Please file requests through [BugCrowd](https://bugcrowd.com/agilebits).

[Learn more about our security practices.](https://bugcrowd.com/agilebits)

## Get help

If you find yourself stuck, [contact 1Password support](https://support.1password.com/) for help.

[Read the full documentation](https://developer.1password.com/docs/connect/github-actions/).

