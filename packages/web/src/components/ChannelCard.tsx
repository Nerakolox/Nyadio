import { Radio, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicChannel, PlayState } from "../api/public/types";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

const stateCopy: Record<PlayState, { label: string; className: string }> = {
  live: {
    label: "直播中",
    className: "border-[var(--nya-success)] bg-[var(--nya-success-bg)] text-[var(--nya-success-text)]"
  },
  preparing: {
    label: "准备中",
    className: "border-[var(--nya-warning)] bg-[var(--nya-warning-bg)] text-[var(--nya-warning-text)]"
  },
  unavailable: {
    label: "暂不可用",
    className: "border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] text-[var(--nya-danger-text)]"
  },
  inactive: {
    label: "已停播",
    className: "border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] text-[var(--nya-text-tertiary)]"
  }
};

export function PlayStateBadge({ state }: { state: PlayState }) {
  const item = stateCopy[state];
  return <Badge className={cn("h-8", item.className)}>{item.label}</Badge>;
}

export function ChannelCard({ channel, compact = false }: { channel: PublicChannel; compact?: boolean }) {
  return (
    <Link to={`/channel/${channel.slug}`} className="block h-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--nya-focus-ring)]">
      <Card className="group flex h-full flex-col justify-between overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-[var(--nya-border-strong)] hover:shadow-[var(--nya-shadow-lg)]">
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--nya-radius-md)] bg-[#fff1f5] text-[var(--nya-primary-strong)]">
                <Radio className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-[var(--nya-text)]">{channel.name}</h3>
                <p className="mt-1 font-mono text-xs text-[var(--nya-text-tertiary)]">/{channel.slug}</p>
              </div>
            </div>
            <PlayStateBadge state={channel.playState} />
          </div>

          {!compact && (
            <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[var(--nya-text-secondary)]">
              {channel.description || "这个频道还没有简介。"}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {channel.tags.length > 0 ? (
              channel.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-2.5 py-1 text-xs text-[var(--nya-text-secondary)]"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--nya-text-tertiary)]">暂无标签</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-5 py-3 text-sm text-[var(--nya-text-secondary)]">
          <span className="inline-flex items-center gap-2">
            <Users className="size-4 text-[var(--nya-accent-text)]" />
            {channel.listenerCount} 个直连听众
          </span>
          <span className="font-semibold text-[var(--nya-primary-strong)] group-hover:underline">查看频道</span>
        </div>
      </Card>
    </Link>
  );
}

export function ChannelCardSkeleton() {
  return (
    <Card className="h-[260px] animate-pulse p-5">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-[var(--nya-radius-md)] bg-[var(--nya-surface-subtle)]" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-[var(--nya-surface-subtle)]" />
          <div className="h-3 w-20 rounded bg-[var(--nya-surface-subtle)]" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-3 rounded bg-[var(--nya-surface-subtle)]" />
        <div className="h-3 rounded bg-[var(--nya-surface-subtle)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--nya-surface-subtle)]" />
      </div>
    </Card>
  );
}
