# 07 — 管理员账户管理

## 数据模型

见 `spec/01-data-model.md`，`AdminUser` 表。

---

## 接口

所有接口权限：JWT SUPERADMIN。

### GET /admin/admins

**响应 200**

```json
[
  {
    "id": "clx...",
    "username": "admin",
    "role": "SUPERADMIN",
    "disabled": false,
    "createdAt": "2026-06-07T10:00:00.000Z"
  }
]
```

注意：不返回 `passwordHash`。

### POST /admin/admins

**请求体**

```json
{
  "username": "moderator1",
  "password": "initialPassword123",
  "role": "MODERATOR"
}
```

**校验**

| 字段 | 规则 |
|---|---|
| username | 3-30 字符，唯一，`/^[a-zA-Z0-9_]+$/` |
| password | 最少 8 位 |
| role | SUPERADMIN / MODERATOR |

**响应 201**：返回创建的 AdminUser（不含 passwordHash）。

**错误**：409 username 已存在。

### PATCH /admin/admins/:id/status

**请求体**：`{ "disabled": true }`

**约束**：不能禁用当前登录的自己（通过比较 `req.user.id` 和 `:id`）。

**响应 200**：`{ "ok": true }`

**错误**：400 试图禁用自己；404 不存在。

---

## 初始超级管理员

系统首次部署时无管理员账户，通过 CLI 脚本创建初始 SUPERADMIN：

```bash
pnpm --filter server seed:admin --username admin --password <初始密码>
```

脚本位置：`packages/server/src/scripts/seed-admin.ts`

---

## 前端对接

- `/admin/admins` 页面：展示管理员列表，提供新建和禁用/启用操作
- 新建 dialog：提交 `POST /admin/admins`，成功后刷新列表
- 禁用/启用按钮：`PATCH /admin/admins/:id/status`，400 错误时提示「不能禁用自己」
