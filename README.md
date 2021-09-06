# Load Secrets from 1Password - GitHub Action

This action loads secrets from [1Password Connect](https://1password.com/secrets/) into GitHub Actions.

Specify right from your workflow YAML which secrets from 1Password should be loaded into your job, and the action will make them available as environment variables for the next steps.

## Prerequisites 
 - [1Password Connect](https://support.1password.com/secrets-automation/#step-2-deploy-a-1password-connect-server) deployed in your infrastructure

## Usage

There are two ways that secrets can be loaded:
 - [use the secrets from the action's ouput](#use-secrets-from-the-actions-output)
 - [export secrets as environment variables](#export-secrets-as-environment-variables)

### Use secrets from the action's output

This approach enables the user to use the loaded secrets as an output from the step: `steps.step-id.outputs.secret-name`. You need to set an id for the step that uses this action to be able to access its outputs. More details about the metadata syntax [here](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#outputsoutput_id).

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

<details>
<summary><b>Longer usage example</b></summary>

```yml
on: push
name: Deploy app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          # Persist the 1Password Connect URL for next steps. You can also persist 
          # the Connect token using input `connect-token`, but keep in mind that 
          # every single step in the job would then be able to access the token.
          connect-host: https://1password.acme.com

      - name: Load Docker credentials
        id: load-docker-credentials
        uses: 1password/load-secrets-action@v1
        env:
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          DOCKERHUB_USERNAME: op://app-cicd/docker/username
          DOCKERHUB_TOKEN: op://app-cicd/docker/token

      - name: Login to Docker Hub
        uses: docker/login-action@v1
        with:
          username: ${{ steps.load-docker-credentials.outputs.DOCKERHUB_USERNAME }}
          password: ${{ steps.load-docker-credentials.outputs.DOCKERHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v2
        with:
          push: true
          tags: acme/app:latest
```
</details>

### Export secrets as environment variables

In this approach, the user can access the loaded secrets as environment variables. These environment variables are accessible at a job level.

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
<details>
<summary><b>Longer usage example</b></summary>

```yml
on: push
name: Deploy app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          # Persist the 1Password Connect URL for next steps. You can also persist 
          # the Connect token using input `connect-token`, but keep in mind that 
          # every single step in the job would then be able to access the token.
          connect-host: https://1password.acme.com

      - name: Load Docker credentials
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
        env:
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          DOCKERHUB_USERNAME: op://app-cicd/docker/username
          DOCKERHUB_TOKEN: op://app-cicd/docker/token

      - name: Login to Docker Hub
        uses: docker/login-action@v1
        with:
          username: ${{ env.DOCKERHUB_USERNAME }}
          password: ${{ env.DOCKERHUB_TOKEN }}

      - name: Print environment variables with masked secrets
        run: printenv

      - name: Build and push Docker image
        uses: docker/build-push-action@v2
        with:
          push: true
          tags: acme/app:latest

      - name: Load AWS credentials
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
          # Remove local copies of the Docker credentials, which are not needed anymore
          unset-previous: true
        env:
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          AWS_ACCESS_KEY_ID: op://app-cicd/aws/access-key-id
          AWS_SECRET_ACCESS_KEY: op://app-cicd/aws/secret-access-key

      - name: Deploy app
        # This script expects AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to be set, which was 
        # done automatically by the step above
        run: ./deploy.sh
```
</details>

## Action Inputs

| Name | Default | Description |
|---|---|---|
| `export-env`     | `false` | Export the loaded secrets as environment variables |
| `unset-previous` | `false` | Whether to unset environment variables populated by 1Password in earlier job steps |

## Secrets Reference Syntax

To specify which secret should be loaded into which environment variable, the action will look for `op://` reference URIs in environment variables, and replace those with the actual secret values.

These reference URIs have the following syntax:

> `op://<vault>/<item>[/<section>]/<field>`

So for example, the reference URI `op://app-cicd/aws/secret-access-key` would be interpreted as:
  * **Vault:** `app-cicd`
  * **Item:** `aws`
  * **Section:** default section
  * **Field:** `secret-access-key`

## Masking

Similar to regular GitHub repository secrets, fields from 1Password will automatically be masked from the GitHub Actions logs too.
So if one of these values accidentally gets printed, it'll get replaced with `***`.

## 1Password Connect Configuration

To use the action, you need to have a [1Password Connect](https://support.1password.com/secrets-automation/#step-1-set-up-a-secrets-automation-workflow) instance deployed somewhere.
To configure the action with your Connect URL and a Connect token, you can set the `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` variables.

If you're using the `load-secrets` action more than once in a single job, you can use the `configure` action to avoid duplicate configuration:

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          connect-host: <Your Connect instance URL>
          connect-token: ${{ secrets.OP_CONNECT_TOKEN }}

      - name: Load secret
        uses: 1password/load-secrets-action@v1
        env:
          SECRET: op://app-cicd/hello-world/secret
```

### `configure` Action Inputs

| Name | Default | Environment variable | Description |
|---|---|---|---|
| `connect-host` | | `OP_CONNECT_HOST` | Your 1Password Connect instance URL |
| `connect-token` | | `OP_CONNECT_TOKEN` | Token to authenticate to your 1Password Connect instance |

## Supported Runners

You can run the action on Linux and macOS runners. Windows is currently not supported.

## Security

1Password requests you practice responsible disclosure if you discover a vulnerability.

Please file requests via [**BugCrowd**](https://bugcrowd.com/agilebits).

For information about security practices, please visit our [Security homepage](https://bugcrowd.com/agilebits).

## Getting help

If you find yourself stuck, visit our [**Support Page**](https://support.1password.com/) for help.
