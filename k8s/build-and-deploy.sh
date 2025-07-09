#!/bin/bash

# Build Docker images
echo "Building Docker images..."
docker build -t local-voice-ai-whisper:latest -f whisper-service/Dockerfile whisper-service/
docker build -t local-voice-ai-app:latest -f Dockerfile.app .

# Apply Kubernetes manifests
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/whisper-deployment.yaml
kubectl apply -f k8s/whisper-service.yaml
kubectl apply -f k8s/app-deployment.yaml
kubectl apply -f k8s/app-service.yaml
kubectl apply -f k8s/ingress.yaml

echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/whisper-service
kubectl wait --for=condition=available --timeout=300s deployment/nextjs-app

echo "Services deployed successfully!"
echo "You can access the application through your ingress controller's IP/domain." 