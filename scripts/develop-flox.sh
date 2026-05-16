#!/usr/bin/env bash

echo "Stopping services..."
./scripts/stop-flox.sh

# Note: GCS is rebuilt automatically by the gcs.sh script when it starts in flox.
# If you need to force other builds (like protos), you can do it here.
# echo "Building..."
# make build-protos

echo "Starting services..."
./scripts/run-flox.sh
