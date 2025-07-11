#!/bin/bash

# Port forwarding script for local-voice-ai services
# This script forwards all services to localhost for local development/testing

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

printf "%b\n" "${BLUE}🔌 Starting port forwarding for local-voice-ai services...${NC}"t forwarding script for local-voice-ai services
# This script forwards all services to localhost for local development/testing

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print with colors (compatible with sh and bash)
print_msg() {
    printf "%b\n" "%b\n" "$1"
}

print_msg "${BLUE}🔌 Starting port forwarding for local-voice-ai services...${NC}"

# 检查 kubectl 是否可用
KUBECTL_PATH=""
if command -v kubectl &> /dev/null; then
    KUBECTL_PATH="kubectl"
elif [ -f /usr/local/bin/kubectl ]; then
    KUBECTL_PATH="/usr/local/bin/kubectl"
elif [ -f /usr/bin/kubectl ]; then
    KUBECTL_PATH="/usr/bin/kubectl"
else
    printf "%b\n" "${RED}❌ kubectl is not installed or not found${NC}"
    exit 1
fi

printf "%b\n" "${GREEN}✅ Found kubectl at: $KUBECTL_PATH${NC}"

# 检查是否连接到集群
if ! $KUBECTL_PATH cluster-info &> /dev/null; then
    printf "%b\n" "${RED}❌ Not connected to a Kubernetes cluster${NC}"
    echo "Please run the deployment script first or configure kubectl"
    exit 1
fi

# 检查服务是否存在
printf "%b\n" "${YELLOW}🔍 Checking if services exist...${NC}"
services=("nextjs-app" "whisper-service" "ollama-service")
for service in "${services[@]}"; do
    if ! $KUBECTL_PATH get service "$service" &> /dev/null; then
        printf "%b\n" "${RED}❌ Service $service not found${NC}"
        echo "Please deploy the application first"
        exit 1
    fi
done

# 创建后台端口转发进程
printf "%b\n" "${GREEN}✅ All services found. Starting port forwarding...${NC}"

# 清理现有的端口转发进程
printf "%b\n" "${YELLOW}🧹 Cleaning up existing port forwards...${NC}"
pkill -f "$KUBECTL_PATH port-forward.*nextjs-app" 2>/dev/null || true
pkill -f "$KUBECTL_PATH port-forward.*whisper-service" 2>/dev/null || true
pkill -f "$KUBECTL_PATH port-forward.*ollama-service" 2>/dev/null || true

# 等待端口释放
sleep 2

# 启动端口转发（后台运行）
printf "%b\n" "${BLUE}🚀 Starting port forwards...${NC}"

# NextJS App (3001 -> 3000)
printf "%b\n" "${YELLOW}📱 Forwarding NextJS App: localhost:3001${NC}"
$KUBECTL_PATH port-forward service/nextjs-app 3001:3000 > /dev/null 2>&1 &
NEXTJS_PID=$!

# Whisper Service (5001 -> 5001)
printf "%b\n" "${YELLOW}🎤 Forwarding Whisper Service: localhost:5001${NC}"
$KUBECTL_PATH port-forward service/whisper-service 5001:5001 > /dev/null 2>&1 &
WHISPER_PID=$!

# Ollama Service (11434 -> 11434)
printf "%b\n" "${YELLOW}🤖 Forwarding Ollama Service: localhost:11434${NC}"
$KUBECTL_PATH port-forward service/ollama-service 11434:11434 > /dev/null 2>&1 &
OLLAMA_PID=$!

# 等待端口转发建立
printf "%b\n" "${YELLOW}⏳ Waiting for port forwards to establish...${NC}"
sleep 3

# 检查端口转发状态
printf "%b\n" "${BLUE}🔍 Checking port forward status...${NC}"
failed_services=()

if ! nc -z localhost 3001 2>/dev/null; then
    printf "%b\n" "${RED}❌ NextJS App port forward failed${NC}"
    failed_services+=("nextjs-app")
else
    printf "%b\n" "${GREEN}✅ NextJS App available at http://localhost:3001${NC}"
fi

if ! nc -z localhost 5001 2>/dev/null; then
    printf "%b\n" "${RED}❌ Whisper Service port forward failed${NC}"
    failed_services+=("whisper-service")
else
    printf "%b\n" "${GREEN}✅ Whisper Service available at http://localhost:5001${NC}"
fi

if ! nc -z localhost 11434 2>/dev/null; then
    printf "%b\n" "${RED}❌ Ollama Service port forward failed${NC}"
    failed_services+=("ollama-service")
else
    printf "%b\n" "${GREEN}✅ Ollama Service available at http://localhost:11434${NC}"
fi

# 保存PID到文件以便后续清理
echo "$NEXTJS_PID" > /tmp/nextjs_port_forward.pid
echo "$WHISPER_PID" > /tmp/whisper_port_forward.pid
echo "$OLLAMA_PID" > /tmp/ollama_port_forward.pid

if [ ${#failed_services[@]} -eq 0 ]; then
    printf "%b\n" "\n${GREEN}🎉 All port forwards are active!${NC}"
else
    printf "%b\n" "\n${YELLOW}⚠️ Some port forwards failed: ${failed_services[*]}${NC}"
fi

printf "%b\n" "\n${BLUE}📋 Available endpoints:${NC}"
printf "%b\n" "  🌐 NextJS App:      http://localhost:3001"
printf "%b\n" "  🎤 Whisper API:     http://localhost:5001"
printf "%b\n" "  🤖 Ollama API:      http://localhost:11434"

printf "%b\n" "\n${BLUE}🔧 Health check endpoints:${NC}"
printf "%b\n" "  🏥 Whisper Health:  http://localhost:5001/health"
printf "%b\n" "  🏥 NextJS Health:   http://localhost:3001/api/health"

printf "%b\n" "\n${YELLOW}📝 Note: Port forwards are running in the background${NC}"
printf "%b\n" "   To stop them, run: ${GREEN}./stop_port_forward.sh${NC}"
printf "%b\n" "   To check status, run: ${GREEN}./check_port_forward.sh${NC}"

printf "%b\n" "\n${GREEN}✅ Port forwarding setup complete!${NC}"
