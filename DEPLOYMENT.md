# AI Task Hub - 部署与运维手册

> 本文档记录 AI Task Hub 项目的所有 Token、密钥、部署流程和运维操作，供所有智能体和开发者复用。
>
> **最后更新**: 2026-05-02 | **当前版本**: v2.7.0 "Project Nova"

---

## 目录

1. [项目概览](#1-项目概览)
2. [仓库与平台信息](#2-仓库与平台信息)
3. [Token 与密钥](#3-token-与密钥)
4. [部署流程](#4-部署流程)
5. [版本发布流程](#5-版本发布流程)
6. [HuggingFace Spaces 部署](#6-huggingface-spaces-部署)
7. [项目架构速查](#7-项目架构速查)
8. [常见问题与解决方案](#8-常见问题与解决方案)
9. [环境变量参考](#9-环境变量参考)

---

## 1. 项目概览

| 项目 | 值 |
|------|-----|
| 项目名称 | AI Task Hub |
| 项目代号 | Project Nova |
| 技术栈 | Next.js 16 + React 19 + tRPC v11 + Prisma 7 + SQLite + Tailwind CSS v4 |
| 当前版本 | v2.7.0 "Project Nova" |
| MCP 工具数 | 162+ |
| 测试用例 | 1875 (99 文件) |
| tRPC 路由 | 15 |
| Prisma 模型 | 36+ |
| 前端页面 | 19 |

---

## 2. 仓库与平台信息

### GitHub 仓库

| 项目 | 值 |
|------|-----|
| 仓库地址 | `https://github.com/arwei944/ai-task-hub` |
| 默认分支 | `main` |
| 远程名称 | `origin` |

### HuggingFace Spaces

| 项目 | 值 |
|------|-----|
| Space 地址 | `https://huggingface.co/spaces/arwei944/ai-task-hub` |
| 访问 URL | `https://arwei944-ai-task-hub.hf.space` |
| Space SDK | Docker |
| 远程名称 | `hf` |

### GitHub Actions Workflows

| Workflow 文件 | 触发条件 | 用途 |
|---------------|----------|------|
| `.github/workflows/deploy-hf.yml` | push main / workflow_dispatch | 部署到 HF Spaces |
| `.github/workflows/sync-to-huggingface.yml` | push main / release | 同步代码到 HF |
| `.github/workflows/ci.yml` | push main / PR | CI 测试 |
| `.github/workflows/deploy.yml` | push main | 构建/部署 |

---

## 3. Token 与密钥

> **安全提示**: Token 存储在 Hermes MCP 的 Memory 中，通过 `read_memory` 工具读取。
> 以下仅记录格式和用途，真实值请从 Hermes Memory 获取。

### 3.1 GitHub Personal Access Token (PAT)

| 项目 | 值 |
|------|-----|
| 格式 | `github_pat_XXXXXXXX...` (以 `github_pat_` 开头) |
| 用途 | GitHub API 操作（创建 Release、触发 Workflow、管理 Secrets 等） |
| 权限 | repo, actions, workflow |
| 获取位置 | GitHub → Settings → Developer settings → Personal access tokens |

**使用方式**:
```bash
# API 调用
curl -H "Authorization: Bearer <GITHUB_PAT>" https://api.github.com/repos/arwei944/ai-task-hub/...

# Git 操作（如需）
git remote set-url origin https://arwei944:<GITHUB_PAT>@github.com/arwei944/ai-task-hub.git
```

### 3.2 HuggingFace Token

| 项目 | 值 |
|------|-----|
| 格式 | `hf_XXXXXXXX...` (以 `hf_` 开头) |
| 用途 | HuggingFace API 操作（部署、创建 Space、触发重建等） |
| 权限 | write |
| 获取位置 | HuggingFace → Settings → Access Tokens |

**使用方式**:
```bash
# Python
from huggingface_hub import HfApi
api = HfApi(token="<HF_TOKEN>")

# Git
git remote set-url hf https://arwei944:<HF_TOKEN>@huggingface.co/spaces/arwei944/ai-task-hub
```

### 3.3 GitHub Secrets 配置

以下 Secret 已通过 GitHub API 配置到仓库中：

| Secret 名称 | 说明 | 用途 |
|-------------|------|------|
| `HF_TOKEN` | HuggingFace Token (格式: `hf_...`) | HF Spaces 部署认证 |

**配置方法**（如需重新配置）:
```bash
# 1. 获取仓库公钥
curl -s -H "Authorization: Bearer <GITHUB_PAT>" \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/secrets/public-key"
# 返回: { "key_id": "...", "key": "base64_public_key" }

# 2. 用 PyNaCl 加密 Token
pip install pynacl
python3 -c "
import base64
from nacl import public
public_key = public.PublicKey(base64.b64decode('<PUBLIC_KEY>'))
sealed_box = public.SealedBox(public_key)
encrypted = sealed_box.encrypt(b'<HF_TOKEN>')
print(base64.b64encode(encrypted).decode())
"

# 3. 创建/更新 Secret
curl -X PUT -H "Authorization: Bearer <GITHUB_PAT>" -H "Content-Type: application/json" \
  -d '{"key_id":"<KEY_ID>","encrypted_value":"<ENCRYPTED_VALUE>"}' \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/secrets/HF_TOKEN"
# 返回 204 表示成功
```

### 3.4 Token 获取方式

| Token | 获取方式 |
|-------|----------|
| GitHub PAT | Hermes MCP → `read_memory` 工具 → MEMORY.md |
| HF Token | Hermes MCP → `read_memory` 工具 → MEMORY.md |

---

## 4. 部署流程

### 4.1 完整部署流程（代码 → GitHub → HuggingFace）

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  本地开发     │────>│  GitHub Push │────>│  GitHub Actions  │
│  (SOLO 沙箱)  │     │  origin/main │     │  deploy-hf.yml   │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                  │
                                                  v
                                          ┌──────────────────┐
                                          │ HuggingFace Spaces│
                                          │  rsync + rebuild  │
                                          └──────────────────┘
```

### 4.2 标准部署步骤

```bash
# 1. 确保在项目目录
cd /workspace/ai-task-hub

# 2. 运行测试
npx vitest run

# 3. 更新版本号
npm version <version> --no-git-tag-version

# 4. 更新 VERSION_HISTORY（src/lib/core/version.ts）
# 5. 更新 CHANGELOG.md

# 6. 提交并推送
git add -A
git commit -m "release: v<version> - <codename>"
git tag v<version>
git push origin main --tags

# 7. GitHub Actions 自动部署到 HuggingFace（无需手动操作）
```

### 4.3 手动触发部署

```bash
# 通过 GitHub API 触发 deploy-hf workflow
curl -X POST \
  -H "Authorization: Bearer <GITHUB_PAT>" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/workflows/deploy-hf.yml/dispatches" \
  -d '{"ref":"main"}'
# 返回 204 表示触发成功
```

### 4.4 手动触发 HF Space 重建

```bash
# 方式 1: 通过 GitHub API 触发 deploy-hf workflow（推荐）
curl -X POST \
  -H "Authorization: Bearer <GITHUB_PAT>" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/workflows/deploy-hf.yml/dispatches" \
  -d '{"ref":"main"}'

# 方式 2: 通过 Python（在有网络访问的环境）
python3 -c "
from huggingface_hub import HfApi
api = HfApi(token='<HF_TOKEN>')
api.restart_space(repo_id='arwei944/ai-task-hub')
"
```

---

## 5. 版本发布流程

### 5.1 版本号规范

遵循语义化版本：`主版本.次版本.修订号[-预发布标识]`

| 阶段 | 格式 | 示例 |
|------|------|------|
| Alpha | `vX.Y.Z-alpha.N` | `v2.4.0-alpha.1` |
| Beta | `vX.Y.Z-beta.N` | `v2.4.0-beta.1` |
| 正式 | `vX.Y.Z` | `v2.4.0` |

### 5.2 发布检查清单

- [ ] 所有测试通过 (`npx vitest run`)
- [ ] `package.json` 版本号已更新
- [ ] `src/lib/core/version.ts` VERSION_HISTORY 已更新
- [ ] `CHANGELOG.md` 已更新
- [ ] Git commit + tag + push
- [ ] GitHub Release 已创建
- [ ] HuggingFace 部署成功（自动）

### 5.3 创建 GitHub Release

```bash
curl -X POST https://api.github.com/repos/arwei944/ai-task-hub/releases \
  -H "Authorization: Bearer <GITHUB_PAT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tag_name": "v<version>",
    "name": "v<version> - <codename>",
    "body": "<release_notes>",
    "draft": false,
    "prerelease": false
  }'
```

### 5.4 版本历史

| 版本 | 代号 | 日期 | 亮点 |
|------|------|------|------|
| v2.4.0 | AI Unleashed | 2026-04-30 | SOLO Bridge Phase B, 7 AI 处理器, Email/WebPush, 162+ MCP 工具 |
| v2.3.0 | Workflow Evolution | 2026-04-30 | 子工作流, 动态步骤, 断点恢复, 通知偏好 |
| v2.2.0 | Platform Pulse | 2026-04-30 | 仪表盘增强, EventBus DLQ, 出站 Webhook |
| v2.1.0 | - | 2026-04-30 | MCP 工具增强, Agent 提示模板, 部署管理 |
| v2.0.0 | AI Native | 2026-04-30 | EventBus v2, 6 新模块, 60+ MCP 工具 |
| v1.0.0~v1.9.0 | - | 2026-04-28~29 | 基础功能迭代 |

---

## 6. HuggingFace Spaces 部署

### 6.1 部署架构

```
GitHub (main branch)
    │
    ├── push 触发 deploy-hf.yml
    │       │
    │       ├── Checkout 代码
    │       ├── rsync 同步文件到 HF Space（排除 node_modules/.next/*.db）
    │       ├── git push 到 HF（可能因 LFS 失败，但不影响）
    │       └── restart_space() 触发重建
    │
    └── 自动部署完成
```

### 6.2 deploy-hf.yml 关键步骤

| 步骤 | 说明 | 是否关键 |
|------|------|----------|
| Create HF Space | 如不存在则创建 Docker SDK Space | ✅ |
| Setup HF Space repo | git clone HF Space 到 /tmp | ✅ |
| Sync project files | rsync 同步（排除 node_modules/.next/*.db） | ✅ |
| Push to HF Spaces | git push（可能因 LFS 失败，已设为非阻塞） | ⚠️ |
| Trigger HF rebuild | restart_space() 触发重建 | ✅ |

### 6.3 rsync 排除列表

```
.git, node_modules, .next, test-db, backups, *.db, *.db-journal, .github/workflows/deploy-hf.yml
```

### 6.4 已知问题：二进制文件

HuggingFace 要求大文件使用 Xet 存储。已通过以下方式解决：
- `.gitattributes` 配置 LFS 过滤规则
- `deploy-hf.yml` 中 git push 步骤设为非阻塞（`|| echo "Warning..."`)
- 实际文件同步依赖 rsync，不依赖 git push

---

## 7. 项目架构速查

### 7.1 核心目录

```
ai-task-hub/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── api/mcp/route.ts     # Web MCP Server (Streamable HTTP)
│   │   ├── dashboard/           # 仪表盘
│   │   ├── tasks/               # 任务管理
│   │   ├── workflows/           # 工作流管理
│   │   ├── deployments/         # 部署管理
│   │   ├── notifications/       # 通知管理
│   │   └── ...                  # 其他页面 (共 19 个)
│   ├── lib/
│   │   ├── core/                # 核心模块 (EventBus, Logger, Version)
│   │   ├── modules/             # 业务模块
│   │   │   ├── task-core/       # 任务核心
│   │   │   ├── workflow-engine/ # 工作流引擎 (含 SOLO Bridge)
│   │   │   ├── ai-engine/       # AI 引擎
│   │   │   ├── notifications/   # 通知系统
│   │   │   ├── deployment-mgmt/ # 部署管理
│   │   │   ├── integration-webhook/ # 出站 Webhook
│   │   │   ├── plugins/         # 插件系统
│   │   │   └── mcp-server/      # MCP 工具定义 + 处理器
│   │   └── trpc/                # tRPC 路由 (15 个)
│   └── components/              # React 组件
├── mcp-server/                  # 独立 MCP Server
├── plugins/                     # 示例插件
│   ├── hello-world/
│   ├── task-stats/
│   └── event-logger/
├── prisma/                      # Prisma Schema
├── tests/                       # 测试文件 (99 个)
├── .github/workflows/           # CI/CD
├── DEPLOYMENT.md                # 本文档
└── ROADMAP.md                   # 路线图
```

### 7.2 MCP 工具注册

所有 MCP 工具在两个位置注册：
1. **独立 MCP Server**: `mcp-server/index.ts`
2. **Web MCP Server**: `src/app/api/mcp/route.ts`

新增工具时，两处都必须注册。

### 7.3 关键配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 版本号（npm version 自动更新） |
| `src/lib/core/version.ts` | VERSION_HISTORY + APP_VERSION（从 package.json 读取） |
| `CHANGELOG.md` | 版本变更日志 |
| `ROADMAP.md` | 长期路线图 |
| `DEPLOYMENT.md` | 部署与运维手册（本文档） |
| `prisma/schema.prisma` | 数据库模型定义 |
| `.gitattributes` | LFS/二进制文件处理规则 |
| `.gitignore` | Git 忽略规则 |

---

## 8. 常见问题与解决方案

### Q1: SOLO 沙箱无法直接访问 HuggingFace

**原因**: 沙箱网络环境限制，huggingface.co 被墙，代理 TLS 握手异常。

**解决方案**: 通过 GitHub Actions 中转部署，不要尝试从沙箱直接 push 到 HF。

### Q2: HF Push 失败 "binary files"

**原因**: HuggingFace 要求大文件使用 Xet 存储。

**解决方案**:
1. 确保 `.gitattributes` 配置了 LFS 规则
2. 确保 `node_modules`、`*.db` 不被 git 跟踪
3. `deploy-hf.yml` 中 push 步骤已设为非阻塞

### Q3: 如何清理 git 中误跟踪的大文件

```bash
# 从 git 索引中移除（不删除本地文件）
git rm -r --cached node_modules
git rm --cached dev.db pnpm-lock.yaml
git commit -m "chore: remove tracked binary files"
git push origin main
```

### Q4: GitHub Actions 失败如何排查

```bash
# 查看最近的 workflow 运行
curl -s -H "Authorization: Bearer <GITHUB_PAT>" \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/runs?per_page=5"

# 查看具体 job 的步骤状态
curl -s -H "Authorization: Bearer <GITHUB_PAT>" \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/runs/<RUN_ID>/jobs"
```

### Q5: 如何手动配置 HF_TOKEN Secret

如果 Secret 丢失或需要更新：
1. 获取公钥: `GET /repos/arwei944/ai-task-hub/actions/secrets/public-key`
2. 用 PyNaCl 加密: `pip install pynacl && python3 -c "..."`
3. 创建 Secret: `PUT /repos/arwei944/ai-task-hub/actions/secrets/HF_TOKEN`

### Q6: GitHub Push Protection 拦截了包含 Token 的提交

**原因**: GitHub 的 Secret Scanning 会检测代码中的真实 Token。

**解决方案**: 文档中不要写入真实 Token，使用占位符（如 `<GITHUB_PAT>`、`<HF_TOKEN>`）。真实 Token 存储在 Hermes MCP Memory 中。

---

## 9. 环境变量参考

### AI 引擎

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 地址 | - |
| `AI_ENGINE_DEFAULT_MODEL` | 默认 AI 模型 | `gpt-4o` |

### SOLO Bridge

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SOLO_MCP_ENDPOINT` | SOLO MCP Server 地址 | `http://localhost:3001/mcp` |
| `SOLO_REST_ENDPOINT` | SOLO REST API 地址 | `http://localhost:3001/api/solo/call` |
| `SOLO_DEFAULT_MODE` | 默认调用模式 | `mcp` |
| `SOLO_TIMEOUT_MS` | 默认超时时间 | `30000` |

### 通知渠道

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_NOTIFY_CHAT_ID` | Telegram 通知 Chat ID |
| `WECHAT_BOT_WEBHOOK_URL` | 企业微信 Webhook URL |
| `SMTP_HOST` | SMTP 服务器地址 |
| `SMTP_PORT` | SMTP 端口 (默认 587) |
| `SMTP_USER` | SMTP 用户名 |
| `SMTP_PASS` | SMTP 密码 |
| `NOTIFY_EMAIL_FROM` | 发件人邮箱 |
| `NOTIFY_EMAIL_TO` | 收件人邮箱 (逗号分隔) |
| `VAPID_PUBLIC_KEY` | Web Push VAPID 公钥 |
| `VAPID_PRIVATE_KEY` | Web Push VAPID 私钥 |
| `VAPID_SUBJECT` | VAPID 主题 (邮箱) |

### 数据库

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | SQLite 数据库路径 | `file:./prisma/dev.db` |

---

## 附录: 快速命令参考

```bash
# === 测试 ===
npx vitest run                    # 运行所有测试
npx vitest run --reporter=verbose # 详细输出

# === 版本管理 ===
npm version <version> --no-git-tag-version  # 更新版本号

# === Git 操作 ===
git tag v<version>                         # 创建标签
git push origin main --tags                # 推送代码+标签

# === GitHub Release ===
curl -X POST -H "Authorization: Bearer <GITHUB_PAT>" \
  https://api.github.com/repos/arwei944/ai-task-hub/releases \
  -d '{"tag_name":"v<version>","name":"v<version>","body":"..."}'

# === 触发 HF 部署 ===
curl -X POST -H "Authorization: Bearer <GITHUB_PAT>" \
  https://api.github.com/repos/arwei944/ai-task-hub/actions/workflows/deploy-hf.yml/dispatches \
  -d '{"ref":"main"}'

# === 查看 Workflow 状态 ===
curl -s -H "Authorization: Bearer <GITHUB_PAT>" \
  "https://api.github.com/repos/arwei944/ai-task-hub/actions/runs?per_page=5" | python3 -c "
import json,sys
for r in json.load(sys.stdin)['workflow_runs']:
    print(f\"{r['name']} | {r['status']} | {r['conclusion'] or '-'}\")
"

# === Prisma 操作 ===
npx prisma generate                  # 生成 Prisma Client
npx prisma db push                   # 推送 Schema 到数据库
npx prisma migrate dev               # 开发环境迁移
```
