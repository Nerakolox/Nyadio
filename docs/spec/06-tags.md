# 06 — 标签

## 数据模型

见 `spec/01-data-model.md`。Tag 与 Channel 多对多，通过 ChannelTag 中间表。

---

## 公开接口

### GET /api/tags

返回所有标签及各自的频道数量（仅统计 ACTIVE 频道）。

**响应 200**

```json
[
  { "id": "clx...", "name": "jazz", "channelCount": 3 },
  { "id": "clx...", "name": "classical", "channelCount": 1 }
]
```

按 `channelCount` 降序排列。

---

## 管理接口

### GET /admin/tags

权限：JWT（任意角色）

与公开接口相同，但 `channelCount` 统计所有频道（含 INACTIVE）。

### POST /admin/tags

权限：JWT SUPERADMIN

**请求体**

```json
{ "name": "electronic" }
```

**校验**：name 最多 30 字，唯一。

**响应 201**

```json
{ "id": "clx...", "name": "electronic", "channelCount": 0 }
```

**错误**：409 name 已存在。

### PATCH /admin/tags/:id

权限：JWT SUPERADMIN

**请求体**：`{ "name": "新名称" }`

**响应 200**：返回更新后的 tag 对象。

**错误**：404 不存在；409 新名称已被其他标签使用。

### DELETE /admin/tags/:id

权限：JWT SUPERADMIN

删除标签及所有 ChannelTag 关联记录（Prisma cascade）。

**响应 200**：`{ "ok": true }`

**错误**：404 不存在。

---

## 前端对接

- `/channels` 页顶部标签云：拉取 `GET /api/tags`，点击跳转 `/tags/:tag`
- `/tags/:tag` 页：拉取 `GET /api/tags` 渲染其他标签导航；拉取 `GET /api/channels?tag=:tag` 渲染频道列表
- `/admin/channels/:id` 编辑表单的标签多选：拉取 `GET /admin/tags` 获取选项
- 管理面标签页 `/admin/tags`：增删改操作后刷新列表
