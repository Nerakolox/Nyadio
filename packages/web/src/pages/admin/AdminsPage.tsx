import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { useAdminUsers, useCreateAdminUser, useSetAdminStatus } from "../../api/admin/hooks";
import type { AdminRole } from "../../api/admin/types";
import { getAdminId, getRole } from "../../api/client";
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

function initialForm() {
  return {
    username: "",
    password: "",
    role: "MODERATOR" as AdminRole
  };
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

function roleText(role: AdminRole): string {
  return role === "SUPERADMIN" ? "超级管理员" : "审核员";
}

export function AdminsPage() {
  if (getRole() !== "SUPERADMIN") return <Navigate to="/admin/submissions" replace />;

  const currentAdminId = getAdminId();
  const admins = useAdminUsers();
  const create = useCreateAdminUser();
  const status = useSetAdminStatus();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const adminItems = admins.data ?? [];
  const activeCount = adminItems.filter((admin) => !admin.disabled).length;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await create.mutateAsync({
      username: form.username.trim(),
      password: form.password,
      role: form.role
    });
    setForm(initialForm());
    setOpen(false);
  };

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[rgba(255,255,255,0.68)] p-5 shadow-[var(--nya-shadow-md)] backdrop-blur-xl md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-xs font-bold text-[var(--nya-primary-strong)]">
            <Users className="size-3.5" />
            账号权限
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--nya-text)]">管理员</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nya-text-secondary)]">
            管理后台登录账号，审核员只能处理投稿和查看基础运行信息。
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <UserPlus />
          新建管理员
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>账号总数</CardDescription>
            <CardTitle className="text-3xl">{adminItems.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>可登录</CardDescription>
            <CardTitle className="text-3xl text-[var(--nya-success-text)]">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>已禁用</CardDescription>
            <CardTitle className="text-3xl text-[var(--nya-text-secondary)]">{adminItems.length - activeCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)]">
          <CardTitle>账号列表</CardTitle>
          <CardDescription>禁用账号后，该账号的下一次管理接口请求会立即返回 401。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {admins.isLoading ? (
            <div className="grid gap-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-[var(--nya-radius-md)] bg-[var(--nya-surface-subtle)]" />
              ))}
            </div>
          ) : admins.error ? (
            <div className="p-5 text-sm font-medium text-[var(--nya-danger-text)]">管理员列表加载失败。</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminItems.map((admin) => {
                    const isSelf = admin.id === currentAdminId;
                    return (
                      <TableRow key={admin.id}>
                        <TableCell className="font-semibold">{admin.username}</TableCell>
                        <TableCell>
                          <Badge>{roleText(admin.role)}</Badge>
                        </TableCell>
                        <TableCell>{admin.disabled ? "已禁用" : "可登录"}</TableCell>
                        <TableCell>{formatTime(admin.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={admin.disabled ? "secondary" : "danger"}
                            disabled={status.isPending || (isSelf && !admin.disabled)}
                            title={isSelf ? "不能禁用自己" : undefined}
                            onClick={() => status.mutate({ id: admin.id, disabled: !admin.disabled })}
                          >
                            {admin.disabled ? "启用" : "禁用"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {status.error && (
        <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
          {status.error.message}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建管理员</DialogTitle>
            <DialogDescription>密码至少 8 位；用户名只能使用字母、数字和下划线。</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <Label>
              用户名
              <Input
                value={form.username}
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </Label>
            <Label>
              初始密码
              <Input
                type="password"
                value={form.password}
                minLength={8}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </Label>
            <Label>
              角色
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}>
                <option value="MODERATOR">审核员</option>
                <option value="SUPERADMIN">超级管理员</option>
              </Select>
            </Label>
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
                <ShieldCheck />
                {create.isPending ? "创建中..." : "创建"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
