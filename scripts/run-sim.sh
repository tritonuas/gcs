#!/usr/bin/env bash

# Start SITL in the background
echo "Starting SITL..."
docker compose -f deployments/docker-compose-sitl.yml up -d

# Wait for SITL to be ready (simple sleep)
echo "Waiting for SITL to initialize..."
sleep 5

# Restart MAVProxy service in flox to ensure it connects immediately
echo "Restarting MAVProxy service..."
flox services restart mavproxy

echo "Simulation started. MAVProxy should connect shortly."
echo "You can view logs with: ./scripts/logs.sh"
