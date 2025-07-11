#!/bin/bash

# Start local registry if not already running
if ! docker ps | grep -q "registry:2"; then
    echo "Starting local registry..."
    docker run -d \
        -p 5072:5000 \
        --restart=always \
        --name registry \
        registry:2
    sleep 5
fi

# Check if k3d is installed
if ! command -v k3d &> /dev/null; then
    echo "k3d not found! Please install it from https://k3d.io/"
    exit 1
fi

# Create k3d cluster with local registry configured (if not exists)
if ! k3d cluster list | grep -q "mycluster"; then
    echo "Creating k3d cluster with local registry..."
    k3d cluster create mycluster \
        --api-port 6550 \
        --agents 2 \
        -p "80:80@loadbalancer" \
        --registry-config "$(cat <<EOF
{
  "mirrors": {
    "localhost:5072": {
      "endpoint": ["http://registry:5000"]
    }
  }
}
EOF
)"
else
    echo "k3d cluster 'mycluster' already exists."
fi

# Print helpful info
echo ""
echo "✅ Local registry is running at: http://localhost:5072"
echo "✅ k3d cluster 'mycluster' is running and configured to use the local registry"
echo "✅ Ingress will be accessible at: http://localhost:80"
