# 08 — 前台页面

## 公共约定

- 所有公开接口均无需鉴权
- 频道在线状态通过 TanStack Query 轮询刷新（列表页 30s，详情页 15s）
- 加载状态：卡片/内容区显示骨架屏，不显示 spinner
- 错误状态：Toast 提示，不阻断页面渲染

**`playState` 渲染口径**

公开 API 返回的 `playState`（详见 spec/02-channels.md）映射到前端徽章/状态文案：

| playState | 徽章颜色/文案 | 卡片可点击 | 详情页播放器 |
|---|---|---|---|
| `live` | 绿色「直播中」 | 是 | hls.js 自动尝试加载 |
| `preparing` | 黄色「准备中」 | 是（点击进详情等待） | 显示「正在准备中…」，轮询直到变 `live` |
| `unavailable` | 红色「暂不可用」 | 是 | 显示「当前不可用」，不调起播放器 |
| `inactive` | 灰色「已停播」 | 否 | （公开列表不返回 INACTIVE，详情页若直接 hit 到则 404） |

`online` 字段（`true` 当 `playState ∈ {live, preparing}`）只用作排序键和列表筛选，不直接展示。

---

## 1. 首页 `/`

**数据来源**：`GET /api/channels?featured=true`

**渲染内容**

- 项目介绍文案（静态，无 API 请求）
- 精选频道卡片列表（最多 6 个，按服务端排序：在线优先 → 热度 → 字母）
  - 每张卡片：频道名、描述、标签、`playState` 徽章
  - 点击卡片 → `/channel/:slug`
- 「浏览全部频道」按钮 → `/channels`

**在线状态刷新**：30s 轮询 `GET /api/channels?featured=true`，按 `playState` 更新徽章。

---

## 2. 频道列表页 `/channels`

**数据来源**

- `GET /api/tags` → 顶部标签云
- `GET /api/channels` → 频道卡片列表（所有 ACTIVE 频道，不分 featured）

**渲染内容**

- 顶部标签云：所有 tag，按 `channelCount` 降序，点击跳转 `/tags/:tag`
- 频道卡片网格：服务端已按「在线 → 热度 → 字母」排序好，前端按返回顺序渲染
  - 卡片内容同首页精选卡片

**在线状态刷新**：30s 轮询 `GET /api/channels`。

---

## 3. 标签页 `/tags/:tag`

**URL 参数**：`tag` 为标签 name（字符串）

**数据来源**

- `GET /api/tags` → 其他标签导航栏
- `GET /api/channels?tag=:tag` → 对应标签的频道列表

**渲染内容**

- 标题「标签：:tag」
- 其他标签横向导航，可切换至其他标签页
- 频道卡片网格（同频道列表页）

**边界情况**

- 标签不存在（`channelCount = 0` 或 tag 名不存在）：频道列表显示空状态「该标签下暂无频道」，不返回 404 页面
- `GET /api/channels?tag=:tag` 返回 400（tag 名含特殊字符）：展示错误提示

---

## 4. 频道详情页 `/channel/:slug`

**数据来源**

- `GET /api/channels/:slug` → 频道基本信息 + `playState` + `outputs`
- 当 `playState === 'live'` 时加载播放器

**渲染内容**

- 频道名、描述、标签
- `playState` 徽章（15s 轮询 `GET /api/channels/:slug` 更新）
- 播放器区域，按 `playState` 切换：
  - `live` → hls.js 加载 `outputs.hls`，可手动播放（不自动播放，避免浪费带宽）
  - `preparing` → 显示「正在准备中…」，轮询等待 `live` 后切换
  - `unavailable` → 显示「当前不可用」
- 输出面 URL（一键复制按钮）：
  - HLS：`outputs.hls`（形如 `https://your.domain/stream/jazz/index.m3u8`）
  - HTTP 直推流：`outputs.stream`（形如 `https://your.domain/stream/jazz/audio.aac`）

**hls.js 集成**

- 仅当浏览器不原生支持 HLS 时加载 hls.js（通过 `Hls.isSupported()` 判断）
- iOS Safari 原生支持 HLS，直接用 `<audio src="...m3u8">`
- 播放器为 `<audio>` 标签，不需要 `<video>`

**懒启动交互**

- 用户首次访问详情页 → 拉取 `/api/channels/:slug`
- 若 `playState === 'preparing'`：前端不主动触发流请求（避免无效启动），但 15s 轮询继续；当用户点击「播放」按钮时再发起 `/stream/:slug/index.m3u8` 请求触发后端懒启动
- 后端进入 starting → 数秒后变 running，下一次轮询拿到 `live` → 前端切换播放器并重载

---

## 5. 投稿页 `/submit`

**数据来源**：`GET /api/channels`（填充「绑定已有频道」分支的下拉）

**表单字段**

| 字段 | 输入类型 | 校验 |
|---|---|---|
| 源 URL | text | 必填，前端做基本 URL 格式校验 |
| 协议 | select | HLS / ICECAST / HTTP_PUSH，必填 |
| 目标频道（模式选择） | radio | 三选一：「不指定」/「绑定已有频道」/「建议新建频道」 |
| ↳ 已有频道 | select | 模式选「绑定已有频道」时显示，从 ACTIVE 频道列表选 |
| ↳ 建议 slug | text | 模式选「建议新建频道」时显示，校验 `/^[a-z0-9-]+$/`，3-50 字符 |
| ↳ 建议名称 | text | 模式选「建议新建频道」时显示，1-100 字 |
| 备注 | textarea | 选填，最多 500 字，字符计数器 |
| 联系方式 | text | 选填，最多 100 字 |

**提交逻辑**

1. 前端校验通过 → 按模式构造 payload（`targetChannelId` 或 `suggestedSlug + suggestedName`，或都不填）→ `POST /api/submissions`
2. 201 成功 → 原地替换表单为成功提示卡片（「感谢投稿，管理员将尽快审核」），不跳页
3. 400 错误 → 对应字段下显示错误消息
4. 429 → Toast 提示「投稿过于频繁，请稍后再试」
