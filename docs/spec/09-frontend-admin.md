# 09 — 管理台页面

## 公共约定

- 所有管理接口需要 `Authorization: Bearer <token>` 头
- 页面加载时若无 token 或 token 过期（API 返回 401）→ 跳转 `/admin/login`
- 操作成功后刷新对应列表（`queryClient.invalidateQueries`）
- 表单提交使用 dialog，不做全页跳转
- MODERATOR 角色的页面隐藏「需要 SUPERADMIN」的操作按钮（前端隐藏，后端仍做权限校验）

---

## 1. 登录页 `/admin/login`

无需 token。已登录（localStorage 有效 token）时跳转 `/admin/submissions`。

**表单字段**：用户名、密码

**提交逻辑**：`POST /admin/login`，401 → 显示「用户名或密码错误」，200 → 存 token 到 localStorage，跳转 `/admin/submissions`。

---

## 2. 投稿审核页 `/admin/submissions`

**权限**：任意角色

**数据来源**：`GET /admin/submissions?status=<tab>&page=<n>`

**渲染内容**

- 三个 Tab：待审核 / 已通过 / 已拒绝，Tab 上显示 `total` 数量
- 每条投稿展示：URL、协议、目标频道（区分两种情况：`targetChannel` 是已有频道则显示「绑定到 [频道名]」；`suggestedSlug/Name` 有值则显示「建议新建：[slug] / [name]」；都为空显示「未指定」）、备注、联系方式、提交时间
- 待审核 Tab 每条有「通过」和「拒绝」两个操作按钮

**「通过」操作**

1. 点击「通过」→ 弹出 ReviewDialog
2. Dialog 顶部展示投稿者建议（targetChannel / suggested* / 无）
3. 两个分支按钮（默认根据投稿者建议预选）：
   - **「绑定到现有频道」**：拉取 `GET /admin/channels`，下拉选频道（已有 Source 的标注「将替换现有源」）；可填审核备注；提交 `PATCH /admin/submissions/:id/review { action: "approve", channelId, reviewNote }`
   - **「采纳建议直接新建」**：表单同新建频道（slug / name / description / tagIds / featured），slug 默认填 `suggestedSlug`、name 默认填 `suggestedName`；可填审核备注；提交 `PATCH /admin/submissions/:id/review { action: "approve_as_new", newChannel, reviewNote }`
4. 成功 → 关闭 dialog，刷新列表

**「拒绝」操作**

1. 点击「拒绝」→ 弹出简单 dialog，可填写拒绝理由
2. 确认 → `PATCH /admin/submissions/:id/review { action: "reject", reviewNote }`
3. 成功 → 刷新列表

---

## 3. 频道管理页 `/admin/channels`

**权限**：查看任意角色；创建/编辑/状态变更 SUPERADMIN

**数据来源**：`GET /admin/channels`（含所有 ACTIVE/INACTIVE 频道）

**渲染内容**

- 频道列表表格：名称、slug、状态、featured、listener count、操作列
- SUPERADMIN 可见「新建频道」按钮
- 每行操作：编辑（SUPERADMIN）、查看运行时（所有人）、启用/停用（SUPERADMIN）

**新建频道 dialog**（SUPERADMIN）

字段：名称、slug、描述、标签（多选，从 `GET /admin/tags` 获取）、featured

提交：`POST /admin/channels`，201 → 关闭 dialog，刷新列表

**编辑频道 dialog**（SUPERADMIN）

字段同新建，但 slug 不可修改（只读），可修改其他字段包括标签

提交：`PATCH /admin/channels/:id`，200 → 关闭 dialog，刷新列表

**启用/停用**（SUPERADMIN）

`PATCH /admin/channels/:id/status { status: "INACTIVE" | "ACTIVE" }`

---

## 4. 频道运行时 `/admin/channels/:id/runtime`

**权限**：任意角色

可作为独立页面或在频道管理页内嵌 panel 展示。

**数据来源**：`GET /admin/channels/:id/runtime`（人工刷新 + 15s 自动轮询）

**渲染内容**

- 运行时状态字段：state、retryCount、listenerCount、hlsPollerCount、lastHeartbeat
- 关联 Source 信息：协议、URL
- SUPERADMIN 操作按钮：
  - 「手动启动」→ `POST /admin/channels/:id/start`（仅 idle 时可用）
  - 「强制停止」→ `POST /admin/channels/:id/stop`（running/starting 时可用）
  - 「重置错误」→ `POST /admin/channels/:id/reset-error`（error 状态时可用）

---

## 5. 标签管理页 `/admin/tags`

**权限**：查看任意角色；增删改 SUPERADMIN

**数据来源**：`GET /admin/tags`

**渲染内容**

- 标签列表：标签名、频道数（含 INACTIVE）
- SUPERADMIN 可见「新建标签」按钮、每行「编辑」「删除」按钮

**新建/编辑**：inline dialog，字段仅 name，提交后刷新列表

**删除**：确认 dialog（「删除后将移除该标签与所有频道的关联，确定吗？」），确认 → `DELETE /admin/tags/:id`

---

## 6. 管理员管理页 `/admin/admins`

**权限**：仅 SUPERADMIN（其他角色看不到该页面入口）

**数据来源**：`GET /admin/admins`

**渲染内容**

- 管理员列表：用户名、角色、状态（启用/禁用）、创建时间
- 「新建管理员」按钮

**新建管理员 dialog**

字段：用户名、初始密码、角色（SUPERADMIN / MODERATOR）

提交：`POST /admin/admins`，409 → 提示「用户名已存在」

**禁用/启用按钮**

`PATCH /admin/admins/:id/status`，400（试图禁用自己）→ Toast 提示「不能禁用自己」

---

## 7. 系统设置页 `/admin/settings`

**权限**：仅 SUPERADMIN

**数据来源**：`GET /admin/settings`

**渲染内容**

表单形式展示 6 项 AppConfig（详见 spec/01-data-model.md）：

| 字段 | 输入类型 | 校验 |
|---|---|---|
| `MAX_ACTIVE_CHANNELS` | number | 整数，1-1000 |
| `HLS_SEGMENT_DURATION` | number | 整数，2-30 秒 |
| `HLS_WINDOW_SIZE` | number | 整数，3-20 段 |
| `IDLE_TIMEOUT_MS` | number | 整数，5000-600000（5 秒至 10 分钟） |
| `MAX_RETRY` | number | 整数，0-10 |
| `SUBMISSION_RATE_LIMIT` | number | 整数，1-100 |

每个字段下方显示当前值 + 默认值 + 简短说明（如「HLS_SEGMENT_DURATION 改后只对新启动的 ffmpeg 生效」）。

**提交**：`PATCH /admin/settings { key1: value1, key2: value2, ... }`（部分提交）

成功 → Toast「配置已保存并生效」，后端同时刷新 ConfigStore 单例与依赖模块（限流插件等）。

**接口**

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/admin/settings` | JWT SUPERADMIN | 拉取当前 AppConfig 全量 |
| PATCH | `/admin/settings` | JWT SUPERADMIN | 部分更新；body 即键值对 |
