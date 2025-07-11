#!/bin/bash

# Start local registry if not running
if ! docker ps | grep -q "registry:2"; then
    echo "Starting local registry..."
    docker run -d \
        -p 5000:5000 \
        --restart=always \
        --name registry \
        registry:2
    
    # Wait for registry to be ready
    sleep 5
fi

# Create registry config for k3s
sudo mkdir -p /etc/rancher/k3s/
cat << EOF | sudo tee /etc/rancher/k3s/registries.yaml
mirrors:
  "localhost:5000":
    endpoint:
      - "http://localhost:5000"
EOF

# Restart k3s to apply registry config
sudo systemctl restart k3s
sleep 10  # Wait for k3s to restart 