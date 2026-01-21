<h1 align="center">🎙️ ASMR Transformer</h1>

<p align="center">
  <img src="public/logo.png" alt="ASMR Transformer Logo" width="120"/>
</p>

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

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000000" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-runtime-339933?logo=node.js&logoColor=white" alt="Node.js" />
</p>

---

![界面预览](docs/images/image-1.png)

## ✨ 特性

一款简洁优雅的语音识别与文本润色工具，采用 Apple 风格设计，支持音频文件上传、从 asmrgay.com 及备用站在线导入/下载音频。

- **🎤 语音识别** - 支持上传音频文件或粘贴 asmrgay.com 及备用站 URL，调用硅基流动 ASR API 进行高精度语音转文字
- **✨ 智能润色** - 支持 OpenAI 兼容 LLM 润色，自动纠错、添加标点、分段排版（不再内置免费 Key）
- **🎯 自定义润色指令** - 可自定义润色规则，适配不同场景（会议记录、采访整理、翻译等）
- **💾 设置持久化** - 默认从服务器 `.env` 读取，WebUI 修改后点击「保存」写回 `.env`
- **📊 实时进度** - 详细的上传进度、处理状态和运行日志
- **🍎 Apple 风格 UI** - 圆润卡片、毛玻璃效果、流畅动画，简洁美观

## 🚀 部署方式

### 本地运行

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

打开浏览器访问 http://localhost:3045 (或自定义端口)

## 🔧 配置说明

### 配置方式（推荐）

1. 复制模板并创建本地配置文件：

```bash
cp .env.example .env
```

2. 两种配置方式二选一：
   - 直接编辑 `.env`
   - 打开 WebUI → 「设置」面板修改并点击「保存」写回 `.env`
   - 设置页顶部提供「保存 / 重新加载 / 放弃改动」用于管理未保存改动

可选环境变量：`APP_SETTINGS_ENV_FILE`（指定 WebUI 读写的 `.env` 文件路径，默认 `./.env`）

### 语音识别 API（必填）

使用硅基流动提供的免费 ASR 服务：

1. 访问 [硅基流动官网](https://siliconflow.cn) 注册账号
2. 在控制台获取 API Key
3. 在工具设置中填入 API Key

默认配置：
- API URL: `https://api.siliconflow.cn/v1/audio/transcriptions`
- 模型: `TeleAI/TeleSpeechASR`

### 文本润色 API（可选）

如需使用自己的 LLM API：
- 支持任何 OpenAI 兼容的 API（如 OpenAI、DeepSeek、通义千问等）
- 在设置中填写 API URL、模型名称和 API Key（如果你的服务不需要 Key，可留空）

### 自定义润色指令

可在设置中修改润色指令，例如：
- 默认：纠错、添加标点、分段排版
- 会议记录：提取要点、整理成会议纪要格式
- 翻译：将内容翻译成英文

### 在线音频链接

仅支持以下站点的播放页面 URL / 直链：
- `www.asmrgay.com`（主站）
- `www.asmr.pw` / `www.asmr.loan` / `www.asmr.party` / `www.asmr.stream`（备用站）

说明：播放页通过 AList API 解析后，真实下载链接可能会跳到 `asmr.121231234.xyz`（已允许）。其它域名会被直接拒绝。

1. 在主界面"在线链接"输入框粘贴链接
2. 选择操作：
   - **下载到本地** - 仅下载音频到 `./audio/` 目录，不转录
   - **直接转录** - 下载并立即转录（需先配置 ASR API Key）
3. 服务器会自动解析播放页面、跟随跳转、校验格式与大小（默认 100MB 内）

可选环境变量：`FETCH_AUDIO_MAX_BYTES`（单位字节，默认 104857600）

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
│   │   ├── polish/route.ts   # LLM 润色（SSE 流式）
│   │   ├── fetch-audio/route.ts # 在线链接导入并转录
│   │   └── download-audio/route.ts # 下载在线音频到本地
│   ├── globals.css           # 全局样式（Apple 设计系统）
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # 主页面组件
├── lib/
│   └── url-utils.ts          # URL 解析/校验/扩展名 MIME 映射
├── docs/images/              # 图片资源
├── tests/                    # 测试文件
│   ├── fixtures/             # 测试资源
│   └── unit/                 # 单元测试
└── package.json
```

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
# 运行单元测试
npm run test:unit

# 运行所有测试
npm test
```

本项目以 Web 界面为主，接口路由仅用于页面内部功能（在线链接导入、润色等），不再提供对外 API 文档。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

[MIT](LICENSE) © 2025 zhu-jl18
