# API 文档 - 语音转文字服务

## 概述

本服务提供音频转文字 API，支持语音识别（ASR）和文本润色（LLM）功能。适合 AI Agent 或自动化脚本调用。

**Base URL:** `http://localhost:3000` (默认端口)

**自定义端口启动：**
```bash
npm run dev -- -p 3092    # 使用端口 3092
npm run dev -- -p 8080    # 使用端口 8080
```

---

## 服务器配置

API 支持通过服务器环境变量预配置，这样调用时无需传递敏感信息。

### 环境变量 (.env)

```bash
# 复制模板
cp .env.example .env

# 编辑 .env 填入你的 API Key
ASR_API_KEY=sk-your-siliconflow-api-key
```

配置后，API 调用时无需传递 `asrApiKey` 参数，服务器会自动使用环境变量中的值。

### 支持的环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ASR_API_KEY` | 硅基流动 ASR API Key | 无（必填） |
| `ASR_API_URL` | ASR API 地址 | `https://api.siliconflow.cn/v1/audio/transcriptions` |
| `ASR_MODEL` | ASR 模型 | `TeleAI/TeleSpeechASR` |
| `LLM_API_KEY` | LLM API Key | 内置免费 Key |
| `LLM_API_URL` | LLM API 地址 | `https://juya.owl.ci/v1` |
| `LLM_MODEL` | LLM 模型 | `DeepSeek-V3.1-Terminus` |

---

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/transcribe` | 一站式音频转文字（支持润色） |
| GET | `/api/transcribe` | 获取 API 信息 |
| POST | `/api/polish` | 文本润色（SSE 流式） |
| GET | `/api/docs` | 获取 API 文档（Markdown/JSON） |

---

## POST /api/transcribe

一站式音频转文字接口，支持 ASR 语音识别和可选的 LLM 文本润色。

### 请求格式

`Content-Type: multipart/form-data`

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | ✅ | 音频文件 (mp3, wav, webm 等) |
| `asrApiKey` | string | ❌* | ASR API Key（服务器已配置则可省略） |
| `asrApiUrl` | string | ❌ | ASR API 地址 |
| `asrModel` | string | ❌ | ASR 模型 |
| `polish` | string | ❌ | `"true"` 启用文本润色 |
| `llmApiKey` | string | ❌ | LLM API Key |
| `llmApiUrl` | string | ❌ | LLM API 地址 |
| `llmModel` | string | ❌ | LLM 模型名称 |
| `customInstructions` | string | ❌ | 自定义润色指令（如翻译、摘要等） |

> *如果服务器已配置 `ASR_API_KEY` 环境变量，则 `asrApiKey` 参数可省略。

### 响应示例

```json
{
  "success": true,
  "transcription": "各位观众早上好，今天是11月16日星期日，欢迎收看AI早报...",
  "polished": "各位观众早上好，今天是11月16日星期日，欢迎收看AI早报。\n\nOpenRouter发布两款测试模型SlockThink。",
  "metadata": {
    "processingTime": 5918,
    "fileName": "audio.mp3",
    "fileSize": 102400
  }
}
```

---

## GET /api/transcribe

获取 API 基本信息。

### 响应示例

```json
{
  "name": "Transcribe API",
  "version": "1.0.0",
  "description": "音频转文字一站式 API，支持 ASR 语音识别和 LLM 文本润色",
  "endpoints": {
    "POST /api/transcribe": "上传音频文件进行转录和润色",
    "POST /api/polish": "对文本进行润色处理"
  },
  "documentation": "/docs"
}
```

---

## POST /api/polish

文本润色接口，返回 SSE 流式响应。

### 请求格式

`Content-Type: application/json`

### 请求参数

```json
{
  "text": "需要润色的文本",
  "apiUrl": "https://juya.owl.ci/v1",
  "apiKey": "your-api-key",
  "model": "DeepSeek-V3.1-Terminus",
  "customInstructions": "自定义润色指令（可选）"
}
```

---

## GET /api/docs

获取 API 文档。

| 参数 | 说明 |
|------|------|
| `format=json` | 返回 JSON 格式 |
| 无参数 | 返回 Markdown 格式 |

---

## 使用示例

### AI Agent 推荐用法（服务器已配置 API Key）

```bash
# 基础转录（无需传递 API Key）
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@audio.mp3"

# 转录 + 润色
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@audio.mp3" \
  -F "polish=true"

# 转录 + 翻译成英文
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@audio.mp3" \
  -F "polish=true" \
  -F "customInstructions=请将文本翻译成英文"
```

### 手动传递 API Key（服务器未配置时）

```bash
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@audio.mp3" \
  -F "asrApiKey=sk-your-key" \
  -F "polish=true"
```

### Python

```python
import requests

# 服务器已配置 API Key，无需传递
response = requests.post(
    "http://localhost:3000/api/transcribe",
    files={"file": open("audio.mp3", "rb")},
    data={"polish": "true"}
)

result = response.json()
print("原文:", result["transcription"])
print("润色:", result["polished"])
```

### JavaScript / Node.js

```javascript
const formData = new FormData();
formData.append("file", audioFile);
formData.append("polish", "true");

const response = await fetch("http://localhost:3000/api/transcribe", {
  method: "POST",
  body: formData
});

const result = await response.json();
console.log("原文:", result.transcription);
console.log("润色:", result.polished);
```

---

## AI Agent 使用指南

### 配置步骤

1. **配置服务器环境变量：**
   ```bash
   cp .env.example .env
   # 编辑 .env，填入 ASR_API_KEY
   ```

2. **启动服务：**
   ```bash
   npm run dev
   # 或指定端口
   npm run dev -- -p 3092
   ```

3. **调用 API（无需传递 API Key）：**
   ```bash
   curl -X POST http://localhost:3000/api/transcribe \
     -F "file=@audio.mp3" \
     -F "polish=true"
   ```

### 安全提示

> ⚠️ **重要：** AI Agent 调用时不应在命令中明文传递 API Key。请确保服务器已配置 `.env` 文件，这样 API 会自动使用环境变量中的密钥。

### 实际输出示例

**原始转录：**
```
🎼各位观众早上好，今天是11月16日星期日，欢迎收看AI早报。以上是今天的主要内容，接下来请看详细报道。open router发布两款测试模型slockthink。😊
```

**润色后：**
```
🎼各位观众早上好，今天是11月16日星期日，欢迎收看AI早报。以上是今天的主要内容，接下来请看详细报道。

OpenRouter发布两款测试模型SlockThink。😊
```

---

## 获取 API Key

- **ASR API Key:** 在 [硅基流动](https://siliconflow.cn) 免费申请
- **LLM API Key:** 可选，留空使用内置免费服务
