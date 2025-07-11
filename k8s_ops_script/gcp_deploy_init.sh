#!/bin/bash

# 设置变量
PROJECT_ID="ai-test-465504"
REGION="us-west4"  # 默认使用台湾机房，你可以改成其他地区
ZONE="us-west4-a"  # 具体的可用区
CLUSTER_NAME="local-voice-ai-cluster"  # 你的集群名称
GPU_NODE_POOL="gpu-pool"  # GPU 节点池名称

# 确保已登录
echo "🔐 Ensuring GCP login..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" || gcloud auth login

# 设置项目
echo "📁 Setting GCP project..."
gcloud config set project $PROJECT_ID

# 启用必要的 API
echo "🔧 Enabling required APIs..."
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# 创建 GKE 集群（如果不存在）
echo "🔄 Creating GKE cluster if it doesn't exist..."
if ! gcloud container clusters list --zone $ZONE | grep -q $CLUSTER_NAME; then
    echo "Creating new cluster $CLUSTER_NAME..."
    gcloud container clusters create $CLUSTER_NAME \
        --zone $ZONE \
        --num-nodes 1 \
        --machine-type e2-standard-4 \
        --disk-size 50
fi

# 创建 GPU 节点池（如果不存在）
echo "🔄 Creating GPU node pool if it doesn't exist..."
if ! gcloud container node-pools list --cluster $CLUSTER_NAME --zone $ZONE | grep -q $GPU_NODE_POOL; then
    echo "Creating new GPU node pool $GPU_NODE_POOL..."
    gcloud container node-pools create $GPU_NODE_POOL \
        --cluster $CLUSTER_NAME \
        --zone $ZONE \
        --num-nodes 1 \
        --machine-type n1-standard-4 \
        --accelerator type=nvidia-tesla-t4,count=1 \
        --disk-size 50 \
        --enable-autoscaling \
        --min-nodes 1 \
        --max-nodes 3
fi

# 获取集群凭证
echo "🔑 Getting cluster credentials..."
gcloud container clusters get-credentials $CLUSTER_NAME --zone $ZONE --project $PROJECT_ID

# # 安装 NVIDIA 驱动和设备插件
# echo "🔧 Installing NVIDIA drivers and device plugin..."
# kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml

# 创建 Artifact Registry 仓库（如果不存在）
echo "🏗️ Creating Artifact Registry repository if it doesn't exist..."
if ! gcloud artifacts repositories list --location=$REGION | grep -q "local-voice-ai-repo"; then
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create local-voice-ai-repo \
        --repository-format=docker \
        --location=$REGION \
        --description="Local Voice AI Docker repository"
fi

# 配置 Docker 认证
echo "🔄 Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev -q
