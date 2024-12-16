# Contributing

Thank you for your interest in contributing to the 1Password load-secrets-action project 👋! Before you start, please take a moment to read through this guide to understand our contribution process.

## Testing

Unit tests can be run with `npm run test`.

After following the steps below for signing commits, you can test against your PR with these steps:

1. Create or use an existing repo to run the `load-secrets` GitHub Action.
2. In a workflow yaml file that uses the GitHub Action, modify the `uses: 1Password/load-secrets-action` line to be

   ```yaml
   uses: 1Password/load-secrets-action@<branch-name>
   ```

   OR

   ```yaml
   uses: 1Password/load-secrets-action@<commit-hash>
   ```

3. Trigger the action, which now includes your changes.

## Documentation Updates

If applicable, update the [README.md](./README.md) to reflect any changes introduced by the new code.

## Sign your commits

To get your PR merged, we require you to sign your commits.

### Sign commits with 1Password

You can also sign commits using 1Password, which lets you sign commits with biometrics without the signing key leaving the local 1Password process.

Learn how to use [1Password to sign your commits](https://developer.1password.com/docs/ssh/git-commit-signing/).

### Sign commits with ssh-agent

Follow the steps below to set up commit signing with `ssh-agent`:

1. [Generate an SSH key and add it to ssh-agent](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
2. [Add the SSH key to your GitHub account](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)
3. [Configure git to use your SSH key for commits signing](https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key#telling-git-about-your-ssh-key)

### Sign commits with gpg

Follow the steps below to set up commit signing with `gpg`:

1. [Generate a GPG key](https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key)
2. [Add the GPG key to your GitHub account](https://docs.github.com/en/authentication/managing-commit-signature-verification/adding-a-gpg-key-to-your-github-account)
3. [Configure git to use your GPG key for commits signing](https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key#telling-git-about-your-gpg-key)
