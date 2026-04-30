# Release Skill — 版本发布技能

## 触发条件
当用户说以下类似的话时触发此技能：
- "发布新版本"
- "发布 v2.1.0"
- "release"
- "创建新版本"
- "版本发布"
- "打 tag"

## 发布流程

### 第一步：确认发布信息
向用户确认以下信息（如果用户未提供）：
1. **版本号** — 如果用户未指定，根据当前版本和变更内容建议：
   - 破坏性变更 → major
   - 新功能 → minor
   - Bug 修复/小改动 → patch
   - 测试版本 → prerelease (alpha/beta/rc)
2. **变更描述** — 本次发布的主要变更内容
3. **是否推送** — 是否推送到 GitHub

### 第二步：验证工作区
```bash
cd /workspace/ai-task-hub && git status --porcelain
```
- 如果工作区不干净，提示用户先提交或暂存更改

### 第三步：运行测试
```bash
cd /workspace/ai-task-hub && pnpm test
```
- 确保所有测试通过后再继续
- 如果测试失败，停止发布并报告问题

### 第四步：执行发布脚本
```bash
cd /workspace/ai-task-hub && npx tsx scripts/release.ts <version> --message "<描述>" [--push]
```

### 第五步：验证发布结果
```bash
cd /workspace/ai-task-hub && git log --oneline -3 && git tag -l | tail -3
```

## 发布检查清单

每次发布前确认：
- [ ] 工作区干净（无未提交更改）
- [ ] 所有测试通过
- [ ] 版本号格式正确（semver）
- [ ] 变更描述清晰
- [ ] VERSION_HISTORY 已更新（脚本自动完成）
- [ ] CHANGELOG.md 已更新（脚本自动完成）
- [ ] 文档已更新（脚本自动完成）
- [ ] Git tag 已创建（脚本自动完成）
- [ ] 推送到 GitHub（如果指定 --push）

## 版本号规范

遵循语义化版本 (Semantic Versioning)：
- **MAJOR (x.0.0)**: 破坏性变更、架构重构
- **MINOR (0.x.0)**: 新功能、新模块、向后兼容的变更
- **PATCH (0.0.x)**: Bug 修复、小改进、文档更新
- **PRERELEASE**: x.y.z-alpha.n (内部测试) → x.y.z-beta.n (公开测试) → x.y.z-rc.n (候选版本)

## 预发布流程

```
alpha.1 → alpha.2 → ... → beta.1 → beta.2 → ... → rc.1 → rc.2 → ... → 正式版
```

## 回滚

如果发布后发现问题：
```bash
# 删除远程 tag
git push origin :refs/tags/v<version>
# 删除本地 tag
git tag -d v<version>
# 回退 commit
git revert HEAD
# 重新发布
npx tsx scripts/release.ts <version> --message "修复: <问题描述>" --push
```

## 文件位置

- 发布脚本: `scripts/release.ts`
- 版本管理: `src/lib/core/version.ts`
- 变更日志: `CHANGELOG.md`
- API 文档: `docs/API.md`
- 部署文档: `docs/DEPLOYMENT.md`
