#!/usr/bin/env bash

# Clean saved targets
echo "Cleaning saved targets..."
rm -f internal/server/saved/targets.json

# Start flox services
echo "Starting flox services..."
flox activate --start-services

# Start SITL in the background
echo "Starting SITL..."
docker compose -f deployments/docker-compose-sitl.yml up -d

# Wait for SITL to be ready
echo "Waiting for SITL to initialize..."
sleep 5

# Restart MAVProxy service in flox to ensure it connects immediately
echo "Restarting MAVProxy service..."
flox services restart mavproxy

echo "Services started."
echo "You can view logs with: ./scripts/logs.sh"
