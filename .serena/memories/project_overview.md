# Project Overview

## Purpose
语音转文字工具 - 基于 Next.js 16 的 Web 应用，提供音频文件上传、在线链接导入、ASR 语音识别、LLM 文本润色功能（设置从服务器 `.env` 读取，WebUI 修改需点击保存写回）。

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.7
- **UI**: React 19 + Tailwind CSS 3.4
- **Runtime**: Node.js (recommend LTS)
- **Deployment**: Local Node.js (npm run dev / npm start)

## External APIs
- SiliconFlow API: 语音转文字 (TeleAI/TeleSpeechASR model)
- LLM API: 文本润色和排版 (可配置的 OpenAI-compatible API)
