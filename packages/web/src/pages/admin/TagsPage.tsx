import { FormEvent, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useAdminTags, useCreateTag, useDeleteTag, useUpdateTag } from "../../api/admin/hooks";
import { getRole } from "../../api/client";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export function TagsPage() {
  const role = getRole();
  const tags = useAdminTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    await create.mutateAsync(newName);
    setNewName("");
  };

  const submitEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    await update.mutateAsync(editing);
    setEditing(null);
  };

  const tagItems = tags.data ?? [];

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[rgba(255,255,255,0.68)] p-5 shadow-[var(--nya-shadow-md)] backdrop-blur-xl md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-xs font-bold text-[var(--nya-primary-strong)]">
            <Tags className="size-3.5" />
            标签库
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--nya-text)]">标签管理</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nya-text-secondary)]">
            维护可复用的频道标签，频道详情和新建频道都会使用这里的标签。
          </p>
        </div>
        <Badge>{tagItems.length} 个标签</Badge>
      </div>

      {role === "SUPERADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>新建标签</CardTitle>
            <CardDescription>标签名称最多 30 个字符，需保持唯一。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={submitCreate}>
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="新标签名称" />
              <Button disabled={create.isPending || !newName.trim()}>
                <Plus />
                {create.isPending ? "创建中..." : "创建"}
              </Button>
            </form>
            {create.error && (
              <div className="mt-3 rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                {create.error.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)]">
          <CardTitle>标签列表</CardTitle>
          <CardDescription>频道数包含启用与停用频道。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tags.isLoading ? (
            <div className="grid gap-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-[var(--nya-radius-md)] bg-[var(--nya-surface-subtle)]" />
              ))}
            </div>
          ) : tags.error ? (
            <div className="p-5 text-sm font-medium text-[var(--nya-danger-text)]">标签列表加载失败。</div>
          ) : tagItems.length === 0 ? (
            <div className="grid place-items-center gap-2 px-5 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface-subtle)] text-[var(--nya-primary-strong)]">
                <Tags className="size-5" />
              </div>
              <p className="font-bold text-[var(--nya-text)]">还没有标签</p>
              <p className="text-sm text-[var(--nya-text-secondary)]">创建标签后可在频道表单中勾选。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>频道数</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tagItems.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-semibold">{tag.name}</TableCell>
                      <TableCell>{tag.channelCount}</TableCell>
                      <TableCell className="text-right">
                        {role === "SUPERADMIN" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setEditing({ id: tag.id, name: tag.name })}>
                              <Pencil />
                              重命名
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                if (confirm("确定删除这个标签，并从所有频道中移除它吗？")) remove.mutate(tag.id);
                              }}
                            >
                              <Trash2 />
                              删除
                            </Button>
                          </div>
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

      <Dialog open={Boolean(editing)} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名标签</DialogTitle>
            <DialogDescription>保存后所有关联频道会显示新标签名。</DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="grid gap-4" onSubmit={submitEdit}>
              <Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              {update.error && (
                <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                  {update.error.message}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  取消
                </Button>
                <Button disabled={update.isPending}>
                  <Pencil />
                  {update.isPending ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
