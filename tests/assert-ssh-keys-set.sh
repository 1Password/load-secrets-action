#!/bin/bash
set -e

assert_ssh_key_set() {
  local var="$1"
  local val
  val="$(printenv "$var" || true)"
  if [ -z "$val" ]; then
    echo "Expected $var to be set"
    exit 1
  fi
  [ "$val" = "***" ] && return 0
  local line
  line="$(echo "$val" | head -1)"
  if echo "$var" | grep -q "OPENSSH"; then
    echo "$line" | grep -q "OPENSSH" || { echo "Expected $var to start with -----BEGIN OPENSSH PRIVATE KEY-----"; exit 1; }
  else
    echo "$line" | grep -q "BEGIN.*PRIVATE KEY" || { echo "Expected $var to be a private key"; exit 1; }
  fi
  echo "$var OK"
}

assert_ssh_key_set "TEST_SSH_KEY"
assert_ssh_key_set "TEST_SSH_KEY_OPENSSH"
assert_ssh_key_set "FILE_TEST_SSH_KEY"
assert_ssh_key_set "FILE_TEST_SSH_KEY_OPENSSH"
