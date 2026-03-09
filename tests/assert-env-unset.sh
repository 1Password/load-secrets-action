#!/bin/bash
# shellcheck disable=SC2086
set -e

assert_env_unset() {
  if [ -n "$(printenv $1)" ]; then
    echo "Expected secret $1 to be unset"
    exit 1
  fi
}

assert_env_unset "SECRET"
assert_env_unset "FILE_SECRET"

assert_env_unset "SECRET_IN_SECTION"
assert_env_unset "FILE_SECRET_IN_SECTION"

assert_env_unset "MULTILINE_SECRET"
assert_env_unset "FILE_MULTILINE_SECRET"

assert_env_unset "WEBSITE"
assert_env_unset "FILE_WEBSITE"

assert_env_unset "TEST_SSH_KEY"
assert_env_unset "FILE_TEST_SSH_KEY"
assert_env_unset "TEST_SSH_KEY_OPENSSH"
assert_env_unset "FILE_TEST_SSH_KEY_OPENSSH"

assert_env_unset "SSH_KEY_DATE"
assert_env_unset "FILE_SSH_KEY_DATE"

assert_env_unset "TEST_CREDENTIALS"
assert_env_unset "FILE_TEST_CREDENTIALS"
assert_env_unset "TEST_CREDENTIALS_NOTES"
assert_env_unset "FILE_TEST_CREDENTIALS_NOTES"
