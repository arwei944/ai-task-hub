# AI Task Hub 部署指南

> 版本：v2.0.0 | 最后更新：2026-04-30

## 目录

- [1. 环境要求](#1-环境要求)
- [2. 本地开发](#2-本地开发)
- [3. 环境变量配置](#3-环境变量配置)
- [4. HF Spaces 部署](#4-hf-spaces-部署)
- [5. Docker 部署](#5-docker-部署)
- [6. 生产安全检查清单](#6-生产安全检查清单)
- [7. 数据备份与恢复](#7-数据备份与恢复)
- [8. 常见问题排查](#8-常见问题排查)

---

## 1. 环境要求

| 依赖 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| **Node.js** | 18.x | 20.x LTS | 需要 npm 或 pnpm |
| **pnpm** | 9.x | 10.x | 包管理器 |
| **Git** | 2.x | 最新 | 版本控制 |
| **操作系统** | - | Linux / macOS | Windows 需 WSL2 |
| **内存** | 2 GB | 4 GB+ | 构建时需要更多内存 |
| **磁盘** | 1 GB | 2 GB+ | 含 node_modules |

### 可选依赖

| 依赖 | 说明 |
|------|------|
| **Docker** | 容器化部署 |
| **Docker Compose** | 编排多容器 |
| **Python 3 + make + g++** | HF Spaces 构建原生模块 |

---

## 2. 本地开发

### 2.1 克隆项目

```bash
git clone https://github.com/arwei944/ai-task-hub.git
cd ai-task-hub
```

### 2.2 安装依赖

```bash
pnpm install
```

> 项目使用 `pnpm` 作为包管理器。`package.json` 中配置了 `onlyBuiltDependencies`，仅编译必要的原生模块（better-sqlite3、esbuild、prisma、sharp）。

### 2.3 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

- `prisma generate` — 生成 Prisma Client 到 `src/generated/prisma`
- `prisma db push` — 将 schema 同步到 SQLite 数据库

### 2.4 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000 即可使用。

### 2.5 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# E2E 测试（需要先安装 Playwright 浏览器）
npx playwright test
```

### 2.6 启动 MCP 服务端（独立模式）

```bash
pnpm mcp:start
```

---

## 3. 环境变量配置

以下为所有支持的环境变量。本地开发时可在项目根目录创建 `.env` 文件。

### 核心配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `NODE_ENV` | 否 | `development` | 运行环境：development / production |
| `PORT` | 否 | `3000` | 服务监听端口 |
| `HOSTNAME` | 否 | `localhost` | 监听地址，Docker 中设为 `0.0.0.0` |
| `DATABASE_URL` | 否 | `file:./dev.db` | SQLite 数据库路径 |
| `NEXT_TELEMETRY_DISABLED` | 否 | `0` | 禁用 Next.js 遥测，设为 `1` 关闭 |

### 安全配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET` | 生产必填 | - | JWT 签名密钥，**生产环境必须设置强随机字符串** |
| `ADMIN_PASSWORD` | 否 | `admin` | 管理员初始密码，**生产环境必须修改** |

### AI 引擎配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `OPENAI_API_KEY` | 否 | - | OpenAI API Key，启用 AI 功能必填 |
| `OPENAI_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI API 基础 URL（支持自定义端点） |
| `AI_MODEL` | 否 | `gpt-4o` | 默认 AI 模型 |

### 平台集成配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `GITHUB_TOKEN` | 否 | - | GitHub Personal Access Token |
| `GITHUB_REPO` | 否 | - | GitHub 仓库（格式：owner/repo） |
| `FEISHU_APP_ID` | 否 | - | 飞书应用 ID |
| `FEISHU_APP_SECRET` | 否 | - | 飞书应用密钥 |
| `NOTION_TOKEN` | 否 | - | Notion Integration Token |
| `NOTION_DATABASE_ID` | 否 | - | Notion 数据库 ID |
| `TELEGRAM_BOT_TOKEN` | 否 | - | Telegram Bot Token |
| `TELEGRAM_NOTIFY_CHAT_ID` | 否 | - | Telegram 通知聊天 ID |
| `WECHAT_BOT_WEBHOOK_URL` | 否 | - | 微信机器人 Webhook URL |
| `WECHAT_NOTIFY_USER_ID` | 否 | - | 微信通知用户 ID |
| `WEBHOOK_SECRET` | 否 | - | Webhook HMAC 签名密钥 |
| `NOTIFICATION_WEBHOOK_URL` | 否 | - | 通知 Webhook URL |

### 本地开发 .env 示例

```env
# 核心配置
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./dev.db

# 安全配置（仅开发环境使用）
JWT_SECRET=dev-secret-do-not-use-in-production
ADMIN_PASSWORD=admin

# AI 引擎（可选）
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o
```

---

## 4. HF Spaces 部署

AI Task Hub 支持 Hugging Face Spaces 一键部署。

### 4.1 部署步骤

1. **创建 Space**：在 Hugging Face 上创建一个新的 Docker Space
2. **上传代码**：将项目代码推送到 Space 的 Git 仓库
3. **自动构建**：HF Spaces 自动执行 `Dockerfile.hf` 构建并部署

### 4.2 Dockerfile.hf 说明

HF Spaces 使用专用的 `Dockerfile.hf`，特点如下：

- **单阶段构建**：在单个 Docker 阶段中完成依赖安装、Prisma 生成、数据库初始化和 Next.js 构建
- **端口**：监听 `7860`（HF Spaces 默认端口）
- **持久化存储**：数据库存储在 `/data/dev.db`（HF Bucket 挂载点）
- **启动脚本**：使用 `start.sh` 进行启动前检查和数据库同步

### 4.3 HF Spaces 环境变量

在 Space 的 Settings > Variables and secrets 中配置：

| 变量名 | 说明 |
|--------|------|
| `OPENAI_API_KEY` | AI 功能必填 |
| `OPENAI_BASE_URL` | 可选，自定义 API 端点 |
| `AI_MODEL` | 可选，默认 gpt-4o |
| `JWT_SECRET` | 建议设置 |
| `ADMIN_PASSWORD` | 建议修改默认值 |
| `GITHUB_TOKEN` | GitHub 集成 |
| `FEISHU_APP_ID` | 飞书集成 |
| `FEISHU_APP_SECRET` | 飞书集成 |
| `NOTION_TOKEN` | Notion 集成 |

### 4.4 自动部署

配置 GitHub Actions 自动部署到 HF Spaces：

```yaml
# .github/workflows/deploy-hf.yml 已包含
# 推送到 main 分支时自动触发部署
```

### 4.5 start.sh 启动流程

`start.sh` 脚本在每次容器启动时执行：

1. 创建 `/data` 持久化目录
2. 初始化 SQLite 数据库（如不存在）
3. 执行 `prisma db push` 同步表结构
4. 验证关键文件（better-sqlite3、Prisma Client、数据库、Next.js 构建）
5. 测试数据库连接
6. 启动 Next.js 服务器

---

## 5. Docker 部署

### 5.1 使用 Dockerfile 构建

项目提供多阶段构建的 `Dockerfile`：

```bash
# 构建镜像
docker build -t ai-task-hub:1.8.0 .

# 运行容器
docker run -d \
  --name ai-task-hub \
  -p 3000:3000 \
  -v ai-task-hub-data:/app/data \
  -e JWT_SECRET=your-strong-secret \
  -e ADMIN_PASSWORD=your-secure-password \
  -e OPENAI_API_KEY=sk-your-key \
  ai-task-hub:1.8.0
```

### 5.2 使用 Docker Compose

项目提供 `docker-compose.yml`：

```bash
# 启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down

# 停止并清除数据
docker compose down -v
```

### 5.3 Docker 构建阶段说明

| 阶段 | 说明 |
|------|------|
| `base` | 基础镜像 node:20-alpine |
| `deps` | 安装依赖（利用 Docker 缓存层） |
| `builder` | Prisma 生成 + Next.js 构建 |
| `runner` | 生产运行镜像（最小化） |

### 5.4 数据持久化

Docker 部署时，数据通过 Volume 持久化：

```bash
# 创建命名卷
docker volume create ai-task-hub-data

# 挂载到容器
docker run -v ai-task-hub-data:/app/data ...
```

数据存储位置：`/app/data/dev.db`

---

## 6. 生产安全检查清单

部署到生产环境前，请逐项确认以下安全配置：

### 必须项

| 序号 | 检查项 | 说明 | 状态 |
|------|--------|------|------|
| 1 | **JWT_SECRET** | 设置为强随机字符串（至少 32 字符） | [ ] |
| 2 | **ADMIN_PASSWORD** | 修改默认密码 `admin` | [ ] |
| 3 | **NODE_ENV** | 设置为 `production` | [ ] |
| 4 | **CORS 配置** | 限制允许的源（Origin） | [ ] |
| 5 | **DATABASE_URL** | 使用持久化存储路径 | [ ] |

### 推荐项

| 序号 | 检查项 | 说明 | 状态 |
|------|--------|------|------|
| 6 | **HTTPS** | 使用反向代理（Nginx/Caddy）启用 TLS | [ ] |
| 7 | **防火墙** | 仅开放必要端口（3000 或 7860） | [ ] |
| 8 | **日志级别** | 生产环境设为 `warn` 或 `error` | [ ] |
| 9 | **API Key 保护** | 所有第三方 API Key 通过环境变量传入 | [ ] |
| 10 | **定期备份** | 配置自动数据库备份 | [ ] |
| 11 | **资源限制** | Docker 设置内存/CPU 限制 | [ ] |
| 12 | **健康检查** | 配置 `/api/status` 健康检查端点 | [ ] |
| 13 | **更新策略** | 定期更新依赖，关注安全公告 | [ ] |

### 安全加固命令

```bash
# 生成强随机 JWT_SECRET
openssl rand -hex 32

# Docker 资源限制
docker run -d \
  --memory=2g \
  --cpus=2 \
  --name ai-task-hub \
  ...
```

### Nginx 反向代理示例

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 7. 数据备份与恢复

### 7.1 通过 API 备份

```bash
# 导出完整数据
curl -o backup-$(date +%Y%m%d).json \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/backup
```

### 7.2 通过 API 恢复

```bash
# 导入数据（覆盖现有数据）
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data @backup-20260429.json \
  http://localhost:3000/api/backup
```

> **警告**：导入操作会覆盖现有数据。建议在导入前先备份当前数据。

### 7.3 直接备份 SQLite 文件

```bash
# Docker 环境
docker cp ai-task-hub:/app/data/dev.db ./backup-$(date +%Y%m%d).db

# 本地环境
cp dev.db ./backup-$(date +%Y%m%d).db
```

### 7.4 定期备份脚本

```bash
#!/bin/bash
# backup.sh — 添加到 crontab 定期执行
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
docker cp ai-task-hub:/app/data/dev.db "$BACKUP_DIR/ai-task-hub-$DATE.db"

# 保留最近 30 天的备份
find $BACKUP_DIR -name "ai-task-hub-*.db" -mtime +30 -delete
```

### 7.5 任务导出

```bash
# 导出为 JSON
curl -o tasks.json \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/export/tasks?format=json"

# 导出为 CSV
curl -o tasks.csv \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/export/tasks?format=csv"
```

---

## 8. 常见问题排查

### 8.1 数据库相关

**问题**：`prisma db push` 失败

```bash
# 解决方案 1：强制同步（会丢失数据）
npx prisma db push --accept-data-loss

# 解决方案 2：删除数据库重新初始化
rm dev.db
npx prisma db push
```

**问题**：`Database file created but no tables`

```bash
# 确认 Prisma schema 已同步
npx prisma generate
npx prisma db push
```

**问题**：数据库锁定

```bash
# SQLite 不支持并发写入，确保没有多个进程同时访问
# 检查是否有多个 Next.js 实例在运行
lsof -i :3000
```

### 8.2 原生模块相关

**问题**：`better-sqlite3` 编译失败

```bash
# 确保安装了构建工具
# Ubuntu/Debian
sudo apt-get install python3 make g++

# macOS
xcode-select --install

# 清除缓存重新安装
rm -rf node_modules
pnpm install
```

**问题**：`Error: Cannot find module 'better-sqlite3'`

```bash
# 重新生成 Prisma Client
npx prisma generate

# 检查 node_modules
ls node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

### 8.3 端口相关

**问题**：`Port 3000 is already in use`

```bash
# 查看占用端口的进程
lsof -i :3000

# 使用其他端口
PORT=3001 pnpm dev

# 或修改 .env
echo "PORT=3001" >> .env
```

### 8.4 认证相关

**问题**：登录后跳转失败 / 401 错误

```bash
# 确认 JWT_SECRET 已设置
echo $JWT_SECRET

# 清除浏览器缓存和 localStorage
# 重新登录获取新 Token
```

**问题**：API 返回 403 Forbidden

```
# 检查用户角色
# admin 角色才能访问 adminProcedure 接口
# 普通用户只能访问 protectedProcedure 接口
```

### 8.5 Docker 相关

**问题**：容器启动后立即退出

```bash
# 查看容器日志
docker logs ai-task-hub

# 常见原因：
# 1. 数据库初始化失败 → 检查 /app/data 目录权限
# 2. 原生模块缺失 → 重新构建镜像
# 3. 端口冲突 → 修改 PORT 环境变量
```

**问题**：容器重启后数据丢失

```bash
# 确保使用了 Volume 挂载
docker run -v ai-task-hub-data:/app/data ...

# 检查 Volume
docker volume ls
docker volume inspect ai-task-hub-data
```

### 8.6 HF Spaces 相关

**问题**：构建超时

```
# HF Spaces 构建时间限制通常为 2 小时
# 优化建议：
# 1. 确保 pnpm-lock.yaml 存在（加速依赖安装）
# 2. 使用 .dockerignore 排除不必要文件
# 3. 减少依赖数量
```

**问题**：Space 重启后数据丢失

```
# 确认 DATABASE_URL 指向 /data 目录
# HF Spaces 的 /data 目录是持久化存储
# 检查环境变量：DATABASE_URL=file:/data/dev.db
```

### 8.7 AI 功能相关

**问题**：AI 功能返回错误

```bash
# 检查 API Key 是否配置
echo $OPENAI_API_KEY

# 检查 API 端点是否可访问
curl $OPENAI_BASE_URL/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 检查模型名称是否正确
echo $AI_MODEL
```

### 8.8 性能相关

**问题**：页面加载缓慢

```
# 开发模式（pnpm dev）性能较差是正常的
# 生产模式构建：
pnpm build
pnpm start

# Docker 部署自动使用生产模式
```

**问题**：API 响应慢

```
# SQLite 不适合高并发写入场景
# 建议：
# 1. 使用连接池（Prisma 默认已配置）
# 2. 增加数据库缓存
# 3. 考虑读写分离
```
