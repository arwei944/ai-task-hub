#!/bin/bash
# release.sh - 版本发布脚本
# 用法: ./scripts/release.sh <version> <changelog-message>
# 示例: ./scripts/release.sh v1.6.0-alpha.1 "Phase A Day 1: 数据库变更 + SOLO Bridge"

set -e

VERSION=$1
CHANGELOG=$2

if [ -z "$VERSION" ] || [ -z "$CHANGELOG" ]; then
    echo "❌ 用法: ./scripts/release.sh <version> <changelog-message>"
    echo "示例: ./scripts/release.sh v1.6.0-alpha.1 \"Phase A Day 1: 数据库变更 + SOLO Bridge\""
    exit 1
fi

# 验证版本号格式
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    echo "❌ 版本号格式错误，应为 v1.2.3 或 v1.2.3-alpha.1"
    exit 1
fi

# 提取纯版本号 (去掉 v 前缀)
SEMVER="${VERSION#v}"

echo "🚀 开始发布 $VERSION"
echo "📝 变更: $CHANGELOG"
echo ""

# 1. 更新 package.json 版本
echo "📦 更新 package.json 版本..."
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$SEMVER\"/" package.json
rm -f package.json.bak

# 2. 更新 CHANGELOG.md
echo "📝 更新 CHANGELOG.md..."
TODAY=$(date +%Y-%m-%d)
TEMP_FILE=$(mktemp)

# 在第一个 ## 之前插入新版本
awk -v ver="$VERSION" -v date="$TODAY" -v msg="$CHANGELOG" '
/^## \[/ {
    if (!inserted) {
        print "## [" ver "] - " date
        print ""
        print "### 🚀 变更"
        print ""
        print "- " msg
        print ""
        inserted = 1
    }
}
{ print }
' CHANGELOG.md > "$TEMP_FILE"
mv "$TEMP_FILE" CHANGELOG.md

# 3. Git 提交
echo "💾 Git 提交..."
git add package.json CHANGELOG.md
git commit -m "release: $VERSION - $CHANGELOG"

# 4. Git tag
echo "🏷️ 创建 tag..."
git tag -a "$VERSION" -m "$CHANGELOG"

# 5. 推送到 GitHub
echo "⬆️ 推送到 GitHub..."
git push origin main --tags

echo ""
echo "✅ 发布完成!"
echo "  版本: $VERSION"
echo "  Tag: $VERSION"
echo "  GitHub: https://github.com/arwei944/ai-task-hub/releases/tag/$VERSION"
echo "  HF Spaces: 将通过 CI 自动部署"
