#!/bin/bash

# Apply PVC first (assuming you have a pvc.yaml)
echo "Applying PVC..."
kubectl apply -f k8s/hf-cache-pvc.yaml

# Apply ConfigMap
echo "Applying ConfigMap..."
kubectl apply -f k8s/configmap.yaml

# Apply deployments
echo "Applying deployments..."
kubectl apply -f k8s/whisper-deployment.yaml
kubectl apply -f k8s/breezyvoice-deployment.yaml
kubectl apply -f k8s/app-deployment.yaml

# Apply services
echo "Applying services..."
kubectl apply -f k8s/whisper-service.yaml
kubectl apply -f k8s/breezyvoice-service.yaml
kubectl apply -f k8s/app-service.yaml

# Wait for pods to be ready
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=whisper --timeout=300s
kubectl wait --for=condition=ready pod -l app=breezyvoice --timeout=300s
kubectl wait --for=condition=ready pod -l app=nextjs-app --timeout=300s

echo "All deployments completed!"

# Show pod status
echo "Current pod status:"
kubectl get pods 