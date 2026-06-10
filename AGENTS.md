# AGENTS.md

This file provides coding guidance for AI agents working in this repository.

## Project Overview

ASMR Transformer 是一个基于 Next.js 16 的语音转文字与文本润色 Web 应用。用户可以上传本地音频，或输入受支持的在线音频链接；应用先调用 ASR 生成原始文本，再可选调用 OpenAI 兼容 LLM 进行润色。

Tech stack: Next.js 16 App Router, React 19, TypeScript 5.7, Tailwind CSS 3.4, Vitest.

External APIs:
- SiliconFlow ASR: 默认 `TeleAI/TeleSpeechASR`
- OpenAI-compatible LLM: 默认 `https://juya.owl.ci/v1` + `DeepSeek-V3.1-Terminus`

## Development Commands

```bash
npm install
npm run dev
npm test
npm run build
npm start
```

`npm run dev` and `npm start` bind to `127.0.0.1:3045`.

## Architecture

### App Structure

```plaintext
app/
├── api/check-audio/route.ts    # 远程音频元信息检查，不向前端暴露 resolved URL
├── api/polish/route.ts         # LLM 润色，SSE 流式响应
├── api/proxy-audio/route.ts    # 服务端远程音频代理，支持断开中止
├── api/runtime-config/route.ts # 浏览器运行时配置
├── api/settings/route.ts       # WebUI 设置读写
├── globals.css                 # 清新蓝调设计系统
├── layout.tsx
└── page.tsx                    # 5-tab 主界面

components/
├── SourceTab.tsx
├── TranscriptionTab.tsx
├── PolishTab.tsx
├── SettingsTab.tsx
└── LogsTab.tsx

hooks/
├── use-transcription-flow.ts   # 页面转录流程协调
├── use-polish-flow.ts          # 页面润色流程协调
├── use-settings-state.ts
├── use-activity-log.ts
└── use-theme-preference.ts

lib/
├── app-settings.ts             # Settings、ASR/LLM 运行设置切片与默认值
├── asr-transcription.ts        # ASR HTTP 请求与上传/等待进度
├── browser-remote-audio.ts     # 浏览器端远程音频获取为 File
├── polish-run.ts               # 润色运行 Module
├── polish-stream.ts            # LLM SSE 流消费与解析
├── remote-audio-policy.ts      # 远程音频来源策略
├── remote-audio.ts             # 服务端远程音频解析/检查/代理
├── runtime-config.ts           # FETCH_AUDIO_MAX_BYTES
├── settings-persistence.ts     # .env 设置持久化
├── transcription-run.ts        # 本地/远程统一转录运行 Module
└── url-utils.ts                # URL 基础校验与 MIME 映射 facade
```

### Domain Modules

**远程音频来源策略**集中在 `lib/remote-audio-policy.ts`。AList 播放页域名、真实下载域名、允许的音频扩展名和 MIME 映射应在这里维护。

**远程音频服务端处理**集中在 `lib/remote-audio.ts`。它负责 AList 播放页解析、真实音频链接校验、HEAD 元信息检查、代理下载、大小限制和请求中止。

**浏览器端远程音频获取**集中在 `lib/browser-remote-audio.ts`。它通过 `/api/proxy-audio` 获取远程音频，产出 ASR 可消费的 `File`，并发出下载进度事件。

**转录运行**集中在 `lib/transcription-run.ts`。本地音频和远程音频都通过 `runTranscription()`，共享上传/下载进度、ASR 等待、成功、空结果、错误和取消语义。

**润色运行**集中在 `lib/polish-run.ts`。页面 hook 不直接拼润色请求细节，而是调用 `runPolishText()` 并接收内容、warning 和日志回调。

**运行设置切片**在 `lib/app-settings.ts`。ASR 运行只依赖 `AsrRunSettings`，LLM 润色只依赖 `LlmRunSettings`。

### AList And Remote URL Privacy

`/api/check-audio` 只返回展示所需的 `name`、`size`、`type`。即使服务端解析了 AList 播放页，也不返回真实下载链接。

前端状态里的远程音频 URL 应保持为用户输入的原始 URL。真实下载 URL 只在服务端远程音频 Module 内部流转。

### UI Flow

主界面是 5-tab 布局：
- 来源：本地文件选择 / 在线链接检查 / 开始转录
- 转录结果：原始文本展示和润色入口
- 润色输出：SSE 润色结果和复制
- 设置：ASR 与 LLM 设置
- 日志：运行日志筛选

`SourceTab`、`TranscriptionTab`、`PolishTab` 使用显式、收窄后的 props。不要让组件直接依赖 hook 的完整返回类型。

## State And Persistence

Settings are persisted to a server-side `.env` file through `GET /api/settings` and `PUT /api/settings`. The WebUI keeps an editable draft and writes only when the user clicks Save.

```typescript
type Settings = {
  apiKey: string
  apiUrl: string
  model: string
  llmApiUrl: string
  llmModel: string
  llmApiKey: string
  customInstructions: string
}
```

Audio info state:

```typescript
type AudioInfo = {
  name: string
  size: number
  type: string
  source: 'local' | 'remote'
  url?: string
}
```

The remote `url` is the original user-facing URL, not an AList resolved URL.

## Code Style

- TypeScript strict mode is enabled.
- Use `type` for object shapes.
- Use explicit function parameter and return types in shared modules.
- Components use PascalCase.
- Variables and functions use camelCase.
- Shared immutable configuration constants use UPPER_SNAKE_CASE when that matches nearby code.
- Routes and utility files use kebab-case.
- Prefer small domain modules over large hooks/components.
- Do not add silent fallbacks. Let invalid runtime configuration fail with explicit errors.

## Git Commit Message Format

Commit subjects must use this format and should use concise Chinese descriptions:

```plaintext
<emoji> <type>: <subject>
```

Allowed types:
- 🎉 init: 初始化
- ✨ feat: 添加新功能
- 🐛 fix: 修复 bug
- 📝 docs: 文档修改
- 🎨 style: 代码风格修改
- 💄 ui: UI/UX 修改
- ♻️ refactor: 代码重构
- ⚡️ perf: 性能优化
- 🧑‍💻 dx: 开发体验
- 🔁 workflow: 工作流变动
- 🏷️ types: 类型声明修改
- 🚧 wip: 工作进行中
- ✅ test: 测试用例
- 🔨 build: 构建相关
- 👷 ci: CI 配置
- ❓ chore: 其它修改
- ⬆️ deps: 依赖项修改
- 🚀 release: 发布版本

Example: `♻️ refactor: 统一本地与远程转录运行流程`

## Important Notes

- No linting tool is configured; follow existing formatting manually.
- Do not hardcode API keys. Use `.env` or the WebUI settings flow.
- `FETCH_AUDIO_MAX_BYTES` controls the remote audio size limit in bytes.
- `next-env.d.ts` is managed by Next.js and should not be edited manually.
- See `CONTEXT.md` for domain vocabulary and `docs/adr/` for recorded architecture decisions.
