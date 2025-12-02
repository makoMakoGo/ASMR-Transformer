# 测试指南

## 环境配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 编辑 `.env`，填入你的 ASR API Key：
```
ASR_API_KEY=sk-your-siliconflow-api-key
```

## 运行测试

### 前置条件

API 测试需要先启动开发服务器：
```bash
# 使用测试默认端口 3092
npm run dev -- -p 3092

# 或使用其他端口（需设置 TEST_BASE_URL）
npm run dev -- -p 8080
```

### 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试（无需启动服务器）
npm run test:unit

# 运行 API 测试（需要启动服务器）
npm run test:api

# 监听模式
npm run test:watch
```

## 测试结构

```
tests/
├── setup.ts              # 测试配置和环境变量加载
├── fixtures/
│   └── Juya's Opening.mp3  # 测试音频文件
├── api/
│   ├── docs.test.ts      # /api/docs 端点测试
│   ├── polish.test.ts    # /api/polish 端点测试
│   └── transcribe.test.ts # /api/transcribe 端点测试
└── unit/
    └── utils.test.ts     # 工具函数单元测试
```

## 测试配置

测试默认使用端口 `3092`，可通过环境变量覆盖：

```bash
TEST_BASE_URL=http://localhost:3000 npm test
```

## 测试用例 (20 tests)

| 测试文件 | 测试数 | 覆盖内容 |
|---------|--------|---------|
| `docs.test.ts` | 3 | 文档 API 的 Markdown/JSON/HTML 输出 |
| `polish.test.ts` | 4 | 文本润色参数验证、SSE 流式响应 |
| `transcribe.test.ts` | 7 | 转录参数验证、基础转录、润色、自定义指令 |
| `utils.test.ts` | 6 | 文件大小格式化、状态配置、默认常量 |

## 测试输出示例

```
========== 转录结果 ==========
文件: Juya's Opening.mp3
耗时: 1984ms
原文:
🎼各位观众早上好，今天是11月16日星期日，欢迎收看AI早报...
==============================

========== 转录 + 润色结果 ==========
【原始转录】
🎼各位观众早上好，今天是11月16日星期日，欢迎收看AI早报...

【润色后】
🎼各位观众早上好，今天是11月16日星期日，欢迎收看AI早报。
OpenRouter发布两款测试模型SlockThink。😊
=====================================
```

## 注意事项

- API 测试需要有效的 ASR API Key（在 `.env` 中配置）
- API 测试需要网络连接
- 测试超时设置为 60 秒
- LLM 润色使用内置免费 Key，无需额外配置
