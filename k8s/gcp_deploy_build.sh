#!/bin/bash

# 设置变量
PROJECT_ID="ai-test-465504"
REGION="us-west4"  # 默认使用台湾机房，你可以改成其他地区
ZONE="us-west4-a"  # 具体的可用区
CLUSTER_NAME="local-voice-ai-cluster"  # 你的集群名称
GPU_NODE_POOL="gpu-pool"  # GPU 节点池名称


# 配置 Docker 认证
echo "🔄 Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev -q


# 构建 Docker 镜像
echo "🏗️ Building Docker images..."
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/local-voice-ai-repo/local-voice-ai:latest ./app
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/local-voice-ai-repo/whisper-service:latest ./whisper-service

# 推送镜像到 Artifact Registry
echo "⬆️ Pushing images to Artifact Registry..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/local-voice-ai-repo/local-voice-ai:latest
docker push $REGION-docker.pkg.dev/$PROJECT_ID/local-voice-ai-repo/whisper-service:latest

