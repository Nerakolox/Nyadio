import { Check, Clipboard, Copy, Headphones, Link2, Pause, Play, RadioTower, RotateCw, Volume2, VolumeX } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { usePublicChannel } from "../../api/public/hooks";
import type { PlayState, PublicChannelDetail } from "../../api/public/types";
import { PlayStateBadge } from "../../components/ChannelCard";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

type PlaybackPhase = "idle" | "starting" | "connecting" | "playing" | "paused" | "blocked" | "error";

interface PlaybackStatus {
  phase: PlaybackPhase;
  message: string | null;
}

export function ChannelDetailPage() {
  const { slug } = useParams();
  const channel = usePublicChannel(slug);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackRunRef = useRef(0);
  const currentPlaybackUrlRef = useRef<string | null>(null);
  const suppressAudioErrorRef = useRef(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [playback, setPlayback] = useState<PlaybackStatus>({ phase: "idle", message: null });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"hls" | "stream" | null>(null);
  const [volume, setVolume] = useState(35);
  const [muted, setMuted] = useState(false);

  const data = channel.data;
  const isNotFound = channel.error instanceof ApiError && channel.error.status === 404;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
    audio.muted = muted || volume === 0;
  }, [muted, volume]);

  useEffect(() => {
    setPlayRequested(false);
    setPlayback({ phase: "idle", message: null });
    setPlayerError(null);
    teardownPlayback();

    return () => {
      teardownPlayback();
    };
  }, [slug]);

  useEffect(() => {
    if (!data || !playRequested) return;

    if (data.playState === "unavailable") {
      const message = "频道当前不可用，后端未能启动音频流。";
      setPlayback({ phase: "error", message });
      setPlayerError(message);
    }
  }, [data?.playState, playRequested]);

  async function requestPlayback() {
    if (!data || data.playState === "unavailable" || playback.phase === "starting" || playback.phase === "connecting") return;

    if (playback.phase === "playing") {
      audioRef.current?.pause();
      setPlayback({ phase: "paused", message: "播放已暂停。" });
      return;
    }

    setPlayRequested(true);
    setPlayerError(null);

    if (playback.phase === "paused" && currentPlaybackUrlRef.current === data.outputs.stream && audioRef.current?.src) {
      await resumePlayback();
      return;
    }

    await attachStreamPlayback(data);
  }

  async function resumePlayback(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayback({ phase: "connecting", message: "正在恢复播放..." });
    try {
      await audio.play();
      setPlayback({ phase: "playing", message: null });
      setPlayerError(null);
    } catch {
      const message = "浏览器拦截了播放，请再次点击播放按钮。";
      setPlayback({ phase: "blocked", message });
      setPlayerError(message);
    }
  }

  async function attachStreamPlayback(channelData: PublicChannelDetail): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;

    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    teardownPlayback({ keepRunId: true });
    currentPlaybackUrlRef.current = channelData.outputs.stream;
    setPlayerError(null);
    setPlayback({ phase: "connecting", message: "正在连接 AAC 直连流..." });

    audio.src = channelData.outputs.stream;
    audio.volume = volume / 100;
    audio.muted = muted || volume === 0;
    audio.load();
    try {
      await audio.play();
      if (playbackRunRef.current === runId) {
        setPlayback({ phase: "playing", message: null });
        setPlayerError(null);
      }
    } catch {
      if (playbackRunRef.current !== runId) return;
      const message = "浏览器拦截了自动播放，请点击播放器上的播放按钮。";
      currentPlaybackUrlRef.current = null;
      setPlayback({ phase: "blocked", message });
      setPlayerError(message);
    }
  }

  function teardownPlayback(options: { keepRunId?: boolean } = {}) {
    if (!options.keepRunId) playbackRunRef.current += 1;
    currentPlaybackUrlRef.current = null;

    const audio = audioRef.current;
    if (!audio) return;
    suppressAudioErrorRef.current = true;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    window.setTimeout(() => {
      suppressAudioErrorRef.current = false;
    }, 0);
  }

  function handleAudioPlay() {
    if (playRequested) setPlayback({ phase: "playing", message: null });
  }

  function handleAudioPause() {
    if (suppressAudioErrorRef.current || !playRequested || playback.phase === "error") return;
    setPlayback({ phase: "paused", message: "播放已暂停。" });
  }

  function handleAudioError() {
    if (suppressAudioErrorRef.current || !playRequested || playback.phase === "error") return;
    const message = "AAC 直连流加载失败，请重试或复制输出地址到外部播放器。";
    setPlayback({ phase: "error", message });
    setPlayerError(message);
    currentPlaybackUrlRef.current = null;
  }

  async function copy(kind: "hls" | "stream", value: string) {
    await writeClipboard(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const playButtonDisabled = data?.playState === "unavailable" || playback.phase === "starting" || playback.phase === "connecting";
  const volumeLabel = muted || volume === 0 ? "已静音" : `${volume}%`;

  if (channel.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Card className="h-[420px] animate-pulse p-6" />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-[var(--nya-text)]">频道不存在或已停播</h1>
          <p className="mt-3 text-sm text-[var(--nya-text-secondary)]">公开详情页不会暴露已停用频道。</p>
          <Button asChild className="mt-6">
            <Link to="/channels">返回频道列表</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <Card className="p-8">
          <h1 className="text-2xl font-bold text-[var(--nya-text)]">加载失败</h1>
          <p className="mt-3 text-sm text-[var(--nya-text-secondary)]">请稍后刷新页面重试。</p>
        </Card>
      </div>
    );
  }

  const sourceUrl = data.source?.url ?? "源链接未配置";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/channels">返回频道列表</Link>
        </Button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-sm text-[var(--nya-text-tertiary)]">/{data.slug}</p>
                <h1 className="mt-2 font-[var(--nya-font-display)] text-4xl font-bold leading-tight text-[var(--nya-text)]">
                  {data.name}
                </h1>
              </div>
              <PlayStateBadge state={data.playState} />
            </div>

            <p className="max-w-3xl text-base leading-8 text-[var(--nya-text-secondary)]">
              {data.description || "这个频道还没有简介。"}
            </p>

            <div className="flex flex-wrap gap-2">
              {data.tags.length > 0 ? data.tags.map((tag) => <Badge key={tag}>{tag}</Badge>) : <Badge>暂无标签</Badge>}
            </div>

            <div className="overflow-hidden rounded-[var(--nya-radius-lg)] border border-[var(--nya-border)] bg-[var(--nya-surface)] shadow-[0_18px_44px_rgba(92,28,52,0.12)]">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--nya-border)] bg-[linear-gradient(135deg,rgba(255,122,162,0.10),rgba(126,208,198,0.08))] px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--nya-text)]">播放器</h2>
                  <p className="mt-1 text-sm text-[var(--nya-text-secondary)]">{playerHint(data.playState, playback)}</p>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--nya-radius-md)] bg-[#fff1f5] text-[var(--nya-primary-strong)]">
                  <Headphones className="size-5" />
                </span>
              </div>

              <audio
                ref={audioRef}
                className="hidden"
                preload="none"
                onError={handleAudioError}
                onPause={handleAudioPause}
                onPlay={handleAudioPlay}
              />

              <div className="grid gap-4 p-5">
                <div className="flex flex-col gap-5 rounded-[var(--nya-radius-lg)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:flex-row md:items-center">
                  <Button
                    type="button"
                    size="icon"
                    onClick={requestPlayback}
                    disabled={playButtonDisabled}
                    aria-label={playback.phase === "playing" ? "暂停播放" : "播放频道"}
                    className="size-16 rounded-full border-0 bg-[var(--nya-text)] text-[var(--nya-surface)] shadow-[0_16px_36px_rgba(92,28,52,0.18)] transition hover:scale-[1.04] hover:bg-[var(--nya-primary-fill)] active:scale-[0.98]"
                  >
                    {playback.phase === "playing" ? <Pause className="size-5" /> : playback.phase === "error" ? <RotateCw className="size-5" /> : <Play className="size-5" />}
                  </Button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-[var(--nya-text)]">{playButtonLabel(playback.phase)}</span>
                      <span className="inline-flex items-center gap-1 rounded-[var(--nya-radius-pill)] bg-[var(--nya-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--nya-success-text)]">
                        <RadioTower className="size-3" />
                        {data.playState === "live" ? "直连可用" : data.playState === "preparing" ? "等待启动" : "不可用"}
                      </span>
                    </div>
                    <div className="mt-4" aria-hidden="true">
                      <span className="nya-eq-meter" data-active={playback.phase === "playing"}>
                        {Array.from({ length: 9 }).map((_, index) => (
                          <span key={index} className="nya-eq-bar" style={{ "--nya-i": index } as CSSProperties} />
                        ))}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 md:w-[280px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMuted((value) => !value)}
                      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-[var(--nya-surface)] text-[var(--nya-text-secondary)] shadow-[var(--nya-shadow-sm)] transition hover:scale-[1.05] hover:text-[var(--nya-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--nya-focus-ring)] active:scale-[0.96]"
                      aria-label={muted || volume === 0 ? "取消静音" : "静音"}
                    >
                      {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                    <span className="rounded-[var(--nya-radius-pill)] bg-[var(--nya-surface)] px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--nya-text-secondary)] shadow-[var(--nya-shadow-sm)]">
                      {volumeLabel}
                    </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        setVolume(next);
                        if (next > 0) setMuted(false);
                      }}
                      className="nya-volume-slider"
                      style={{ "--nya-volume": `${volume}%` } as CSSProperties}
                      aria-label="音量"
                    />
                  </div>
                </div>

                <div className="rounded-[var(--nya-radius-lg)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--nya-text)]">
                      <Link2 className="size-4 text-[var(--nya-primary-strong)]" />
                      源链接
                    </span>
                    {data.source?.protocol && (
                      <span className="rounded-[var(--nya-radius-pill)] bg-[var(--nya-surface)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--nya-text-secondary)]">
                        {data.source.protocol}
                      </span>
                    )}
                  </div>
                  <p className="break-all font-mono text-xs leading-5 text-[var(--nya-text-secondary)]">{sourceUrl}</p>
                </div>
              </div>

              {playerError && (
                <p className="mx-5 mb-5 rounded-[var(--nya-radius-md)] border border-[var(--nya-warning)] bg-[var(--nya-warning-bg)] px-3 py-2 text-sm text-[var(--nya-warning-text)]">
                  {playerError}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold text-[var(--nya-text)]">输出地址</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--nya-text-secondary)]">可复制到支持 HLS 或 AAC 直连的播放器。</p>
          <div className="mt-5 space-y-3">
            <CopyRow label="HLS" value={data.outputs.hls} copied={copied === "hls"} onCopy={() => copy("hls", data.outputs.hls)} />
            <CopyRow
              label="直连 AAC"
              value={data.outputs.stream}
              copied={copied === "stream"}
              onCopy={() => copy("stream", data.outputs.stream)}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}

function playerHint(state: PlayState, playback: PlaybackStatus): string {
  if (playback.message) return playback.message;
  if (playback.phase === "playing") return "正在使用 AAC 直连播放。";
  if (playback.phase === "paused") return "播放已暂停，点击播放按钮可继续。";
  if (state === "live") return "点击播放后会连接 AAC 直连流。";
  if (state === "preparing") return "点击播放会连接 AAC 直连流，并触发后端启动音频流。";
  return "当前不可播放，请等待管理员处理。";
}

function playButtonLabel(phase: PlaybackPhase): string {
  if (phase === "starting") return "正在启动";
  if (phase === "connecting") return "正在连接";
  if (phase === "playing") return "正在播放";
  if (phase === "paused") return "继续播放";
  if (phase === "blocked") return "继续播放";
  if (phase === "error") return "重试播放";
  return "播放";
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--nya-text)]">{label}</span>
        <Button type="button" size="sm" variant="secondary" onClick={onCopy}>
          {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
      <p className="break-all font-mono text-xs leading-5 text-[var(--nya-text-secondary)]">{value}</p>
    </div>
  );
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
