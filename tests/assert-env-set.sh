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

assert_env_equals "SECRET" "${SECRET}"
assert_env_equals "FILE_SECRET" "${SECRET}"

assert_env_equals "SECRET_IN_SECTION" "${SECRET}"
assert_env_equals "FILE_SECRET_IN_SECTION" "${SECRET}"

assert_env_equals "MULTILINE_SECRET" "${MULTILINE_SECRET}"
assert_env_equals "FILE_MULTILINE_SECRET" "${MULTILINE_SECRET}"