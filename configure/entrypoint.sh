#!/bin/bash
# shellcheck disable=SC2086
set -e

# Capture Connect configuration in $GITHUB_ENV, giving (optional) inputs 
# precendence over OP_CONNECT_* environment variables.

OP_CONNECT_HOST="${INPUT_CONNECT_HOST:-$OP_CONNECT_HOST}"
if [ -n "$OP_CONNECT_HOST" ]; then
  echo "OP_CONNECT_HOST=$OP_CONNECT_HOST" >> $GITHUB_ENV
fi

OP_CONNECT_TOKEN="${INPUT_CONNECT_TOKEN:-$OP_CONNECT_TOKEN}"
if [ -n "$OP_CONNECT_TOKEN" ]; then
  echo "OP_CONNECT_TOKEN=$OP_CONNECT_TOKEN" >> $GITHUB_ENV
fi

USE_CONNECT="${INPUT_USE_CONNECT:-$USE_CONNECT}"
if [ -n "$USE_CONNECT" ]; then
  echo "USE_CONNECT=$USE_CONNECT" >> $GITHUB_ENV
fi

OP_USER_DOMAIN="${INPUT_USER_DOMAIN:-$OP_USER_DOMAIN}"
if [ -n "$OP_USER_DOMAIN" ]; then
  echo "OP_USER_DOMAIN=$OP_USER_DOMAIN" >> $GITHUB_ENV
fi

OP_USER_EMAIL="${INPUT_USER_EMAIL:-$OP_USER_EMAIL}"
if [ -n "$OP_USER_EMAIL" ]; then
  echo "OP_USER_EMAIL=$OP_USER_EMAIL" >> $GITHUB_ENV
fi

OP_USER_KEY="${INPUT_USER_KEY:-$OP_USER_KEY}"
if [ -n "$OP_USER_KEY" ]; then
  echo "OP_USER_KEY=$OP_USER_KEY" >> $GITHUB_ENV
fi

OP_USER_PWD="${INPUT_USER_PWD:-$OP_USER_PWD}"
if [ -n "$OP_USER_PWD" ]; then
  echo "OP_USER_PWD=$OP_USER_PWD" >> $GITHUB_ENV
fi
