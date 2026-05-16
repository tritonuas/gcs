#!/usr/bin/env bash

# Stop flox services
echo "Stopping flox services..."
flox services stop

# Stop SITL container
echo "Stopping SITL..."
docker compose -f deployments/docker-compose-sitl.yml down

echo "All services stopped."
