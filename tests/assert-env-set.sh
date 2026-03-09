#!/bin/bash
# shellcheck disable=SC2086
set -e

assert_env_equals() {
  if [ "$(printenv $1)" != "$2" ]; then
    echo -e "Expected $1 to be set to:\n$2\nBut got:\n$(printenv $1)"
    exit 1
  fi
}

readonly SECRET="RGVhciBzZWN1cml0eSByZXNlYXJjaGVyLCB0aGlzIGlzIGp1c3QgYSBkdW1teSBzZWNyZXQuIFBsZWFzZSBkb24ndCByZXBvcnQgaXQu"
MULTILINE_SECRET="$(cat << EOF
-----BEGIN PRIVATE KEY-----
RGVhciBzZWN1cml0eSByZXNlYXJjaGVyLApXaGls
ZSB3ZSBkZWVwbHkgYXBwcmVjaWF0ZSB5b3VyIHZp
Z2lsYW5jZSBhbmQgZWZmb3J0cyB0byBtYWtlIHRo
ZSB3b3JsZCBtb3JlIHNlY3VyZSwgSSdtIGFmcmFp
ZCBJIG11c3QgdGVsbCB5b3UgdGhhdCB0aGlzIHZh
bHVlIGlzIG5vdCBhIGFjdHVhbCBwcml2YXRlIGtl
eS4gCkl0J3MgYSBqdXN0IGEgZHVtbXkgc2VjcmV0
IHRoYXQgd2UgdXNlIHRvIHRlc3QgdmFyaW91cyAx
UGFzc3dvcmQgc2VjcmV0cyBpbnRlZ3JhdGlvbnMu
IApTbyBwbGVhc2UgZG9uJ3QgcmVwb3J0IGl0IQo=
-----END PRIVATE KEY-----
EOF
)"
readonly MULTILINE_SECRET
readonly WEBSITE="www.test.com"
readonly SSH_KEY_DATE="1773057660"
readonly TEST_FILE_CONTENT_EXPECTED="This is a test"

assert_env_equals "SECRET" "${SECRET}"
assert_env_equals "FILE_SECRET" "${SECRET}"

assert_env_equals "SECRET_IN_SECTION" "${SECRET}"
assert_env_equals "FILE_SECRET_IN_SECTION" "${SECRET}"

assert_env_equals "MULTILINE_SECRET" "${MULTILINE_SECRET}"
assert_env_equals "FILE_MULTILINE_SECRET" "${MULTILINE_SECRET}"

# WEBSITE/FILE_WEBSITE only loaded by Service Account as Connect does not support website field
if [ -n "$(printenv WEBSITE 2>/dev/null)" ]; then
  assert_env_equals "WEBSITE" "${WEBSITE}"
fi
if [ -n "$(printenv FILE_WEBSITE 2>/dev/null)" ]; then
  assert_env_equals "FILE_WEBSITE" "${WEBSITE}"
fi

assert_env_equals "SSH_KEY_DATE" "${SSH_KEY_DATE}"
assert_env_equals "FILE_SSH_KEY_DATE" "${SSH_KEY_DATE}"

assert_env_equals "TEST_FILE_CONTENT" "${TEST_FILE_CONTENT_EXPECTED}"
assert_env_equals "FILE_TEST_FILE_CONTENT" "${TEST_FILE_CONTENT_EXPECTED}"
