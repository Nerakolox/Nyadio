import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListFilter, Plus, Power, RadioTower } from "lucide-react";
import {
  useAdminChannels,
  useAdminTags,
  useCreateChannel,
  useSetChannelStatus
} from "../../api/admin/hooks";
import type { Protocol } from "../../api/admin/types";
import { getRole } from "../../api/client";
import { RuntimeDot } from "../../components/RuntimeDot";
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

const protocols: Protocol[] = ["HLS", "ICECAST", "HTTP_PUSH"];

function statusText(status: "ACTIVE" | "INACTIVE") {
  return status === "ACTIVE" ? "启用" : "停用";
}

function initialForm() {
  return {
    slug: "",
    name: "",
    description: "",
    sourceUrl: "",
    sourceProtocol: "HLS" as Protocol,
    tagIds: [] as string[],
    featured: false
  };
}

export function ChannelsPage() {
  const navigate = useNavigate();
  const role = getRole();
  const channels = useAdminChannels();
  const tags = useAdminTags();
  const create = useCreateChannel();
  const status = useSetChannelStatus();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const tagOptions = useMemo(() => tags.data ?? [], [tags.data]);
  const channelItems = channels.data ?? [];
  const runningCount = channelItems.filter((channel) => channel.runtime.state === "running").length;
  const inactiveCount = channelItems.filter((channel) => channel.status === "INACTIVE").length;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await create.mutateAsync({
      ...form,
      slug: form.slug.trim().toLowerCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      sourceUrl: form.sourceUrl.trim()
    });
    setOpen(false);
    setForm(initialForm());
  };

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[rgba(255,255,255,0.68)] p-5 shadow-[var(--nya-shadow-md)] backdrop-blur-xl md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-xs font-bold text-[var(--nya-primary-strong)]">
            <RadioTower className="size-3.5" />
            频道控制台
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--nya-text)]">频道管理</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nya-text-secondary)]">
            管理频道元数据、输入源、启停状态和 ffmpeg 运行时。
          </p>
        </div>
        {role === "SUPERADMIN" && (
          <Button onClick={() => setOpen(true)}>
            <Plus />
            新建频道
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>频道总数</CardDescription>
            <CardTitle className="text-3xl">{channelItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>运行中</CardDescription>
            <CardTitle className="text-3xl text-[var(--nya-success-text)]">{runningCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>已停用</CardDescription>
            <CardTitle className="text-3xl text-[var(--nya-text-secondary)]">{inactiveCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>频道列表</CardTitle>
            <CardDescription>点击行进入详情页查看运行时和输入源。</CardDescription>
          </div>
          <Badge>
            <ListFilter className="mr-2 size-3.5" />
            {channelItems.length} 个频道
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {channels.isLoading ? (
            <div className="grid gap-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-[var(--nya-radius-md)] bg-[var(--nya-surface-subtle)]" />
              ))}
            </div>
          ) : channels.error ? (
            <div className="p-5 text-sm font-medium text-[var(--nya-danger-text)]">频道列表加载失败。</div>
          ) : channelItems.length === 0 ? (
            <div className="grid place-items-center gap-2 px-5 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface-subtle)] text-[var(--nya-primary-strong)]">
                <RadioTower className="size-5" />
              </div>
              <p className="font-bold text-[var(--nya-text)]">还没有频道</p>
              <p className="text-sm text-[var(--nya-text-secondary)]">创建第一个频道后，它会出现在这里。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>运行时</TableHead>
                    <TableHead>听众</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelItems.map((channel) => (
                    <TableRow
                      key={channel.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/channels/${channel.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-[var(--nya-primary-strong)]">{channel.slug}</TableCell>
                      <TableCell className="font-semibold">{channel.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {channel.tags.length > 0 ? (
                            channel.tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)
                          ) : (
                            <span className="text-[var(--nya-text-tertiary)]">无</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{statusText(channel.status)}</TableCell>
                      <TableCell>
                        <RuntimeDot state={channel.status === "INACTIVE" ? "inactive" : channel.runtime.state} />
                      </TableCell>
                      <TableCell>{channel.runtime.listenerCount}</TableCell>
                      <TableCell className="text-right">
                        {role === "SUPERADMIN" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              status.mutate({
                                id: channel.id,
                                status: channel.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                              });
                            }}
                          >
                            <Power />
                            {channel.status === "ACTIVE" ? "停用" : "启用"}
                          </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建频道</DialogTitle>
            <DialogDescription>Slug 创建后不可修改，输入源 URL 会在服务端进行 SSRF 校验。</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Label>
                Slug
                <Input
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })}
                  placeholder="例如: jazz-radio"
                  required
                />
                <span className="text-xs font-medium text-[var(--nya-text-tertiary)]">仅允许小写字母、数字和连字符。</span>
              </Label>
              <Label>
                名称
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </Label>
            </div>
            <Label>
              输入源 URL
              <Input
                value={form.sourceUrl}
                onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
                required
              />
            </Label>
            <div className="grid gap-4 md:grid-cols-2">
              <Label>
                协议
                <Select
                  value={form.sourceProtocol}
                  onChange={(event) => setForm({ ...form, sourceProtocol: event.target.value as Protocol })}
                >
                  {protocols.map((protocol) => (
                    <option key={protocol}>{protocol}</option>
                  ))}
                </Select>
              </Label>
              <label className="flex items-center gap-3 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 text-sm font-semibold text-[var(--nya-text)]">
                <input
                  className="size-4 accent-[var(--nya-primary-fill)]"
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => setForm({ ...form, featured: event.target.checked })}
                />
                首页推荐
              </label>
            </div>
            <Label>
              描述
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Label>
            <div className="grid gap-2">
              <div className="text-sm font-semibold text-[var(--nya-text)]">标签</div>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => (
                  <label
                    key={tag.id}
                    className="inline-flex h-8 items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 text-xs font-semibold text-[var(--nya-text-secondary)]"
                  >
                    <input
                      className="size-3.5 accent-[var(--nya-primary-fill)]"
                      type="checkbox"
                      checked={form.tagIds.includes(tag.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          tagIds: event.target.checked
                            ? [...form.tagIds, tag.id]
                            : form.tagIds.filter((id) => id !== tag.id)
                        })
                      }
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
            {create.error && (
              <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                {create.error.message}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button disabled={create.isPending}>
                <Plus />
                {create.isPending ? "创建中..." : "创建"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
