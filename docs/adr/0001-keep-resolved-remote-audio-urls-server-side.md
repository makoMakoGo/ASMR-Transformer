# 0001: AList 解析后的真实音频链接只在服务端流转

## Status

Accepted

## Context

在线音频可以是用户直接提供的真实音频链接，也可以是 AList 播放页。AList 播放页需要服务端调用 `/api/fs/get` 解析出真实音频链接。

真实音频链接属于下载细节，不适合作为前端状态或 API 响应的一部分暴露出去。前端只需要展示文件名、大小、MIME 类型，并在用户开始转录时继续使用原始输入 URL。

## Decision

`/api/check-audio` 不返回 resolved URL，只返回展示所需的 `name`、`size`、`type`。

前端远程音频状态保留用户输入的原始 URL。

AList 解析、真实下载链接校验、HEAD 检查和代理下载都留在服务端远程音频 Module 内部。

## Consequences

前端不会知道 AList 解析后的真实下载 URL。

远程音频策略和解析细节集中在 `lib/remote-audio-policy.ts`、`lib/remote-audio.ts` 和相关 API route。

如果未来需要调试 resolved URL，应通过服务端日志或显式调试工具完成，不应把它重新放回普通客户端状态。
