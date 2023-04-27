# Load Secrets from 1Password - GitHub Action

This action loads secrets from 1Password into GitHub Actions using [1Password Connect](https://developer.1password.com/docs/connect) or a [Service Account <sup>[BETA]</sup>](https://developer.1password.com/docs/service-accounts).

Specify in your workflow YAML file which secrets from 1Password should be loaded into your job, and the action will make them available as environment variables for the next steps.

Read more on the [1Password Developer Portal](https://developer.1password.com/docs/ci-cd/github-actions).

## Requirements

Before you get started, you'll need to:

- [Deploy 1Password Connect](/docs/connect/get-started#step-2-deploy-1password-connect-server) in your infrastructure.
- Set the `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` environment variables to your Connect instance's credentials, so it'll be used to load secrets.

_Supported runners_: You can run the action on Mac and Linux runners. Windows is currently not supported.

## Usage

You can configure the action to use your 1Password Connect instance.

If you provide `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` variables, the Connect instance will be used to load secrets. Make sure [1Password Connect](https://support.1password.com/secrets-automation/#step-2-deploy-a-1password-connect-server) is deployed in your infrastructure.

If you provide `OP_SERVICE_ACCOUNT_TOKEN` variable, the service account will be used to load secrets.

**_Note_**: If all environment variables have been set, the Connect credentials will take precedence over the provided service account token. You must unset the Connect environment variables to ensure the action uses the service account token.

There are two ways that secrets can be loaded:

- [use the secrets from the action's ouput](#use-secrets-from-the-actions-output)
- [export secrets as environment variables](#export-secrets-as-environment-variables)

### Use secrets from the action's output

This method allows for you to use the loaded secrets as an output from the step: `steps.step-id.outputs.secret-name`. You will need to set an id for the step that uses this action to be able to access its outputs. For more details, , see [`outputs.<output_id>`](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#outputsoutput_id).

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Load secret
        id: op-load-secret
        uses: 1password/load-secrets-action@v1
        with:
          export-env: false
        env:
          OP_CONNECT_HOST: <Your Connect instance URL>
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret

      - name: Print masked secret
        run: echo "Secret: ${{ steps.op-load-secret.outputs.SECRET }}"
        # Prints: Secret: ***
```

<details>
<summary><b>Usage example with Service Accounts <sup>BETA</sup></b></summary>

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Load secret
        id: op-load-secret
        uses: 1password/load-secrets-action@v1
        with:
          export-env: false
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret

      - name: Print masked secret
        run: echo "Secret: ${{ steps.op-load-secret.outputs.SECRET }}"
        # Prints: Secret: ***
```

</details>

<details>
<summary><b>Longer usage example</b></summary>

```yml
on: push
name: Deploy app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          # Persist the 1Password Connect URL for next steps. You can also persist
          # the Connect token using input `connect-token`, but keep in mind that
          # this will grant all steps of the job access to the token.
          connect-host: https://1password.acme.com

      - name: Load Docker credentials
        id: load-docker-credentials
        uses: 1password/load-secrets-action@v1
        with:
          export-env: false
        env:
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          DOCKERHUB_USERNAME: op://app-cicd/docker/username
          DOCKERHUB_TOKEN: op://app-cicd/docker/token

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ steps.load-docker-credentials.outputs.DOCKERHUB_USERNAME }}
          password: ${{ steps.load-docker-credentials.outputs.DOCKERHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          push: true
          tags: acme/app:latest
```

</details>

<details>
<summary><b>Longer usage example with Service Accounts <sup>BETA</sup></b></summary>

```yml
on: push
name: Deploy app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          # Persist the 1Password Service Account token. This will grant
          # all steps of the job access to the token.
          service-account-token: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}

      - name: Load Docker credentials
        id: load-docker-credentials
        uses: 1password/load-secrets-action@v1
        with:
          export-env: false
        env:
          DOCKERHUB_USERNAME: op://app-cicd/docker/username
          DOCKERHUB_TOKEN: op://app-cicd/docker/token

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ steps.load-docker-credentials.outputs.DOCKERHUB_USERNAME }}
          password: ${{ steps.load-docker-credentials.outputs.DOCKERHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          push: true
          tags: acme/app:latest
```

</details>

### Export secrets as environment variables

This method, allows the action to access the loaded secrets as environment variables. These environment variables are accessible at a job level.

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Load secret
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret

      - name: Print masked secret
        run: echo "Secret: $SECRET"
        # Prints: Secret: ***
```

<details>
<summary><b>Usage example with Service Accounts <sup>BETA</sup></b></summary>

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

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

</details>

<details>
<summary><b>Longer usage example</b></summary>

```yml
on: push
name: Deploy app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          # Persist the 1Password Connect URL for next steps. You can also persist
          # the Connect token using input `connect-token`, but keep in mind that
          # this will grant all steps of the job access to the token.
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
        uses: docker/login-action@v2
        with:
          username: ${{ env.DOCKERHUB_USERNAME }}
          password: ${{ env.DOCKERHUB_TOKEN }}

      - name: Print environment variables with masked secrets
        run: printenv

      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          push: true
          tags: acme/app:latest

      - name: Load AWS credentials
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
          # Remove local copies of the Docker credentials, which aren't needed anymore
          unset-previous: true
        env:
          OP_CONNECT_TOKEN: ${{ secrets.OP_CONNECT_TOKEN }}
          AWS_ACCESS_KEY_ID: op://app-cicd/aws/access-key-id
          AWS_SECRET_ACCESS_KEY: op://app-cicd/aws/secret-access-key

      - name: Deploy app
        # This script expects AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to be set.
        # This happened using secret references in the preceding lines.
        run: ./deploy.sh
```

</details>

<details>
<summary><b>Longer usage example with Service Accounts <sup>BETA</sup></b></summary>

```yml
on: push
name: Deploy app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure 1Password Connect
        uses: 1password/load-secrets-action/configure@v1
        with:
          # Persist the 1Password Service Account token. This will grant
          # all steps of the job access to the token.
          service-account-token: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}

      - name: Load Docker credentials
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
        env:
          DOCKERHUB_USERNAME: op://app-cicd/docker/username
          DOCKERHUB_TOKEN: op://app-cicd/docker/token

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ env.DOCKERHUB_USERNAME }}
          password: ${{ env.DOCKERHUB_TOKEN }}

      - name: Print environment variables with masked secrets
        run: printenv

      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          push: true
          tags: acme/app:latest

      - name: Load AWS credentials
        uses: 1password/load-secrets-action@v1
        with:
          # Export loaded secrets as environment variables
          export-env: true
          # Remove local copies of the Docker credentials, which aren't needed anymore
          unset-previous: true
        env:
          AWS_ACCESS_KEY_ID: op://app-cicd/aws/access-key-id
          AWS_SECRET_ACCESS_KEY: op://app-cicd/aws/secret-access-key

      - name: Deploy app
        # This script expects AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to be set.
        # This happened using secret references in the preceding lines.
        run: ./deploy.sh
```

</details>

## Action Inputs

| Name             | Default | Description                                                                        |
| ---------------- | ------- | ---------------------------------------------------------------------------------- |
| `export-env`     | `true`  | Export the loaded secrets as environment variables                                 |
| `unset-previous` | `false` | Whether to unset environment variables populated by 1Password in earlier job steps |

## Secrets Reference Syntax

To specify which secret should be loaded into which environment variable, the action will look for `op://` reference URIs in environment variables, and replace those with the actual secret values.

These reference URIs have the following syntax:

> `op://<vault>/<item>[/<section>]/<field>`

So for example, the reference URI `op://app-cicd/aws/secret-access-key` would be interpreted as:

- **Vault:** `app-cicd`
- **Item:** `aws`
- **Section:** default section
- **Field:** `secret-access-key`

## Masking

Similar to regular GitHub repository secrets, fields from 1Password will automatically be masked from the GitHub Actions logs too.
So if one of these values accidentally gets printed, it'll get replaced with `***`.

## 1Password Configuration

To use the action with Connect, you need to have a [1Password Connect](https://support.1password.com/secrets-automation/#step-1-set-up-a-secrets-automation-workflow) instance deployed somewhere.
To configure the action with your Connect host and token, set the `OP_CONNECT_HOST` and `OP_CONNECT_TOKEN` environment variables.

To configure the action with your service account token <sup>BETA</sup>, set the `OP_SERVICE_ACCOUNT_TOKEN` environment variable.

If you're using the `load-secrets` action more than once in a single job, you can use the `configure` action to avoid duplicate configuration:

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

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

| Name                    | Environment variable       | Description                                              |
| ----------------------- | -------------------------- | -------------------------------------------------------- |
| `connect-host`          | `OP_CONNECT_HOST`          | Your 1Password Connect instance URL                      |
| `connect-token`         | `OP_CONNECT_TOKEN`         | Token to authenticate to your 1Password Connect instance |
| `service-account-token` | `OP_SERVICE_ACCOUNT_TOKEN` | Your 1Password service account token                     |

## Supported Runners

You can run the action on Linux and macOS runners. Windows is currently not supported.

## Warnings

If you're using the CLI in your GitHub pipelines and you want to create items with it, the following command will fail:

```
op item create --category=login --title='My Example Item' --vault='Test' \
                --url https://www.acme.com/login \
                --generate-password=20,letters,digits \
                username=jane@acme.com \
                'Test Field 1=my test secret' \
                'Test Section 1.Test Field2[text]=Jane Doe' \
                'Test Section 1.Test Field3[date]=1995-02-23' \
                'Test Section 2.Test Field4[text]='$myNotes
```

This is caused by the fact that the environment in these pipelines is in piped mode, which triggers the CLI's pipe detection to expect a piped input.
To be able to create items in such environments, do the following steps:

1. Get the template of the item category you want:

   ```sh
   op item template get --out-file=new-item.json <category>
   ```

2. Edit [the template](https://developer.1password.com/docs/cli/item-template-json) to add your information.
3. Pipe the item content to the command:

   ```sh
   cat new-item.json | op item create --vault='Test'
   ```

## Security

1Password requests you practice responsible disclosure if you discover a vulnerability.

Please file requests through [BugCrowd](https://bugcrowd.com/agilebits).

For information about our security practices, visit the [1Password Security homepage](https://1password.com/security).

## Getting help

If you find yourself stuck, visit our [**Support Page**](https://support.1password.com/) for help.
