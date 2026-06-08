# Nyadio

多协议音频聚合中转枢纽。任意来源协议（HLS / Icecast / HTTP Push）进，经 ffmpeg 归一化后统一以 HLS 或 HTTP 直推流输出，挂在 `/stream/:slug/*` 下。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + TypeScript + Fastify + Prisma |
| 数据库 | PostgreSQL |
| 前端 | React + Vite + TanStack Query |
| 流处理 | ffmpeg |
| 包管理 | pnpm workspaces |

---

## 前置要求

- **Node.js** ≥ 20
- **pnpm** ≥ 9（`npm i -g pnpm`）
- **PostgreSQL** ≥ 14（本地或远程均可）
- **ffmpeg**（需在 PATH 中可执行）

---

## 本地开发

所有命令默认在项目根目录执行，除非特别说明。

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

只维护项目根目录的 `.env`。`packages/server/.env` 不再放真实配置，后端脚本会直接读取 `../../.env`。

编辑根目录 `.env`，至少填写：

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/nyadio
JWT_SECRET=your-random-secret-at-least-32-chars
HLS_DIR=/dev/shm/nyadio
PORT=3000
HOST=0.0.0.0
```

生成 JWT_SECRET 的方法：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 初始化数据库

首次启动前执行一次：

```bash
pnpm --filter server prisma migrate deploy
pnpm --filter server seed:config
pnpm --filter server seed:admin --username admin --password 12345678
```

以后如果只是日常开发，通常只需要在代码变更涉及 Prisma migration 时重新执行迁移。

### 4. 启动服务

开两个终端分别运行：

```bash
# 终端 1：后端 API / stream，热重载
pnpm --filter server dev
```

```bash
# 终端 2：前端 Vite dev server
pnpm --filter web dev
```

- 后端：`http://localhost:3000`
- 前端：`http://localhost:5173`
- 管理后台：`http://localhost:5173/admin/login`
- 前端 dev server 已代理 `/api`、`/admin`、`/stream`、`/health` 到后端。

### 5. 常用检查

```bash
pnpm --filter server typecheck
pnpm --filter web typecheck
pnpm --filter web build
```

---

## 生产部署

推荐拆成三个部署单元：前端静态文件、后端 Node 服务、PostgreSQL 数据库。它们可以部署在同一台机器并共用一个域名，但进程和环境变量应分开管理。

- 前端：`pnpm --filter web build` 后发布 `packages/web/dist`，不需要读取后端密钥。
- 后端：只运行 `packages/server/dist/index.js`，注入 `DATABASE_URL`、`JWT_SECRET`、`HLS_DIR`、`PORT`、`HOST`、`LOG_LEVEL`、`FFMPEG_PATH` 等服务端变量。
- 数据库：独立 PostgreSQL，连接串只提供给后端和迁移命令。

### 1. 准备代码和依赖

```bash
pnpm install
```

### 2. 配置后端环境变量

可以使用根目录 `.env`，也可以通过 PM2、Docker、systemd 或云平台环境变量注入。生产变量只给后端服务和迁移命令使用。

```bash
cp .env.example .env
```

至少填写：

```env
DATABASE_URL=postgresql://user:password@db-host:5432/nyadio
JWT_SECRET=<随机 32 字节以上密钥>
HLS_DIR=/dev/shm/nyadio
PORT=3000
HOST=127.0.0.1
NODE_ENV=production
LOG_LEVEL=info
```

`FFMPEG_PATH` 可留空，前提是服务器 PATH 里能找到 `ffmpeg`。

### 3. 数据库迁移和初始化

```bash
pnpm --filter server prisma migrate deploy
pnpm --filter server seed:config
pnpm --filter server seed:admin --username admin --password <初始密码>
```

`seed:admin` 只需要首次部署时执行。后续更新通常只执行迁移和构建。

### 4. 构建

```bash
pnpm --filter web build
pnpm --filter server build
```

构建产物：

- 前端静态文件：`packages/web/dist`
- 后端入口：`packages/server/dist/index.js`

### 5. 用 PM2 启动后端

项目根目录创建 `ecosystem.config.js`：

```js
module.exports = {
  apps: [{
    name: 'nyadio',
    script: 'packages/server/dist/index.js',
    instances: 1,        // 必须单实例
    exec_mode: 'fork',   // 禁止 cluster 模式
    env_file: '.env',
    watch: false,
    max_memory_restart: '512M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    merge_logs: true,
  }]
}
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. 用 Nginx 托管前端并代理后端

下面示例使用同一个域名：Nginx 直接服务前端 `dist`，并把 `/api`、`/stream`、`/health` 和非 HTML 的 `/admin/*` 请求代理到后端。

```nginx
map $http_accept $is_html_request {
    default 0;
    "~*text/html" 1;
}

server {
    listen 80;
    server_name your-domain.com;

    root /path/to/Nyadio/packages/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /stream/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }

    location = /health {
        proxy_pass http://127.0.0.1:3000;
    }

    location /admin/ {
        error_page 418 = @spa;

        if ($is_html_request) {
            return 418;
        }

        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location @spa {
        try_files /index.html =404;
    }
}
```

`/admin/*` 同时有前端页面和后端接口：浏览器直接访问页面时 Accept 包含 `text/html`，Nginx 返回前端 SPA；前端 `fetch` 请求通常不是 HTML 请求，Nginx 会代理到后端。

---

## 更新部署

```bash
git pull
pnpm install
pnpm --filter server prisma migrate deploy
pnpm --filter web build
pnpm --filter server build
pm2 reload nyadio
```

---

## 环境变量说明

本地开发统一放在项目根目录 `.env`。生产环境不要求一定使用文件，也可以用 PM2、Docker、systemd、云平台 Secret/Env 面板分别注入；关键是只给后端注入服务端密钥，不要把 `DATABASE_URL` / `JWT_SECRET` 暴露给前端构建或浏览器。

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | 是 | — | PostgreSQL 连接串 |
| `JWT_SECRET` | 是 | — | JWT 签名密钥，≥32 字节 |
| `HLS_DIR` | 否 | `/dev/shm/nyadio` | HLS 段存储目录，建议 tmpfs |
| `PORT` | 否 | `3000` | 监听端口 |
| `HOST` | 否 | `0.0.0.0` | 监听地址 |
| `NODE_ENV` | 否 | `production` | 环境标识 |
| `LOG_LEVEL` | 否 | `info` | 日志级别（fatal/error/warn/info/debug/trace） |
| `FFMPEG_PATH` | 否 | `ffmpeg` | ffmpeg 可执行文件路径；留空时使用 PATH |

> 限流、HLS 参数、空闲超时等运行时配置存储在数据库 `AppConfig` 表中，通过管理后台 `/admin/settings` 页面修改，首次部署由 `seed:config` 写入默认值。
