# 流式 TTS (Text-to-Speech) 系统使用说明

## 概述

这个系统实现了流式 TTS 功能，能够在部分音频数据可用时就开始播放，大大减少了用户等待时间。

## 系统架构

### 1. API 层面
- `/api/speech-stream.ts` - 新的流式 TTS API 端点
- `/api/speech.ts` - 原有的完整 TTS API 端点（向后兼容）

### 2. 客户端层面
- `lib/ttsManager.ts` - 升级的 TTS 管理器，支持流式播放

## 工作流程

### 流式播放流程：

1. **发起请求**: 前端调用 `/api/speech-stream` 端点
2. **服务端处理**: 
   - 接收 TTS 服务的流式响应
   - 实时转发音频数据块到前端
3. **客户端播放**:
   - 接收音频数据流
   - 当收到足够数据（≥8KB）时立即开始播放
   - 继续接收剩余数据以确保完整播放

### 关键特性：

- **快速响应**: 收到初始音频数据后立即开始播放
- **无缝体验**: 后台继续接收数据确保播放不中断
- **向后兼容**: 自动检测是否支持流式，不支持时回退到完整播放
- **错误处理**: 完整的错误处理和重试机制

## 使用方法

### 在 React 组件中使用：

```typescript
// 在 pages/class/index.tsx 中已经集成
// TTS 管理器会自动选择最佳播放方式

// 调用 TTS
if (ttsManagerRef.current) {
  await ttsManagerRef.current.speak(responseText, messageId);
}
```

### 配置选项：

```typescript
const ttsConfig = {
  enabled: true,     // 启用 TTS
  voice: null,       // 使用默认语音
  rate: 1.5,         // 播放速度
  volume: 0.8,       // 音量
  pitch: 1.0         // 音调
};
```

## 技术实现

### 流式传输：
- 使用 Transfer-Encoding: chunked
- ReadableStream API 处理数据流
- HTML Audio 元素进行播放

### 音频格式：
- 支持 WAV 格式
- 自动处理音频头部信息
- 优化的缓冲区管理

### 性能优化：
- 最小 8KB 缓冲区确保快速开始
- 智能错误处理和回退机制
- 内存高效的流处理

## 环境变量

在 `.env.local` 中配置：

```env
TTS_SERVICE_URL=http://localhost:8000
TTS_API_KEY=your_api_key_here
```

## 监控和调试

系统提供详细的日志输出：

- 🌊 流式传输状态
- 🎵 音频播放状态
- 📊 数据传输统计
- ❌ 错误信息和诊断

## 浏览器兼容性

- 现代浏览器（Chrome, Firefox, Safari, Edge）
- 需要支持 ReadableStream API
- 需要 HTML5 Audio 支持

## 故障排除

### 常见问题：

1. **播放延迟**: 检查网络连接和 TTS 服务响应时间
2. **音频中断**: 确保浏览器支持所需的音频格式
3. **无声音**: 检查浏览器音频权限和音量设置

### 调试步骤：

1. 打开浏览器开发者工具
2. 查看控制台日志中的 TTS 相关信息
3. 检查网络面板中的 API 请求状态
4. 验证音频文件是否正确下载

## 性能指标

期望的性能改进：
- **响应时间**: 减少 60-80% 的等待时间
- **用户体验**: 更自然的对话流程
- **资源使用**: 高效的内存和网络使用
