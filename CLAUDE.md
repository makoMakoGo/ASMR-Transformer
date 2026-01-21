# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

语音转文字工具 - 一款基于 Next.js 16 的 Web 应用，提供音频文件上传、ASR 语音识别、LLM 文本润色功能。采用暖奶油色极简设计，支持设置持久化。

**Tech Stack**: Next.js 16 (App Router) + TypeScript 5.7 + React 19 + Tailwind CSS 3.4

**External APIs**:
- **SiliconFlow ASR**: 语音转文字（TeleAI/TeleSpeechASR 模型，可在硅基流动中文官网免费申请 Key）
- **LLM 润色服务**: OpenAI 兼容 API（默认 `https://juya.owl.ci/v1` + DeepSeek-V3.1-Terminus 模型，不再内置免费 Key）

## Development Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3045, bind 127.0.0.1)
npm run build        # Production build (also type checks)
npm start            # Start production server (http://localhost:3045, bind 127.0.0.1)
```

## Architecture

### App Structure
```plaintext
app/
├── api/polish/route.ts        # LLM 文本润色（SSE 流式）
├── api/proxy-audio/route.ts   # 流式代理在线音频（返回二进制流，前端显示下载进度）
├── api/check-audio/route.ts   # 检查在线音频元信息（支持 AList 播放页面解析）
├── globals.css            # 暖奶油色设计系统（CSS 变量、动画）
├── layout.tsx             # Root layout with metadata
└── page.tsx               # Main UI (4-Tab 布局：来源/结果/设置/日志)
lib/
├── alist-utils.ts         # AList 站点检测和 URL 解析（共享工具）
└── url-utils.ts           # URL 处理工具函数
```

### Key Components

**app/page.tsx** - Client component with 4-tab layout:
- **来源 Tab**: 本地文件上传 + 在线链接检查 → 统一音频信息卡片 → 开始转录
- **结果 Tab**: 原始文本/润色文本子 Tab，支持一键润色和复制
- **设置 Tab**: ASR 配置、LLM 配置、代理设置
- **日志 Tab**: 实时日志，支持按类型筛选（全部/错误/成功/信息）

**lib/alist-utils.ts** - AList 站点支持:
- 支持的站点: asmrgay.com, asmr.pw, asmr.loan, asmr.party, asmr.stream
- AList 解析后的真实下载域名可能为: asmr.121231234.xyz
- `isAlistPageUrl()` - 检测播放页面 URL（非 /d/ 路径）
- `resolveAlistUrl()` - 调用 AList `/api/fs/get` 获取真实音频 URL

**app/api/check-audio/route.ts** - 检查在线音频:
- 支持 AList 播放页面自动解析（调用 AList API 获取真实 URL）
- HEAD 请求获取 content-length, content-type
- 从 URL 或 content-disposition 提取文件名
- 验证是否为音频文件
- 返回 `resolvedUrl` 字段（如果进行了 AList 解析）

**app/api/proxy-audio/route.ts** - 流式代理在线音频:
- 支持 AList 播放页面自动解析
- 流式返回音频二进制数据（不存磁盘，全程内存）
- 响应头包含 Content-Length（前端可显示下载进度）和 X-File-Name
- 最大文件限制: 100MB（可通过 `FETCH_AUDIO_MAX_BYTES` 环境变量配置）

**app/api/polish/route.ts** - LLM 文本润色:
- Proxies requests to LLM API (OpenAI-compatible chat completion)
- Accepts `customInstructions` for user-side instructions
- Temperature: 0.3 for consistent output

**app/globals.css** - 暖奶油色设计系统:
- CSS variables for warm cream/beige palette (HSL format)
- Light/dark mode support
- Custom animations (fade-in, slide-in, ai-dot-bounce)
- Smooth scrollbar styling

### State Management

Settings are persisted to server `.env` via `GET/PUT /api/settings` (WebUI keeps an editable draft and writes to `.env` only when user clicks Save):
```typescript
type Settings = {
  apiKey: string        // ASR API Key
  apiUrl: string        // ASR API URL
  model: string         // ASR Model
  llmApiUrl: string     // LLM API URL
  llmModel: string      // LLM Model
  llmApiKey: string     // LLM API Key
  customInstructions: string // 自定义润色指令
}
```

Audio info state (unified for local and remote):
```typescript
type AudioInfo = {
  name: string      // 文件名
  size: number      // 字节数
  type: string      // MIME type
  source: 'local' | 'remote'  // 来源
  url?: string      // 远程 URL（仅远程音频）
}
```

### Status Flow

The transcription process has unified status tracking (same for local and remote):
1. `idle` → 准备就绪
2. `processing` → 处理中（本地=上传到 ASR API，远程=服务端拉取音频）
3. `transcribing` → 识别中（ASR 正在处理）
4. `done` → 已完成
5. `error` → 出错了

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
- Warm cream palette via CSS variables (--background, --primary, etc.)
- HSL color format: `hsl(var(--primary))`
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
- **API keys** - 不要在代码里硬编码密钥，使用 `.env` / WebUI 设置写回 `.env`
- **localStorage** - 仅用于 theme 等 UI 偏好；配置以服务器 `.env` 为准
