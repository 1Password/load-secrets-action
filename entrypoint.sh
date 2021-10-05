#!/bin/bash
# shellcheck disable=SC2046,SC2001,SC2086
set -e

# Install op-cli
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  curl -sSfLo op.zip "https://bucket.agilebits.com/cli-private-beta/v2/op_linux_amd64_v2-alpha2.zip"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  curl -sSfLo op.zip "https://bucket.agilebits.com/cli-private-beta/v2/op_darwin_amd64_v2-alpha2.zip"
fi
unzip -od /usr/local/bin/ op.zip && rm op.zip

if [ -z "$OP_CONNECT_TOKEN" ] || [ -z "$OP_CONNECT_HOST" ]; then
  echo "\$OP_CONNECT_TOKEN and \$OP_CONNECT_HOST must be set"
  exit 1
fi

managed_variables_var="OP_MANAGED_VARIABLES"
IFS=',' read -r -a managed_variables <<< "$(printenv $managed_variables_var)"

# Unset all secrets managed by 1Password if `unset-previous` is set.
if [ "$INPUT_UNSET_PREVIOUS" == "true" ]; then
  echo "Unsetting previous values..."

  # Find environment variables that are managed by 1Password.
  for env_var in "${managed_variables[@]}"; do
    echo "Unsetting $env_var"
    unset $env_var

    echo "$env_var=" >> $GITHUB_ENV

    # Keep the masks, just in case.
  done

  managed_variables=()
fi

# Iterate over environment varables to find 1Password references, load the secret values, 
# and make them available as environment variables in the next steps.
IFS=$'\n'
for env_var in $(op env ls); do
  ref=$(printenv $env_var)

  echo "Populating variable: $env_var"
  secret_value=$(op read $ref)

  if [ -z "$secret_value" ]; then
    echo "Could not find or access secret $ref"
    exit 1
  fi

  # Register a mask for the secret to prevent accidental log exposure.
  # To support multiline secrets, escape percent signs and add a mask per line.
  escaped_mask_value=$(echo "$secret_value" | sed -e 's/%/%25/g')
  IFS=$'\n'
  for line in $escaped_mask_value; do
    if [ "${#line}" -lt 3 ]; then
      # To avoid false positives and unreadable logs, omit mask for lines that are too short.
      continue
    fi
    echo "::add-mask::$line"
  done
  unset IFS

  if [ "$INPUT_EXPORT_ENV" == "true" ]; then
    # To support multiline secrets, we'll use the heredoc syntax to populate the environment variables.
    # As the heredoc identifier, we'll use a randomly generated 64-character string,
    # so that collisions are practically impossible.
    random_heredoc_identifier=$(openssl rand -hex 16)
  
    {
      # Populate env var, using heredoc syntax with generated identifier
      echo "$env_var<<${random_heredoc_identifier}"
      echo "$secret_value"
      echo "${random_heredoc_identifier}"
    } >> $GITHUB_ENV

    managed_variables+=("$env_var")

  else
    # Prepare the secret_value to be outputed properly (especially multiline secrets)
    secret_value=$(echo "$secret_value" | awk -v ORS='%0A' '1')

    echo "::set-output name=$env_var::$secret_value"
  fi

done
unset IFS

# Add extra env var that lists which secrets are managed by 1Password so that in a later step
# these can be unset again.
managed_variables_str=$(IFS=','; echo "${managed_variables[*]}")
echo "$managed_variables_var=$managed_variables_str" >> $GITHUB_ENV
