<!-- Image sourced from https://blog.1password.com/1password-service-accounts/ -->
<img alt="" role="img" src="https://blog.1password.com/posts/2023/1password-service-accounts/header.png"/>

<div align="center">
  <h1>Load Secrets from 1Password - GitHub Action</h1>
  <p>Provide the secrets your GitHub runner needs from 1Password.</p>
  <a href="https://developer.1password.com/docs/ci-cd/github-actions">
    <img alt="Get started" src="https://user-images.githubusercontent.com/45081667/226940040-16d3684b-60f4-4d95-adb2-5757a8f1bc15.png" height="37"/>
  </a>
</div>

---

`load-secrets-action` loads secrets from 1Password into GitHub Actions using [Service Accounts](https://developer.1password.com/docs/service-accounts) or [1Password Connect](https://developer.1password.com/docs/connect).

Specify in your workflow YAML file which secrets from 1Password should be loaded into your job, and the action will make them available as environment variables for the next steps.

Read more on the [1Password Developer Portal](https://developer.1password.com/docs/ci-cd/github-actions).

## 🪄 See it in action!

[![Using 1Password Service Accounts with GitHub Actions - showcase](https://img.youtube.com/vi/kVBl5iQYgSA/maxresdefault.jpg)](https://www.youtube.com/watch?v=kVBl5iQYgSA "Using 1Password Service Accounts with GitHub Actions")

## ✨ Quickstart

### Export secrets as a step's output (recommended)

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Load secret
        id: load_secrets
        uses: 1password/load-secrets-action@v3
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret
          OP_ENV_FILE: "./path/to/.env.tpl" # see tests/.env.tpl for example

      - name: Print masked secret
        run: 'echo "Secret: ${{ steps.load_secrets.outputs.SECRET }}"'
        # Prints: Secret: ***
```

### Export secrets as env variables

```yml
on: push
jobs:
  hello-world:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Load secret
        uses: 1password/load-secrets-action@v3
        with:
          # Export loaded secrets as environment variables
          export-env: true
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          SECRET: op://app-cicd/hello-world/secret
          OP_ENV_FILE: "./path/to/.env.tpl" # see tests/.env.tpl for example

      - name: Print masked secret
        run: 'echo "Secret: $SECRET"'
        # Prints: Secret: ***
```

## 💙 Community & Support

- File an [issue](https://github.com/1Password/load-secrets-action/issues) for bugs and feature requests.
- Join the [Developer Slack workspace](https://developer.1password.com/joinslack).
- Subscribe to the [Developer Newsletter](https://1password.com/dev-subscribe/).

## 🔐 Security

1Password requests you practice responsible disclosure if you discover a vulnerability.

Please file requests by sending an email to bugbounty@agilebits.com.
