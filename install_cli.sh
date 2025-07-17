#!/bin/bash
set -e

# Install op-cli
install_op_cli() {
  # Create a temporary directory where the CLI is installed
  OP_INSTALL_DIR="$(mktemp -d)"
  if [[ ! -d "$OP_INSTALL_DIR" ]]; then
    echo "Install dir $OP_INSTALL_DIR not found"
    exit 1
  fi
  echo "::debug::OP_INSTALL_DIR: ${OP_INSTALL_DIR}"

  # Get the latest stable version of the CLI
  CLI_VERSION="v$(curl https://app-updates.agilebits.com/check/1/0/CLI2/en/2.0.0/N -s | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+')"

  if [[ "$RUNNER_OS" == "Linux" ]]; then
    # Get runner's architecture
    ARCH=$(uname -m)
    if [[ "$(getconf LONG_BIT)" = 32 ]]; then
      ARCH="386"
    elif [[ "$ARCH" == "x86_64" ]]; then
      ARCH="amd64"
    elif [[ "$ARCH" == "aarch64" ]]; then
      ARCH="arm64"
    fi

    if [[ "$ARCH" != "386" ]] && [[ "$ARCH" != "amd64" ]] && [[ "$ARCH" != "arm" ]] && [[ "$ARCH" != "arm64" ]]; then
      echo "Unsupported architecture for the 1Password CLI: $ARCH."
      exit 1
    fi

    curl -sSfLo op.zip "https://cache.agilebits.com/dist/1P/op2/pkg/${CLI_VERSION}/op_linux_${ARCH}_${CLI_VERSION}.zip"
    unzip -od "$OP_INSTALL_DIR" op.zip && rm op.zip
  elif [[ "$RUNNER_OS" == "macOS" ]]; then
    curl -sSfLo op.pkg "https://cache.agilebits.com/dist/1P/op2/pkg/${CLI_VERSION}/op_apple_universal_${CLI_VERSION}.pkg"
    pkgutil --expand op.pkg temp-pkg
    tar -xvf temp-pkg/op.pkg/Payload -C "$OP_INSTALL_DIR"
    rm -rf temp-pkg && rm op.pkg
  elif [ "$RUNNER_OS" = "Windows" ]; then
    pwsh -Command "Invoke-WebRequest -Uri https://cache.agilebits.com/dist/1P/op2/pkg/${CLI_VERSION}/op_windows_amd64_${CLI_VERSION}.zip -OutFile op.zip"
    pwsh -Command "Expand-Archive -Path op.zip -DestinationPath '${OP_INSTALL_DIR}'; Remove-Item op.zip"
  else
    echo "Operating system not supported yet for this GitHub Action: $RUNNER_OS."
    exit 1
  fi
}

install_op_cli
