# 10 — 安全

## SSRF 防护

所有用户提交的 URL（投稿 `url`、Source `url`）在进入数据库或 ffmpeg 前必须通过以下校验，校验失败返回 400。

**校验逻辑**（`packages/server/src/security/ssrf.ts`）

```ts
import { URL } from 'node:url'
import { isIP } from 'node:net'
import { promises as dns } from 'node:dns'

const BLOCKED_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,           // 链路本地（AWS 元数据：169.254.169.254）
  /^0\./,
  /^::1$/,                 // IPv6 loopback
  /^fc00:/i,               // IPv6 ULA
  /^fe80:/i,               // IPv6 链路本地
]

function isPrivate(addr: string): boolean {
  return BLOCKED_RANGES.some(r => r.test(addr))
}

export async function validateUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('INVALID_URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('INVALID_URL')
  }
  const host = url.hostname
  if (isIP(host)) {
    // 直接 IP，段匹配
    if (isPrivate(host)) throw new Error('SSRF_BLOCKED')
  } else {
    // 域名：解析全部 A/AAAA 记录，逐一检查
    const v4 = await dns.resolve4(host).catch(() => [] as string[])
    const v6 = await dns.resolve6(host).catch(() => [] as string[])
    const addrs = [...v4, ...v6]
    if (addrs.length === 0) throw new Error('DNS_RESOLVE_FAILED')
    if (addrs.some(isPrivate)) throw new Error('SSRF_BLOCKED')
  }
  return url
}
```

**注意**：
- `validateUrl` 是 async 函数，所有调用点（`POST /api/submissions`、`POST /admin/channels`、`PATCH .../review` 的审核通过路径）均须 `await`。
- DNS 预解析将攻击窗口从「随时」收窄到「DNS TTL 窗口内的竞态」。要彻底消除，需在宿主机 iptables 封锁私网出口——超出当前 scope，记录为已知残余风险。
- 不支持 `file://`、`ftp://` 等协议，只允许 `http://` 和 `https://`。

**错误码扩展**

| 错误码 | 说明 |
|---|---|
| `INVALID_URL` | URL 格式不合法或协议不支持 |
| `SSRF_BLOCKED` | IP 或解析结果命中私网段 |
| `DNS_RESOLVE_FAILED` | 域名无法解析（不存在或网络异常） |

---

## Shell 注入防护

ffmpeg 子进程通过 `execa` 以数组形式调用，永远不拼接 shell 字符串：

```ts
// 正确
await execa('ffmpeg', ['-i', sourceUrl, '-map', '0:a', ...])

// 禁止
await exec(`ffmpeg -i ${sourceUrl}`)
```

`sourceUrl` 已通过 SSRF 校验，但即使不校验，execa 数组参数也不会触发 shell 注入。

---

## 密码安全

详见 `spec/05-auth.md`。要点：

- scrypt（Node 内建），无第三方密码库依赖
- `timingSafeEqual` 防时序攻击
- 密码哈希存储，原文不落库、不落日志

---

## 限流

使用 `@fastify/rate-limit`，分两层：

| 接口 | 限制 | 配置项 |
|---|---|---|
| `POST /api/submissions` | `SUBMISSION_RATE_LIMIT` 次/小时（默认 5） | `.env` |
| `POST /admin/login` | 10 次/分钟（固定） | 代码硬编码 |
| 全局 | 100 次/分钟/IP（兜底） | `.env` 可配 |

限流键为远端 IP（`req.ip`），在 Nginx 反向代理后需配置 `trustProxy: true`。

---

## JWT 安全

- Secret 从 `JWT_SECRET` 环境变量读取，不硬编码
- `JWT_SECRET` 至少 32 字节随机值，生产部署前必须替换
- Token 有效期 8 小时（`expiresIn: '8h'`）
- 不提供 refresh token；过期后重新登录
- Token 存 `localStorage`（而非 cookie），SPA 管理员页面，无 CSRF 风险；XSS 防护依赖 shadcn/Vite 编译时模板转义

---

## 其他

- Fastify 默认不暴露 server 版本（`Server` 响应头）
- SQL 注入：全程通过 Prisma ORM，参数化查询，无手写 SQL
- 日志：不记录密码、token、完整 URL（含敏感参数），仅记录频道 slug、操作类型
