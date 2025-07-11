#!/bin/bash

# GPU 版本 TTS API 部署腳本

set -e

echo "🎙️  TTS API 部署腳本（GPU 版本）"
echo "================================"

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 函數：打印狀態
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 檢查 Docker 和 NVIDIA 是否安裝
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安裝，請先安裝 Docker"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose 未安裝，請先安裝 Docker Compose"
        exit 1
    fi
    
    # 檢查 NVIDIA Docker 支援
    if ! docker info | grep -q "nvidia"; then
        print_warning "NVIDIA Docker 運行時未檢測到"
        print_warning "請確保已安裝 NVIDIA Container Toolkit"
    fi
    
    # 檢查 nvidia-smi 是否可用
    if ! command -v nvidia-smi &> /dev/null; then
        print_error "nvidia-smi 未安裝，請先安裝 NVIDIA 驅動"
        exit 1
    fi
    
    print_status "Docker、Docker Compose 和 NVIDIA 工具已安裝"
    
    # 顯示 GPU 信息
    print_status "GPU 信息："
    nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader,nounits
}

# 創建必要目錄
create_directories() {
    print_status "創建必要目錄..."
    mkdir -p hf_cache
    mkdir -p test_outputs
}

# 構建 Docker 映像
build_image() {
    print_status "構建 Docker 映像..."
    docker build -t tts-api:latest .
    print_status "Docker 映像構建完成"
}

# 停止現有服務
stop_services() {
    print_status "停止現有服務..."
    docker compose down || true
}

# 啟動服務
start_services() {
    print_status "啟動服務..."
    docker compose up -d --build
    
    # 等待服務啟動
    print_status "等待服務啟動..."
    sleep 30
    
    # 檢查服務狀態
    if docker compose ps | grep -q "Up"; then
        print_status "服務啟動成功！"
    else
        print_error "服務啟動失敗"
        docker compose logs
        exit 1
    fi
}

# 測試服務
test_service() {
    print_status "測試服務..."
    
    # 測試 GPU 狀態端點
    if curl -s -f http://localhost:8000/v1/gpu-status > /dev/null; then
        print_status "✅ GPU 狀態端點正常"
        # 顯示 GPU 狀態
        curl -s http://localhost:8000/v1/gpu-status | python3 -m json.tool
    else
        print_error "❌ GPU 狀態端點異常"
        return 1
    fi
    
    # 測試 models 端點
    if curl -s -f http://localhost:8000/v1/models > /dev/null; then
        print_status "✅ /v1/models 端點正常"
    else
        print_error "❌ /v1/models 端點異常"
        return 1
    fi
    
    # 測試 TTS 端點
    curl -X POST "http://localhost:8000/v1/audio/speech" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "suno/bark",
            "input": "GPU 版本測試中文語音合成",
            "response_format": "wav",
            "speed": 1.0
        }' \
        --output test_outputs/deployment_test.wav
    
    if [ -f "test_outputs/deployment_test.wav" ] && [ -s "test_outputs/deployment_test.wav" ]; then
        print_status "✅ TTS 端點正常，測試音頻已保存"
    else
        print_error "❌ TTS 端點異常"
        return 1
    fi
}

# 顯示服務信息
show_info() {
    echo ""
    echo "🎉 部署完成！"
    echo "================================"
    echo "🌐 API 端點："
    echo "  - GPU 狀態: http://localhost:8000/v1/gpu-status"
    echo "  - Models: http://localhost:8000/v1/models"
    echo "  - TTS: http://localhost:8000/v1/audio/speech"
    echo ""
    echo "📊 服務狀態："
    docker compose ps
    echo ""
    echo "🖥️ GPU 信息："
    nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits
    echo ""
    echo "📋 管理命令："
    echo "  - 查看日誌: docker-compose logs -f"
    echo "  - 重啟服務: docker-compose restart"
    echo "  - 停止服務: docker-compose down"
    echo ""
    echo "🧪 測試命令："
    echo "  python test_gpu_usage.py"
}

# 主函數
main() {
    case "${1:-deploy}" in
        "build")
            check_docker
            create_directories
            build_image
            ;;
        "start")
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "test")
            test_service
            ;;
        "deploy")
            check_docker
            create_directories
            build_image
            stop_services
            start_services
            test_service
            show_info
            ;;
        "clean")
            print_status "清理資源..."
            docker compose down -v
            docker rmi tts-api:latest || true
            print_status "資源清理完成"
            ;;
        *)
            echo "用法: $0 {build|start|stop|test|deploy|clean}"
            echo ""
            echo "命令說明："
            echo "  build   - 只構建 Docker 映像"
            echo "  start   - 啟動服務"
            echo "  stop    - 停止服務"
            echo "  test    - 測試服務"
            echo "  deploy  - 完整部署（默認）"
            echo "  clean   - 清理資源"
            exit 1
            ;;
    esac
}

# 執行主函數
main "$@"
