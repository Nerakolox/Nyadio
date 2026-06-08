# Web

负责所有前端页面：公开面 5 页 + 管理面 7 页，纯静态 SPA，由服务端 @fastify/static 托管。

## 技术栈

- 框架: React + Vite + TypeScript
- 状态/请求: TanStack Query（轮询、缓存）
- UI: shadcn/ui + Tailwind CSS v4
- 音频播放: hls.js（iOS Safari 降级用原生 `<audio src>`）
- 路由: React Router

## 页面职责

### 公开面

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | HomePage | 推荐频道卡片（featured）+ 项目介绍，30s 轮询 |
| `/channels` | ChannelsPage | 全部频道网格 + 标签云，30s 轮询 |
| `/tags/:tag` | TagPage | 按标签筛选频道 |
| `/channel/:slug` | ChannelDetailPage | 播放器（hls.js）+ URL 复制，15s 轮询 |
| `/submit` | SubmitPage | 投稿表单，成功后原地替换为成功卡片 |

### 管理面（`/admin/*`，JWT 守卫）

| 路由 | 页面 | 说明 |
|---|---|---|
| `/admin/login` | LoginPage | 登录，token 写 localStorage `nyadio_admin_token` |
| `/admin/channels` | ChannelsPage | 频道列表 + 新建 Dialog，运行状态色点 |
| `/admin/channels/:id` | ChannelDetailPage | 编辑 + 运行面板 10s 轮询 + 强制启停 |
| `/admin/tags` | TagsPage | 标签 CRUD |
| `/admin/submissions` | SubmissionsPage | 审核队列 Tab + ReviewDialog（绑定已有/新建两分支） |
| `/admin/admins` | AdminsPage | 管理员账户列表 + 新建 + 禁用/启用 |
| `/admin/settings` | SettingsPage | AppConfig 6 项表单，保存后 Toast |

## 文档

| 文档 | 内容 |
|---|---|
| [../../docs/STYLE.MD](../../docs/STYLE.MD) | 品牌主题 Sakura Cream：CSS 变量、色板、字体、圆角/阴影、使用规则 |
| [../../docs/spec/00-index.md](../../docs/spec/00-index.md) | spec 索引，所有模块一览 |
| [../../docs/spec/08-frontend-public.md](../../docs/spec/08-frontend-public.md) | 公开面 5 页：功能、数据流、状态处理 |
| [../../docs/spec/09-frontend-admin.md](../../docs/spec/09-frontend-admin.md) | 管理面 7 页：字段、交互、权限分支 |
| [../../docs/spec/02-channels.md](../../docs/spec/02-channels.md) | playState 语义、公开/管理 API 响应结构 |
| [../../docs/spec/04-submissions.md](../../docs/spec/04-submissions.md) | 投稿表单字段约束、ReviewDialog 两分支逻辑 |
| [../../docs/spec/01-data-model.md](../../docs/spec/01-data-model.md) | 枚举值（Protocol、ChannelStatus、AdminRole 等） |
| [../../docs/PLAN.md](../../docs/PLAN.md) | 分批开发计划（P1–P4 前端任务） |

## 关键约束

- 用户点击播放时才发 `/stream/:slug/index.m3u8`，不提前触发懒启动
- 401 响应时清 localStorage token 并跳 `/admin/login`
- 投稿表单 radio 三选一：不指定 / 绑定已有频道（targetChannelId）/ 建议新建（suggestedSlug + suggestedName）
- ReviewDialog 绑定已有频道分支：从 GET /admin/channels 拉列表，已有 Source 的标注「将替换现有源」
- MODERATOR 登录后看不到 source.url（后端已过滤为 null，前端不做额外处理）
- 禁用自己时按钮 disabled + tooltip，不发请求
