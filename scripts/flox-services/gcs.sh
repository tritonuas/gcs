#!/usr/bin/env bash
export DEBUG_MODE=true
export OBC_ADDR=localhost:5010
export ANTENNA_TRACKER_IP=192.168.1.36
export ANTENNA_TRACKER_PORT=4000
export MAV_DEVICE=tcp:127.0.0.1:14551
export INFLUXDB_BUCKET=mavlink
export INFLUXDB_ORG=TritonUAS
export INFLUXDB_TOKEN=influxdbToken
export INFLUXDB_URI=http://localhost:8086
export HUB_PATH=$(pwd)

# Ensure missions directory exists
mkdir -p missions

# Run the build
make build

# Run the binary
echo "Starting GCS..."
./gcs
EXIT_CODE=$?
echo "GCS exited with $EXIT_CODE"
exit $EXIT_CODE
