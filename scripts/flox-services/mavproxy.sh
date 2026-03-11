#!/usr/bin/env bash
# Wait for SITL to be ready (optional, but good practice)
# sleep 5

# Ensure venv is activated
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

echo "Starting MAVProxy loop..."

while true; do
  echo "Attempting to start MAVProxy..."
  mavproxy.py \
    --master=tcp:127.0.0.1:5760 \
    --out=tcpin:0.0.0.0:14552 \
    --out=tcpin:0.0.0.0:14551 \
    --out=tcpin:0.0.0.0:14553 \
    --non-interactive
  
  EXIT_CODE=$?
  echo "MAVProxy exited with code $EXIT_CODE. Restarting in 5 seconds..."
  sleep 5
done
