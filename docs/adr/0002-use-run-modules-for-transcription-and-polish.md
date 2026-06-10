# 0002: 使用运行 Module 收拢转录与润色流程

## Status

Accepted

## Context

页面 hook 曾经同时承担 UI 状态、请求构造、进度映射、错误处理和日志输出。随着本地音频、远程音频、ASR 等待、取消、LLM 流式润色等逻辑增多，hook 和组件会越来越难测试。

架构评审中将这些流程称为“转录运行”和“润色运行”，它们是比单个 hook 更稳定的领域边界。

## Decision

转录流程集中到 `lib/transcription-run.ts`。本地音频和远程音频都调用 `runTranscription()`，共享结果、进度、日志、错误和取消语义。

浏览器端远程音频下载集中到 `lib/browser-remote-audio.ts`，服务端远程音频检查和代理集中到 `lib/remote-audio.ts`。

润色流程集中到 `lib/polish-run.ts`。页面 hook 调用 `runPolishText()`，并通过回调接收内容、warning 和日志。

页面组件使用显式、收窄后的 props，不直接依赖 hook 的完整返回类型。

## Consequences

hook 更偏向 UI 编排，运行 Module 承担可测试的业务流程。

转录和润色的边界更容易被单元测试覆盖。

新增运行状态或日志时，应优先更新对应运行 Module 的 contract，再让 hook 适配 UI。
