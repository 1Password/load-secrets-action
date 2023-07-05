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

## 💙 Community & Support

- File an [issue](https://github.com/1Password/load-secrets-action/issues) for bugs and feature requests.
- Join the [Developer Slack workspace](https://join.slack.com/t/1password-devs/shared_invite/zt-1halo11ps-6o9pEv96xZ3LtX_VE0fJQA).
- Subscribe to the [Developer Newsletter](https://1password.com/dev-subscribe/).

## 🔐 Security

1Password requests you practice responsible disclosure if you discover a vulnerability.

Please file requests via [**BugCrowd**](https://bugcrowd.com/agilebits).

For information about security practices, please visit the [1Password Bug Bounty Program](https://bugcrowd.com/agilebits).
