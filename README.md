# 语音转文字工具

基于 Next.js 15 + TypeScript + Tailwind CSS 的语音识别与文本润色工具。

## 功能

- 上传音频文件或实时录音
- 调用 SiliconFlow API 进行语音转文字
- 调用 LLM API 对转录结果进行纠错和排版
- 实时显示上传进度和处理日志

## 本地运行

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## Docker 部署

```bash
docker compose up -d --build
```

访问 http://your-server:3000

## 配置

在界面中填写：
- 语音识别 API Key 和 URL
- LLM API Key 和 URL（用于文本润色）
