#!/bin/bash
# shellcheck disable=SC2046,SC2001,SC2086
set -e

# Install op-cli
$(curl -sSfLo op.zip "https://drive.google.com/uc?export=download&id=1HRAsihTN0Cx0pWZEWN06jAWxo0eW5eG-")
unzip -od /usr/local/bin/ op.zip && rm op.zip

if [ -z "$USE_CONNECT" ]; then
  if [ -z "$OP_USER_DOMAIN" ] || [ -z "$OP_USER_EMAIL" ] || [ -z "$OP_USER_KEY" ] || [ -z "$OP_USER_PWD" ]; then
    echo "\$OP_USER_DOMAIN, \$OP_USER_EMAIL, \$OP_USER_KEY and \$OP_USER_PWD must be set"
    exit 1
  fi

  export OP_DEVICE=ugsqksnl4o6f2uwkyeibhqpony
  eval $(printenv OP_USER_PWD | op signin "$OP_USER_DOMAIN" "$OP_USER_EMAIL" "$OP_USER_KEY")
else
  if [ -z "$OP_CONNECT_TOKEN" ] || [ -z "$OP_CONNECT_HOST" ]; then
    echo "\$OP_CONNECT_TOKEN and \$OP_CONNECT_HOST must be set"
    exit 1
  fi
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
for env_var in $(op list envars); do
  ref=$(printenv $env_var)

  echo "Populating variable: $env_var"
  secret_value=$(op read $ref)

  if [ -z "$secret_value" ]; then
    echo "Could not find or access secret $ref"
    exit 1
  fi

  # If the field is marked as concealed or is a note, register a mask
  # for the secret to prevent accidental log exposure.
  if [ "$field_type" == "CONCEALED" ] || [ "$field_purpose" == "NOTES" ]; then
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
  fi

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
done
unset IFS

# Add extra env var that lists which secrets are managed by 1Password so that in a later step
# these can be unset again.
managed_variables_str=$(IFS=','; echo "${managed_variables[*]}")
echo "$managed_variables_var=$managed_variables_str" >> $GITHUB_ENV
