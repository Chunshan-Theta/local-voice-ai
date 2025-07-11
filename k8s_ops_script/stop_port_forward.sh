#!/bin/bash

# Stop port forwarding script for local-voice-ai services

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

printf "%b\n" "${BLUE}🛑 Stopping port forwarding for local-voice-ai services...${NC}"

# 方法1: 通过PID文件停止
printf "%b\n" "${YELLOW}🔍 Checking for PID files...${NC}"
stopped_count=0

if [ -f /tmp/nextjs_port_forward.pid ]; then
    NEXTJS_PID=$(cat /tmp/nextjs_port_forward.pid)
    if kill -0 $NEXTJS_PID 2>/dev/null; then
        kill $NEXTJS_PID 2>/dev/null
        printf "%b\n" "${GREEN}✅ Stopped NextJS App port forward (PID: $NEXTJS_PID)${NC}"
        ((stopped_count++))
    fi
    rm -f /tmp/nextjs_port_forward.pid
fi

if [ -f /tmp/whisper_port_forward.pid ]; then
    WHISPER_PID=$(cat /tmp/whisper_port_forward.pid)
    if kill -0 $WHISPER_PID 2>/dev/null; then
        kill $WHISPER_PID 2>/dev/null
        printf "%b\n" "${GREEN}✅ Stopped Whisper Service port forward (PID: $WHISPER_PID)${NC}"
        ((stopped_count++))
    fi
    rm -f /tmp/whisper_port_forward.pid
fi

if [ -f /tmp/ollama_port_forward.pid ]; then
    OLLAMA_PID=$(cat /tmp/ollama_port_forward.pid)
    if kill -0 $OLLAMA_PID 2>/dev/null; then
        kill $OLLAMA_PID 2>/dev/null
        printf "%b\n" "${GREEN}✅ Stopped Ollama Service port forward (PID: $OLLAMA_PID)${NC}"
        ((stopped_count++))
    fi
    rm -f /tmp/ollama_port_forward.pid
fi

# 方法2: 通过进程名称停止（备用方法）
printf "%b\n" "${YELLOW}🧹 Cleaning up any remaining port forward processes...${NC}"
killed_processes=0

# 查找并杀死 kubectl port-forward 进程
pids=$(pgrep -f "port-forward.*nextjs-app" 2>/dev/null)
if [ -n "$pids" ]; then
    echo $pids | xargs kill 2>/dev/null
    printf "%b\n" "${GREEN}✅ Killed remaining NextJS App port forward processes${NC}"
    ((killed_processes++))
fi

pids=$(pgrep -f "port-forward.*whisper-service" 2>/dev/null)
if [ -n "$pids" ]; then
    echo $pids | xargs kill 2>/dev/null
    printf "%b\n" "${GREEN}✅ Killed remaining Whisper Service port forward processes${NC}"
    ((killed_processes++))
fi

pids=$(pgrep -f "port-forward.*ollama-service" 2>/dev/null)
if [ -n "$pids" ]; then
    echo $pids | xargs kill 2>/dev/null
    printf "%b\n" "${GREEN}✅ Killed remaining Ollama Service port forward processes${NC}"
    ((killed_processes++))
fi

# 等待进程完全停止
sleep 2

# 检查端口是否已释放
printf "%b\n" "${BLUE}🔍 Checking if ports are released...${NC}"
ports_released=0

if ! nc -z localhost 3001 2>/dev/null; then
    printf "%b\n" "${GREEN}✅ Port 3000 (NextJS App) is released${NC}"
    ((ports_released++))
else
    printf "%b\n" "${YELLOW}⚠️ Port 3000 may still be in use${NC}"
fi

if ! nc -z localhost 5001 2>/dev/null; then
    printf "%b\n" "${GREEN}✅ Port 5001 (Whisper Service) is released${NC}"
    ((ports_released++))
else
    printf "%b\n" "${YELLOW}⚠️ Port 5001 may still be in use${NC}"
fi

if ! nc -z localhost 11434 2>/dev/null; then
    printf "%b\n" "${GREEN}✅ Port 11434 (Ollama Service) is released${NC}"
    ((ports_released++))
else
    printf "%b\n" "${YELLOW}⚠️ Port 11434 may still be in use${NC}"
fi

# 显示结果
printf "%b\n" "\n${BLUE}📊 Summary:${NC}"
printf "%b\n" "  Stopped by PID: $stopped_count"
printf "%b\n" "  Killed by name: $killed_processes"
printf "%b\n" "  Ports released: $ports_released/3"

if [ $ports_released -eq 3 ]; then
    printf "%b\n" "\n${GREEN}🎉 All port forwards have been successfully stopped!${NC}"
else
    printf "%b\n" "\n${YELLOW}⚠️ Some ports may still be in use. Check manually if needed:${NC}"
    printf "%b\n" "  Check port 3000: ${GREEN}lsof -i :3000${NC}"
    printf "%b\n" "  Check port 5001: ${GREEN}lsof -i :5001${NC}"
    printf "%b\n" "  Check port 11434: ${GREEN}lsof -i :11434${NC}"
fi

printf "%b\n" "\n${BLUE}✅ Port forwarding cleanup complete!${NC}"
