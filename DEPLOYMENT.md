# 部署文档

## 环境要求

| 组件 | 最低版本 |
|------|----------|
| Node.js | ≥ 20 |
| pnpm | ≥ 10 |
| 内存 | ≥ 512MB |
| 磁盘 | ≥ 1GB |

## 方式一：本地开发

```bash
git clone https://github.com/arwei944/ai-task-hub.git
cd ai-task-hub
pnpm install
pnpm prisma db push
pnpm dev
```

访问 http://localhost:3000

## 方式二：Docker Compose

```bash
git clone https://github.com/arwei944/ai-task-hub.git
cd ai-task-hub
docker compose up -d
```

访问 http://localhost:7860

### Docker Compose 配置

```yaml
services:
  ai-task-hub:
    build: .
    ports:
      - "7860:7860"
    volumes:
      - ./data:/data          # 持久化数据（数据库、JWT密钥）
    environment:
      - ADMIN_PASSWORD=your_secure_password
      - DATA_DIR=/data
    restart: unless-stopped
```

## 方式三：HuggingFace Spaces

AI Task Hub 支持 HuggingFace Spaces Docker 部署。

### 步骤

1. Fork 仓库到你的 GitHub
2. 在 HuggingFace 创建新的 Space，选择 **Docker** SDK
3. 关联你的 GitHub 仓库
4. 设置环境变量（可选）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_PASSWORD` | 管理员密码 | 自动生成 |
| `DATA_DIR` | 数据目录 | `/data` |
| `NODE_ENV` | 运行环境 | `production` |

5. Space 会自动构建和部署

> 💡 在线演示：https://arwei944-ai-task-hub.hf.space

## 环境变量

### 必需

无需必需环境变量，所有配置都有合理默认值。

### 可选

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADMIN_PASSWORD` | 管理员初始密码 | 首次启动自动生成并打印 |
| `DATA_DIR` | 数据存储目录 | `./data` |
| `DATABASE_URL` | 数据库连接字符串 | `file:./data/ai-task-hub.db` |
| `JWT_SECRET` | JWT 签名密钥 | 自动生成并持久化 |
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |
| `CORS_ORIGINS` | CORS 允许的源 | `http://localhost:3000` |
| `WEBHOOK_SECRET` | Webhook HMAC 签名密钥 | 无（不验证签名） |

### AI / SOLO Bridge

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key | 无 |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4o` |
| `SOLO_MCP_ENDPOINT` | MCP Server 地址 | `http://localhost:3001/mcp` |
| `SOLO_REST_ENDPOINT` | REST API 地址 | `http://localhost:3001/api/solo/call` |
| `SOLO_DEFAULT_MODE` | 默认调用模式 | `mcp` |
| `SOLO_TIMEOUT_MS` | 调用超时 (ms) | `30000` |

### 通知渠道

| 变量 | 说明 |
|------|------|
| `SMTP_HOST` | SMTP 服务器地址 |
| `SMTP_PORT` | SMTP 端口 |
| `SMTP_USER` | SMTP 用户名 |
| `SMTP_PASS` | SMTP 密码 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `WECHAT_WEBHOOK_URL` | 企业微信 Webhook URL |

## 数据持久化

AI Task Hub 使用 SQLite 数据库，数据存储在 `DATA_DIR` 目录下：

```
data/
├── ai-task-hub.db     # SQLite 数据库
├── ai-task-hub.db-wal # WAL 日志
└── .jwt_secret        # JWT 密钥（自动生成）
```

> ⚠️ 部署时务必挂载 `data/` 目录为持久化卷，否则容器重启后数据会丢失。

## 反向代理 (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

## 健康检查

```bash
curl http://localhost:3000/api/health
```

## 备份与恢复

### 备份

```bash
# 通过 API 备份
curl -X POST http://localhost:3000/api/backup -H "Content-Type: application/json" \
  -d '{"table": "Task"}' > backup_tasks.json
```

### 恢复

```bash
curl -X POST http://localhost:3000/api/backup -H "Content-Type: application/json" \
  -d '{"table": "Task", "action": "restore", "data": '"$(cat backup_tasks.json)"'
```

## 常见问题

### 首次启动密码在哪里？

首次启动时，管理员密码会打印在终端日志中。搜索 `Admin password` 关键字。也可以通过环境变量 `ADMIN_PASSWORD` 预设。

### 数据库损坏怎么办？

```bash
# 重新初始化数据库
pnpm prisma db push --force-reset
```

> ⚠️ 此操作会清空所有数据。

### 如何更换端口？

设置 `PORT` 环境变量：

```bash
PORT=8080 pnpm start
```
