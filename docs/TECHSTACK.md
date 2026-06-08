# Nyadio 技术选型方案

## 1. 背景与新增需求

在 `PROJECTINFO.md` 的核心架构基础上，新增以下需求：

- **管理后台**：用户可公开投稿音频源，管理员审核后上线
- **多管理员协作**：支持角色区分（超级管理员 / 审核员）
- **关联数据**：频道 ↔ 源 ↔ 标签 ↔ 投稿，需要关系型存储

---

## 2. 技术选型

### 后端：Node.js (TypeScript) + Fastify

选 Fastify 而非 Express 的理由：
- 内建 schema 验证，直接用于 SSRF 校验和请求校验
- 插件系统有声明周期钩子，限流插件接入干净
- HTTP 直推流（长连接广播）场景下背压管理优于 Express
- TypeScript 类型支持一流

**核心依赖**

| 包 | 用途 |
|---|---|
| `fastify` | HTTP 框架 |
| `@fastify/jwt` | JWT 签发与校验（管理员鉴权） |
| `@fastify/rate-limit` | `/api` + 全局限流 |
| `@fastify/static` | 托管 React 静态构建产物 |
| `zod` | 运行时校验（含 SSRF 拦截） |
| `execa` | ffmpeg 子进程管理，数组参数 API 天然防 shell 注入 |
| `prisma` + `@prisma/client` | ORM + 数据库迁移 |
| `pino` | 结构化日志（Fastify 内建） |

### 前端：React + Vite (TypeScript)

- Vite 构建纯静态 SPA，由 Fastify `@fastify/static` 托管，无需单独部署
- 公开面：频道列表、播放页、投稿表单
- 管理面：`/admin/*` 路由，JWT 守卫，审核队列 + 频道管理

**UI 与状态**

| 包 | 用途 |
|---|---|
| `shadcn/ui` + Tailwind CSS v4 | 组件库，无捆绑样式；主题遵循 [STYLE.MD](STYLE.MD)（Sakura Cream 色系，`--nya-*` 语义 token） |
| `@tanstack/react-query` | 频道状态轮询（心跳场景完美匹配） |

不选 Ant Design / MUI：体积重，设计语言与"基础设施工具"调性不符。不需要 Redux/Zustand，状态量极小。

### 数据库：PostgreSQL + Prisma

用户投稿、审核流、多管理员、关联数据均为关系型场景，直接使用 PostgreSQL。Prisma 提供类型安全查询和迁移管理。

**HLS 段仍走 tmpfs**，不进数据库。频道注册表（运行时状态）是内存 Map，从 DB 加载，重启时重建。

### 鉴权：JWT（`@fastify/jwt`）

- 管理员登录 → 服务端签发 JWT，有效期 8 小时
- `/admin/*` 路由需 Bearer token，校验后取角色
- 投稿接口公开（无需登录），但走 SSRF 校验 + 限流保护
- 密码用 `scrypt` 哈希存储（Node 内建 `crypto`，无需第三方包）

### 进程管理：PM2（fork 模式，单实例）

同 `PROJECTINFO.md`，频道注册表是进程内状态，禁用 cluster 模式。

### Monorepo：pnpm workspaces

两个包（`server` / `web`），无需 Turborepo/Nx。

---

## 3. 数据模型

```
Channel        频道（slug 唯一且不可修改，active/inactive；含 popularity 热度字段）
  └─ Source    输入源（一对一，一个频道只有一个源；upsert 覆盖式更新）
  └─ ChannelTag ─ Tag   标签（多对多，标签由管理员统一管理）

Submission     用户投稿（pending → approved/rejected）
  └─ AdminUser 审核人
  └─ Channel   targetChannelId 可选外键 + suggestedSlug/suggestedName 双模式

AdminUser      管理员（username + scrypt 密码哈希，role: SUPERADMIN/MODERATOR）

AppConfig      全局可调配置键值对（替代 env 中的运行时参数）
```

**枚举**
- `Protocol`：`HLS | ICECAST | HTTP_PUSH`（yt-dlp 为后期演进，当前不实现）
- `SubmissionStatus`：`PENDING | APPROVED | REJECTED`
- `ChannelStatus`：`ACTIVE | INACTIVE`
- `AdminRole`：`SUPERADMIN | MODERATOR`

详见 [spec/01-data-model.md](spec/01-data-model.md)。

---

## 4. 功能规格

### 4.1 输入源（入口适配器）

当前实现的协议：
- **HLS**：第三方 m3u8 URL，ffmpeg `-i` 直接拉取
- **Icecast**：Icecast 挂载点 URL，ffmpeg `-i` 直接拉取
- **HTTP\_PUSH**：HTTP 直推流 URL，ffmpeg `-i` 直接拉取

yt-dlp 接入为后期演进，当前不实现。无本地文件源，只做网络拉流。

### 4.2 输出面

此次必须实现的输出面：

| 输出面 | 路径 | 说明 |
|---|---|---|
| HLS | `/stream/:slug/index.m3u8` + `/stream/:slug/seg_*.aac` | 分段 6 秒，滑动窗口 5 段，段写 tmpfs |
| HTTP 直推流 | `/stream/:slug/audio.aac` | Node 读 ffmpeg 管道广播给所有长连接听众 |

所有流路径统一在 `/stream/` 前缀下，与前端 SPA 路由（`/`、`/channels`、`/admin/*` 等）和 API 路由（`/api/*`）彻底隔离，避免 slug 命名空间冲突。

Icecast 推送面为可选演进，当前不实现。

### 4.3 音频规格

- 编码：AAC
- 码率：128 kbps
- 容器：ADTS（直推流）/ MPEG-TS（HLS 段）

### 4.4 频道生命周期

- **懒启动**：频道首次被请求时启动 ffmpeg
- **心跳回收**：无任何连接（HLS 轮询 + 直推流连接）超过 `IDLE_TIMEOUT_MS`（AppConfig，默认 30 秒）自动回收 ffmpeg
- **自动重试**：ffmpeg 异常退出时自动重启，最多重试 `MAX_RETRY` 次（AppConfig，默认 3）；超过后标记频道为错误状态，等待管理员介入
- **并发上限**：同时活跃频道数为 `MAX_ACTIVE_CHANNELS`（AppConfig，默认 20）

> 这些阈值都在数据库 `AppConfig` 表里，由 `/admin/settings` 管理。详见 [spec/01-data-model.md](spec/01-data-model.md) 的 AppConfig 段。

### 4.5 用户投稿

表单字段（双模式）：

| 字段 | 必填 | 说明 |
|---|---|---|
| 源 URL | 是 | 经 SSRF 校验 |
| 协议类型 | 是 | HLS / ICECAST / HTTP_PUSH |
| 目标频道（模式选择） | 否 | 三选一：「不指定」/「绑定已有频道（targetChannelId）」/「建议新建（suggestedSlug + suggestedName）」 |
| 备注 | 否 | 给审核人看的备注，500 字以内 |
| 联系方式 | 否 | 方便审核人联系投稿者，自由文本，100 字以内 |

限流：按 IP，频率为 `SUBMISSION_RATE_LIMIT`（AppConfig，默认 5 次/小时）。

### 4.6 管理后台功能

| 功能 | 权限 |
|---|---|
| 审核投稿（approve / approve_as_new / reject + 审核备注） | MODERATOR + SUPERADMIN |
| 新建频道（填写 slug / 名称 / 简介 / 标签 / featured） | SUPERADMIN |
| 编辑频道信息（名称、简介、标签、featured；slug 不可改） | SUPERADMIN |
| 手动启用/停用频道 | SUPERADMIN |
| 查看频道运行状态（ffmpeg 是否在跑、重试次数、最后心跳） | MODERATOR + SUPERADMIN |
| 管理标签（创建、删除、改名） | SUPERADMIN |
| 管理管理员账户 | SUPERADMIN |
| 系统设置（AppConfig 6 项） | SUPERADMIN |

### 4.7 页面清单与功能明细

#### 公开面

**`/` 首页**
- 项目介绍：是什么、怎么用、NetMusic 接入说明
- 推荐频道预览：管理员手动标记的推荐频道卡片（展示名称、简介、标签、在线状态），点击跳频道详情

**`/channels` 频道列表**
- 全部活跃频道卡片，展示名称、简介、标签、在线状态
- 默认排序：在线优先 → 同等在线按热度 → 同等热度按名称字母
- TanStack Query 定期轮询刷新在线状态
- 顶部标签云，点击跳转 `/tags/:tag`

**`/tags/:tag` 标签频道页**
- 展示该标签下所有活跃频道，布局与频道列表相同
- 排序规则与频道列表一致
- URL 可直接分享/收藏

**`/channel/:slug` 频道详情**
- 展示：名称、简介、标签
- 各输出面 URL 一键复制（HLS `.m3u8`、HTTP 直推流 `.aac`）
- 内嵌播放器（`<audio>` + hls.js），手动点击播放，不自动播放
- `playState` 实时刷新（live / preparing / unavailable）

**`/submit` 投稿**
- 表单字段：源 URL + 协议类型（必填），目标频道（三选一模式：不指定/绑定已有/建议新建）+ 托言备注 + 联系方式（选填）
- 提交后显示受理成功状态，不跳页
- 按 IP 限流（`SUBMISSION_RATE_LIMIT` AppConfig 项）

#### 管理面（`/admin/*`，JWT 守卫）

**`/admin/login` 登录**
- 用户名 + 密码，登录后跳转审核队列

**`/admin/submissions` 审核队列**（MODERATOR + SUPERADMIN）
- 投稿列表，按状态筛选（pending / approved / rejected）
- 每条展示：URL、协议、目标频道、备注、联系方式、提交时间
- 操作：通过（需选目标频道）或拒绝，均可填审核备注

**`/admin/channels` 频道管理**（SUPERADMIN）
- 全部频道列表（含非活跃），展示名称、slug、标签、运行状态（在线 / 离线 / 错误）
- 操作：新建频道、启用/停用
- 点击跳转频道详情/编辑页

**`/admin/channels/:id` 频道详情/编辑**（SUPERADMIN）
- 编辑：名称、简介、标签（slug 只读）
- 运行状态面板：ffmpeg 是否在跑、重试次数、最后心跳时间
- 手动启停频道

**`/admin/tags` 标签管理**（SUPERADMIN）
- 标签列表，操作：创建、改名、删除

**`/admin/admins` 管理员账户管理**（SUPERADMIN）
- 管理员列表，操作：新建账户（设角色）、禁用账户

**`/admin/settings` 系统设置**（SUPERADMIN）
- AppConfig 6 项可调参数表单（详见 [spec/09-frontend-admin.md](spec/09-frontend-admin.md) 第 7 节）

---

## 5. 目录结构

```
nyadio/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── channels/     # 频道注册表 + 心跳 + 重试逻辑（内存，从 DB 加载）
│   │   │   ├── ffmpeg/       # 子进程管理 + tee 扇出
│   │   │   ├── adapters/     # 入口适配器（HLS / Icecast / HTTP_PUSH）
│   │   │   ├── outputs/      # 出口面（HLS 段写 tmpfs / HTTP 直推流广播）
│   │   │   ├── routes/       # Fastify 路由（/api, /admin, /stream, /health）
│   │   │   ├── security/     # SSRF 校验 + shell 净化
│   │   │   ├── config/       # ConfigStore 单例（从 DB AppConfig 加载 + 刷新）
│   │   │   ├── scripts/      # seed-admin / seed-config CLI
│   │   │   └── db/           # Prisma client 单例
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   │   ├── public/   # 首页、频道列表、频道详情、标签页、投稿表单
│       │   │   └── admin/    # 登录、审核队列、频道管理、标签管理、管理员管理、系统设置
│       │   └── api/          # TanStack Query hooks
│       └── package.json
├── package.json              # pnpm workspace root
├── ecosystem.config.js       # PM2 配置（fork 模式，单实例）
└── docs/
    ├── PROJECTINFO.md
    ├── TECHSTACK.md
    └── spec/                 # 模块化 SPEC（见 spec/00-index.md）
```

---

## 6. 安全要点

| 关注点 | 方案 |
|---|---|
| SSRF | `zod` URL 解析 + 拒绝私网段（`10.x / 172.16.x / 192.168.x / 127.x / 169.254.x`）及云元数据 IP |
| shell 注入 | `execa` 数组参数传 ffmpeg，绝不拼字符串；URL 中含 shell 元字符一律拒绝 |
| API 限流 | `@fastify/rate-limit` 全局；投稿接口按 IP 限流，频率由 `SUBMISSION_RATE_LIMIT` AppConfig 项控制（保存设置时热刷新） |
| 密码存储 | `node:crypto` scrypt（`salt:derivedKey` 格式，timing-safe 比较） |
| JWT 密钥 | 从环境变量 `JWT_SECRET` 读取，生产环境必须替换 |
| JWT 即时失效 | 每个管理接口 `onRequest` 钩子查 DB 验证 `disabled` 状态，禁用即时生效 |
| 并发频道封顶 | `MAX_ACTIVE_CHANNELS` AppConfig 项控制，防算力/流量被刷爆 |

---

## 7. API 路由概览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/health` | 无 | 健康检查 |
| GET | `/api/channels` | 无 | 公开频道列表（活跃，含 playState） |
| GET | `/api/channels/:slug` | 无 | 频道详情 + 各输出面 URL + playState |
| GET | `/api/tags` | 无 | 公开标签列表 |
| GET | `/stream/:slug/index.m3u8` | 无 | HLS 播放列表（懒启动触发点） |
| GET | `/stream/:slug/seg_:n.aac` | 无 | HLS 段文件（从 tmpfs 读） |
| GET | `/stream/:slug/audio.aac` | 无 | HTTP 直推流（长连接，懒启动触发点） |
| POST | `/api/submissions` | 无 | 用户投稿（IP 限流 + SSRF 校验） |
| POST | `/admin/login` | 无 | 管理员登录，返回 JWT |
| GET | `/admin/submissions` | JWT | 投稿列表 |
| PATCH | `/admin/submissions/:id/review` | JWT | 审核（approve / approve_as_new / reject + 备注） |
| GET | `/admin/channels` | JWT | 全部频道（含非活跃）；`source` 字段仅 SUPERADMIN 可见 |
| POST | `/admin/channels` | JWT SUPERADMIN | 新建频道 |
| PATCH | `/admin/channels/:id` | JWT SUPERADMIN | 编辑频道信息 |
| PATCH | `/admin/channels/:id/status` | JWT SUPERADMIN | 启用/停用频道 |
| GET | `/admin/channels/:id/runtime` | JWT | 查看频道运行状态 |
| POST | `/admin/channels/:id/start` | JWT SUPERADMIN | 强制启动 |
| POST | `/admin/channels/:id/stop` | JWT SUPERADMIN | 强制停止 |
| POST | `/admin/channels/:id/reset-error` | JWT SUPERADMIN | 重置错误状态 |
| GET | `/admin/channels/:id/source-history` | JWT SUPERADMIN | 频道源变更历史 |
| GET | `/admin/tags` | JWT | 标签列表 |
| POST | `/admin/tags` | JWT SUPERADMIN | 创建标签 |
| PATCH | `/admin/tags/:id` | JWT SUPERADMIN | 修改标签名 |
| DELETE | `/admin/tags/:id` | JWT SUPERADMIN | 删除标签 |
| GET | `/admin/admins` | JWT SUPERADMIN | 管理员列表 |
| POST | `/admin/admins` | JWT SUPERADMIN | 新建管理员 |
| PATCH | `/admin/admins/:id/status` | JWT SUPERADMIN | 启用/禁用管理员 |
| GET | `/admin/settings` | JWT SUPERADMIN | 拉取 AppConfig 全量 |
| PATCH | `/admin/settings` | JWT SUPERADMIN | 部分更新 AppConfig，热刷新依赖模块 |

---

## 8. 环境变量

仅保留与部署/秘密相关的变量；运行时可调参数（限流、HLS 段、空闲超时、并发上限等）已迁入数据库 `AppConfig`，由 `/admin/settings` 管理。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL 连接串，必填 |
| `JWT_SECRET` | — | JWT 签名密钥，必填，生产环境必须随机生成 |
| `PORT` | `3000` | Node 监听端口 |
| `HOST` | `0.0.0.0` | Node 监听地址 |
| `HLS_DIR` | `/dev/shm/nyadio` | tmpfs 路径，存 HLS 段 |
| `LOG_LEVEL` | `info` | pino 日志级别 |
| `NODE_ENV` | `development` | 生产环境设为 `production` |

---

## 9. 演进路径

与 `PROJECTINFO.md` 第 10 节一致，数据库层已就绪，后续：
- yt-dlp 源 → 新增入口适配器分支，处理直播链接刷新
- 直推流听众多 → 该面改推 Icecast，卸载扇出
- HLS 听众多 → 该面改 nginx 静态 + 心跳机制
- 鉴权正式化 → JWT 换 OAuth2 / 第三方登录
- 需要更复杂权限 → AdminUser 表扩展资源级 ACL
