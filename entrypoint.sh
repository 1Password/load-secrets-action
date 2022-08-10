#!/bin/bash
# shellcheck disable=SC2046,SC2001,SC2086
set -e

readonly CONNECT="CONNECT"
readonly SERVICE_ACCOUNT="SERVICE_ACCOUNT"

auth_type=$CONNECT
managed_variables_var="OP_MANAGED_VARIABLES"
IFS=','

# Unset all secrets managed by 1Password if `unset-previous` is set.
unset_prev_secrets() {
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
}

# Install op-cli
install_op_cli() {
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -sSfLo op.zip "https://cache.agilebits.com/dist/1P/op2/pkg/v2.6.0-beta.06/op_linux_amd64_v2.6.0-beta.06.zip"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    curl -sSfLo op.zip "https://bucket.agilebits.com/cli-private-beta/v2/op_darwin_amd64_v2-alpha2.zip"
  fi
  unzip -od /usr/local/bin/ op.zip && rm op.zip
}

# Load environment variables using op cli. Iterate over them to find 1Password references, load the secret values,
# and make them available as environment variables in the next steps.
extract_from_op_env() {
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

    else
      # Prepare the secret_value to be outputed properly (especially multiline secrets)
      secret_value=$(echo "$secret_value" | awk -v ORS='%0A' '1')

      echo "::set-output name=$env_var::$secret_value"
    fi

  managed_variables+=("$env_var")

  done
  unset IFS
}

# Load environment variables using connect service. Iterate over hem to find 1Password references, load the secret values,
# and make them available as environment variables in the next steps.
extract_from_connect() {
  curl_headers=(-H "Content-Type: application/json" -H "Authorization: Bearer $OP_CONNECT_TOKEN")
  IFS=$'\n'

  for possible_ref in $(printenv | grep "=op://" | grep -v "^#"); do
    env_var=$(echo "$possible_ref" | cut -d '=' -f1)
    ref=$(printenv $env_var)

    if [[ ! $ref == "op://"* ]]; then
      echo "Not really a reference: $ref"
      continue
    fi

    path=$(echo $ref | sed -e "s/^op:\/\///")
    if [ $(echo "$path" | tr -cd '/' | wc -c) -lt 2 ]; then
      echo "Expected path to be in format op://<vault>/<item>[/<section>]/<field>: $ref"
      continue
    fi

    echo "Populating variable: $env_var"

    vault=""
    item=""
    section=""
    field=""
    i=0
    IFS="/"
    for component in $path; do
      ((i+=1))
      case "$i" in
        1) vault=$component ;;
        2) item=$component ;;
        3) section=$component ;;
        4) field=$component ;;
      esac
    done
    unset IFS

    # If field is not set, it may have wrongfully been interpreted as the section.
    if [ -z "$field" ]; then
      field="$section"
      section=""
    fi

    if [[ $(echo -n $(echo $vault | grep "^[a-z0-9]*$") | wc -c) -ne 26 ]]; then
      echo "Getting vault ID from vault name: $vault"
      vault=$(curl -sSf "${curl_headers[@]}" "$OP_CONNECT_HOST/v1/vaults?filter=name%20eq%20%22$vault%22" | jq -r '.[0] | .id')
      if [ -z "$vault" ]; then
        echo "Could not find vault ID for vault: $vault"
        exit 1
      fi
    fi

    if [[ $(echo -n $(echo $item | grep "^[a-z0-9]*$") | wc -c) -ne 26 ]]; then
      echo "Getting item ID from vault $vault..."
      item=$(curl -sSf "${curl_headers[@]}" "$OP_CONNECT_HOST/v1/vaults/$vault/items?filter=title%20eq%20%22$item%22" | jq -r '.[0] | .id')
      if [ -z "$item" ]; then
        echo "Could not find item ID for item: $item"
        exit 1
      fi
    fi

    echo "Loading item $item from vault $vault..."
    item_json=$(curl -sSf "${curl_headers[@]}" "$OP_CONNECT_HOST/v1/vaults/$vault/items/$item")

    jq_field_selector=".id == \"$field\" or .label == \"$field\""
    jq_section_selector=".section == null"

    # If the reference contains a section, edit the jq selector to take that into account.
    if [ -n "$section" ]; then
      echo "Looking for section: $section"
      section_id=$(echo "$item_json" | jq -r ".sections[] | select(.id == \"$section\" or .label == \"$section\") | .id")
      jq_section_selector=".section.id == \"$section_id\""
    fi

    jq_secret_selector="$jq_section_selector and ($jq_field_selector)"

    echo "Looking for field: $field"
    secret_field_json=$(echo "$item_json" | jq -r "first(.fields[] | select($jq_secret_selector))")

    field_type=$(echo "$secret_field_json" | jq -r '.type')
    field_purpose=$(echo "$secret_field_json" | jq -r '.purpose')
    secret_value=$(echo "$secret_field_json" | jq -r '.value')

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
}

read -r -a managed_variables <<< "$(printenv $managed_variables_var)"

if [ -z "$OP_CONNECT_TOKEN" ] || [ -z "$OP_CONNECT_HOST" ]; then
  if [ -z "$OP_SERVICE_ACCOUNT_TOKEN" ]; then
    echo "(\$OP_CONNECT_TOKEN and \$OP_CONNECT_HOST) or \$OP_SERVICE_ACCOUNT_TOKEN must be set"
    exit 1
  fi

  auth_type=$SERVICE_ACCOUNT
fi

printf "Authenticated with %s \n" $auth_type

unset_prev_secrets

if [ "$auth_type" == "$SERVICE_ACCOUNT" ]; then
  install_op_cli
  extract_from_op_env
elif [ "$auth_type" == "$CONNECT" ]; then
  extract_from_connect
fi

# Add extra env var that lists which secrets are managed by 1Password so that in a later step
# these can be unset again.
managed_variables_str=$(IFS=','; echo "${managed_variables[*]}")
echo "$managed_variables_var=$managed_variables_str" >> $GITHUB_ENV
