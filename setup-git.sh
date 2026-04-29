#!/bin/bash
# AI Task Hub - Git 环境初始化脚本
# 每次新会话执行: source /workspace/ai-task-hub/setup-git.sh <GITHUB_TOKEN>
#
# 用法:
#   source /workspace/ai-task-hub/setup-git.sh ghp_xxxxxxxxxxxx
#   或者先设置环境变量: export GITHUB_TOKEN=ghp_xxx && source /workspace/ai-task-hub/setup-git.sh

TOKEN="${1:-$GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ 用法: source setup-git.sh <GITHUB_TOKEN>"
  echo "   或:   export GITHUB_TOKEN=ghp_xxx && source setup-git.sh"
  return 1 2>/dev/null || exit 1
fi

export GITHUB_TOKEN="$TOKEN"
export GH_TOKEN="$TOKEN"

echo "https://arwei944:${TOKEN}@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials
git config --global credential.helper store

echo "✅ Git credentials configured"
echo "   GITHUB_TOKEN=${TOKEN:0:10}..."
