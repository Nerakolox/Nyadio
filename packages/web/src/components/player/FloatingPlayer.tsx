import { Pause, Play, RadioTower, RotateCw, Volume2, VolumeX, X } from "lucide-react";
import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "./PlayerProvider";

export function FloatingPlayer() {
  const player = usePlayer();
  const channel = player.current;

  if (!channel) return null;

  const busy = player.phase === "connecting";
  const volumeLabel = player.muted || player.volume === 0 ? "已静音" : `${player.volume}%`;

  return (
    <aside className="nya-floating-player fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-4xl rounded-[var(--nya-radius-xl)] border border-[var(--nya-border-strong)] bg-[color:var(--nya-surface)]/95 shadow-[0_18px_54px_rgba(92,28,52,0.18)] backdrop-blur">
        <div className="grid gap-3 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-4">
          <button
            type="button"
            onClick={player.togglePlayback}
            disabled={busy}
            aria-label={player.phase === "playing" ? "暂停播放" : "播放频道"}
            className="inline-flex size-12 cursor-pointer items-center justify-center rounded-full bg-[var(--nya-text)] text-[var(--nya-surface)] shadow-[0_12px_28px_rgba(92,28,52,0.18)] transition hover:scale-[1.04] hover:bg-[var(--nya-primary-fill)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--nya-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97] sm:size-14"
          >
            {player.phase === "playing" ? <Pause className="size-5" /> : player.phase === "error" ? <RotateCw className="size-5" /> : <Play className="size-5" />}
          </button>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link to={`/channel/${channel.slug}`} className="min-w-0 truncate text-sm font-bold text-[var(--nya-text)] hover:text-[var(--nya-primary-strong)] sm:text-base">
                {channel.name}
              </Link>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-[var(--nya-radius-pill)] bg-[var(--nya-success-bg)] px-2.5 text-xs font-semibold text-[var(--nya-success-text)]">
                <RadioTower className="size-3" />
                {statusLabel(player.phase)}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[var(--nya-text-secondary)]">{player.message ?? `/${channel.slug}`}</p>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 sm:w-[280px]">
            <button
              type="button"
              onClick={() => player.setMuted(!player.muted)}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-[var(--nya-surface-subtle)] text-[var(--nya-text-secondary)] transition hover:text-[var(--nya-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--nya-focus-ring)]"
              aria-label={player.muted || player.volume === 0 ? "取消静音" : "静音"}
            >
              {player.muted || player.volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={player.volume}
              onChange={(event) => player.setVolume(Number.parseInt(event.target.value, 10))}
              className="nya-volume-slider"
              style={{ "--nya-volume": `${player.volume}%` } as CSSProperties}
              aria-label="音量"
            />
            <span className="hidden w-12 text-right font-mono text-xs font-semibold tabular-nums text-[var(--nya-text-secondary)] sm:block">
              {volumeLabel}
            </span>
            <button
              type="button"
              onClick={player.stop}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-[var(--nya-surface-subtle)] text-[var(--nya-text-secondary)] transition hover:bg-[var(--nya-danger-bg)] hover:text-[var(--nya-danger-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--nya-focus-ring)]"
              aria-label="关闭播放器"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function statusLabel(phase: string): string {
  if (phase === "connecting") return "连接中";
  if (phase === "playing") return "播放中";
  if (phase === "paused") return "已暂停";
  if (phase === "blocked") return "需点击";
  if (phase === "error") return "播放失败";
  return "待播放";
}
