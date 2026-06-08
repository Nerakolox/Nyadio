import { ArrowRight, Headphones, RadioTower, Sparkles, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicChannels } from "../../api/public/hooks";
import { ChannelCard, ChannelCardSkeleton } from "../../components/ChannelCard";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

export function HomePage() {
  const featured = usePublicChannels({ featured: true });
  const channels = (featured.data ?? []).slice(0, 6);
  const playableCount = channels.filter((channel) => channel.playState === "live" || channel.playState === "preparing").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1.06fr)_420px] lg:items-stretch">
        <div className="flex min-h-[460px] flex-col justify-center rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(255,241,245,0.78))] p-6 shadow-[var(--nya-shadow-lg)] sm:p-8 lg:p-10">
          <div className="inline-flex w-fit items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-sm font-semibold text-[var(--nya-primary-strong)] shadow-[var(--nya-shadow-sm)]">
            <Sparkles className="size-4" />
            Nyadio
          </div>
          <div className="mt-7 max-w-3xl space-y-5">
            <h1 className="[text-wrap:balance] font-[var(--nya-font-display)] text-4xl font-bold leading-[1.05] text-[var(--nya-text)] sm:text-5xl lg:text-6xl">
              把常听的电台放到一个地方
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--nya-text-secondary)] sm:text-lg">
              Nyadio 用来管理网络电台频道，统一提供网页播放、频道列表、标签筛选、播放状态查看和频道推荐入口。
            </p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/channels">
                去听频道
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/submit">
                推荐频道
                <UploadCloud className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-[var(--nya-text-secondary)] sm:grid-cols-3">
            {[
              ["不用翻记录", "频道都放在列表里"],
              ["先看到能听的", "失效的不会挡在前面"],
              ["留给下一次", "好听的频道不容易丢"]
            ].map(([title, text]) => (
              <div key={title} className="rounded-[var(--nya-radius-md)] bg-[color:var(--nya-surface)]/72 p-3">
                <p className="font-semibold text-[var(--nya-text)]">{title}</p>
                <p className="mt-1 leading-5">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="relative overflow-hidden p-6">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#fff1f5]" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--nya-text-secondary)]">首页概览</p>
                <h2 className="mt-2 text-3xl font-bold text-[var(--nya-text)]">今天可以听什么</h2>
              </div>
              <span className="flex size-12 items-center justify-center rounded-[var(--nya-radius-md)] bg-[var(--nya-accent)] text-[var(--nya-accent-text)]">
                <RadioTower className="size-6" />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface-subtle)] p-4">
                <p className="text-sm text-[var(--nya-text-secondary)]">精选频道</p>
                <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[var(--nya-text)]">{featured.isLoading ? "--" : channels.length}</p>
              </div>
              <div className="rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface-subtle)] p-4">
                <p className="text-sm text-[var(--nya-text-secondary)]">现在可听</p>
                <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[var(--nya-text)]">{featured.isLoading ? "--" : playableCount}</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                ["按状态整理", "能播放的频道会优先出现，少一点反复试错。"],
                ["按收听变化", "最近被更多人点开的频道，会慢慢排到更显眼的位置。"],
                ["按标签查找", "用标签快速找到适合工作、休息或睡前的声音。"]
              ].map(([title, text], index) => (
                <div key={title} className="flex gap-3 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-4">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--nya-surface)] font-mono text-xs font-bold text-[var(--nya-primary-strong)] shadow-[var(--nya-shadow-sm)]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--nya-text)]">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--nya-text-secondary)]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--nya-primary-strong)]">
              <Headphones className="size-4" />
              推荐收听
            </div>
            <h2 className="mt-2 text-2xl font-bold text-[var(--nya-text)]">精选频道</h2>
            <p className="mt-2 text-sm text-[var(--nya-text-secondary)]">这里放管理员挑出的常用频道，状态会自动更新。</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/channels">
              查看全部
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {featured.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ChannelCardSkeleton key={index} />
            ))}
          </div>
        ) : channels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <EmptyPanel title="暂无精选频道" text="后台将频道设为精选后，会显示在这里。" />
        )}
      </section>

      <footer className="border-t border-[var(--nya-border)] py-6 text-sm leading-6 text-[var(--nya-text-secondary)]">
        <p className="font-semibold text-[var(--nya-text)]">免责声明</p>
        <p className="mt-2 max-w-4xl">
          Nyadio 仅做音频播放格式转换与转发，不主动提供、存储、剪辑或修改原始内容。频道内容版权、来源说明及相关责任归原出处或内容提供方所有；如有权利问题，请联系
          <a className="font-semibold text-[var(--nya-link)] underline-offset-4 hover:underline" href="mailto:nerakolo@outlook.com">
            管理员
          </a>
          核实处理。
        </p>
      </footer>
    </div>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <Card className="p-8 text-center">
      <h3 className="text-lg font-bold text-[var(--nya-text)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--nya-text-secondary)]">{text}</p>
    </Card>
  );
}
