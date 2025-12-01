#!/bin/sh
#
# 安装 Git hooks
#

SCRIPT_DIR=$(dirname "$0")
HOOKS_DIR=$(git rev-parse --git-dir)/hooks

echo "📦 安装 Git hooks..."

# 复制 commit-msg hook
cp "$SCRIPT_DIR/commit-msg" "$HOOKS_DIR/commit-msg"
chmod +x "$HOOKS_DIR/commit-msg"

echo "✅ Git hooks 安装完成!"
echo ""
echo "已安装:"
echo "  - commit-msg: 验证提交信息格式"
