# 04 — 投稿与审核

## 流程概述

```
用户填写表单
    │ POST /api/submissions
    ▼
Submission 记录（status=PENDING）
    │
    │ 管理员在 /admin/submissions 审核
    ├─ 拒绝 → status=REJECTED，写 reviewNote
    └─ 通过：管理员选择两种分支之一
         ├─ approve  → 绑定到现有频道（可与投稿者填的 targetChannelId 不同）
         │              source.upsert（覆盖式：有则 update，无则 create）
         │              ChannelRegistry.reload(channelId)
         │
         └─ approve_as_new → 采纳建议直接新建频道
                            事务内创建新 Channel + 新 Source
                            ChannelRegistry.add(newChannel)
```

---

## 公开接口

### POST /api/submissions

限流：按 IP，`SUBMISSION_RATE_LIMIT`（AppConfig）次/小时（默认 5）。

**请求体（绑定已有频道）**

```json
{
  "url": "https://stream.example.com/radio",
  "protocol": "HLS",
  "targetChannelId": "clx_channel_id",
  "note": "这是一个很稳定的爵士乐直播流，已稳定运行两年",
  "contact": "telegram: @username"
}
```

**请求体（建议新建频道）**

```json
{
  "url": "https://stream.example.com/radio",
  "protocol": "HLS",
  "suggestedSlug": "jazz-fm",
  "suggestedName": "Jazz FM",
  "note": "建议新建一个爵士频道",
  "contact": "telegram: @username"
}
```

**字段约束**

| 字段 | 类型 | 必填 | 校验 |
|---|---|---|---|
| url | string | 是 | 合法 URL + SSRF 校验 |
| protocol | enum | 是 | HLS / ICECAST / HTTP_PUSH |
| targetChannelId | string | 否 | 存在性校验（外键），与 suggested* 互斥 |
| suggestedSlug | string | 否 | `/^[a-z0-9-]+$/`，3-50 字符；与 targetChannelId 互斥 |
| suggestedName | string | 否 | 1-100 字；与 targetChannelId 互斥；若填了 suggestedSlug 必填 |
| note | string | 否 | 最多 500 字 |
| contact | string | 否 | 最多 100 字 |

**互斥规则**：`targetChannelId` 与 `suggestedSlug + suggestedName` 二选一，可都为空（投稿者未指定）。同时填两组 → 400。

**响应 201**

```json
{
  "id": "clx...",
  "status": "PENDING",
  "createdAt": "2026-06-07T10:00:00.000Z"
}
```

**错误响应**

| 状态码 | 原因 |
|---|---|
| 400 | URL 格式无效 |
| 400 | URL 包含私网地址（SSRF） |
| 400 | protocol 枚举值无效 |
| 400 | targetChannelId 与 suggested* 同时填 |
| 400 | targetChannelId 指向不存在的频道 |
| 400 | suggestedSlug 格式不合法 |
| 400 | note/contact 超长 |
| 429 | IP 限流触发 |

---

## 管理接口

### GET /admin/submissions

权限：JWT（任意角色）

**查询参数**

| 参数 | 说明 |
|---|---|
| `status` | PENDING / APPROVED / REJECTED，默认 PENDING |
| `page` | 页码，默认 1 |
| `limit` | 每页条数，默认 20，最大 100 |

**响应 200**

```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "clx...",
      "url": "https://stream.example.com/radio",
      "protocol": "HLS",
      "targetChannelId": "clx_channel_id",
      "targetChannel": { "id": "clx_channel_id", "slug": "jazz", "name": "Jazz Radio" },
      "suggestedSlug": null,
      "suggestedName": null,
      "note": "...",
      "contact": "telegram: @username",
      "status": "PENDING",
      "createdAt": "2026-06-07T10:00:00.000Z",
      "reviewer": null,
      "reviewNote": null,
      "reviewedAt": null
    }
  ]
}
```

`targetChannel` 为 null 表示投稿者建议新建（看 `suggestedSlug` / `suggestedName`）或未指定。

### PATCH /admin/submissions/:id/review

权限：JWT（任意角色）

**请求体（绑定已有频道）**

```json
{
  "action": "approve",
  "channelId": "clx_channel_id",
  "reviewNote": "已验证可用，绑定到 jazz 频道"
}
```

**请求体（采纳建议直接新建频道）**

```json
{
  "action": "approve_as_new",
  "newChannel": {
    "slug": "jazz-fm",
    "name": "Jazz FM",
    "description": "全天爵士",
    "tagIds": ["clx_tag_1"],
    "featured": false
  },
  "reviewNote": "采纳建议新建"
}
```

**请求体（拒绝）**

```json
{
  "action": "reject",
  "reviewNote": "URL 无法访问"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| action | 是 | `approve` \| `approve_as_new` \| `reject` |
| channelId | approve 时必填 | 目标频道 ID |
| newChannel | approve_as_new 时必填 | 新频道完整字段，slug 唯一性校验 |
| reviewNote | 否 | 审核备注 |

**响应 200**：`{ "ok": true, "channelId": "clx..." }`（approve_as_new 返回新建的 channelId）

**错误响应**

| 状态码 | 原因 |
|---|---|
| 400 | action 枚举值无效 |
| 400 | approve 时未提供 channelId |
| 400 | approve_as_new 时 newChannel 字段缺失或非法 |
| 404 | 投稿不存在 |
| 404 | channelId 对应频道不存在 |
| 409 | 投稿状态不是 PENDING（已审核过） |
| 409 | approve_as_new 时 newChannel.slug 已存在（含并发竞态兜底） |

**副作用（approve）**

```ts
await prisma.$transaction(async (tx) => {
  // 先把旧 source 存入历史（如果存在）
  await tx.$executeRaw`
    INSERT INTO "SourceHistory" (id, "channelId", protocol, url, "replacedBy", "createdAt")
    SELECT gen_random_uuid(), id, protocol, url, ${id}, NOW()
    FROM "Source" WHERE "channelId" = ${channelId}
  `
  await tx.source.upsert({
    where: { channelId },
    update: { protocol, url },
    create: { channelId, protocol, url },
  })
  await tx.submission.update({
    where: { id },
    data: { status: 'APPROVED', reviewedBy, reviewNote },
  })
})
channelRegistry.reload(channelId)  // 重新加载 Source 到内存
```

**副作用（approve_as_new）**

```ts
// 事务外先做 slug 唯一性预检查，给出可读错误
const existing = await prisma.channel.findUnique({
  where: { slug: newChannel.slug },
  select: { id: true },
})
if (existing) {
  return reply.status(409).send({
    error: `slug "${newChannel.slug}" 已被使用，请修改后重新提交`,
  })
}

// 数据库 unique constraint 保留，兜底极低概率并发竞态（两个管理员同时审核填同一 slug）
const created = await prisma.$transaction(async (tx) => {
  const channel = await tx.channel.create({
    data: {
      slug: newChannel.slug,
      name: newChannel.name,
      description: newChannel.description,
      featured: newChannel.featured,
      tags: { create: newChannel.tagIds.map(tagId => ({ tagId })) },
      source: { create: { protocol: submission.protocol, url: submission.url } },
    },
  })
  await tx.submission.update({
    where: { id },
    data: { status: 'APPROVED', reviewedBy, reviewNote },
  })
  return channel
})
channelRegistry.add(created)  // 新频道写入 Registry，state='idle'
```

> 事务内若仍触发 Prisma P2002（slug unique 冲突），catch 后同样返回 409，不会静默损坏数据。

---

## 前端对接

### 公开投稿页 `/submit`

1. 页面加载时拉取 `GET /api/channels`，填充「目标频道」分支的下拉
2. 表单顶部 radio 切换：「选择已有频道」/「建议新建频道」
   - 选已有频道 → 显示频道下拉，绑定到 `targetChannelId`
   - 选建议新建 → 显示 `suggestedSlug`（带格式提示）+ `suggestedName` 两个文本框
   - 也可不选目标，直接提交（两组字段都为空）
3. 用户提交 → `POST /api/submissions`
4. 201 成功 → 原地替换表单为成功状态，不跳页
5. 400 SSRF → 提示「URL 格式有误或包含不支持的地址」
6. 400 互斥校验失败 → 字段下提示
7. 429 → 提示「投稿过于频繁，请稍后再试」

### 管理审核页 `/admin/submissions`

1. 页面加载时拉取 `GET /admin/submissions?status=PENDING`
2. Tab 切换时拉取对应 status 的列表
3. 点击「通过」→ 弹出 ReviewDialog
   - 顶部展示投稿者填写的目标信息：
     - 若 `targetChannelId` 有值 → 「投稿者建议绑定到：[频道名]」，下拉默认选中该频道
     - 若 `suggestedSlug/Name` 有值 → 「投稿者建议新建频道：[slug] / [name]」，提供「采纳建议」按钮切换到新建模式
     - 都为空 → 直接进入选择已有频道分支
   - 两个分支：
     - **绑定已有频道**：从 `GET /admin/channels` 拉所有频道（已有 Source 的标注「将替换现有源」），选定后 `PATCH ... { action: "approve", channelId }`
     - **采纳建议新建**：填写完整新频道字段（slug、name、description、tagIds、featured），slug 默认填 `suggestedSlug`，提交 `PATCH ... { action: "approve_as_new", newChannel }`
4. 点击「拒绝」→ 弹出简单 dialog，可填拒绝理由 → `PATCH ... { action: "reject", reviewNote }`
5. 成功 → 关闭 dialog，刷新列表
