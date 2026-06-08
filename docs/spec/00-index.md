# Nyadio SPEC 索引

## 项目一句话

多协议音频聚合中转枢纽：任意来源协议进 → ffmpeg 归一化 → HLS / HTTP 直推流出（统一挂在 `/stream/:slug/*` 前缀下）。

---

## 模块文档

| 文件 | 内容 |
|---|---|
| [../STYLE.MD](../STYLE.MD) | 品牌主题 Sakura Cream：色板阶梯、语义 token、CSS 变量、字体、圆角/间距/阴影、使用规则 |
| [01-data-model.md](./01-data-model.md) | 完整数据库模型，所有表字段、关联关系、枚举值（含 AppConfig 全局配置） |
| [02-channels.md](./02-channels.md) | 频道 CRUD、生命周期（懒启动 / 心跳 / 重试 / 回收）、`playState` 对外语义 |
| [03-ffmpeg.md](./03-ffmpeg.md) | ffmpeg 子进程管理、tee 扇出、输出面（HLS / 直推流） |
| [04-submissions.md](./04-submissions.md) | 用户投稿（双模式：绑定已有 / 建议新建）、审核流程、前后端对接 |
| [05-auth.md](./05-auth.md) | 管理员鉴权、JWT、密码存储（每次查 DB 验证 disabled） |
| [06-tags.md](./06-tags.md) | 标签 CRUD、与频道的多对多关系 |
| [07-admin-users.md](./07-admin-users.md) | 管理员账户管理 |
| [08-frontend-public.md](./08-frontend-public.md) | 公开前端：5 个页面的功能、数据流、状态处理 |
| [09-frontend-admin.md](./09-frontend-admin.md) | 管理前端：7 个页面（含 /admin/settings 系统设置） |
| [10-security.md](./10-security.md) | SSRF、shell 注入、限流、JWT 安全 |
| [11-ops.md](./11-ops.md) | 环境变量、AppConfig 默认值 seed、PM2、tmpfs、部署步骤 |

---

## 约定

- 所有接口路径以 `/` 开头，不含域名
- 流路径统一在 `/stream/` 前缀下：`/stream/:slug/index.m3u8`、`/stream/:slug/seg_*.aac`、`/stream/:slug/audio.aac`
- 频道详情页前端路由：`/channel/:slug`（单数）
- 请求体和响应体均为 JSON，`Content-Type: application/json`
- 管理接口需在 `Authorization: Bearer <token>` 头传 JWT
- 时间字段统一 ISO 8601 字符串（UTC），如 `"2026-06-07T10:00:00.000Z"`
- 错误响应格式统一：`{ "error": "描述" }`
