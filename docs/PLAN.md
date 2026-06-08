# Nyadio 分批开发计划

## Context

项目是多协议音频聚合中转枢纽，后端 Fastify + Prisma + PostgreSQL，前端 React + Vite + TanStack Query，ffmpeg 做流处理。spec 文档已完整，需要把 12 个前端页面和对应后端 API 拆成 4 个独立可交付的批次，每批次内聚、可独立验收。

---

## 批次总览

| 批次 | 模块 | 核心交付 |
|---|---|---|
| P1 | 基础设施 + 频道管理 | DB schema、ConfigStore、ChannelRegistry、ffmpeg 流处理、频道 CRUD API、管理面频道页 |
| P2 | 流媒体公开面 | /stream 路由、公开 API、前端公开 5 页 |
| P3 | 投稿与审核 | 投稿 API、审核 API、前端投稿页 + 审核队列页 |
| P4 | 用户与系统设置 | 管理员账户 API、AppConfig 设置 API、前端管理员页 + 系统设置页 |

P2 / P3 / P4 均依赖 P1 完成，三者之间可并行。

---

## P1 — 基础设施 + 频道管理

### 数据模型

文件：`packages/server/prisma/schema.prisma`

需建表：
- `Channel`（id, slug unique, name, description, featured, status, popularity, lastDecayAt, createdAt, updatedAt）
- `Source`（id, channelId unique FK→Channel cascade, protocol, url, createdAt, updatedAt）
- `SourceHistory`（id, channelId FK→Channel cascade, protocol, url, replacedBy nullable, createdAt）
- `Tag`（id, name unique）
- `ChannelTag`（channelId, tagId, 复合主键，两端 cascade）
- `AdminUser`（id, username unique, passwordHash, role, disabled, createdAt, updatedAt）
- `AppConfig`（key PK, value, updatedAt）

枚举：`Protocol`（HLS/ICECAST/HTTP_PUSH）、`ChannelStatus`（ACTIVE/INACTIVE）、`AdminRole`（SUPERADMIN/MODERATOR）

迁移命令：`pnpm --filter server prisma migrate dev`

Seed 脚本：
- `packages/server/src/scripts/seed-config.ts` — 写入 AppConfig 6 项默认值
- `packages/server/src/scripts/seed-admin.ts` — 创建初始 SUPERADMIN

### 约束
- `slug` 创建后不可修改，唯一，格式 `/^[a-z0-9-]+$/`
- `slug` 不得为保留词：`api`、`admin`、`stream`、`health`
- `Source` 1:1 频道，通过 channelId unique 保证
- `AppConfig.value` 统一字符串存储，读取时按类型 parse

### 后端

**ConfigStore 单例**（`packages/server/src/config/store.ts`）
- 启动时从 DB 加载全部 AppConfig 到内存 Map
- 提供 `get(key): string`、`getInt(key): number` 方法
- `refresh()` 方法重新从 DB 拉取并通知依赖模块

**ChannelRegistry 单例**（`packages/server/src/channels/registry.ts`）
- 内存 Map<slug, ChannelEntry>，启动时加载所有 ACTIVE Channel（含 Source）
- ChannelEntry 结构：`{ channel, state, retryCount, lastHeartbeat, listenerCount, hlsPollerCount, process }`
- 方法：`get(slug)`、`add(channel)`、`reload(channelId)`、`remove(slug)`

**频道生命周期**（`packages/server/src/channels/lifecycle.ts`）
- 懒启动：`state=idle` 收到流请求时触发，改为 `starting`，启动 ffmpeg，15s 超时视为失败
- 心跳：每次 /stream 请求刷新 `lastHeartbeat`
- 空闲回收：每 10s 扫描，`now - lastHeartbeat > IDLE_TIMEOUT_MS AND listenerCount=0` → 回收，state→idle
- 重试：ffmpeg 异常退出 → 指数退避（2^n 秒）重启，超过 MAX_RETRY → state=error

**ffmpeg 模块**
- `packages/server/src/ffmpeg/process.ts` — FfmpegProcess 类，启动/SIGTERM/SIGKILL（5s 超时后 KILL）
- `packages/server/src/ffmpeg/args.ts` — 按协议和 AppConfig 组装参数数组（永不拼字符串）
- `packages/server/src/ffmpeg/tee.ts` — 构造 tee 输出字符串

ffmpeg 参数模板（HLS + 直推流双路）：
```
ffmpeg -re -i <url> -map 0:a -c:a aac -b:a 128k -ar 44100
  -f tee "[f=hls:hls_time=X:hls_list_size=Y:hls_flags=delete_segments+append_list:hls_segment_filename=<HLS_DIR>/<slug>/seg_%05d.aac]<HLS_DIR>/<slug>/index.m3u8|[f=adts]pipe:1"
```

**输出面**
- `packages/server/src/outputs/hls.ts` — 确保 tmpfs 目录存在，响应 m3u8 和段文件，ffmpeg 停止后清理目录
- `packages/server/src/outputs/stream.ts` — StreamBroadcaster：attach/detach ffmpeg stdout，addClient/removeClient HTTP 长连接

**SSRF 校验**（`packages/server/src/security/ssrf.ts`）
- async `validateUrl(raw): Promise<URL>`
- IP 直接段匹配；域名用 `node:dns` resolve4/6 预解析，命中私网段抛 SSRF_BLOCKED，解析失败抛 DNS_RESOLVE_FAILED
- 仅允许 http/https

**鉴权中间件**（`packages/server/src/routes/auth.ts`）
- `onRequest` 钩子：jwtVerify → 查 DB 验 disabled → 挂 req.user（含最新 role）
- SUPERADMIN 专属路由额外校验 role

**频道管理 API**（`packages/server/src/routes/admin/channels.ts`）

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | /admin/login | 无 | 登录，返回 JWT（8h）；同 IP 限 10 次/分钟 |
| GET | /admin/channels | JWT | 全部频道含运行时；source 字段 MODERATOR 返回 null |
| POST | /admin/channels | JWT SUPERADMIN | 新建频道，slug 唯一+保留词校验，SSRF 校验 source URL，写 Registry |
| PATCH | /admin/channels/:id | JWT SUPERADMIN | 编辑 name/description/featured/tagIds |
| PATCH | /admin/channels/:id/status | JWT SUPERADMIN | 启用/停用；停用时回收 ffmpeg |
| GET | /admin/channels/:id/runtime | JWT | 运行时快照（state/retryCount/lastHeartbeat/listenerCount/idleSecondsRemaining） |
| POST | /admin/channels/:id/start | JWT SUPERADMIN | 强制启动 |
| POST | /admin/channels/:id/stop | JWT SUPERADMIN | 强制停止，state→idle |
| POST | /admin/channels/:id/reset-error | JWT SUPERADMIN | state=error → idle，retryCount 归零 |
| GET | /admin/channels/:id/source-history | JWT SUPERADMIN | 源变更历史，时间倒序 |

**标签 API**（`packages/server/src/routes/admin/tags.ts`）

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | /admin/tags | JWT |
| POST | /admin/tags | JWT SUPERADMIN |
| PATCH | /admin/tags/:id | JWT SUPERADMIN |
| DELETE | /admin/tags/:id | JWT SUPERADMIN |

### 前端

页面：`/admin/login`、`/admin/channels`、`/admin/channels/:id`、`/admin/tags`

**`/admin/login`**（`packages/web/src/pages/admin/LoginPage.tsx`）
- 用户名 + 密码表单，POST /admin/login，成功写 localStorage `nyadio_admin_token`，跳 /admin/channels
- 401 显示「用户名或密码错误」，429 显示「登录过于频繁」

**`/admin/channels`**（`packages/web/src/pages/admin/ChannelsPage.tsx`）
- GET /admin/channels 拉列表，展示 slug/名称/标签/运行状态（绿点=running、黄点=starting、红点=error、灰点=idle/inactive）
- 新建频道 Dialog（slug/name/description/sourceUrl/sourceProtocol/tagIds/featured）
- 启用/停用按钮
- 点击行跳 /admin/channels/:id

**`/admin/channels/:id`**（`packages/web/src/pages/admin/ChannelDetailPage.tsx`）
- 编辑表单（name/description/featured/tags），slug 只读展示
- 运行状态面板：state/retryCount/lastHeartbeat/listenerCount，轮询 GET .../runtime（10s）
- 强制启动/停止/重置错误按钮

**`/admin/tags`**（`packages/web/src/pages/admin/TagsPage.tsx`）
- 标签列表，新建/改名/删除操作

**共用**
- `packages/web/src/api/client.ts` — fetch 封装，自动附 Authorization header，401 时清 token 跳登录
- `packages/web/src/api/admin/` — TanStack Query hooks：useAdminChannels、useChannelRuntime、useAdminTags 等

### 验收
- `POST /admin/channels` 创建频道后，访问 `/stream/:slug/index.m3u8` 触发懒启动，ffmpeg 进程可观察到
- 停用频道后 GET /admin/channels 该频道 status=INACTIVE，ffmpeg 进程已回收
- 管理员登录后能看到频道列表，MODERATOR 看不到 source.url

---

## P2 — 流媒体公开面

### 依赖
P1 完成（ChannelRegistry、ffmpeg、HLS/直推流输出面已就绪）

### 后端

**流路由**（`packages/server/src/routes/stream.ts`）

| 路径 | 说明 |
|---|---|
| GET /stream/:slug/index.m3u8 | 触发懒启动，从 tmpfs 读 m3u8，刷新心跳 |
| GET /stream/:slug/seg_:n.aac | 从 tmpfs 读段文件，刷新心跳 |
| GET /stream/:slug/audio.aac | HTTP 直推流长连接，触发懒启动，popularity 原子更新 |

m3u8 响应头：`Content-Type: application/vnd.apple.mpegurl, Cache-Control: no-cache, Access-Control-Allow-Origin: *`
段响应头：`Content-Type: audio/aac, Cache-Control: max-age=60, Access-Control-Allow-Origin: *`
直推流响应头：`Content-Type: audio/aac, Transfer-Encoding: chunked, Cache-Control: no-cache, X-Content-Type-Options: nosniff`

popularity 原子 SQL（每次 /stream/:slug/audio.aac 新连接）：
```sql
UPDATE "Channel"
SET popularity = popularity * POWER(0.9, EXTRACT(EPOCH FROM (NOW() - "lastDecayAt")) / 86400.0) + 1,
    "lastDecayAt" = NOW()
WHERE id = $channelId
```

边界：slug 不在 Registry → 404；INACTIVE → 503；state=error → 503；MAX_ACTIVE_CHANNELS 已满 → 429

**公开频道 API**（`packages/server/src/routes/api/channels.ts`）

| 路径 | 说明 |
|---|---|
| GET /api/channels | 所有 ACTIVE 频道，支持 ?featured=true 和 ?tag=:name 筛选，服务端排序（在线→热度→字母，热度内存衰减） |
| GET /api/channels/:slug | 频道详情 + outputs（hls/stream 完整 URL）+ playState；INACTIVE → 404 |
| GET /api/tags | 标签列表，含 channelCount |
| GET /health | 健康检查 |

playState 映射：running→live，idle/starting→preparing，error→unavailable，INACTIVE→inactive

### 前端

**`/`**（`packages/web/src/pages/public/HomePage.tsx`）
- GET /api/channels?featured=true，渲染最多 6 张频道卡片
- 静态项目介绍文案，NetMusic 接入说明
- 「浏览全部频道」→ /channels
- 30s 轮询更新 playState 徽章

**`/channels`**（`packages/web/src/pages/public/ChannelsPage.tsx`）
- GET /api/tags + GET /api/channels，标签云 + 频道卡片网格
- 30s 轮询
- 标签云点击 → /tags/:tag

**`/tags/:tag`**（`packages/web/src/pages/public/TagPage.tsx`）
- GET /api/channels?tag=:tag + GET /api/tags（导航栏）
- 空状态：「该标签下暂无频道」（不 404）

**`/channel/:slug`**（`packages/web/src/pages/public/ChannelDetailPage.tsx`）
- GET /api/channels/:slug，15s 轮询
- hls.js 集成：`Hls.isSupported()` 判断，iOS Safari 用原生 `<audio src>`
- 用户点击播放时才发起 /stream/:slug/index.m3u8（触发懒启动，不提前）
- preparing 状态显示「正在准备中」，轮询变 live 后切换播放器
- HLS URL + 直推流 URL 一键复制（Clipboard API + 降级）

**频道卡片组件**（`packages/web/src/components/ChannelCard.tsx`）
- playState 徽章：绿「直播中」/ 黄「准备中」/ 红「暂不可用」
- 骨架屏加载态

### 约束
- 直推流连接计入 listenerCount 和 popularity；HLS 轮询只更新 hlsPollerCount，不计热度
- 公开列表不返回 INACTIVE 频道；/api/channels/:slug 若 INACTIVE 一律 404

### 验收
- 浏览器访问 /channel/:slug，点播放，ffmpeg 进程启动，音频可播
- VLC 打开 /stream/:slug/audio.aac 可连续播放
- 30s 空闲后 ffmpeg 自动回收（listenerCount=0 且无 HLS 轮询）
- /channels 标签云正确，点击标签只显示对应频道

---

## P3 — 投稿与审核

### 依赖
P1 完成（Channel、AdminUser、鉴权中间件就绪）

### 数据模型

`Submission` 表（P1 的 schema.prisma 里已全量定义，P3 激活相关路由）

字段：url, protocol, targetChannelId（可空 FK SetNull）, suggestedSlug, suggestedName, note, contact, status, reviewedBy, reviewNote, createdAt, updatedAt

互斥约束（后端校验，非 DB 约束）：targetChannelId 与 suggestedSlug+suggestedName 二选一，不可同时填

### 后端

**投稿 API**（`packages/server/src/routes/api/submissions.ts`）

`POST /api/submissions`
- 限流：`SUBMISSION_RATE_LIMIT`（AppConfig）次/小时/IP
- 校验：url 经 validateUrl（async SSRF）；protocol 枚举；互斥规则；suggestedSlug 格式 /^[a-z0-9-]+$/ 且 3-50 字符；note≤500；contact≤100
- targetChannelId 存在性校验（查 DB）
- 响应 201：`{ id, status: "PENDING", createdAt }`
- 错误：400 各字段，429 限流

**审核 API**（`packages/server/src/routes/admin/submissions.ts`）

`GET /admin/submissions`
- 权限：JWT（任意角色）
- 参数：status（默认 PENDING）、page（默认 1）、limit（默认 20，最大 100）
- 返回：`{ total, page, limit, items }`，items 含 targetChannel 关联对象

`PATCH /admin/submissions/:id/review`
- 权限：JWT（任意角色）
- action=approve：校验 channelId 存在 → 事务内先写 SourceHistory → source.upsert → submission.update → channelRegistry.reload
- action=approve_as_new：事务外先查 slug 唯一性（409 可读报错）→ 事务内 channel.create + source.create + submission.update → channelRegistry.add；事务内 unique constraint 兜底并发竞态
- action=reject：submission.update status=REJECTED + reviewNote
- 409：投稿非 PENDING 状态

### 前端

**`/submit`**（`packages/web/src/pages/public/SubmitPage.tsx`）
- GET /api/channels 填充「绑定已有频道」下拉
- 表单 radio 三选一：不指定 / 绑定已有 / 建议新建
- 前端基本 URL 格式校验，协议 select
- 成功后原地替换为成功卡片，不跳页
- 400 SSRF → 字段下提示「URL 格式有误或包含不支持的地址」；429 → Toast

**`/admin/submissions`**（`packages/web/src/pages/admin/SubmissionsPage.tsx`）
- Tab：PENDING / APPROVED / REJECTED，切换时重新拉取
- 「通过」→ ReviewDialog（展示投稿者意图，支持「绑定已有」和「采纳建议新建」两个分支）
- 「拒绝」→ 简单 Dialog，可填拒绝理由
- 操作成功后关 Dialog，刷新列表

### 验收
- 公开页提交投稿，DB 里出现 PENDING 记录
- MODERATOR 登录能审核通过/拒绝
- approve 后 source.url 已更新，SourceHistory 有一条记录
- approve_as_new 后新频道出现在 /admin/channels 列表
- 超过限流次数返回 429；提交私网 IP URL 返回 400

---

## P4 — 管理员账户 + 系统设置

### 依赖
P1 完成（AdminUser 表、鉴权就绪）

### 后端

**管理员账户 API**（`packages/server/src/routes/admin/admins.ts`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/admins | 列表，不含 passwordHash |
| POST | /admin/admins | 新建：username(3-30, /^[a-zA-Z0-9_]+$/，唯一), password(≥8位), role；scrypt 哈希 |
| PATCH | /admin/admins/:id/status | disabled toggle；不能禁用自己（req.user.id === :id） |

**系统设置 API**（`packages/server/src/routes/admin/settings.ts`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/settings | 返回全部 AppConfig 键值 |
| PATCH | /admin/settings | 部分 upsert；保存后调 ConfigStore.refresh() 热刷新依赖模块 |

AppConfig 6 项：MAX_ACTIVE_CHANNELS(int)、HLS_SEGMENT_DURATION(int)、HLS_WINDOW_SIZE(int)、IDLE_TIMEOUT_MS(int)、MAX_RETRY(int)、SUBMISSION_RATE_LIMIT(int)

HLS_SEGMENT_DURATION / HLS_WINDOW_SIZE 改后只对新启动 ffmpeg 生效，已运行频道不受影响。

### 前端

**`/admin/admins`**（`packages/web/src/pages/admin/AdminsPage.tsx`）
- 管理员列表：username/role/disabled/createdAt
- 新建 Dialog：username + password + role
- 禁用/启用按钮，禁用自己时 disabled + tooltip
- 409 username 冲突时表单下报错

**`/admin/settings`**（`packages/web/src/pages/admin/SettingsPage.tsx`）
- GET /admin/settings 加载当前值，6 项 number input
- 每项注明含义和生效时机
- PATCH /admin/settings 保存，成功 Toast「设置已保存」

### 验收
- SUPERADMIN 创建 MODERATOR，MODERATOR 登录只能访问审核队列
- 禁用账户后 JWT 下次请求立即 401，不等 8h 过期
- 修改 IDLE_TIMEOUT_MS 后 ConfigStore 立即更新
- 修改 SUBMISSION_RATE_LIMIT 后限流热刷新生效

---

## 全局约束

- 所有用户提交的 URL 必须经过 `validateUrl`（async，含 DNS 预解析）
- ffmpeg 调用永远用 execa 数组参数，不拼字符串
- 管理接口每次 onRequest 查 DB 验 disabled，不依赖 token 缓存
- slug 保留词：api、admin、stream、health
- ChannelRegistry 是进程内单例，PM2 必须 fork 模式单实例
- HLS 段存 tmpfs（HLS_DIR env），不进 DB，频道停止后清理

---

## 文件结构

```
packages/server/src/
├── config/store.ts
├── channels/registry.ts + lifecycle.ts
├── ffmpeg/process.ts + args.ts + tee.ts
├── outputs/hls.ts + stream.ts
├── adapters/hls.ts + icecast.ts + http-push.ts
├── security/ssrf.ts
├── routes/
│   ├── api/channels.ts + submissions.ts + tags.ts
│   ├── admin/channels.ts + submissions.ts + tags.ts + admins.ts + settings.ts
│   ├── stream.ts
│   └── auth.ts
├── db/client.ts
└── scripts/seed-admin.ts + seed-config.ts

packages/web/src/
├── api/client.ts + admin/ + public/
├── components/ChannelCard.tsx + ...
└── pages/
    ├── public/HomePage + ChannelsPage + TagPage + ChannelDetailPage + SubmitPage
    └── admin/LoginPage + ChannelsPage + ChannelDetailPage + TagsPage + SubmissionsPage + AdminsPage + SettingsPage
```
