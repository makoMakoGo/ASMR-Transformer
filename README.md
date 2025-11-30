# 语音转文字工具

基于 Next.js 15 + TypeScript + Tailwind CSS 的语音识别与文本润色工具。

## 功能

- 上传音频文件或实时录音
- 调用 SiliconFlow API 进行语音转文字
- 调用 LLM API 对转录结果进行纠错和排版
- 实时显示上传进度和处理日志

## API 说明

- 语音转文字：使用硅基流动中文官网可免费申请的 `TeleAI/TeleSpeechASR` 模型，默认 API URL `https://api.siliconflow.cn/v1/audio/transcriptions`。
- 文本润色：内置免费不限量的润色服务（模型 `DeepSeek-V3.1-Terminus`，API `https://juya.owl.ci/v1`），不填写 Key 时会自动使用内置 Key；如需自定义可在界面填写自己的 API/模型/Key。

## 本地运行

```bash
# 克隆项目
git clone <repo-url>
cd Gradio-Web-Audio

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建与启动
npm run build
npm start
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
