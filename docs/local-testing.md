# Local Testing Guide

This document explains how to run e2e tests locally using `act`.

## Prerequisites

1. **Docker** installed and running
2. **act** installed ([install guide](https://github.com/nektos/act#installation))
   ```bash
   brew install act  # macOS
   ```
3. **1Password credentials** (see [Required Secrets](#required-secrets))
4. Build action

## Required env variables

| Secret                     | Description           |
| -------------------------- | --------------------- |
| `OP_SERVICE_ACCOUNT_TOKEN` | Service Account token |
| `VAULT`                    | Vault name or UUID    |

## Building Before Testing

If you've modified TypeScript code, rebuild before running E2E tests:

```bash
npm run build
```

## Testing

### Run E2E tests using Service Account

```bash
act push -W .github/workflows/e2e-tests.yml \
  -s OP_SERVICE_ACCOUNT_TOKEN="$OP_SERVICE_ACCOUNT_TOKEN" \
  -s VAULT="$VAULT" \
  -j test-service-account \
  --matrix os:ubuntu-latest
```

## Run unit tests

```bash
npm test
```
