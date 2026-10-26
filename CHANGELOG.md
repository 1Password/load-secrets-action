# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Secret references are now detected by reading environment variables directly instead of running `op env ls`. Variables are matched against the documented secret reference syntax. ([#196](https://github.com/1Password/load-secrets-action/pull/196))

## [5.0.1] - 2026-08-18

### Changed

- Bump `@1password/sdk` from 0.5.0-beta.1 to the stable 0.5.0, and rebuild `dist/`. ([#187](https://github.com/1Password/load-secrets-action/pull/187))
- Update the built-in beta CLI fallback version from 2.38.1-beta.02 to 2.39.0-beta.02.

### Fixed

- The authentication error message now also lists Workload Identity (`OP_WORKLOAD_ID` + `OP_ENVIRONMENT_ID` + `OP_INTEGRATION_KEY`) as a valid option. Previously it only listed the CLI methods, which was misleading when a Workload Identity variable was missing or misspelled. ([#187](https://github.com/1Password/load-secrets-action/pull/187))

### Security

- Harden CI: add the StepSecurity harden-runner, pin GitHub Actions to commit SHAs in the E2E and fallback-version workflows, and restrict workflow permissions. ([#182](https://github.com/1Password/load-secrets-action/pull/182))

## [5.0.0] - 2026-07-31

### Added

- Workload Identity authentication using the GitHub Actions OIDC token (public preview). ([#169](https://github.com/1Password/load-secrets-action/pull/169))

## [4.1.1] - 2026-07-23

### Added

- Fallback version resolution: if app-updates.agilebits.com is unavailable, the action falls back to Docker Hub, and then to a built-in pinned version. ([#173](https://github.com/1Password/load-secrets-action/pull/173))

### Security

- Harden CI: add the StepSecurity harden-runner, pin GitHub Actions to commit SHAs across workflows, restrict workflow permissions, and add a Dependabot config. ([#174](https://github.com/1Password/load-secrets-action/pull/174))

## [4.0.1] - 2026-06-11

### Changed

- Bump `actions/checkout` from v5 to v6 in CI workflows. ([#156](https://github.com/1Password/load-secrets-action/pull/156))
- Add the 1Password API Terms of Service notice to the README. ([#166](https://github.com/1Password/load-secrets-action/pull/166))

### Fixed

- On Windows, installing the 1Password CLI could fail because the downloaded archive was missing the `.zip` extension needed by PowerShell's archive extraction fallback. ([#154](https://github.com/1Password/load-secrets-action/pull/154))

### Security

- Pin external actions in GitHub Actions workflows to immutable commit SHAs. ([#157](https://github.com/1Password/load-secrets-action/pull/157))

## [4.0.0] - 2026-03-23

### Changed

- Update the action runtime from Node 20 to Node 24 for GitHub Actions compatibility. ([#149](https://github.com/1Password/load-secrets-action/pull/149))

### Security

- Resolve npm audit and Dependabot findings with `npm audit fix` where safe (for example `ajv`, `flatted`, `undici`, and `minimatch`). ([#151](https://github.com/1Password/load-secrets-action/pull/151))

## [3.2.1] - 2026-03-03

### Fixed

- Revert an SDK field-resolution regression introduced in 3.2.0 that broke some valid secret references (website/url fields). ([#145](https://github.com/1Password/load-secrets-action/pull/145))

## [3.2.0] - 2026-03-02

### Changed

- Service account authentication now uses the 1Password SDK instead of the CLI. The CLI is no longer installed when using a service account token. ([#137](https://github.com/1Password/load-secrets-action/pull/137))
- Document the SSH key format parameter for secret references. ([#130](https://github.com/1Password/load-secrets-action/pull/130))

### Fixed

- Empty string secret values are now set as outputs and environment variables instead of being skipped. ([#132](https://github.com/1Password/load-secrets-action/pull/132))

## [3.1.0] - 2025-12-16

### Added

- Support loading secrets from env files. ([#118](https://github.com/1Password/load-secrets-action/pull/118))

### Removed

- The `op-cli-installer` dependency. ([#127](https://github.com/1Password/load-secrets-action/pull/127))

### Security

- Update `js-yaml` from 4.1.0 to 4.1.1. ([#128](https://github.com/1Password/load-secrets-action/pull/128))

## [3.0.0] - 2025-08-14

### Changed

- **BREAKING:** The `export-env` input now defaults to `false`. To keep exporting secrets as environment variables, set `export-env: true` explicitly in your workflow. ([#114](https://github.com/1Password/load-secrets-action/pull/114))

### Added

- Windows support, using the 1Password CLI installer. ([#109](https://github.com/1Password/load-secrets-action/pull/109))
- A default value for the `version` input. ([#112](https://github.com/1Password/load-secrets-action/pull/112))

### Security

- Address `undici` vulnerabilities: use of insufficiently random values, and a denial of service via bad certificate data. ([#103](https://github.com/1Password/load-secrets-action/pull/103))

## [2.0.0] - 2024-03-20

### Changed

- Migrate the action to TypeScript. ([#36](https://github.com/1Password/load-secrets-action/pull/36))
- Upgrade the action runtime from Node 16 to Node 20. ([#36](https://github.com/1Password/load-secrets-action/pull/36))

### Removed

- **BREAKING:** Automatic protocol prepending for the Connect host URL. You now need to include the protocol (`http://` or `https://`) when passing the Connect host URL. ([#66](https://github.com/1Password/load-secrets-action/pull/66))

## [1.3.2] - 2024-02-21

### Security

- Fix Dependabot vulnerabilities. ([#55](https://github.com/1Password/load-secrets-action/pull/55), [#57](https://github.com/1Password/load-secrets-action/pull/57))

## [1.3.1] - 2023-07-06

### Fixed

- Parse the CLI version without `jq`. ([#51](https://github.com/1Password/load-secrets-action/pull/51))

### Security

- Fix Dependabot vulnerabilities. ([#52](https://github.com/1Password/load-secrets-action/pull/52))

## [1.3.0] - 2023-07-05

### Added

- Install the 1Password CLI for arm and 386 on Linux. ([#44](https://github.com/1Password/load-secrets-action/pull/44), [#49](https://github.com/1Password/load-secrets-action/pull/49))
- Automatically fetch the latest stable version of the 1Password CLI. ([#49](https://github.com/1Password/load-secrets-action/pull/49))

### Changed

- Update documentation related to [1Password Service Accounts](https://developer.1password.com/docs/service-accounts/).

### Removed

- The deprecated `set-output` command. ([#27](https://github.com/1Password/load-secrets-action/issues/27))

### Fixed

- Use a temp directory for `op` instead of root on Linux. ([#28](https://github.com/1Password/load-secrets-action/pull/28))
- Allow installing the CLI on macOS runners without `sudo` privileges. ([#32](https://github.com/1Password/load-secrets-action/pull/32))

## [1.2.0] - 2022-12-22

This release restores backward compatibility with earlier `v1` versions. Versions 1.1.x contained breaking changes, so anyone using them should update to this version.

### Fixed

- Ensure `OP_CONNECT_HOST` has a URL scheme set. ([#25](https://github.com/1Password/load-secrets-action/pull/25))
- Set the default of `export-env` to `true`. ([#25](https://github.com/1Password/load-secrets-action/pull/25))

## [1.1.2] - 2022-12-16

### Fixed

- The workflow failed if a secret reference included spaces. ([#20](https://github.com/1Password/load-secrets-action/issues/20))

## [1.1.1] - 2022-12-14

### Changed

- Add a link to the 1Password Developer Documentation in the README. ([#19](https://github.com/1Password/load-secrets-action/pull/19))

### Fixed

- Make `openssl` generate a 64-character string, as described in the code comment. ([#18](https://github.com/1Password/load-secrets-action/pull/18))
- Pass User-Agent information to the 1Password CLI. ([#22](https://github.com/1Password/load-secrets-action/pull/22))

## [1.1.0] - 2022-09-07

### Added

- Use the 1Password CLI to perform actions. ([#5](https://github.com/1Password/load-secrets-action/pull/5))
- Service Account beta feature. ([#5](https://github.com/1Password/load-secrets-action/pull/5))

### Changed

- Update package dependencies. ([#14](https://github.com/1Password/load-secrets-action/pull/14))

## [1.0.2] - 2022-05-18

### Security

- Improve the way input is processed to avoid command injection. ([#11](https://github.com/1Password/load-secrets-action/pull/11))

## [1.0.1] - 2021-06-09

### Fixed

- Fix item and vault loading by name. ([#4](https://github.com/1Password/load-secrets-action/pull/4))

## [1.0.0] - 2021-05-28

### Added

- Action (`1password/load-secrets-action@v1`) to load secrets from 1Password into environment variables. ([#1](https://github.com/1Password/load-secrets-action/pull/1))
- Action (`1password/load-secrets-action/configure@v1`) to persist 1Password Connect configuration. ([#1](https://github.com/1Password/load-secrets-action/pull/1))

[Unreleased]: https://github.com/1Password/load-secrets-action/compare/v5.0.1...HEAD
[5.0.1]: https://github.com/1Password/load-secrets-action/compare/v5.0.0...v5.0.1
[5.0.0]: https://github.com/1Password/load-secrets-action/compare/v4.1.1...v5.0.0
[4.1.1]: https://github.com/1Password/load-secrets-action/compare/v4.0.1...v4.1.1
[4.0.1]: https://github.com/1Password/load-secrets-action/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/1Password/load-secrets-action/compare/v3.2.1...v4.0.0
[3.2.1]: https://github.com/1Password/load-secrets-action/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/1Password/load-secrets-action/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/1Password/load-secrets-action/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/1Password/load-secrets-action/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/1Password/load-secrets-action/compare/v1.3.2...v2.0.0
[1.3.2]: https://github.com/1Password/load-secrets-action/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/1Password/load-secrets-action/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/1Password/load-secrets-action/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/1Password/load-secrets-action/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/1Password/load-secrets-action/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/1Password/load-secrets-action/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/1Password/load-secrets-action/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/1Password/load-secrets-action/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/1Password/load-secrets-action/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/1Password/load-secrets-action/releases/tag/v1.0.0
