#!/bin/bash

# Start Python Whisper service in background
echo "Starting Whisper service..."
python3 local_whisper_service.py &
WHISPER_PID=$!

# Wait for Whisper service to be ready
echo "Waiting for Whisper service to be ready..."
until curl -f http://localhost:5001/health > /dev/null 2>&1; do
  sleep 2
done
echo "Whisper service is ready!"

# Start Next.js
echo "Starting Next.js application..."
npm start &
NEXTJS_PID=$!

# Function to handle shutdown
shutdown() {
  echo "Shutting down services..."
  kill $WHISPER_PID $NEXTJS_PID
  exit 0
}

# Trap signals
trap shutdown SIGTERM SIGINT

# Wait for both processes
wait $WHISPER_PID $NEXTJS_PID 