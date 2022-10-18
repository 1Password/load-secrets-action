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

1. [Use secrets from the action's output](#use-secrets-from-the-actions-output)
2. [Export secrets as environment variables](#export-secrets-as-environment-variables)

### Use secrets from the action's output

This method allows you to use the loaded secrets outputted by the step: `steps.step-id.outputs.secret-name`.

You'll need to set an ID for the step to be able to access its outputs. For more information, see [`outputs.<output_id>`](https://docs.github.com/actions/creating-actions/metadata-syntax-for-github-actions#outputsoutput_id).

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Load secret
        id: op-load-secret
        uses: 1password/load-secrets-action@v1
        env:
          OP_CONNECT_HOST: <Your Connect instance URL>
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret

      - name: Print masked secret
        run: echo "Secret: ${{ steps.op-load-secret.outputs.SECRET }}"
        # Prints: Secret: ***
```

[Read the full documentation for more usage examples.](https://developer.1password.com/docs/connect/github-actions/#use-secrets-from-the-actions-output)

### Export secrets as environment variables

This method allows the action to access the loaded secrets as environment variables. These environment variables are accessible at a job level.

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Load secret
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
        env:
          OP_CONNECT_HOST: <Your Connect instance URL>
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret

      - name: Print masked secret
        run: echo "Secret: $SECRET"
        # Prints: Secret: ***
```

[Read the full documentation for more usage examples.](https://developer.1password.com/docs/connect/github-actions/#export-secrets-as-environment-variables)

## Masking

Similar to regular GitHub repository secrets, fields from 1Password will automatically be masked in GitHub Actions logs. If one of these values accidentally gets printed, it'll be replaced with `***`.

## Security

1Password requests you practice responsible disclosure if you discover a vulnerability.

Please file requests through [BugCrowd](https://bugcrowd.com/agilebits).

[Learn more about our security practices.](https://bugcrowd.com/agilebits)

## Get help

If you find yourself stuck, [contact 1Password support](https://support.1password.com/) for help.

[Read the full documentation](https://developer.1password.com/docs/connect/github-actions/).

