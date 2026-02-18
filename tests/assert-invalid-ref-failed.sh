#!/bin/bash
set -e
if [ "$STEP_OUTCOME" != "failure" ]; then
  echo "Expected action to fail on invalid ref, got: $STEP_OUTCOME"
  exit 1
fi
echo "Action correctly failed on invalid ref"
