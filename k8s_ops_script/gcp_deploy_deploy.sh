#!/bin/bash

# 设置变量
PROJECT_ID="ai-test-465504"
REGION="us-west4"  # 默认使用台湾机房，你可以改成其他地区
ZONE="us-west4-a"  # 具体的可用区
CLUSTER_NAME="local-voice-ai-cluster"  # 你的集群名称
GPU_NODE_POOL="gpu-pool"  # GPU 节点池名称

# 设置 GKE 认证插件环境变量
export USE_GKE_GCLOUD_AUTH_PLUGIN=True

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查并安装 GKE 认证插件
echo "🔧 Checking GKE auth plugin..."
if ! command -v gke-gcloud-auth-plugin &> /dev/null; then
    echo "❌ GKE auth plugin not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y google-cloud-sdk-gke-gcloud-auth-plugin
    echo "✅ GKE auth plugin installed"
else
    echo "✅ GKE auth plugin is already installed"
fi

# 确保已登录
echo "🔐 Ensuring GCP login..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" || gcloud auth login

# 设置项目
echo "📁 Setting GCP project..."
gcloud config set project $PROJECT_ID

# 获取集群凭证
echo "🔑 Getting cluster credentials..."
gcloud container clusters get-credentials $CLUSTER_NAME --zone $ZONE --project $PROJECT_ID

# 部署到 GKE
echo "🚀 Deploying to GKE..."
cd k8s

# 更新部署文件中的镜像路径
echo "🔄 Updating image paths in deployment files..."
# 备份原始文件
cp app-deployment.yaml app-deployment.yaml.bak
cp whisper-deployment.yaml whisper-deployment.yaml.bak

# 替换镜像路径
sed -i "s|gcr.io/$PROJECT_ID/local-voice-ai:latest|$REGION-docker.pkg.dev/$PROJECT_ID/local-voice-ai-repo/local-voice-ai:latest|g" app-deployment.yaml
sed -i "s|gcr.io/$PROJECT_ID/whisper-service:latest|$REGION-docker.pkg.dev/$PROJECT_ID/local-voice-ai-repo/whisper-service:latest|g" whisper-deployment.yaml

# Apply PVC first
echo "📦 Applying PVC..."
kubectl apply -f hf-cache-pvc.yaml
kubectl apply -f ollama-pvc.yaml

# Apply ConfigMap
echo "⚙️ Applying ConfigMap..."
kubectl apply -f configmap.yaml

# Apply deployments
echo "🚀 Applying deployments..."
kubectl apply -f whisper-deployment.yaml
kubectl apply -f ollama-deployment.yaml
kubectl apply -f app-deployment.yaml

# Apply services
echo "🔌 Applying services..."
kubectl apply -f whisper-service.yaml
kubectl apply -f ollama-service.yaml
kubectl apply -f app-service.yaml

# Apply ingress
echo "🌐 Applying ingress..."
kubectl apply -f ingress.yaml

# Wait for pods to be ready
echo "⏳ Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=whisper --timeout=300s
kubectl wait --for=condition=ready pod -l app=ollama --timeout=300s
kubectl wait --for=condition=ready pod -l app=nextjs-app --timeout=300s

echo "✅ Deployment completed!"

# Show pod status and GPU allocation
echo "📊 Current pod status:"
kubectl get pods
echo "🎮 GPU allocation status:"
kubectl get pods -l app=whisper -o=custom-columns=NAME:.metadata.name,STATUS:.status.phase,GPU:.spec.containers[0].resources.limits.nvidia\\.com/gpu
kubectl get pods -l app=ollama -o=custom-columns=NAME:.metadata.name,STATUS:.status.phase,GPU:.spec.containers[0].resources.limits.nvidia\\.com/gpu

# Show service status
echo "🔍 Service status:"
kubectl get services

# Show ingress status
echo "🌍 Ingress status:"
kubectl get ingress

# 检查 GPU 节点状态
echo "🎮 GPU Node status:"
kubectl describe nodes | grep -A5 "nvidia.com/gpu"

echo "
🎉 Deployment complete! Your application should be accessible soon.
To get the external IP, run: kubectl get ingress

To verify GPU setup:
1. Check GPU node: kubectl describe node <node-name> | grep nvidia.com/gpu
2. Check Whisper pod logs: kubectl logs -l app=whisper
3. Check Ollama pod logs: kubectl logs -l app=ollama
4. Access health endpoint to verify GPU detection

🔗 Port forwarding options:
To access services locally via port forwarding:
- NextJS App: kubectl port-forward service/nextjs-app 3000:3000
- Whisper Service: kubectl port-forward service/whisper-service 5001:5001
- Ollama Service: kubectl port-forward service/ollama-service 11434:11434

Then access:
- NextJS App: http://localhost:3000
- Whisper API: http://localhost:5001
- Ollama API: http://localhost:11434
"

# 恢复部署文件到原始状态
echo "🔄 Restoring deployment files..."
if [ -f app-deployment.yaml.bak ]; then
    mv app-deployment.yaml.bak app-deployment.yaml
fi
if [ -f whisper-deployment.yaml.bak ]; then
    mv whisper-deployment.yaml.bak whisper-deployment.yaml
fi

echo -e "\n${GREEN}🎉 Deployment scripts created!${NC}"
echo "Available utility scripts:"
echo "   ./status.sh         - Check deployment status"
echo "   ./port_forward.sh   - Start port forwarding"
echo "   ./stop_port_forward.sh - Stop port forwarding" 