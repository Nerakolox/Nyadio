# 05 — 鉴权

## 机制

管理接口使用 JWT Bearer Token 鉴权。投稿接口和公开读接口无需鉴权。

---

## 登录流程

```
POST /admin/login { username, password }
    │
    ├─ AdminUser 不存在 → 401
    ├─ AdminUser.disabled = true → 401
    ├─ scrypt 校验失败 → 401
    └─ 校验通过
           │
           ▼
       app.jwt.sign({ id, role }, { expiresIn: '8h' })
           │
           ▼
       返回 { token }
```

JWT payload：

```json
{ "id": "clx...", "role": "SUPERADMIN", "iat": 1234567890, "exp": 1234596890 }
```

---

## 接口

### POST /admin/login

无需鉴权。

**请求体**

```json
{ "username": "admin", "password": "secret" }
```

**响应 200**

```json
{ "token": "eyJ..." }
```

**错误响应**

| 状态码 | 原因 |
|---|---|
| 400 | 请求体字段缺失 |
| 401 | 用户名/密码错误，或账户已禁用（统一返回「用户名或密码错误」，不区分） |
| 429 | 登录限流（防暴力破解，同 IP 每分钟最多 10 次） |

---

## 权限校验

每个管理接口在 `onRequest` 钩子中：

1. `req.jwtVerify()` → Token 无效 / 过期 → 401
2. **每次都查 DB** 验证账户当前状态：
   - `prisma.adminUser.findUnique({ where: { id: req.user.id } })`
   - 用户不存在 → 401（账户已删除）
   - `disabled = true` → 401（账户已禁用，**即时生效**）
3. 把最新的 `role` 挂在 `req.user.role`（防止 Token 中的 role 与 DB 不一致；后续以 DB 为准）

> 设计取舍：每次查 DB 多一次往返，但管理接口本来就是低频操作，性能开销可忽略；换来踢人即时生效，避免「被盗号 / 被解雇的管理员手里的 token 还能用 8 小时」这种安全漏洞。

SUPERADMIN 专属接口在校验完账户状态后额外校验 `req.user.role === 'SUPERADMIN'`，否则返回 403。

**权限矩阵**

| 接口 | MODERATOR | SUPERADMIN |
|---|---|---|
| GET /admin/submissions | ✓ | ✓ |
| PATCH /admin/submissions/:id/review | ✓ | ✓ |
| GET /admin/channels | ✓ | ✓ |
| GET /admin/channels/:id/runtime | ✓ | ✓ |
| POST /admin/channels | ✗ | ✓ |
| PATCH /admin/channels/:id | ✗ | ✓ |
| PATCH /admin/channels/:id/status | ✗ | ✓ |
| POST /admin/channels/:id/start\|stop\|reset-error | ✗ | ✓ |
| GET /admin/tags | ✓ | ✓ |
| POST/PATCH/DELETE /admin/tags | ✗ | ✓ |
| GET /admin/admins | ✗ | ✓ |
| POST /admin/admins | ✗ | ✓ |
| PATCH /admin/admins/:id/status | ✗ | ✓ |

---

## 密码存储

使用 Node.js 内建 `node:crypto` 的 `scrypt`，无需第三方包。

存储格式：`<hex_salt>:<hex_derivedKey>`（salt 16 字节，derivedKey 64 字节）。

比较使用 `timingSafeEqual` 防时序攻击。

```ts
// packages/server/src/routes/auth.ts
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = await scryptAsync(password, salt, 64) as Buffer
  return `${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashed] = stored.split(':')
  const key = await scryptAsync(password, salt, 64) as Buffer
  return timingSafeEqual(key, Buffer.from(hashed, 'hex'))
}
```

---

## 前端对接

- JWT 存储：`localStorage.setItem('nyadio_admin_token', token)`
- 所有管理请求在 `Authorization: Bearer <token>` 头传 token
- TanStack Query 的 `queryClient` 配置全局请求拦截，自动附加 token
- 401 响应：清除 localStorage token，跳转 `/admin/login`
- 已登录状态访问 `/admin/login`：跳转 `/admin/submissions`
