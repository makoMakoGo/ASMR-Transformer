# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

语音转文字工具 - 一款基于 Next.js 16 的 Web 应用，提供音频文件上传、ASR 语音识别、LLM 文本润色功能。采用 Apple 风格设计，支持设置持久化。

**Tech Stack**: Next.js 16 (App Router) + TypeScript 5.7 + React 19 + Tailwind CSS 3.4

**External APIs**:
- **SiliconFlow ASR**: 语音转文字（TeleAI/TeleSpeechASR 模型，可在硅基流动中文官网免费申请 Key）
- **内置润色服务**: DeepSeek-V3.1-Terminus 模型，API `https://juya.owl.ci/v1`，仓库默认提供免费不限量 Key

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
├── api/polish/route.ts    # LLM 文本润色 API endpoint（支持自定义 system/user prompt）
├── globals.css            # Apple 风格设计系统（CSS 变量、动画、毛玻璃效果）
├── layout.tsx             # Root layout with metadata
└── page.tsx               # Main UI (完整的音频转录工作流)
```

### Key Components

**app/page.tsx** - Client component with complete audio transcription workflow:
- File upload via `<input type="file">` and microphone recording via MediaRecorder API
- XMLHttpRequest for upload progress tracking with granular status updates
- ASR transcription via SiliconFlow API
- LLM-based text polishing via `/api/polish` with customizable prompts
- Real-time logging system with timestamps and color-coded messages
- Settings persistence via localStorage
- Copy to clipboard functionality

**app/api/polish/route.ts** - Server-side API route:
- Proxies requests to LLM API (OpenAI-compatible chat completion)
- Accepts custom `systemPrompt` and `userPrompt` parameters
- Default system prompt: 纠错、标点、分段排版，保持原意
- Temperature: 0.3 for consistent output

**app/globals.css** - Apple Design System:
- CSS variables for Apple color palette
- Glass morphism effects (backdrop-filter blur)
- Custom animations (fade-in, slide-in, pulse-ring, progress-shine)
- Card hover effects and button press states

### State Management

Settings are persisted to localStorage under key `voice-to-text-settings`:
```typescript
type Settings = {
  apiKey: string        // ASR API Key
  apiUrl: string        // ASR API URL
  model: string         // ASR Model
  llmApiUrl: string     // LLM API URL
  llmModel: string      // LLM Model
  llmApiKey: string     // LLM API Key
  systemPrompt: string  // Custom system prompt
  userPrompt: string    // Custom user prompt (use {text} placeholder)
}
```

### Status Flow

The transcription process has granular status tracking:
1. `idle` → 准备就绪
2. `uploading` → 上传中（显示进度百分比）
3. `uploaded` → 已上传（等待服务器响应）
4. `transcribing` → 识别中（服务器处理）
5. `done` → 已完成
6. `error` → 出错了

## Code Style

### TypeScript
- Strict mode enabled
- Explicit type annotations for function parameters and returns
- Use `type` for object shapes (e.g., `type LogEntry = { ... }`)

### React/Next.js Patterns
- Use `'use client'` directive for client components
- Server components by default (no directive needed)
- API routes: named exports (GET, POST, etc.) with `NextRequest`/`NextResponse`
- useEffect for localStorage operations (SSR safety)

### Naming Conventions
- Components: PascalCase
- Variables/functions: camelCase
- Types: PascalCase
- Files: kebab-case for routes, PascalCase for components

### Styling
- Tailwind CSS utility classes only
- Apple color palette via CSS variables (--apple-blue, --apple-green, etc.)
- No CSS modules or styled-components

## Git Commit Message Format

**MUST follow the format defined in `.gitmessage`:**

```
<emoji> <type>: <subject>
```

Available types:
- 🎉 init: 初始化
- ✨ feat: 添加新功能
- 🐛 fix: 修复 bug
- 📝 docs: 文档修改
- 🎨 style: 代码风格修改
- ♻️ refactor: 代码重构
- ⚡ perf: 性能优化
- ✅ test: 测试用例
- 🔨 build: 构建相关
- 👷 ci: CI 配置
- ❓ chore: 其它修改
- ⬆️ deps: 依赖项修改

Example: `✨ feat: 添加SSE流式润色功能`

## Important Notes

- **No linting/formatting tools configured** - follow existing code style manually
- **Windows environment** - use appropriate commands (dir, type, etc.)
- **API keys in code** - The codebase contains hardcoded fallback API key for demo purposes; avoid committing new secrets
- **Standalone build** - Next.js configured for Docker deployment with standalone output
- **localStorage** - Settings persist in browser, works identically in npm dev and Docker
