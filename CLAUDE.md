# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

语音转文字工具 - 基于 Next.js 15 的 Web 应用，提供音频文件上传/实时录音、ASR 语音识别、LLM 文本润色功能。

**Tech Stack**: Next.js 15 (App Router) + TypeScript 5.7 + React 19 + Tailwind CSS 3.4

**External APIs**:
- SiliconFlow API: 语音转文字（TeleAI/TeleSpeechASR 模型，可在硅基流动中文官网免费申请 Key）
- 内置免费润色服务：DeepSeek-V3.1-Terminus 模型，API `https://juya.owl.ci/v1`，仓库默认提供免费不限量 Key（可被用户自定义覆盖）

## Development Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (also type checks)
npm start            # Start production server

# Docker Deployment
docker compose up -d --build    # Build and run in detached mode
```

## Architecture

### App Structure
```
app/
├── api/polish/route.ts    # LLM 文本润色 API endpoint
├── layout.tsx             # Root layout with metadata
└── page.tsx               # Main UI (audio transcription workflow)
```

### Key Components

**app/page.tsx** - Client component with complete audio transcription workflow:
- File upload via `<input type="file">` and microphone recording via MediaRecorder API
- XMLHttpRequest for upload progress tracking
- ASR transcription via SiliconFlow API
- LLM-based text polishing via `/api/polish`
- Real-time logging system with timestamps and color-coded messages
- Copy to clipboard functionality

**app/api/polish/route.ts** - Server-side API route:
- Proxies requests to LLM API (OpenAI-compatible chat completion)
- System prompt: 纠错、标点、分段排版，保持原意
- Temperature: 0.3 for consistent output

### Configuration
- `next.config.ts`: `output: 'standalone'` for Docker deployment
- `tsconfig.json`: strict mode, ES2017 target, path alias `@/*`
- `Dockerfile`: Multi-stage build (deps → builder → runner)

## Code Style

### TypeScript
- Strict mode enabled
- Explicit type annotations for function parameters and returns
- Use `type` for object shapes (e.g., `type LogEntry = { ... }`)

### React/Next.js Patterns
- Use `'use client'` directive for client components
- Server components by default (no directive needed)
- API routes: named exports (GET, POST, etc.) with `NextRequest`/`NextResponse`

### Naming Conventions
- Components: PascalCase
- Variables/functions: camelCase
- Types: PascalCase
- Files: kebab-case for routes, PascalCase for components

### Styling
- Tailwind CSS utility classes only
- No CSS modules or styled-components

## Important Notes

- **No linting/formatting tools configured** - follow existing code style manually
- **Windows environment** - use appropriate commands (dir, type, etc.)
- **API keys in code** - The codebase contains hardcoded API keys in `app/page.tsx:17` for demo purposes; avoid committing new secrets
- **Standalone build** - Next.js configured for Docker deployment with standalone output
