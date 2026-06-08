# Backend

负责所有服务端逻辑：HTTP API、流媒体路由、ffmpeg 子进程管理、数据库访问。

## 技术栈

- Runtime: Node.js + TypeScript
- 框架: Fastify
- ORM: Prisma + PostgreSQL
- 子进程: execa（数组参数，禁止字符串拼接）
- 鉴权: @fastify/jwt
- 限流: @fastify/rate-limit
- 密码: node:crypto scrypt

## 职责范围

- `/api/*` — 公开频道、投稿接口
- `/admin/*` — 管理接口（JWT 鉴权，每次 onRequest 查 DB 验 disabled）
- `/stream/:slug/*` — HLS 段文件 + HTTP 直推流长连接
- `/health` — 健康检查
- ConfigStore 单例：启动时从 DB 加载 AppConfig，提供 `get/getInt/refresh`
- ChannelRegistry 单例：内存 Map，维护 ffmpeg 运行时状态（PM2 必须 fork 模式单实例）
- ffmpeg 生命周期：懒启动 / 心跳回收 / 指数退避重试
- SSRF 校验：async validateUrl，含 DNS 预解析（node:dns resolve4/resolve6）

## 文档

| 文档 | 内容 |
|---|---|
| [../../docs/spec/00-index.md](../../docs/spec/00-index.md) | spec 索引，所有模块一览 |
| [../../docs/spec/01-data-model.md](../../docs/spec/01-data-model.md) | 完整 DB schema、枚举、AppConfig |
| [../../docs/spec/02-channels.md](../../docs/spec/02-channels.md) | 频道 CRUD、ChannelRegistry、生命周期 API |
| [../../docs/spec/03-ffmpeg.md](../../docs/spec/03-ffmpeg.md) | ffmpeg 子进程、tee 扇出、输出面 |
| [../../docs/spec/04-submissions.md](../../docs/spec/04-submissions.md) | 投稿与审核接口、事务逻辑 |
| [../../docs/spec/05-auth.md](../../docs/spec/05-auth.md) | JWT 鉴权、密码存储、即时失效 |
| [../../docs/spec/06-tags.md](../../docs/spec/06-tags.md) | 标签 CRUD |
| [../../docs/spec/07-admin-users.md](../../docs/spec/07-admin-users.md) | 管理员账户管理 |
| [../../docs/spec/10-security.md](../../docs/spec/10-security.md) | SSRF、shell 注入防护、限流 |
| [../../docs/spec/11-ops.md](../../docs/spec/11-ops.md) | 环境变量、seed、PM2、tmpfs |
| [../../docs/PLAN.md](../../docs/PLAN.md) | 分批开发计划（P1–P4 后端任务） |

## 关键约束

- ffmpeg 调用只用 execa 数组参数，永不拼字符串
- ChannelRegistry 是进程内单例，禁用 PM2 cluster 模式
- HLS 段写 tmpfs（`HLS_DIR` env），不进 DB，频道停止后清理
- slug 保留词（拒绝创建）：`api`、`admin`、`stream`、`health`
- popularity 更新用单条原子 SQL（`$executeRaw`），不用 read-modify-write
- approve 事务内先写 SourceHistory 再 upsert Source
- approve_as_new 事务外先 slug 预检查（409 可读报错），DB unique constraint 兜底竞态
