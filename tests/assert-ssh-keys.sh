#!/bin/bash
set -e

# SSH_PRIVATE_KEY: any private key format
v="$(printenv SSH_PRIVATE_KEY)"
if [ -z "$v" ]; then
  echo "SSH_PRIVATE_KEY is not set"
  exit 1
fi
if ! echo "$v" | head -1 | grep -qE -- '^-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'; then
  echo "SSH_PRIVATE_KEY does not start with a private key header"
  exit 1
fi
if ! echo "$v" | tail -1 | grep -qE -- '-----END (RSA |EC |OPENSSH )?PRIVATE KEY-----$'; then
  echo "SSH_PRIVATE_KEY does not end with a private key footer"
  exit 1
fi
echo "SSH_PRIVATE_KEY has valid key format"

# SSH_PRIVATE_KEY_OPENSSH: OpenSSH format only
v="$(printenv SSH_PRIVATE_KEY_OPENSSH)"
if [ -z "$v" ]; then
  echo "SSH_PRIVATE_KEY_OPENSSH is not set"
  exit 1
fi
if ! echo "$v" | head -1 | grep -q -- '-----BEGIN OPENSSH PRIVATE KEY-----'; then
  echo "SSH_PRIVATE_KEY_OPENSSH is not in OpenSSH format"
  exit 1
fi
if ! echo "$v" | tail -1 | grep -q -- '-----END OPENSSH PRIVATE KEY-----$'; then
  echo "SSH_PRIVATE_KEY_OPENSSH does not end with OpenSSH private key footer"
  exit 1
fi
echo "SSH_PRIVATE_KEY_OPENSSH has valid OpenSSH key format"
