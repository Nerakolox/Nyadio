# 01 — 数据模型

## 总览

```
Channel ──── Source          (1:1)
Channel ──── ChannelTag ──── Tag   (M:N)
Submission ─ AdminUser       (N:1, 审核人)
Submission ─ Channel         (N:1, targetChannelId,可空)
AdminUser                    (独立)
AppConfig                    (独立,键值对全局配置)
```

---

## Channel（频道）

```prisma
model Channel {
  id           String        @id @default(cuid())
  slug         String        @unique          // URL 标识，创建后不可修改
  name         String                         // 显示名称，最多 100 字
  description  String?                        // 简介，最多 500 字
  featured     Boolean       @default(false)  // 首页推荐
  status       ChannelStatus @default(ACTIVE)
  popularity   Float         @default(0)      // 热度（直推流连接累计，每日 ×0.9 衰减）
  lastDecayAt  DateTime      @default(now())  // 上一次衰减计算时间
  source       Source?                        // 一对一
  tags         ChannelTag[]
  submissions  Submission[]                   // 指向本频道的投稿（targetChannelId 反向关系）
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

enum ChannelStatus {
  ACTIVE    // 正常运行
  INACTIVE  // 手动停用
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|---|---|---|
| slug | 唯一字符串 | 小写字母、数字、连字符；用于 URL 路径；不可修改 |
| featured | boolean | true 时出现在首页推荐区块 |
| status | enum | ACTIVE 才能被公开访问和启动 ffmpeg |
| popularity | float | 排序用热度。每次 `/stream/:slug/audio.aac` 新连接 +1；按时间差做指数衰减（`0.9 ^ days`） |
| lastDecayAt | datetime | 上次写入 popularity 时的时间戳，用于按需衰减 |

**衰减规则**

- **写入（新直推流连接）**：使用单条原子 SQL，避免并发覆盖竞态：
  ```sql
  UPDATE "Channel"
  SET
    popularity = popularity
      * POWER(0.9, EXTRACT(EPOCH FROM (NOW() - "lastDecayAt")) / 86400.0)
      + 1,
    "lastDecayAt" = NOW()
  WHERE id = $channelId
  ```
  通过 `prisma.$executeRaw` 调用，单条 UPDATE 在 PostgreSQL 里是原子的，并发多个连接同时触发时每次都正确累加。
- **读取（列表查询）**：不写 DB，仅在 Node 内存里按 `lastDecayAt` 做一次相同公式衰减再排序，保证展示热度准确。
- HLS 听众不计入 popularity（HLS 轮询只更新 `hlsPollerCount` 运行时计数）。

**运行时状态（不进 DB，存内存）**

频道的 ffmpeg 运行状态由内存中的 `ChannelRegistry` 维护，不持久化：

| 字段 | 类型 | 说明 |
|---|---|---|
| state | `'idle' \| 'starting' \| 'running' \| 'error'` | ffmpeg 当前状态 |
| retryCount | number | 当前连续重试次数 |
| lastHeartbeat | Date | 最后一次有效请求时间 |
| listenerCount | number | 当前 HTTP 直推流（`/stream/:slug/audio.aac`）连接数 |
| hlsPollerCount | number | 近 30 秒内 m3u8 请求次数（原始计数，不去重），仅作活跃度信号，不参与排序 |

---

## Source（输入源）

```prisma
model Source {
  id        String       @id @default(cuid())
  channelId String       @unique             // 1:1 外键
  channel   Channel      @relation(fields: [channelId], references: [id], onDelete: Cascade)
  protocol  Protocol
  url       String                           // 原始 URL，已通过 SSRF 校验
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

enum Protocol {
  HLS        // 第三方 m3u8
  ICECAST    // Icecast 挂载点
  HTTP_PUSH  // HTTP 连续流
  // YTDLP — 后期演进，当前不实现
}
```

**说明**

- 每个频道恰好对应 0 或 1 条 Source 记录（1:1 unique）
- 审核投稿通过时，先将旧 Source 写入 `SourceHistory`（见下），再用 `prisma.source.upsert` 覆盖
- 没有独立的 SourceStatus；频道是否启用由 `Channel.status` 决定

---

## SourceHistory（源变更历史）

```prisma
model SourceHistory {
  id          String   @id @default(cuid())
  channelId   String
  channel     Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  protocol    Protocol
  url         String
  replacedBy  String?  // 导致此次替换的 Submission.id，可追溯审核操作
  createdAt   DateTime @default(now())
}
```

**说明**

- 每次 `source.upsert` 覆盖前，将旧 Source 记录插入此表，同一事务内完成
- 不提供公开 API；管理员需追溯时通过 `GET /admin/channels/:id/source-history`（仅 SUPERADMIN）查询
- `onDelete: Cascade`——频道删除时历史记录一并清理，不留悬空数据

---

## Submission（用户投稿）

```prisma
model Submission {
  id              String           @id @default(cuid())
  url             String
  protocol        Protocol
  // 目标频道：二选一（也可都为空，表示投稿者未指定）
  targetChannelId String?                          // 指向已有频道
  targetChannel   Channel?         @relation(fields: [targetChannelId], references: [id], onDelete: SetNull)
  suggestedSlug   String?                          // 建议新建频道的 slug，格式 /^[a-z0-9-]+$/
  suggestedName   String?                          // 建议新建频道的显示名称
  note            String?                          // 托言备注，最多 500 字
  contact         String?                          // 联系方式，最多 100 字
  status          SubmissionStatus @default(PENDING)
  reviewedBy      String?
  reviewer        AdminUser?       @relation(fields: [reviewedBy], references: [id])
  reviewNote      String?                          // 审核备注
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

enum SubmissionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**说明**

- `targetChannelId`、`suggestedSlug`、`suggestedName` 三者互斥：要么填 `targetChannelId`（投稿者从下拉选已有频道），要么填 `suggestedSlug` + `suggestedName`（投稿者建议新建频道），要么三者都为空（未指定）
- 后端在 `POST /api/submissions` 必须做互斥校验
- `targetChannelId` 是真外键（onDelete: SetNull）；若管理员审核前频道被删，字段自动置空，投稿仍然可审
- 审核通过的两种分支：
  - **绑定到现有频道**：管理员在 dialog 选 `channelId`（可与 `targetChannelId` 不同），后端 `source.upsert` 覆盖
  - **采纳建议直接新建**：管理员补全描述/标签/featured 后一键新建频道并绑定 Source，详见 spec/04-submissions.md

---

## AdminUser（管理员）

```prisma
model AdminUser {
  id           String       @id @default(cuid())
  username     String       @unique
  passwordHash String                        // scrypt 格式：salt:derivedKey
  role         AdminRole    @default(MODERATOR)
  disabled     Boolean      @default(false)
  submissions  Submission[]                  // 审核过的投稿
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

enum AdminRole {
  SUPERADMIN
  MODERATOR
}
```

---

## Tag（标签）

```prisma
model Tag {
  id       String       @id @default(cuid())
  name     String       @unique              // 最多 30 字
  channels ChannelTag[]
}

model ChannelTag {
  channelId String
  tagId     String
  channel   Channel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([channelId, tagId])
}
```

---

## AppConfig（全局配置）

```prisma
model AppConfig {
  key       String   @id              // 配置项名称，全大写下划线，如 "MAX_ACTIVE_CHANNELS"
  value     String                    // 统一以字符串存储，读取时按类型 parse
  updatedAt DateTime @updatedAt
}
```

**当前定义的键**（首次部署时由 seed 脚本插入默认值）

| key | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `MAX_ACTIVE_CHANNELS` | int | `20` | 同时活跃 ffmpeg 进程数上限 |
| `HLS_SEGMENT_DURATION` | int | `6` | HLS 每段秒数 |
| `HLS_WINDOW_SIZE` | int | `5` | HLS 滑动窗口段数 |
| `IDLE_TIMEOUT_MS` | int | `30000` | 无连接多久回收 ffmpeg（毫秒） |
| `MAX_RETRY` | int | `3` | ffmpeg 异常退出最大重试次数 |
| `SUBMISSION_RATE_LIMIT` | int | `5` | 投稿接口每 IP 每小时次数上限 |

**读写规则**

- 启动时由 `ConfigStore` 单例从 DB 一次性加载到内存
- 各模块（ChannelRegistry / ffmpeg args / rate-limit / 等）从 `ConfigStore` 同步读取，不直接查 DB
- 管理员通过 `/admin/settings` 保存配置 → 后端 upsert + 调用 `ConfigStore.refresh()` 重新拉一遍 + 通知依赖模块（如 rate-limit 重新注册路由级限流）
- `HLS_SEGMENT_DURATION` / `HLS_WINDOW_SIZE` 改后只对**新启动的 ffmpeg 进程生效**；已运行的频道按旧值继续，下次重启自动应用新值

---

## 关联关系总图

```
AdminUser (1) ──────────────── (N) Submission
                                      │
                               投稿审核通过后
                                      │
                ┌─────────────────────┴──────────────────────┐
                │                                            │
        采纳 targetChannelId                       采纳 suggested* 新建频道
                │                                            │
                ▼                                            ▼
Channel (1) ──── (1) Source ◄─── upsert(覆盖)        新 Channel + 新 Source
                      │
               覆盖前写入
                      ▼
             SourceHistory (N)  ← replacedBy → Submission.id

Channel (N) ──── (N) Tag   (通过 ChannelTag 中间表)

Submission (N) ─── (1) Channel  (targetChannelId 可选外键，onDelete: SetNull)
AppConfig                       (独立键值对，无外键)
```
