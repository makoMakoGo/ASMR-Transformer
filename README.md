# 🎙️ ASMR Transformer

<p align="center">
  <img src="docs/images/juya-foot.jpg" alt="橘鸦的诱惑" width="400" />
</p>

<p align="center">
  <em>最终是想要 <a href="https://space.bilibili.com/285286947">橘鸦Juya</a> 音色来搞定制化 ASMR，想想牛牛就硬硬的 🥵🥵🥵</em>
</p>

<p align="center">
  <a href="#-特性">特性</a> •
  <a href="#-部署方式">部署</a> •
  <a href="#-配置说明">配置</a> •
  <a href="#-联动食用">联动</a> •
  <a href="#-license">License</a>
</p>

---

一款简洁优雅的语音识别与文本润色工具，采用 Apple 风格设计，支持音频文件上传、从 asmrgay.com 及备用站在线导入/下载音频。

![界面预览](docs/images/image-1.png)

## 📋 TODO / 进展

- [x] 增加音频来源，支持从 [asmrgay.com](https://asmrgay.com/asmr) 链接在线导入
- [ ] 做更多模型适配，探索更多 Audio-to-Text 模型
- [ ] 扩充功能：识别后由 AI 定制仿写 ASMR 内容，并通过音色克隆进行 TTS
- [ ] API 接口同步支持远程服务器部署（Deno Deploy、Docker 等）

## ✨ 特性

- **🎤 语音识别** - 支持上传音频文件或粘贴 asmrgay.com 及备用站 URL，调用硅基流动 ASR API 进行高精度语音转文字
- **✨ 智能润色** - 内置免费 LLM 润色服务，自动纠错、添加标点、分段排版
- **🎯 自定义润色指令** - 可自定义润色规则，适配不同场景（会议记录、采访整理、翻译等）
- **💾 设置持久化** - 所有配置自动保存到浏览器 localStorage，下次打开无需重新填写
- **📊 实时进度** - 详细的上传进度、处理状态和运行日志
- **🍎 Apple 风格 UI** - 圆润卡片、毛玻璃效果、流畅动画，简洁美观

## 🚀 部署方式

### 方式一：本地运行

```bash
# 克隆项目
git clone https://github.com/zhu-jl18/ASMR-Transformer.git
cd ASMR-Transformer

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或指定端口
npm run dev -- -p 3092
```

打开浏览器访问 http://localhost:3000 (或自定义端口)

### 方式二：Docker 部署（推荐生产环境）

```bash
docker compose up -d --build
```

访问 http://your-server:3000

## 🔧 配置说明

### 语音识别 API（必填）

使用硅基流动提供的免费 ASR 服务：

1. 访问 [硅基流动官网](https://siliconflow.cn) 注册账号
2. 在控制台获取 API Key
3. 在工具设置中填入 API Key

默认配置：
- API URL: `https://api.siliconflow.cn/v1/audio/transcriptions`
- 模型: `TeleAI/TeleSpeechASR`

### 文本润色 API（可选）

工具内置了免费不限量的润色服务，开箱即用，无需配置。

如需使用自己的 LLM API：
- 支持任何 OpenAI 兼容的 API（如 OpenAI、DeepSeek、通义千问等）
- 在设置中填写 API URL、模型名称和 API Key

### 自定义润色指令

可在设置中修改润色指令，例如：
- 默认：纠错、添加标点、分段排版
- 会议记录：提取要点、整理成会议纪要格式
- 翻译：将内容翻译成英文

### 在线音频链接

支持 asmrgay.com 主站及备用站（asmr.pw、asmr.loan、asmr.party、asmr.stream）的播放页面 URL，以及 .mp3/.wav 等直链。

1. 在主界面"在线链接"输入框粘贴链接
2. 选择操作：
   - **下载到本地** - 仅下载音频到 `./audio/` 目录，不转录
   - **直接转录** - 下载并立即转录（需先配置 ASR API Key）
3. 服务器会自动解析播放页面、跟随跳转、校验格式与大小（默认 50MB 内）

可选环境变量：`FETCH_AUDIO_MAX_BYTES`（单位字节，默认 52428800）

**代理配置**：在设置面板中可配置代理地址（如 `http://127.0.0.1:7890`），用于服务器端拉取外部音频。

## 🔗 联动食用

<table>
  <tr>
    <td>
      <a href="https://github.com/OuroChival-Shizue/My_Chat_Window_Can_Not_Be_A_GalGame">
        <img src="https://github-readme-stats.vercel.app/api/pin/?username=OuroChival-Shizue&repo=My_Chat_Window_Can_Not_Be_A_GalGame&theme=radical&border_color=ff69b4&bg_color=0d1117&title_color=ff69b4&icon_color=ff69b4" alt="My_Chat_Window_Can_Not_Be_A_GalGame" />
      </a>
    </td>
  </tr>
</table>

<blockquote>
🎮 <b>把聊天窗口变成 GalGame！</b><br/>
配合本项目食用更佳~ ASMR 转文字 → GalGame 对话框，二次元浓度拉满！
</blockquote>

## 📁 项目结构

```
├── app/
│   ├── api/
│   │   ├── docs/route.ts     # API 文档端点
│   │   ├── polish/route.ts   # LLM 润色 API
│   │   ├── transcribe/route.ts # 一站式转录 API（文件上传）
│   │   ├── fetch-audio/route.ts # 在线链接导入并转录
│   │   └── download-audio/route.ts # 下载在线音频到本地
│   ├── docs/page.tsx         # API 文档页面
│   ├── globals.css           # 全局样式（Apple 设计系统）
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # 主页面组件
├── lib/
│   └── url-utils.ts          # URL 解析/校验/扩展名 MIME 映射
├── docs/
│   ├── api.md                # API 文档
│   ├── testing.md            # 测试指南
│   └── images/               # 图片资源
├── tests/                    # 测试文件
│   ├── setup.ts              # 测试配置
│   ├── api/                  # API 测试
│   └── unit/                 # 单元测试
├── for-test/                 # 测试资源
├── Dockerfile                # Docker 构建配置
├── docker-compose.yml        # Docker Compose 配置
└── package.json
```

## 🛠️ 技术栈

| 技术 | 版本 |
|------|------|
| Next.js | 15 (App Router) |
| TypeScript | 5.7 |
| React | 19 |
| Tailwind CSS | 3.4 |
| 部署 | Docker / Node.js |

## 📝 使用流程

```
1️⃣ 点击设置图标，填入硅基流动 API Key
        ↓
2️⃣ 粘贴在线链接 或 选择本地音频文件
        ↓
3️⃣ 点击「直接转录」或「开始转录」
        ↓
4️⃣ 查看原始结果，点击「润色」进行智能排版
        ↓
5️⃣ 复制润色后的文本使用
```

## 🧪 测试

```bash
# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 ASR_API_KEY

# 运行单元测试
npm run test:unit

# 运行 API 测试（需先启动 npm run dev）
npm run test:api

# 运行所有测试
npm test
```

详见 [测试指南](docs/testing.md)

## 🔌 API 接口

服务启动后可通过 API 调用。配置 `.env` 后无需在命令中传递 API Key：

```bash
# 配置环境变量（首次使用）
cp .env.example .env
# 编辑 .env 填入 ASR_API_KEY

# 一站式转录（本地文件）
curl -X POST http://localhost:3000/api/transcribe \
  -F "file=@audio.mp3" \
  -F "polish=true"

# 在线链接导入（asmrgay.com 或直链）
curl -X POST http://localhost:3000/api/fetch-audio \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://asmrgay.com/your-audio-link",
    "polish": false
  }'

# 获取 API 文档
curl http://localhost:3000/api/docs
```

详见 [API 文档](docs/api.md) 或访问 http://localhost:3000/docs

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

[MIT](LICENSE) © 2025 zhu-jl18
