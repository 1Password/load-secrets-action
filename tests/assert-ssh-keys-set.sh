#!/bin/bash
# shellcheck disable=SC2086
set -e

assert_ssh_key_set() {
  local var="$1"
  local val
  val="$(printenv "$var" || true)"
  if [ -z "$val" ]; then
    echo "Expected $var to be set"
    exit 1
  fi
  if ! echo "$val" | head -1 | grep -q "BEGIN.*PRIVATE KEY"; then
    echo "Expected $var to be a private key (missing BEGIN PRIVATE KEY header)"
    exit 1
  fi
  echo "$var is set and looks like a private key"
}

assert_ssh_key_set "TEST_SSH_KEY"
assert_ssh_key_set "TEST_SSH_KEY_OPENSSH"
assert_ssh_key_set "FILE_TEST_SSH_KEY"
assert_ssh_key_set "FILE_TEST_SSH_KEY_OPENSSH"
