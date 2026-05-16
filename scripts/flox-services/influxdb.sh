#!/usr/bin/env bash
export INFLUXD_ENGINE_PATH=$(pwd)/.flox/run/influxdb
mkdir -p $INFLUXD_ENGINE_PATH

# Start influxd
echo "Starting InfluxDB..."
influxd
EXIT_CODE=$?
echo "InfluxDB exited with $EXIT_CODE"
exit $EXIT_CODE
