# 03 — ffmpeg 子进程与流处理

## 职责

- 用 `execa` 启动 ffmpeg 子进程，以数组参数传参（防 shell 注入）
- 入口侧：用 `-i` 拉取上游协议（HLS / Icecast / HTTP 直推流）
- 出口侧：tee 扇出到 HLS 面（写 tmpfs）和 HTTP 直推流面（管道）
- 只做一次解码、一次编码（AAC 128kbps），多路 tee 输出，不重复转码

---

## 模块位置

```
packages/server/src/
├── ffmpeg/
│   ├── process.ts     # FfmpegProcess 类：启动、监听退出、SIGTERM/SIGKILL
│   ├── args.ts        # 按协议和输出面组装 ffmpeg 参数数组
│   └── tee.ts         # tee 输出字符串构造器
├── outputs/
│   ├── hls.ts         # HLS 段写入 tmpfs、m3u8 生成、滑动窗口清理
│   └── stream.ts      # HTTP 直推流广播器（EventEmitter，管理长连接集合）
└── adapters/
    ├── hls.ts         # HLS 源：直接传 URL，无额外处理
    ├── icecast.ts     # Icecast 源：同上，ffmpeg 能直接拉 Icecast
    └── http-push.ts   # HTTP 直推流源：同上
```

---

## ffmpeg 参数结构

以 HLS 源、两路输出（HLS + 直推流）为例：

```
ffmpeg
  -re                          # 实时速率读取（防快进）
  -i <source_url>              # 输入源
  -map 0:a                     # 只取音频流
  -c:a aac                     # 编码为 AAC
  -b:a 128k                    # 码率 128kbps
  -ar 44100                    # 采样率 44.1kHz
  -f tee
  "[f=hls:hls_time=6:hls_list_size=5:hls_flags=delete_segments+append_list:hls_segment_filename=<HLS_DIR>/<slug>/seg_%05d.aac]<HLS_DIR>/<slug>/index.m3u8|[f=adts]pipe:1"
```

**参数说明**

| 参数 | 说明 |
|---|---|
| `-re` | 以原始速率读取，防止 ffmpeg 比实时快跑把源读空 |
| `-map 0:a` | 忽略视频流（yt-dlp 源可能带视频） |
| `-c:a aac -b:a 128k` | 统一编码，所有源归一化 |
| `hls_time=6` | 每段秒数（`HLS_SEGMENT_DURATION` AppConfig 项） |
| `hls_list_size=5` | 滑动窗口保留最近 5 段（`HLS_WINDOW_SIZE` AppConfig 项） |
| `hls_flags=delete_segments` | 旧段自动删除，tmpfs 占用恒定（约 5×96KB ≈ 480KB） |
| `hls_flags=append_list` | 不写 `#EXT-X-ENDLIST`，播放器识别为持续直播 |
| `pipe:1` | 直推流输出到 stdout，Node 读取后广播给 HTTP 监听者 |

---

## HLS 输出面

`packages/server/src/outputs/hls.ts`

ffmpeg 直接将段文件和 m3u8 写入 tmpfs（`HLS_DIR/<slug>/`），Node 不参与 HLS 数据写入。

Node 的职责仅限于：
1. 确保 `HLS_DIR/<slug>/` 目录存在（启动 ffmpeg 前创建）
2. 接收 `GET /stream/:slug/index.m3u8` 请求 → 从 tmpfs 读取文件 → 响应（触发心跳 + 懒启动）
3. 接收 `GET /stream/:slug/seg_*.aac` 请求 → 从 tmpfs 读取文件 → 响应（触发心跳）
4. ffmpeg 停止后清理 `HLS_DIR/<slug>/` 目录下的所有文件

**m3u8 响应头**

```
Content-Type: application/vnd.apple.mpegurl
Cache-Control: no-cache, no-store
Access-Control-Allow-Origin: *
```

**段响应头**

```
Content-Type: audio/aac
Cache-Control: max-age=60
Access-Control-Allow-Origin: *
```

---

## HTTP 直推流输出面

`packages/server/src/outputs/stream.ts`

ffmpeg 将 ADTS AAC 输出到 stdout（`pipe:1`），Node 读取后广播给所有已连接的 HTTP 客户端。

```
ffmpeg stdout
    │
    ▼
StreamBroadcaster (EventEmitter)
    │  on('data', chunk)
    ├─ → client1 res.write(chunk)
    ├─ → client2 res.write(chunk)
    └─ → client3 res.write(chunk)
```

**StreamBroadcaster 接口**

```ts
class StreamBroadcaster {
  attach(ffmpegStdout: Readable): void   // 绑定 ffmpeg 输出
  detach(): void                          // ffmpeg 停止时解绑，清空客户端
  addClient(res: FastifyReply): void      // 新监听者加入
  removeClient(res: FastifyReply): void   // 监听者断开
  get listenerCount(): number
}
```

**HTTP 直推流响应头**

```
Content-Type: audio/aac
Transfer-Encoding: chunked
Cache-Control: no-cache
Access-Control-Allow-Origin: *
X-Content-Type-Options: nosniff
```

客户端断开时（`req.socket` 的 `close` 事件）调用 `removeClient`，同时刷新心跳计数。

---

## 进程退出处理

`packages/server/src/ffmpeg/process.ts`

```
ffmpeg exit (code !== 0 或 signal)
    │
    └─ 通知 ChannelRegistry → 触发重试逻辑（见 spec/02-channels.md）
```

**清理顺序**（停止频道时）：
1. `ffmpeg.kill('SIGTERM')`
2. 等待最多 5 秒
3. 若进程仍存活：`ffmpeg.kill('SIGKILL')`
4. `StreamBroadcaster.detach()`（向所有客户端发送 HTTP 响应结束）
5. 清理 `HLS_DIR/<slug>/` 目录

---

## 安全

- ffmpeg 命令以数组形式传给 `execa`，永远不拼 shell 字符串
- `source.url` 在进入 ffmpeg 前已通过 SSRF 校验（见 spec/10-security.md）
- ffmpeg 以受限权限运行（与 Node 进程同用户，不提权）
