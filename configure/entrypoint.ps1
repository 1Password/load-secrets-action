if ($env:INPUT_CONNECT_HOST) {
  Add-Content -Path $env:GITHUB_ENV -Value "OP_CONNECT_HOST=$($env:INPUT_CONNECT_HOST)" -Encoding utf8
} elseif ($env:OP_CONNECT_HOST) {
  Add-Content -Path $env:GITHUB_ENV -Value "OP_CONNECT_HOST=$($env:OP_CONNECT_HOST)" -Encoding utf8
}

if ($env:INPUT_CONNECT_TOKEN) {
  Add-Content -Path $env:GITHUB_ENV -Value "OP_CONNECT_TOKEN=$($env:INPUT_CONNECT_TOKEN)" -Encoding utf8
} elseif ($env:OP_CONNECT_TOKEN) {
  Add-Content -Path $env:GITHUB_ENV -Value "OP_CONNECT_TOKEN=$($env:OP_CONNECT_TOKEN)" -Encoding utf8
}

if ($env:INPUT_SERVICE_ACCOUNT_TOKEN) {
  Add-Content -Path $env:GITHUB_ENV -Value "OP_SERVICE_ACCOUNT_TOKEN=$($env:INPUT_SERVICE_ACCOUNT_TOKEN)" -Encoding utf8
} elseif ($env:OP_SERVICE_ACCOUNT_TOKEN) {
  Add-Content -Path $env:GITHUB_ENV -Value "OP_SERVICE_ACCOUNT_TOKEN=$($env:OP_SERVICE_ACCOUNT_TOKEN)" -Encoding utf8
}