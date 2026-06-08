import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, History, Play, RotateCcw, Save, Square, Waves } from "lucide-react";
import {
  useAdminChannels,
  useAdminTags,
  useChannelRuntime,
  useRuntimeAction,
  useSourceHistory,
  useUpdateChannel
} from "../../api/admin/hooks";
import { getRole } from "../../api/client";
import { RuntimeDot, runtimeStateText } from "../../components/RuntimeDot";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";

export function ChannelDetailPage() {
  const { id } = useParams();
  const role = getRole();
  const channels = useAdminChannels();
  const tags = useAdminTags();
  const runtime = useChannelRuntime(id);
  const history = useSourceHistory(role === "SUPERADMIN" ? id : undefined);
  const channel = useMemo(() => channels.data?.find((item) => item.id === id), [channels.data, id]);
  const update = useUpdateChannel(id ?? "");
  const action = useRuntimeAction(id ?? "");
  const [form, setForm] = useState({ name: "", description: "", featured: false, tagIds: [] as string[] });

  useEffect(() => {
    if (channel) {
      setForm({
        name: channel.name,
        description: channel.description ?? "",
        featured: channel.featured,
        tagIds: channel.tags.map((tag) => tag.id)
      });
    }
  }, [channel]);

  if (!id) return null;
  if (channels.isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-24 animate-pulse rounded-[var(--nya-radius-xl)] bg-[var(--nya-surface)]" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="h-96 animate-pulse rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface)]" />
          <div className="h-96 animate-pulse rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface)]" />
        </div>
      </div>
    );
  }
  if (!channel) return <p className="text-sm font-medium text-[var(--nya-danger-text)]">频道不存在。</p>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await update.mutateAsync(form);
  };

  const runtimeData = runtime.data ?? channel.runtime;

  return (
    <section className="grid gap-5">
      <div className="rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[rgba(255,255,255,0.68)] p-5 shadow-[var(--nya-shadow-md)] backdrop-blur-xl">
        <Link
          to="/admin/channels"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--nya-link)] hover:underline"
        >
          <ArrowLeft className="size-4" />
          返回频道列表
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="font-mono text-[var(--nya-primary-strong)]">{channel.slug}</Badge>
              <RuntimeDot state={channel.status === "INACTIVE" ? "inactive" : runtimeData.state} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--nya-text)]">{channel.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--nya-text-secondary)]">
              {channel.description || "该频道暂未填写描述。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {channel.tags.map((tag) => (
              <Badge key={tag.id}>{tag.name}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
            <CardDescription>Slug 只读，名称、描述、推荐状态和标签可由超级管理员修改。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <Label>
                Slug
                <Input value={channel.slug} readOnly />
              </Label>
              <Label>
                名称
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  disabled={role !== "SUPERADMIN"}
                />
              </Label>
              <Label>
                描述
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  disabled={role !== "SUPERADMIN"}
                />
              </Label>
              <label className="flex items-center gap-3 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--nya-text)]">
                <input
                  className="size-4 accent-[var(--nya-primary-fill)]"
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => setForm({ ...form, featured: event.target.checked })}
                  disabled={role !== "SUPERADMIN"}
                />
                首页推荐
              </label>
              <div className="grid gap-2">
                <div className="text-sm font-semibold text-[var(--nya-text)]">标签</div>
                <div className="flex flex-wrap gap-2">
                  {(tags.data ?? []).map((tag) => (
                    <label
                      key={tag.id}
                      className="inline-flex h-8 items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 text-xs font-semibold text-[var(--nya-text-secondary)]"
                    >
                      <input
                        className="size-3.5 accent-[var(--nya-primary-fill)]"
                        type="checkbox"
                        checked={form.tagIds.includes(tag.id)}
                        disabled={role !== "SUPERADMIN"}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            tagIds: event.target.checked
                              ? [...form.tagIds, tag.id]
                              : form.tagIds.filter((item) => item !== tag.id)
                          })
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </div>
              {update.error && (
                <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                  {update.error.message}
                </div>
              )}
              {role === "SUPERADMIN" && (
                <Button disabled={update.isPending} className="w-fit">
                  <Save />
                  {update.isPending ? "保存中..." : "保存修改"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>运行时</CardTitle>
            <CardDescription>每 10 秒刷新一次运行状态。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              {[
                ["状态", runtimeStateText(runtimeData.state)],
                ["重试次数", runtimeData.retryCount],
                ["最后心跳", runtimeData.lastHeartbeat ?? "从未"],
                ["听众数", runtimeData.listenerCount],
                ["HLS 轮询", runtimeData.hlsPollerCount],
                ["空闲剩余", runtimeData.idleSecondsRemaining ?? "活跃"]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[108px_1fr] gap-3 rounded-[var(--nya-radius-md)] bg-[var(--nya-surface-subtle)] px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-[var(--nya-text-secondary)]">{label}</span>
                  <span className="min-w-0 break-words font-medium text-[var(--nya-text)]">{value}</span>
                </div>
              ))}
            </div>
            {role === "SUPERADMIN" && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => action.mutate("start")} disabled={action.isPending}>
                  <Play />
                  启动
                </Button>
                <Button variant="secondary" onClick={() => action.mutate("stop")} disabled={action.isPending}>
                  <Square />
                  停止
                </Button>
                <Button variant="secondary" onClick={() => action.mutate("reset-error")} disabled={action.isPending}>
                  <RotateCcw />
                  重置错误
                </Button>
              </div>
            )}
            {action.error && (
              <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                {action.error.message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {role === "SUPERADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="size-5 text-[var(--nya-primary-strong)]" />
              输入源
            </CardTitle>
            <CardDescription>MODERATOR 账号不会看到输入源 URL。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {channel.source ? (
              <div className="grid gap-2">
                <div className="grid gap-2 rounded-[var(--nya-radius-lg)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-4 md:grid-cols-[140px_1fr]">
                  <span className="font-semibold text-[var(--nya-text-secondary)]">协议</span>
                  <span>{channel.source.protocol}</span>
                  <span className="font-semibold text-[var(--nya-text-secondary)]">URL</span>
                  <span className="break-all font-mono text-xs text-[var(--nya-primary-strong)]">{channel.source.url}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--nya-text-secondary)]">尚未配置输入源。</p>
            )}

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--nya-text)]">
                <History className="size-4 text-[var(--nya-primary-strong)]" />
                输入源历史
              </h3>
              <div className="grid gap-3">
                {(history.data ?? []).map((item) => (
                  <div key={item.id} className="rounded-[var(--nya-radius-lg)] border border-[var(--nya-border)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge>{item.protocol}</Badge>
                      <span className="text-xs font-medium text-[var(--nya-text-tertiary)]">{item.createdAt}</span>
                    </div>
                    <p className="mt-3 break-all font-mono text-xs text-[var(--nya-primary-strong)]">{item.url}</p>
                  </div>
                ))}
                {(history.data ?? []).length === 0 && (
                  <p className="text-sm text-[var(--nya-text-secondary)]">暂无输入源替换记录。</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
