# 🤝 贡献指南

感谢你对 ASMR Transformer 的关注！欢迎提交 Issue 和 Pull Request。

## 🛠️ 开发环境

### 推荐工具

**强烈推荐使用 Vibe Coding 辅助开发！** 本项目内置了以下 AI 辅助配置：

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` | Claude Code 指导文件，包含项目架构、代码风格等 |
| `AGENTS.md` | AI Agent 通用指导文件 |

如果你使用 Serena MCP，本地生成的 `.serena/` 已加入 `.gitignore`，不要提交到仓库。

### 环境准备

```bash
# 克隆项目
git clone https://github.com/zhu-jl18/ASMR-Transformer.git
cd ASMR-Transformer

# 安装依赖（会自动安装 Git hooks）
npm install

# 启动开发服务器
npm run dev
```

## 📝 提交规范

本项目使用 Git hooks 强制检查提交信息格式，请遵循 `.gitmessage` 模板：

```
<emoji> <type>: <描述>
```

### 可用的 type

| Emoji | Type | 说明 |
|-------|------|------|
| 🎉 | init | 初始化 |
| ✨ | feat | 添加新功能 |
| 🐛 | fix | 修复 bug |
| 📝 | docs | 文档修改 |
| 🎨 | style | 代码风格修改 |
| ♻️ | refactor | 代码重构 |
| ⚡ | perf | 性能优化 |
| ✅ | test | 测试用例 |
| 🔨 | build | 构建相关 |
| 👷 | ci | CI 配置 |
| ❓ | chore | 其它修改 |
| ⬆️ | deps | 依赖项修改 |

### 示例

```bash
git commit -m "✨ feat: 添加音频在线导入功能"
git commit -m "🐛 fix: 修复润色超时问题"
git commit -m "📝 docs: 更新部署文档"
```

## 🔄 PR 流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/amazing-feature`)
3. 提交变更（遵循提交规范）
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

## 🎯 代码风格

- TypeScript 严格模式
- 使用 Tailwind CSS 进行样式开发
- 遵循 `CLAUDE.md` 中的代码规范

## 💬 交流

如有问题，欢迎提交 Issue 讨论！
