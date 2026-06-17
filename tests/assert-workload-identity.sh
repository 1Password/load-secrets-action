#!/bin/bash
# shellcheck disable=SC2086
set -e

# Asserts the secrets loaded via Workload Identity.

assert_env_equals() {
  if [ "$(printenv $1)" != "$2" ]; then
    echo -e "Expected $1 to be set to:\n$2\nBut got:\n$(printenv $1)"
    exit 1
  fi
}

assert_env_equals "ANOTHER_TEST" "anothertest123"
assert_env_equals "SUPER_SECRET" "supersecret"
assert_env_equals "TEST_SECRET" "thisisatest"
