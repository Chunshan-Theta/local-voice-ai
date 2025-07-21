# Local Voice AI Solution

This project integrates voice interaction components to create a comprehensive local voice AI solution, providing a complete voice conversation experience. The system uses a microservices architecture that combines speech recognition, natural language processing, and voice synthesis technologies to create an intelligent voice assistant that runs in a local environment.

## 📋 Project Overview

This project integrates multiple voice interaction components, including:
- **Speech Recognition Service** - Uses OpenAI Whisper model for speech-to-text conversion
- **Intelligent Conversation Engine** - Provides intelligent responses based on Ollama models
- **Web Frontend Interface** - Next.js application for browser voice interaction
- **Containerized Deployment** - Supports Docker and Kubernetes deployment

## 🏗️ System Architecture

```
                          User Voice Interaction Flow
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    ▼                  ①Record Voice                                   │
┌─────────┐         ┌──────────────┐                                   │
│  User   │────────►│ Web Frontend │                                   │
│(Browser)│         │  (Next.js)   │                                   │
└─────────┘         └──────┬───────┘                                   │
    ▲                      │                                           │
    │                      │②Upload Audio File                         │
    │⑤Play Response         ▼                                           │
    │              ┌──────────────┐   ③Speech-to-Text   ┌─────────────────┐ │
    │              │   API Route  │──────────────►│ Whisper Service │ │
    │              │  (/api/*)    │◄──────────────│   (Flask API)   │ │
    │              └──────┬───────┘   ④Return Text    └─────────────────┘ │
    │                     │                                           │
    │                     │⑤Send Text                                  │
    │                     ▼                                           │
    │              ┌─────────────────┐                                 │
    │              │ Ollama Service  │                                 │
    │              │   (LLaMA3)      │                                 │
    │              └─────────────────┘                                 │
    │                     │                                           │
    └─────────────────────┘⑥Return AI Response                        │
                                                                      │

```
```

                        Kubernetes Cluster Environment                           
    ┌─────────────────────────────────────────────────────────────────┘
    │
    │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  │    Pod      │   │    Pod      │   │    Pod      │
    │  │ ┌─────────┐ │   │ ┌─────────┐ │   │ ┌─────────┐ │
    │  │ │Next.js  │ │   │ │ Whisper │ │   │ │ Ollama  │ │
    │  │ │   App   │ │   │ │ Service │ │   │ │ Service │ │
    │  │ └─────────┘ │   │ └─────────┘ │   │ └─────────┘ │
    │  └─────────────┘   └─────────────┘   └─────────────┘
    │        │                  │                  │
    │        └──────────────────┼──────────────────┘
    │                           │
    │  ┌─────────────────────────┼─────────────────────────┐
    │  │                 Service Network                  │
    │  │          (Load Balancing & Service Discovery)    │
    │  └─────────────────────────────────────────────────┘
    └─────────────────────────────────────────────────────
```

## 🚀 Key Features

- 🎤 **Browser Voice Recording** - Supports real-time voice input and recording
- 🔊 **High-Precision Speech Recognition** - Uses Whisper model for speech-to-text conversion
- 🤖 **Intelligent Conversation Generation** - Natural language processing based on oLLaMA models
- 💬 **Real-time Conversation Interface** - Smooth user interaction experience
- 🐳 **Containerized Deployment** - Supports Docker and Kubernetes environments
- 🔧 **Scalable Architecture** - Microservices design for easy maintenance and expansion

## 🛠️ Technology Stack

### Frontend
- **Next.js** - React framework
- **TypeScript** - Type safety
- **MediaRecorder API** - Browser audio recording

### Backend Services
- **Flask** - Whisper speech recognition service
- **Ollama** - LLaMA3 conversation model service
- **Python** - Backend logic processing

### Deployment & Operations
- **Docker** - Containerization technology
- **Kubernetes** - Container orchestration
- **Google Kubernetes Engine (GKE)** - Cloud deployment

## 🚀 Quick Start

### Kubernetes Deployment

Deploy the complete system on a Kubernetes cluster:

```bash
1. export $(grep -v '^#' ./.env | xargs)
2. ./k8s_ops_script/gcp_deploy_init.sh
3. ./k8s_ops_script/gcp_deploy_build.sh
4. ./k8s_ops_script/gcp_deploy_deploy.sh
```

### Local Development Environment

1. **Start Whisper Service**
```bash
cd whisper-service
pip install -r requirements.txt
python app.py
```

2. **Start Ollama Service**
```bash
# Install and start Ollama
ollama serve
ollama pull llama3
```

3. **Start Frontend Application**
```bash
cd app
npm install
npm run dev
```

## 📁 Project Structure

```
local-voice-ai/
├── app/                    # Next.js frontend application
├── whisper-service/        # Whisper speech recognition service
├── k8s/                   # Kubernetes deployment configuration
├── k8s_ops_script/        # Operations scripts
└── README.md              # Project documentation
```

## 🔧 Configuration

### Environment Variables
- `WHISPER_MODEL`: Whisper model version (tiny/base/small/medium/large)
- `OLLAMA_HOST`: Ollama service address
- `PORT`: Service port number

### Kubernetes Resources
- **Deployments**: Application service deployment
- **Services**: Service exposure and load balancing
- **ConfigMaps**: Configuration management
- **PersistentVolumes**: Data persistence

## 🌟 Key Advantages

1. **Fully Local** - No dependence on external APIs, ensuring data privacy
2. **Highly Integrated** - Seamless integration of voice interaction components
3. **Containerized Deployment** - Easy to deploy and scale
4. **Microservices Architecture** - Modular design for easy maintenance
5. **Multi-Environment Support** - Supports both local development and production deployment

## 📝 License

This project is licensed under the MIT License.

