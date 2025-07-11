# Local Voice AI - Kubernetes Deployment Scripts

This directory contains scripts for deploying and managing the Local Voice AI application on Google Kubernetes Engine (GKE).

## Scripts Overview

### 🚀 Deployment Scripts

#### `gcp_deploy_deploy.sh`
Main deployment script that:
- Checks and installs GKE auth plugin
- Authenticates with GCP
- Gets cluster credentials
- Deploys all services (NextJS app, Whisper service, Ollama service)
- Shows deployment status

```bash
./gcp_deploy_deploy.sh
```

### 🔗 Port Forwarding Scripts

#### `port_forward.sh`
Starts port forwarding for all services to access them locally:
- NextJS App: `http://localhost:3000`
- Whisper Service: `http://localhost:5001`  
- Ollama Service: `http://localhost:11434`

```bash
./port_forward.sh
```

#### `stop_port_forward.sh`
Stops all active port forwarding processes:

```bash
./stop_port_forward.sh
```

### 📊 Monitoring Scripts

#### `status.sh`
Comprehensive status check showing:
- Pod status
- Service status
- Ingress status
- GPU allocation
- Recent events
- Port forwarding status

```bash
./status.sh
```

## Quick Start

1. **Deploy the application:**
   ```bash
   ./gcp_deploy_deploy.sh
   ```

2. **Check deployment status:**
   ```bash
   ./status.sh
   ```

3. **Start port forwarding for local access:**
   ```bash
   ./port_forward.sh
   ```

4. **Access the application:**
   - Open `http://localhost:3000` in your browser
   - Whisper API available at `http://localhost:5001`
   - Ollama API available at `http://localhost:11434`

5. **Stop port forwarding when done:**
   ```bash
   ./stop_port_forward.sh
   ```

## Services

### NextJS App (Port 3000)
- Main web interface for the voice AI application
- Handles user interactions and UI

### Whisper Service (Port 5001)
- Speech recognition service
- Converts audio to text using OpenAI Whisper
- Utilizes GPU acceleration

### Ollama Service (Port 11434)
- Large Language Model service
- Provides AI responses and conversation
- Utilizes GPU acceleration

## GPU Configuration

The deployment includes GPU-enabled nodes for:
- Whisper service: Speech recognition acceleration
- Ollama service: LLM inference acceleration

Check GPU allocation with:
```bash
kubectl get pods -l app=whisper -o=custom-columns=NAME:.metadata.name,STATUS:.status.phase,GPU:.spec.containers[0].resources.limits.nvidia\\.com/gpu
```

## Troubleshooting

### Port Forwarding Issues
- If ports are already in use, the script will show an error
- Stop existing port forwards: `./stop_port_forward.sh`
- Check what's using a port: `lsof -i :3000`

### Authentication Issues
- Ensure you're logged in: `gcloud auth login`
- Check project: `gcloud config get-value project`
- Verify cluster access: `kubectl get nodes`

### Pod Issues
- Check pod logs: `kubectl logs -l app=whisper`
- Describe pod: `kubectl describe pod <pod-name>`
- Check events: `kubectl get events --sort-by=.metadata.creationTimestamp`

## Environment Variables

The scripts use the following environment variables:
- `USE_GKE_GCLOUD_AUTH_PLUGIN=True`: Required for GKE authentication
- `PROJECT_ID`: GCP project ID (set in deployment script)
- `CLUSTER_NAME`: GKE cluster name (set in deployment script)
- `ZONE`: GCP zone (set in deployment script)
