# Project Overview

## Purpose
语音转文字工具 - 基于 Next.js 15 的 Web 应用，提供音频文件上传/实时录音、ASR 语音识别、LLM 文本润色功能。

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.7
- **UI**: React 19 + Tailwind CSS 3.4
- **Runtime**: Node.js 20
- **Deployment**: Docker (multi-stage build with standalone output)

## External APIs
- SiliconFlow API: 语音转文字 (TeleAI/TeleSpeechASR model)
- LLM API: 文本润色和排版 (可配置的 OpenAI-compatible API)
