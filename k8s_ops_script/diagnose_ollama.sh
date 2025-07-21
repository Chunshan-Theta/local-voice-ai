#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Ollama Deployment Diagnostics${NC}"
echo "=" * 50

# 檢查 Pod 狀態
echo -e "\n${YELLOW}📦 Pod Status:${NC}"
kubectl get pods -l app=ollama -o wide

# 檢查 Pod 詳細信息
echo -e "\n${YELLOW}🔍 Pod Details:${NC}"
kubectl describe pods -l app=ollama

# 檢查 Service 狀態
echo -e "\n${YELLOW}🔌 Service Status:${NC}"
kubectl get service ollama-service

# 檢查 PVC 狀態
echo -e "\n${YELLOW}💾 PVC Status:${NC}"
kubectl get pvc ollama-pvc

# 檢查 GPU 資源
echo -e "\n${YELLOW}🎮 GPU Resources:${NC}"
kubectl describe nodes | grep -A10 "nvidia.com/gpu"

# 檢查 Pod 日誌
echo -e "\n${YELLOW}📋 Pod Logs (last 20 lines):${NC}"
kubectl logs -l app=ollama --tail=20

# 檢查 Pod 事件
echo -e "\n${YELLOW}⚠️ Pod Events:${NC}"
kubectl get events --field-selector involvedObject.kind=Pod --sort-by='.lastTimestamp' | grep ollama

# 檢查存儲掛載
echo -e "\n${YELLOW}💾 Storage Mounts:${NC}"
kubectl exec -l app=ollama -- df -h | grep ollama || echo "No ollama mount found"

# 測試 API 連接
echo -e "\n${YELLOW}🔗 API Connection Test:${NC}"
OLLAMA_POD=$(kubectl get pods -l app=ollama -o jsonpath='{.items[0].metadata.name}')
if [ ! -z "$OLLAMA_POD" ]; then
    echo "Testing API in pod: $OLLAMA_POD"
    kubectl exec $OLLAMA_POD -- curl -s http://localhost:11434/api/tags || echo "API test failed"
else
    echo "No Ollama pod found"
fi

# 檢查磁碟空間
echo -e "\n${YELLOW}💿 Disk Space:${NC}"
if [ ! -z "$OLLAMA_POD" ]; then
    kubectl exec $OLLAMA_POD -- df -h
fi

# 檢查網路連接
echo -e "\n${YELLOW}🌐 Network Test:${NC}"
if [ ! -z "$OLLAMA_POD" ]; then
    echo "Testing external connectivity:"
    kubectl exec $OLLAMA_POD -- ping -c 3 8.8.8.8 || echo "External connectivity failed"
    kubectl exec $OLLAMA_POD -- nslookup huggingface.co || echo "DNS resolution failed"
fi

echo -e "\n${GREEN}✅ Diagnostics completed${NC}"
echo -e "\n${BLUE}Troubleshooting Tips:${NC}"
echo "1. Check if GPU nodes are available and properly labeled"
echo "2. Verify PVC is bound and has sufficient space (50Gi)"
echo "3. Check pod logs for specific error messages"
echo "4. Ensure network connectivity for model downloads"
echo "5. Verify resource requests don't exceed node capacity"
