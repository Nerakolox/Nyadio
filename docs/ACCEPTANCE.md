# 验收测试清单

> 验收前提：执行 `pnpm --filter server build` 重新编译，确保 dist 包含 P3/P4 路由；前端执行 `pnpm --filter web build`。

---

## P1 — 基础设施 + 频道管理

### DB & 启动

- [ ] `prisma migrate deploy` 成功，7 张表（Channel / Source / SourceHistory / Tag / ChannelTag / AdminUser / AppConfig）均存在
- [ ] `seed-config` 写入 AppConfig 6 项默认值（MAX_ACTIVE_CHANNELS / HLS_SEGMENT_DURATION / HLS_WINDOW_SIZE / IDLE_TIMEOUT_MS / MAX_RETRY / SUBMISSION_RATE_LIMIT）
- [ ] `seed-admin` 创建初始 SUPERADMIN，passwordHash 非明文
- [ ] `GET /health` 返回 200

### 鉴权

- [ ] `POST /admin/login` 凭据正确返回 JWT（≤8h 有效期）
- [ ] 同 IP 登录 >10 次/分钟返回 429
- [ ] 无 token 请求 `/admin/channels` 返回 401
- [ ] 禁用账户的 token 在下一次请求立即返回 401（不等过期）

### 频道 CRUD

- [ ] `POST /admin/channels` 创建频道，slug 正常存入
- [ ] 重复 slug 返回 409
- [ ] slug 为保留词（`api` / `admin` / `stream` / `health`）返回 400
- [ ] slug 含大写或特殊字符返回 400
- [ ] source URL 为私网 IP（如 `http://192.168.1.1/`）返回 400（SSRF 拦截）
- [ ] source URL 含 shell 元字符（如 `;` / `|`）返回 400
- [ ] `PATCH /admin/channels/:id` MODERATOR 角色调用返回 403
- [ ] `PATCH /admin/channels/:id/status` 停用后 GET 返回 status=INACTIVE，ffmpeg 进程已不存在
- [ ] `GET /admin/channels` MODERATOR 返回的 source 字段为 null
- [ ] `GET /admin/channels/:id/source-history` 在换源后有历史记录

### 标签

- [ ] `POST /admin/tags` 创建标签
- [ ] `DELETE /admin/tags/:id` 删除后关联的 ChannelTag 级联删除（频道标签消失）
- [ ] 重复名称返回 409

### ffmpeg / 生命周期

- [ ] 访问 `GET /stream/:slug/index.m3u8` 触发懒启动，运行时 state 变 `starting` 再变 `running`，ffmpeg 子进程可用 `ps` 确认存在
- [ ] IDLE_TIMEOUT_MS 到期且 listenerCount=0 后 ffmpeg 进程自动回收，state→idle
- [ ] ffmpeg 异常退出后触发指数退避重试，retryCount 递增
- [ ] 超过 MAX_RETRY 后 state=error
- [ ] `POST /admin/channels/:id/reset-error` 后 state=idle，retryCount=0

### 前端 — 管理面基础

- [ ] `/admin/login` 登录成功跳转 `/admin/submissions`
- [ ] 401 时清 token 跳回登录页
- [ ] `/admin/channels` 列表展示正确的状态色点（绿/黄/红/灰）
- [ ] 新建频道 Dialog 字段校验（slug 格式、URL 非空）前端侧提示
- [ ] `/admin/channels/:id` 运行状态面板 10s 轮询刷新

---

## P2 — 流媒体公开面

### 流路由

- [ ] `GET /stream/:slug/index.m3u8` 返回合法 HLS playlist，`Content-Type: application/vnd.apple.mpegurl`，含 `Access-Control-Allow-Origin: *`
- [ ] m3u8 段路径为绝对路径（NetMusic 约束）
- [ ] `GET /stream/:slug/seg_*.aac` 返回 `Content-Type: audio/aac`，`Cache-Control: max-age=60`
- [ ] `GET /stream/:slug/audio.aac` 返回 chunked 长连接，持续吐 AAC 数据
- [ ] slug 不存在返回 404；INACTIVE 返回 503；state=error 返回 503
- [ ] 在线频道数达到 MAX_ACTIVE_CHANNELS 上限时再请求返回 429

### 公开 API

- [ ] `GET /api/channels` 仅返回 ACTIVE 频道
- [ ] `?featured=true` 只返回 featured=true 的频道
- [ ] `?tag=:name` 按标签筛选
- [ ] `GET /api/channels/:slug` 返回 outputs 字段含完整 hls 和 stream URL
- [ ] playState 映射正确（running→live / idle+starting→preparing / error→unavailable）
- [ ] INACTIVE 频道 `GET /api/channels/:slug` 返回 404
- [ ] `GET /api/tags` 返回含 channelCount 的标签列表
- [ ] 直推流新连接时 popularity 更新（原子 SQL），HLS 轮询不更新

### 前端 — 公开面

- [ ] `/` 展示 featured 频道卡片（最多 6 张），30s 轮询更新 playState 徽章
- [ ] `/channels` 标签云点击跳 `/tags/:tag`，频道只显示该标签下的
- [ ] `/channel/:slug` 点击播放才触发 `/stream/:slug/index.m3u8`（不提前请求）
- [ ] preparing 状态显示「正在准备中」文案，变 live 后播放器可用
- [ ] iOS Safari 不支持 hls.js 时降级为原生 `<audio src>` 播放 HLS
- [ ] HLS URL 和直推流 URL 一键复制有视觉反馈
- [ ] `/tags/不存在的标签` 显示空状态提示，不 404

---

## P3 — 投稿与审核

### 投稿 API

- [ ] `POST /api/submissions` 成功返回 201，`{ id, status: "PENDING", createdAt }`
- [ ] URL 为私网地址返回 400（SSRF 拦截）
- [ ] protocol 非枚举值返回 400
- [ ] suggestedSlug 格式不合法（含大写、含空格、<3 字符）返回 400
- [ ] note >500 字返回 400，contact >100 字返回 400
- [ ] targetChannelId 与 suggestedSlug+suggestedName 同时填返回 400（互斥约束）
- [ ] targetChannelId 不存在于 DB 返回 400
- [ ] 超过 SUBMISSION_RATE_LIMIT 次/小时/IP 返回 429

### 审核 API

- [ ] `GET /admin/submissions?status=PENDING` 正确分页，含 targetChannel 关联对象
- [ ] `PATCH .../review`（action=approve）：事务内写 SourceHistory → upsert Source，channelRegistry 已 reload
- [ ] approve 后 SourceHistory 有一条新记录，source.url 已更新
- [ ] `action=approve_as_new`：slug 已存在时返回 409（可读提示），不存在时新频道写入并出现在 /admin/channels
- [ ] `action=reject`：投稿 status=REJECTED，reviewNote 有值
- [ ] 对非 PENDING 投稿做 review 返回 409
- [ ] MODERATOR 权限可访问审核接口，SUPERADMIN 也可

### 前端 — 投稿/审核

- [ ] `/submit` 表单 radio 三选一（不指定/绑定已有/建议新建），正确控制字段显示
- [ ] 成功提交后原地替换为成功卡片（不跳页）
- [ ] 私网 URL 提交后字段下显示提示文案
- [ ] `/admin/submissions` Tab 切换 PENDING / APPROVED / REJECTED 各自加载对应数据
- [ ] ReviewDialog「绑定已有」分支：已有 Source 的频道标注「将替换现有源」
- [ ] 审核操作成功后 Dialog 关闭，列表刷新

---

## P4 — 管理员账户 + 系统设置

### 管理员账户 API

- [ ] `GET /admin/admins` 不含 passwordHash 字段
- [ ] `POST /admin/admins` 密码 scrypt 哈希存储，非明文
- [ ] username <3 字符或含特殊字符返回 400
- [ ] password <8 位返回 400
- [ ] username 重复返回 409
- [ ] `PATCH /admin/admins/:id/status` 禁用后该账户的 JWT 立即 401
- [ ] 不能禁用自己（返回 400）
- [ ] MODERATOR 无权访问 /admin/admins（返回 403）

### 系统设置 API

- [ ] `GET /admin/settings` 返回全部 6 项 AppConfig
- [ ] `PATCH /admin/settings` 修改 IDLE_TIMEOUT_MS 后 ConfigStore 立即返回新值
- [ ] 修改 SUBMISSION_RATE_LIMIT 后限流阈值热刷新生效
- [ ] 修改 HLS_SEGMENT_DURATION 对已运行频道无影响，只对新启动的 ffmpeg 生效

### 前端 — P4

- [ ] `/admin/admins` 新建 Dialog 409 冲突时表单下显示报错
- [ ] 禁用自己时按钮 disabled + tooltip，不发请求
- [ ] `/admin/settings` 加载当前 6 项值，保存成功显示 Toast「设置已保存」

---

## 全局安全与约束

- [ ] 所有 ffmpeg 调用用 execa 数组参数，无字符串拼接（审查 `ffmpeg/args.ts:buildFfmpegArgs`）
- [ ] 所有用户提交 URL 经过 `validateUrl`（含 DNS 预解析），私网 / 元数据 IP 段均拦截
- [ ] `onRequest` 钩子每次查 DB 验 disabled，禁用即时生效
- [ ] ChannelRegistry 是单例，PM2 配置 fork 模式、单实例
