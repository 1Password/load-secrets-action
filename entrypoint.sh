#!/bin/bash
set -e

# Install op-cli
install_op_cli() {
  CLI_VERSION="v2.16.0-beta.01"
  OP_INSTALL_DIR="$(mktemp -d)"
  if [[ ! -d "$OP_INSTALL_DIR" ]]; then
    echo "Install dir $OP_INSTALL_DIR not found"
    exit 1
  fi
  echo "::debug::OP_INSTALL_DIR: ${OP_INSTALL_DIR}"
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -sSfLo op.zip "https://cache.agilebits.com/dist/1P/op2/pkg/$CLI_VERSION/op_linux_amd64_$CLI_VERSION.zip"
    unzip -od "$OP_INSTALL_DIR" op.zip && rm op.zip
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    curl -sSfLo op.pkg "https://cache.agilebits.com/dist/1P/op2/pkg/$CLI_VERSION/op_apple_universal_$CLI_VERSION.pkg"
    pkgutil --expand op.pkg temp-pkg
    tar -xvf temp-pkg/op.pkg/Payload -C "$OP_INSTALL_DIR"
    rm -rf temp-pkg && rm op.pkg
  fi
}

# Uninstall op-cli
uninstall_op_cli() {
  if [[ -d "$OP_INSTALL_DIR" ]]; then
    rm -fr "$OP_INSTALL_DIR"
  fi
}

install_op_cli
