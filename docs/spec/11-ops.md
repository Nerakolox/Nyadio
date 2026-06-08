# 11 — 运维与部署

## 环境变量

仅保留与部署环境/秘密强相关的变量。运行时可调参数（限流、HLS 段、空闲超时等）已迁移到数据库 `AppConfig` 表，由 `/admin/settings` 页面管理（详见 spec/01-data-model.md 与 spec/09-frontend-admin.md）。

本地开发只维护项目根目录 `.env`。`packages/server/.env` 只保留为空占位，避免同一变量在多个目录出现不同值。生产环境可以不用 `.env` 文件，推荐通过 PM2、Docker、systemd 或云平台 Secret/Env 面板把变量注入后端服务。

部署单元建议分开：前端发布 `packages/web/dist` 静态文件；后端运行 `packages/server/dist/index.js`；PostgreSQL 独立部署。前端不应接收 `DATABASE_URL`、`JWT_SECRET` 等后端密钥。

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | 是 | — | PostgreSQL 连接串（Prisma） |
| `JWT_SECRET` | 是 | — | JWT 签名密钥，≥32 字节随机值 |
| `HLS_DIR` | 否 | `/dev/shm/nyadio` | HLS 段存储目录（建议 tmpfs） |
| `PORT` | 否 | `3000` | Fastify 监听端口 |
| `HOST` | 否 | `0.0.0.0` | Fastify 监听地址 |
| `NODE_ENV` | 否 | `production` | 环境标识 |
| `LOG_LEVEL` | 否 | `info` | pino 日志级别 |
| `FFMPEG_PATH` | 否 | `ffmpeg` | ffmpeg 可执行文件路径 |

> 旧版 SPEC 的 `HLS_SEGMENT_DURATION` / `HLS_WINDOW_SIZE` / `IDLE_TIMEOUT_MS` / `MAX_RETRY` / `MAX_ACTIVE_CHANNELS` / `SUBMISSION_RATE_LIMIT` 已不再走 env，统一进 `AppConfig` 表。首次部署的默认值由 seed 脚本写入。

---

## tmpfs 配置

HLS 段文件写入内存文件系统，避免 SSD 高频写入。

Linux 系统 `/dev/shm` 默认已挂载，容量为系统内存的一半。无需额外配置。

启动时服务器自动创建 `HLS_DIR` 目录（如不存在）：

```ts
await fs.mkdir(process.env.HLS_DIR ?? '/dev/shm/nyadio', { recursive: true })
```

**容量估算**：每个运行中的频道占用约 `HLS_WINDOW_SIZE × HLS_SEGMENT_DURATION × 16KB ≈ 480KB`，10 个频道约 5MB，忽略不计。

---

## PM2 配置

`ecosystem.config.js`（项目根目录）：

```js
module.exports = {
  apps: [
    {
      name: 'nyadio',
      script: 'packages/server/dist/index.js',
      instances: 1,          // 必须单实例，ChannelRegistry 是进程内状态
      exec_mode: 'fork',     // 禁止 cluster 模式
      env_file: '.env',
      watch: false,
      max_memory_restart: '512M',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
    }
  ]
}
```

---

## Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # HTTP 直推流长连接
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
}
```

Fastify 需设置 `trustProxy: true` 以正确读取客户端真实 IP（限流用）。

---

## 首次部署步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DATABASE_URL、JWT_SECRET 等

# 3. 数据库迁移
pnpm --filter server prisma migrate deploy

# 4. 写入默认 AppConfig（6 项可调参数）
pnpm --filter server seed:config

# 5. 构建前端
pnpm --filter web build

# 6. 构建后端
pnpm --filter server build

# 7. 创建初始管理员
pnpm --filter server seed:admin --username admin --password <初始密码>

# 8. 启动
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 设置开机自启
```

---

## 更新部署步骤

```bash
git pull
pnpm install
pnpm --filter server prisma migrate deploy
pnpm --filter web build
pnpm --filter server build
pm2 reload nyadio  # 零停机重载（单实例 fork 模式下等同于 restart）
```

---

## 日志

- Fastify 使用 pino 结构化日志，输出 JSON
- `logs/out.log`：正常请求日志
- `logs/err.log`：错误和异常

ffmpeg 子进程的 stderr 通过 pino 转发，级别为 `debug`（生产可调为 `warn` 减少噪音，通过 `LOG_LEVEL` 环境变量配置）。
