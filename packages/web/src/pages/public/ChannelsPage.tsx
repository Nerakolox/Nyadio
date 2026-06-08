import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { usePublicChannels, usePublicTags } from "../../api/public/hooks";
import { ChannelCard, ChannelCardSkeleton } from "../../components/ChannelCard";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";

export function ChannelsPage() {
  const tags = usePublicTags();
  const channels = usePublicChannels();

  return (
    <PublicListFrame
      title="全部频道"
      description="正在播放的频道会排在前面；大家最近常听的频道也会更靠前。"
      note="热度公式：当前热度 = 上次热度 × 0.9 ^ 间隔天数 + 本次播放加分。每次有人点开播放，本次播放加分为 1。"
      tags={tags.data ?? []}
      tagsLoading={tags.isLoading}
    >
      {channels.isLoading ? (
        <CardGridSkeleton />
      ) : (channels.data ?? []).length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channels.data?.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      ) : (
        <EmptyState text="暂无公开频道。" />
      )}
    </PublicListFrame>
  );
}

export function PublicListFrame({
  title,
  description,
  note,
  tags,
  tagsLoading,
  children
}: {
  title: string;
  description: string;
  note?: string;
  tags: { id: string; name: string; channelCount: number }[];
  tagsLoading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-8 space-y-5">
        <div className="max-w-3xl">
          <h1 className="font-[var(--nya-font-display)] text-4xl font-bold text-[var(--nya-text)]">{title}</h1>
          <p className="mt-3 text-base leading-7 text-[var(--nya-text-secondary)]">{description}</p>
          {note && (
            <p className="mt-2 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 py-2 text-sm leading-6 text-[var(--nya-text-secondary)]">
              {note}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tagsLoading ? (
            Array.from({ length: 6 }).map((_, index) => <span key={index} className="h-8 w-20 animate-pulse rounded-full bg-[var(--nya-surface)]" />)
          ) : tags.length > 0 ? (
            tags.map((tag) => (
              <Link key={tag.id} to={`/tags/${encodeURIComponent(tag.name)}`}>
                <Badge className="transition hover:border-[var(--nya-border-strong)] hover:text-[var(--nya-primary-strong)]">
                  {tag.name}
                  <span className="ml-2 text-[var(--nya-text-tertiary)]">{tag.channelCount}</span>
                </Badge>
              </Link>
            ))
          ) : (
            <span className="text-sm text-[var(--nya-text-tertiary)]">暂无标签</span>
          )}
        </div>
      </section>
      {children}
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <ChannelCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-[var(--nya-text-secondary)]">{text}</p>
    </Card>
  );
}
