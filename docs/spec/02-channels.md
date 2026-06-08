# 02 — 频道

## 职责范围

频道（Channel）是系统的核心实体，负责：
- 持久化频道配置（DB）
- 维护运行时状态（内存 ChannelRegistry）
- 对外暴露 CRUD 接口（公开读 + 管理写）

---

## 数据流

```
DB (Channel + Source)
    │ 启动时加载 / 审核通过时更新
    ▼
ChannelRegistry (内存 Map<slug, ChannelEntry>)
    │ 首次请求时懒启动
    ▼
ffmpeg 子进程  →  详见 spec/03-ffmpeg.md
```

---

## ChannelRegistry

`packages/server/src/channels/registry.ts`

进程内单例 Map，key 为 `slug`，value 为 `ChannelEntry`：

```ts
interface ChannelEntry {
  channel: Channel          // DB 快照（含 Source）
  state: 'idle' | 'starting' | 'running' | 'error'
  retryCount: number        // 当前连续重试次数，运行正常时归零
  lastHeartbeat: Date       // 最后一次有效请求时间
  listenerCount: number     // 当前 HTTP 直推流连接数
  hlsPollerCount: number    // 近 30 秒内 m3u8 请求次数（原始计数，不去重）
  process: FfmpegProcess | null
}
```

**启动时初始化**：从 DB 加载所有 `status=ACTIVE` 的 Channel（含 Source），写入 Registry，state 初始为 `'idle'`。

**重启恢复**：PM2 重启后 Registry 重新从 DB 初始化，ffmpeg 进程不自动恢复（等待下一次请求触发懒启动）。

---

## 频道生命周期

### 懒启动

触发条件：收到 `/stream/:slug/index.m3u8` 或 `/stream/:slug/audio.aac` 请求，且当前 state 为 `'idle'`。

```
请求进入
  │
  ├─ slug 不在 Registry → 404
  ├─ channel.status = INACTIVE → 503 {"error": "频道已停用"}
  ├─ channel.status = ACTIVE, state = 'error' → 503 {"error": "频道异常，等待管理员处理"}
  ├─ state = 'idle' → 触发启动，将 state 改为 'starting'，等待就绪后响应
  ├─ state = 'starting' → 排队等待，复用同一次启动
  └─ state = 'running' → 直接响应
```

启动超时：15 秒内 ffmpeg 未产出第一个 HLS 段或管道数据 → 视为启动失败，进入重试逻辑。

### 心跳与回收

每次收到以下请求时刷新 `lastHeartbeat`：
- HLS 播放列表轮询 `GET /stream/:slug/index.m3u8`（同时 `hlsPollerCount` +1，30 秒后自动衰减）
- HLS 段请求 `GET /stream/:slug/seg_*.aac`
- HTTP 直推流建立连接 `GET /stream/:slug/audio.aac`（连接持续期间视为持续心跳；新建立连接时同时给 `Channel.popularity` 衰减后 +1）

空闲检测：每 10 秒扫描一次 Registry，对所有 `state=running` 的频道检查：

```
now - lastHeartbeat > IDLE_TIMEOUT_MS (默认 30000)
  AND listenerCount === 0
    → 回收 ffmpeg，state 改为 'idle'，retryCount 归零
```

### 自动重试

ffmpeg 进程异常退出（exit code ≠ 0）时：

```
retryCount < MAX_RETRY (默认 3)
  → retryCount++，等待 2^retryCount 秒后重启（指数退避：2s / 4s / 8s）

retryCount >= MAX_RETRY
  → state 改为 'error'，停止重试
  → 等待管理员在后台手动 reset-error 或 start
```

> `IDLE_TIMEOUT_MS` 与 `MAX_RETRY` 从 AppConfig 读取（见 spec/01-data-model.md），运行时由 ConfigStore 单例提供。

---

## 公开接口

### GET /api/channels

返回所有 `status=ACTIVE` 的频道列表。

**响应 200**

```json
[
  {
    "id": "clx...",
    "slug": "jazz",
    "name": "Jazz Radio",
    "description": "全天候爵士乐直播",
    "featured": false,
    "tags": ["jazz", "instrumental"],
    "online": true,
    "playState": "live",
    "listenerCount": 3
  }
]
```

**字段说明**

| 字段 | 说明 |
|---|---|
| `online` | `true` 当 `state ∈ {running, starting}`；否则 `false` |
| `playState` | 对外播放状态枚举，`'live' \| 'preparing' \| 'unavailable' \| 'inactive'`（详见下表） |
| `listenerCount` | 当前直推流长连接数（不含 HLS 听众） |

**`playState` 映射**

| playState | 触发条件 | 前端语义 |
|---|---|---|
| `live` | 内部 `state === 'running'` | 可立即播放 |
| `preparing` | 内部 `state ∈ {idle, starting}` 且 `Channel.status = ACTIVE` | 正在准备中，请稍候 |
| `unavailable` | 内部 `state === 'error'` | 当前不可用，等待管理员处理 |
| `inactive` | `Channel.status = INACTIVE`（仅在管理面看到，公开列表不返回 INACTIVE） | 已停播 |

**排序**：服务端排序，规则：**在线优先（`online = true`）→ 热度（`Channel.popularity` 现场衰减后降序）→ 名称字母序**。

> 「在线」包含 `running` 和 `starting`，与 `online` 字段口径一致。
> 「热度」按 `Channel.popularity` 字段，每天指数衰减 ×0.9，每次直推流新连接 +1（详见 spec/01-data-model.md）。HLS 听众不计入热度。

**查询参数**

| 参数 | 说明 |
|---|---|
| `featured=true` | 仅返回 featured 频道（首页预览用） |
| `tag=:tagName` | 按标签筛选 |

### GET /api/channels/:slug

**响应 200**

```json
{
  "id": "clx...",
  "slug": "jazz",
  "name": "Jazz Radio",
  "description": "全天候爵士乐直播",
  "featured": false,
  "tags": ["jazz", "instrumental"],
  "online": true,
  "playState": "live",
  "listenerCount": 3,
  "outputs": {
    "hls": "https://example.com/stream/jazz/index.m3u8",
    "stream": "https://example.com/stream/jazz/audio.aac"
  }
}
```

**响应 404**：slug 不存在或 `Channel.status = INACTIVE`（公开接口对 INACTIVE 一律 404，不暴露其存在）。

---

## 管理接口

### GET /admin/channels

权限：JWT（任意角色）

返回所有频道（含 INACTIVE），附运行时状态。**`source` 字段仅 SUPERADMIN 可见**，MODERATOR 响应中该字段为 `null`。

**响应 200（SUPERADMIN）**

```json
[
  {
    "id": "clx...",
    "slug": "jazz",
    "name": "Jazz Radio",
    "description": "...",
    "featured": false,
    "status": "ACTIVE",
    "tags": ["jazz"],
    "source": { "protocol": "HLS", "url": "https://..." },
    "runtime": {
      "state": "running",
      "retryCount": 0,
      "lastHeartbeat": "2026-06-07T10:00:00.000Z",
      "listenerCount": 3,
      "hlsPollerCount": 4
    }
  }
]
```

**响应 200（MODERATOR）**

同上，但 `"source": null`。

### POST /admin/channels

权限：JWT SUPERADMIN

**请求体**

```json
{
  "slug": "jazz",
  "name": "Jazz Radio",
  "description": "全天候爵士乐直播",
  "sourceUrl": "https://stream.example.com/jazz",
  "sourceProtocol": "HLS",
  "tagIds": ["clx_tag_1"],
  "featured": false
}
```

**校验**
- slug：`/^[a-z0-9-]+$/`，唯一
- sourceUrl：SSRF 校验
- sourceProtocol：枚举值

**响应 201**：返回创建的 Channel 完整对象（含 Source）。

**副作用**：写入 ChannelRegistry，state 为 `'idle'`。

### PATCH /admin/channels/:id

权限：JWT SUPERADMIN

可修改字段：`name`、`description`、`featured`、`tagIds`。slug 和 source 不可通过此接口修改。

**响应 200**：返回更新后的 Channel 对象。

### PATCH /admin/channels/:id/status

权限：JWT SUPERADMIN

**请求体**

```json
{ "status": "INACTIVE" }
```

INACTIVE 时同时回收该频道的 ffmpeg（若在运行）。

**响应 200**：`{ "ok": true }`

### GET /admin/channels/:id/runtime

权限：JWT（任意角色）

**响应 200**

```json
{
  "state": "running",
  "retryCount": 0,
  "lastHeartbeat": "2026-06-07T10:00:00.000Z",
  "listenerCount": 3,
  "hlsPollerCount": 1,
  "idleSecondsRemaining": null
}
```

`idleSecondsRemaining`：null 表示有活跃连接，数字表示距自动回收剩余秒数。

### POST /admin/channels/:id/start

权限：JWT SUPERADMIN

强制启动 ffmpeg，不等待心跳触发。

**响应 200**：`{ "ok": true }` 或 `{ "error": "已在运行" }`

### POST /admin/channels/:id/stop

权限：JWT SUPERADMIN

强制停止 ffmpeg，state 改为 `'idle'`，retryCount 归零。

**响应 200**：`{ "ok": true }`

### POST /admin/channels/:id/reset-error

权限：JWT SUPERADMIN

将 `state=error` 重置为 `'idle'`，retryCount 归零，允许下次请求重新触发懒启动。

**响应 200**：`{ "ok": true }` 或 `{ "error": "当前状态不是 error" }`

### GET /admin/channels/:id/source-history

权限：JWT SUPERADMIN

返回该频道的源变更历史，按时间倒序排列。

**响应 200**

```json
[
  {
    "id": "clx...",
    "protocol": "HLS",
    "url": "https://old-stream.example.com/jazz",
    "replacedBy": "clx_submission_id",
    "createdAt": "2026-06-07T09:00:00.000Z"
  }
]
```

`replacedBy` 为触发此次替换的 Submission.id，可关联到 `/admin/submissions` 追溯审核操作。列表为空表示该频道 Source 从未被覆盖过。

---

## 边界条件

| 情况 | 处理 |
|---|---|
| 请求一个 INACTIVE 频道的 m3u8 | 503，不启动 ffmpeg |
| `MAX_ACTIVE_CHANNELS`（AppConfig）已满，新请求触发启动 | 429 `{"error": "活跃频道数已达上限"}` |
| 创建频道时 slug 已存在 | 409 `{"error": "slug 已被使用"}` |
| 停用频道时 ffmpeg 正在运行 | 先发 SIGTERM，等待 5 秒，若未退出发 SIGKILL |
| slug 命中保留前缀（`api`、`admin`、`stream`、`health`） | 后端不会有冲突（流路径已在 `/stream/:slug/*` 下，前端 SPA 路由也独立），但建议在 slug 校验时拒绝这几个名字以避免心智混乱 |
