#!/bin/bash

# Check port forwarding status for local-voice-ai services

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

printf "%b\n" "${BLUE}🔍 Checking port forwarding status for local-voice-ai services...${NC}"

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

# 检查端口转发进程
printf "%b\n" "\n${YELLOW}🔄 Checking kubectl port-forward processes:${NC}"
pf_processes=()

# 检查 NextJS App
nextjs_pids=$(pgrep -f "port-forward.*nextjs-app" 2>/dev/null)
if [ -n "$nextjs_pids" ]; then
    printf "%b\n" "${GREEN}✅ NextJS App port forward running (PID: $nextjs_pids)${NC}"
    pf_processes+=("nextjs-app")
else
    printf "%b\n" "${RED}❌ NextJS App port forward not running${NC}"
fi

# 检查 Whisper Service
whisper_pids=$(pgrep -f "port-forward.*whisper-service" 2>/dev/null)
if [ -n "$whisper_pids" ]; then
    printf "%b\n" "${GREEN}✅ Whisper Service port forward running (PID: $whisper_pids)${NC}"
    pf_processes+=("whisper-service")
else
    printf "%b\n" "${RED}❌ Whisper Service port forward not running${NC}"
fi

# 检查 Ollama Service
ollama_pids=$(pgrep -f "port-forward.*ollama-service" 2>/dev/null)
if [ -n "$ollama_pids" ]; then
    printf "%b\n" "${GREEN}✅ Ollama Service port forward running (PID: $ollama_pids)${NC}"
    pf_processes+=("ollama-service")
else
    printf "%b\n" "${RED}❌ Ollama Service port forward not running${NC}"
fi

# 检查端口可用性
printf "%b\n" "\n${YELLOW}🔌 Checking port availability:${NC}"
port_status=()

# 检查端口 3001
if nc -z localhost 3001 2>/dev/null; then
    printf "%b\n" "${GREEN}✅ Port 3001 (NextJS App) is accessible${NC}"
    port_status+=("3001")
else
    printf "%b\n" "${RED}❌ Port 3001 (NextJS App) is not accessible${NC}"
fi

# 检查端口 5001
if nc -z localhost 5001 2>/dev/null; then
    printf "%b\n" "${GREEN}✅ Port 5001 (Whisper Service) is accessible${NC}"
    port_status+=("5001")
else
    printf "%b\n" "${RED}❌ Port 5001 (Whisper Service) is not accessible${NC}"
fi

# 检查端口 11434
if nc -z localhost 11434 2>/dev/null; then
    printf "%b\n" "${GREEN}✅ Port 11434 (Ollama Service) is accessible${NC}"
    port_status+=("11434")
else
    printf "%b\n" "${RED}❌ Port 11434 (Ollama Service) is not accessible${NC}"
fi

# 检查 PID 文件
printf "%b\n" "\n${YELLOW}📁 Checking PID files:${NC}"
pid_files=()

if [ -f /tmp/nextjs_port_forward.pid ]; then
    pid=$(cat /tmp/nextjs_port_forward.pid)
    if kill -0 $pid 2>/dev/null; then
        printf "%b\n" "${GREEN}✅ NextJS PID file exists and process is running (PID: $pid)${NC}"
        pid_files+=("nextjs")
    else
        printf "%b\n" "${YELLOW}⚠️ NextJS PID file exists but process is not running${NC}"
    fi
else
    printf "%b\n" "${RED}❌ NextJS PID file not found${NC}"
fi

if [ -f /tmp/whisper_port_forward.pid ]; then
    pid=$(cat /tmp/whisper_port_forward.pid)
    if kill -0 $pid 2>/dev/null; then
        printf "%b\n" "${GREEN}✅ Whisper PID file exists and process is running (PID: $pid)${NC}"
        pid_files+=("whisper")
    else
        printf "%b\n" "${YELLOW}⚠️ Whisper PID file exists but process is not running${NC}"
    fi
else
    printf "%b\n" "${RED}❌ Whisper PID file not found${NC}"
fi

if [ -f /tmp/ollama_port_forward.pid ]; then
    pid=$(cat /tmp/ollama_port_forward.pid)
    if kill -0 $pid 2>/dev/null; then
        printf "%b\n" "${GREEN}✅ Ollama PID file exists and process is running (PID: $pid)${NC}"
        pid_files+=("ollama")
    else
        printf "%b\n" "${YELLOW}⚠️ Ollama PID file exists but process is not running${NC}"
    fi
else
    printf "%b\n" "${RED}❌ Ollama PID file not found${NC}"
fi

# 测试服务响应
printf "%b\n" "\n${YELLOW}🏥 Testing service health:${NC}"
health_status=()

# 测试 NextJS App 健康检查
if nc -z localhost 3001 2>/dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null)
    if [ "$response" = "200" ]; then
        printf "%b\n" "${GREEN}✅ NextJS App health check passed${NC}"
        health_status+=("nextjs")
    else
        printf "%b\n" "${YELLOW}⚠️ NextJS App is running but health check failed (HTTP $response)${NC}"
    fi
else
    printf "%b\n" "${RED}❌ Cannot test NextJS App health (port not accessible)${NC}"
fi

# 测试 Whisper Service 健康检查
if nc -z localhost 5001 2>/dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/health 2>/dev/null)
    if [ "$response" = "200" ]; then
        printf "%b\n" "${GREEN}✅ Whisper Service health check passed${NC}"
        health_status+=("whisper")
    else
        printf "%b\n" "${YELLOW}⚠️ Whisper Service is running but health check failed (HTTP $response)${NC}"
    fi
else
    printf "%b\n" "${RED}❌ Cannot test Whisper Service health (port not accessible)${NC}"
fi

# 测试 Ollama Service
if nc -z localhost 11434 2>/dev/null; then
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/version 2>/dev/null)
    if [ "$response" = "200" ]; then
        printf "%b\n" "${GREEN}✅ Ollama Service is responding${NC}"
        health_status+=("ollama")
    else
        printf "%b\n" "${YELLOW}⚠️ Ollama Service is running but not responding properly (HTTP $response)${NC}"
    fi
else
    printf "%b\n" "${RED}❌ Cannot test Ollama Service (port not accessible)${NC}"
fi

# 汇总状态
printf "%b\n" "\n${BLUE}📊 Summary:${NC}"
printf "%b\n" "  Running processes: ${#pf_processes[@]}/3 (${pf_processes[*]})"
printf "%b\n" "  Accessible ports: ${#port_status[@]}/3 (${port_status[*]})"
printf "%b\n" "  Valid PID files: ${#pid_files[@]}/3 (${pid_files[*]})"
printf "%b\n" "  Healthy services: ${#health_status[@]}/3 (${health_status[*]})"

if [ ${#pf_processes[@]} -eq 3 ] && [ ${#port_status[@]} -eq 3 ] && [ ${#health_status[@]} -eq 3 ]; then
    printf "%b\n" "\n${GREEN}🎉 All services are fully operational!${NC}"
elif [ ${#pf_processes[@]} -eq 0 ] && [ ${#port_status[@]} -eq 0 ]; then
    printf "%b\n" "\n${YELLOW}⚠️ No port forwarding is currently active${NC}"
    printf "%b\n" "   Run ${GREEN}./port_forward.sh${NC} to start port forwarding"
else
    printf "%b\n" "\n${YELLOW}⚠️ Port forwarding is partially working${NC}"
    printf "%b\n" "   You may need to restart port forwarding:"
    printf "%b\n" "   1. Run ${GREEN}./stop_port_forward.sh${NC}"
    printf "%b\n" "   2. Run ${GREEN}./port_forward.sh${NC}"
fi

# 显示可用的服务端点
if [ ${#port_status[@]} -gt 0 ]; then
    printf "%b\n" "\n${BLUE}🔗 Available endpoints:${NC}"
    for port in "${port_status[@]}"; do
        case $port in
            3001) printf "%b\n" "  🌐 NextJS App:      http://localhost:3001" ;;
            5001) printf "%b\n" "  🎤 Whisper API:     http://localhost:5001" ;;
            11434) printf "%b\n" "  🤖 Ollama API:      http://localhost:11434" ;;
        esac
    done
fi

printf "%b\n" "\n${BLUE}✅ Status check complete!${NC}"
