#!/bin/bash
assert_env_unset() {
  if [ -n "$(printenv $1)" ]; then
    echo "Expected secret $1 to be unset"
    exit 1
  fi
}

assert_env_unset "SECRET"
assert_env_unset "SECRET_IN_SECTION"
assert_env_unset "MULTILINE_SECRET"
