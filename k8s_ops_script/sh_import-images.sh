#!/bin/bash


# Build and push Docker images
echo "Building and pushing Docker images..."

# Function to build and push image
build_and_push() {
    local name=$1
    local dockerfile=$2
    local context=$3
    
    echo "Building $name..."
    docker build -t "localhost:5072/$name:latest" -f "$dockerfile" "$context"
    echo "Pushing $name..."
    docker push "localhost:5072/$name:latest"
}

# Build and push images in parallel
build_and_push "local-voice-ai-whisper" "whisper-service/Dockerfile" "whisper-service/" &
build_and_push "local-voice-ai-app" "app/Dockerfile" "app/" &

# Wait for all builds to complete
wait
docker network connect k3d-mycluster registry
echo "All images built and pushed to local registry"
