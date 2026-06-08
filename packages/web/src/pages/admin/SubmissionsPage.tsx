import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, FilePlus2, Link2, X } from "lucide-react";
import {
  useAdminChannels,
  useAdminSubmissions,
  useAdminTags,
  useReviewSubmission
} from "../../api/admin/hooks";
import type { AdminSubmission, SubmissionStatus } from "../../api/admin/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";

const statuses: { value: SubmissionStatus; label: string }[] = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" }
];

type DialogMode = "approve" | "approve_as_new" | "reject";
const protocols = ["HLS", "ICECAST", "HTTP_PUSH"] as const;

function targetText(item: AdminSubmission): string {
  if (item.targetChannel) return `绑定到 ${item.targetChannel.name}`;
  if (item.suggestedSlug || item.suggestedName) return `建议新建 ${item.suggestedSlug ?? "-"} / ${item.suggestedName ?? "-"}`;
  return "未指定";
}

function formatTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function newChannelDefaults(item: AdminSubmission) {
  return {
    slug: item.suggestedSlug ?? "",
    name: item.suggestedName ?? "",
    description: item.note ?? "",
    tagIds: [] as string[],
    featured: false
  };
}

export function SubmissionsPage() {
  const [status, setStatus] = useState<SubmissionStatus>("PENDING");
  const [page, setPage] = useState(1);
  const submissions = useAdminSubmissions(status, page);
  const review = useReviewSubmission();
  const channels = useAdminChannels();
  const tags = useAdminTags();
  const [active, setActive] = useState<AdminSubmission | null>(null);
  const [mode, setMode] = useState<DialogMode>("approve");
  const [channelId, setChannelId] = useState("");
  const [reviewProtocol, setReviewProtocol] = useState<AdminSubmission["protocol"]>("HLS");
  const [newChannel, setNewChannel] = useState(newChannelDefaults({} as AdminSubmission));
  const [reviewNote, setReviewNote] = useState("");

  const items = submissions.data?.items ?? [];
  const total = submissions.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (submissions.data?.limit ?? 20)));
  const channelOptions = useMemo(() => channels.data ?? [], [channels.data]);
  const tagOptions = useMemo(() => tags.data ?? [], [tags.data]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  function openReview(item: AdminSubmission, nextMode: DialogMode) {
    setActive(item);
    setMode(nextMode);
    setChannelId(item.targetChannelId ?? channelOptions[0]?.id ?? "");
    setReviewProtocol(item.protocol);
    setNewChannel(newChannelDefaults(item));
    setReviewNote("");
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!active) return;
    if (mode === "reject") {
      await review.mutateAsync({ id: active.id, body: { action: "reject", reviewNote: reviewNote.trim() || null } });
    } else if (mode === "approve") {
      await review.mutateAsync({
        id: active.id,
        body: { action: "approve", channelId, protocol: reviewProtocol, reviewNote: reviewNote.trim() || null }
      });
    } else {
      await review.mutateAsync({
        id: active.id,
        body: {
          action: "approve_as_new",
          newChannel: {
            slug: newChannel.slug.trim().toLowerCase(),
            name: newChannel.name.trim(),
            description: newChannel.description.trim() || null,
            tagIds: newChannel.tagIds,
            featured: newChannel.featured
          },
          protocol: reviewProtocol,
          reviewNote: reviewNote.trim() || null
        }
      });
    }
    setActive(null);
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[rgba(255,255,255,0.68)] p-5 shadow-[var(--nya-shadow-md)] backdrop-blur-xl md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-xs font-bold text-[var(--nya-primary-strong)]">
            <ClipboardCheck className="size-3.5" />
            投稿审核
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--nya-text)]">投稿审核</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nya-text-secondary)]">
            审核公开投稿，绑定到已有频道或采纳建议新建频道。
          </p>
        </div>
        <Badge>{total} 条记录</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((item) => (
          <Button
            key={item.value}
            variant={status === item.value ? "default" : "secondary"}
            onClick={() => setStatus(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)]">
          <CardTitle>{statuses.find((item) => item.value === status)?.label}</CardTitle>
          <CardDescription>按提交时间倒序排列。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {submissions.isLoading ? (
            <div className="grid gap-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-[var(--nya-radius-md)] bg-[var(--nya-surface-subtle)]" />
              ))}
            </div>
          ) : submissions.error ? (
            <div className="p-5 text-sm font-medium text-[var(--nya-danger-text)]">投稿列表加载失败。</div>
          ) : items.length === 0 ? (
            <div className="grid place-items-center gap-2 px-5 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface-subtle)] text-[var(--nya-primary-strong)]">
                <ClipboardCheck className="size-5" />
              </div>
              <p className="font-bold text-[var(--nya-text)]">当前没有投稿</p>
              <p className="text-sm text-[var(--nya-text-secondary)]">切换其他状态查看历史记录。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>协议</TableHead>
                    <TableHead>目标</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>联系方式</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex max-w-[280px] items-center gap-2">
                          <Link2 className="size-4 shrink-0 text-[var(--nya-primary-strong)]" />
                          <span className="truncate font-mono text-xs">{item.url}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.protocol}</TableCell>
                      <TableCell>{targetText(item)}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{item.note || "-"}</TableCell>
                      <TableCell>{item.contact || "-"}</TableCell>
                      <TableCell>{formatTime(item.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => openReview(item, item.suggestedSlug ? "approve_as_new" : "approve")}>
                              <Check className="size-4" />
                              通过
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => openReview(item, "reject")}>
                              <X className="size-4" />
                              拒绝
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--nya-text-secondary)]">
                            {item.reviewer?.username ?? "-"} / {item.reviewNote || "无备注"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
          上一页
        </Button>
        <span className="text-sm text-[var(--nya-text-secondary)]">
          第 {page} / {totalPages} 页
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
          下一页
        </Button>
      </div>

      <Dialog open={Boolean(active)} onOpenChange={(value) => !value && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{mode === "reject" ? "拒绝投稿" : "通过投稿"}</DialogTitle>
            <DialogDescription>
              {active ? `${active.protocol} / ${targetText(active)}` : "选择审核方式并提交。"}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <form className="grid gap-4" onSubmit={submitReview}>
              <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-3 text-sm leading-6 text-[var(--nya-text-secondary)]">
                <div className="break-all font-mono text-xs text-[var(--nya-text)]">{active.url}</div>
                {active.note && <div className="mt-2">备注：{active.note}</div>}
                {active.contact && <div>联系方式：{active.contact}</div>}
              </div>

              {mode !== "reject" && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={mode === "approve" ? "default" : "secondary"} onClick={() => setMode("approve")}>
                    <Link2 className="size-4" />
                    绑定已有频道
                  </Button>
                  <Button type="button" variant={mode === "approve_as_new" ? "default" : "secondary"} onClick={() => setMode("approve_as_new")}>
                    <FilePlus2 className="size-4" />
                    采纳建议新建
                  </Button>
                </div>
              )}

              {mode !== "reject" && (
                <Label>
                  审核采用协议
                  <Select value={reviewProtocol} onChange={(event) => setReviewProtocol(event.target.value as AdminSubmission["protocol"])}>
                    {protocols.map((protocol) => (
                      <option key={protocol} value={protocol}>
                        {protocol}
                        {protocol === active.protocol ? "（投稿原始协议）" : ""}
                      </option>
                    ))}
                  </Select>
                </Label>
              )}

              {mode === "approve" && (
                <Label>
                  目标频道
                  <Select value={channelId} onChange={(event) => setChannelId(event.target.value)} required>
                    <option value="">请选择频道</option>
                    {channelOptions.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} / {channel.slug}
                        {channel.source ? " / 将替换现有源" : ""}
                      </option>
                    ))}
                  </Select>
                </Label>
              )}

              {mode === "approve_as_new" && (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Label>
                      slug
                      <Input value={newChannel.slug} onChange={(event) => setNewChannel({ ...newChannel, slug: event.target.value.toLowerCase() })} required />
                    </Label>
                    <Label>
                      名称
                      <Input value={newChannel.name} onChange={(event) => setNewChannel({ ...newChannel, name: event.target.value })} required />
                    </Label>
                  </div>
                  <Label>
                    描述
                    <Textarea value={newChannel.description} onChange={(event) => setNewChannel({ ...newChannel, description: event.target.value })} />
                  </Label>
                  <label className="flex items-center gap-3 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--nya-text)]">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--nya-primary-fill)]"
                      checked={newChannel.featured}
                      onChange={(event) => setNewChannel({ ...newChannel, featured: event.target.checked })}
                    />
                    首页推荐
                  </label>
                  <div className="grid gap-2">
                    <div className="text-sm font-semibold text-[var(--nya-text)]">标签</div>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map((tag) => (
                        <label key={tag.id} className="inline-flex h-8 items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 text-xs font-semibold text-[var(--nya-text-secondary)]">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[var(--nya-primary-fill)]"
                            checked={newChannel.tagIds.includes(tag.id)}
                            onChange={(event) =>
                              setNewChannel({
                                ...newChannel,
                                tagIds: event.target.checked
                                  ? [...newChannel.tagIds, tag.id]
                                  : newChannel.tagIds.filter((id) => id !== tag.id)
                              })
                            }
                          />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Label>
                审核备注
                <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
              </Label>

              {review.error && (
                <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                  {review.error.message}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setActive(null)}>
                  取消
                </Button>
                <Button disabled={review.isPending || (mode === "approve" && !channelId)}>
                  {mode === "reject" ? <X className="size-4" /> : <Check className="size-4" />}
                  {review.isPending ? "提交中..." : mode === "reject" ? "确认拒绝" : "确认通过"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
