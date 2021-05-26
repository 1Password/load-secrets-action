#!/bin/bash
# shellcheck disable=SC2046,SC2001,SC2086
set -e

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

  echo "Loading item $item from vault $vault..."
  item_json=$(curl -sSf -H "Content-Type: application/json" -H "Authorization: Bearer $OP_CONNECT_TOKEN" "$OP_CONNECT_HOST/v1/vaults/$vault/items/$item")
  jq_field_selector=".id == \"$field\" or .label == \"$field\""

  # If the reference contains a section, edit the jq selector to take that into account.
  if [ -n "$section" ]; then
    echo "Looking for section: $section"
    section_id=$(echo "$item_json" | jq -r ".sections[] | select(.id == \"$section\" or .label == \"$section\") | .id")
    jq_field_selector=".section.id == \"$section_id\" and ($jq_field_selector)"
  else
    jq_field_selector=".section == null"
  fi

  echo "Looking for field: $field"
  secret_value=$(echo "$item_json" | jq -r "first(.fields[] | select($jq_field_selector) | .value)")

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
