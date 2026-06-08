import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Send, UploadCloud } from "lucide-react";
import { ApiError } from "../../api/client";
import { useCreateSubmission, usePublicChannels } from "../../api/public/hooks";
import type { Protocol } from "../../api/public/types";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

type Mode = "none" | "existing" | "new";
type ContactType = "email" | "qq";

const protocols: Protocol[] = ["HLS", "ICECAST", "HTTP_PUSH"];

function contactTypeLabel(type: ContactType): string {
  return type === "qq" ? "QQ" : "邮箱";
}

function initialForm() {
  return {
    url: "",
    protocol: "HLS" as Protocol,
    mode: "none" as Mode,
    targetChannelId: "",
    suggestedSlug: "",
    suggestedName: "",
    note: "",
    contactType: "email" as ContactType,
    contact: ""
  };
}

export function SubmitPage() {
  const channels = usePublicChannels();
  const create = useCreateSubmission();
  const [form, setForm] = useState(initialForm);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ id: string; createdAt: string } | null>(null);

  const channelOptions = useMemo(() => channels.data ?? [], [channels.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    try {
      new URL(form.url);
    } catch {
      errors.url = "请输入有效的 URL。";
    }
    if (form.mode === "existing" && !form.targetChannelId) {
      errors.targetChannelId = "请选择要绑定的频道。";
    }
    if (form.mode === "new") {
      if (!/^[a-z0-9-]{3,50}$/.test(form.suggestedSlug)) {
        errors.suggestedSlug = "slug 需要是 3-50 位小写字母、数字或连字符。";
      }
      if (!form.suggestedName.trim()) {
        errors.suggestedName = "请填写建议频道名称。";
      }
    }
    const contact = form.contact.trim();
    if (contact) {
      if (form.contactType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        errors.contact = "请输入有效的邮箱地址。";
      }
      if (form.contactType === "qq" && !/^[1-9]\d{4,11}$/.test(contact)) {
        errors.contact = "QQ 号需要是 5-12 位数字。";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldError(errors);
      return;
    }

    setFieldError({});
    try {
      const result = await create.mutateAsync({
        url: form.url.trim(),
        protocol: form.protocol,
        targetChannelId: form.mode === "existing" ? form.targetChannelId : null,
        suggestedSlug: form.mode === "new" ? form.suggestedSlug.trim().toLowerCase() : null,
        suggestedName: form.mode === "new" ? form.suggestedName.trim() : null,
        note: form.note.trim() || null,
        contact: contact ? `${contactTypeLabel(form.contactType)}：${contact}` : null
      });
      setSuccess({ id: result.id, createdAt: result.createdAt });
      setForm(initialForm());
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setFieldError({ form: "投稿过于频繁，请稍后再试。" });
      } else {
        setFieldError({ url: "URL 格式有误或包含不支持的地址。" });
      }
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-[var(--nya-radius-lg)] bg-[var(--nya-success-bg)] text-[var(--nya-success-text)]">
              <CheckCircle2 className="size-7" />
            </div>
            <CardTitle className="text-2xl">投稿已提交</CardTitle>
            <CardDescription>管理员审核后会更新频道源或创建新频道。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 text-center">
            <p className="font-mono text-sm text-[var(--nya-text-tertiary)]">投稿编号：{success.id}</p>
            <Button onClick={() => setSuccess(null)} className="mx-auto">
              继续投稿
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-8 max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-xs font-bold text-[var(--nya-primary-strong)] shadow-[var(--nya-shadow-sm)]">
          <UploadCloud className="size-3.5" />
          投稿入口
        </div>
        <h1 className="font-[var(--nya-font-display)] text-4xl font-bold text-[var(--nya-text)]">提交一个音频源</h1>
        <p className="mt-3 text-base leading-7 text-[var(--nya-text-secondary)]">
          可以绑定到已有频道，也可以建议新建频道；所有 URL 都会经过服务端安全校验。
        </p>
      </section>

      <Card>
        <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)]">
          <CardTitle>投稿表单</CardTitle>
          <CardDescription>请提供稳定可访问的 HLS、Icecast 或 HTTP 音频源。</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <Label>
                源 URL
                <Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com/live" />
                {fieldError.url && <span className="text-xs font-semibold text-[var(--nya-danger-text)]">{fieldError.url}</span>}
              </Label>
              <Label>
                协议
                <Select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as Protocol })}>
                  {protocols.map((protocol) => (
                    <option key={protocol}>{protocol}</option>
                  ))}
                </Select>
              </Label>
            </div>

            <div className="grid gap-3">
              <div className="text-sm font-semibold text-[var(--nya-text)]">目标频道</div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["none", "不指定", "只提交源，由管理员判断"],
                  ["existing", "绑定已有", "建议替换某个频道的源"],
                  ["new", "建议新建", "提供新频道名称和 slug"]
                ].map(([value, title, text]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer gap-3 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-3 text-sm"
                  >
                    <input
                      type="radio"
                      className="mt-1 size-4 accent-[var(--nya-primary-fill)]"
                      checked={form.mode === value}
                      onChange={() => setForm({ ...form, mode: value as Mode })}
                    />
                    <span>
                      <span className="block font-bold text-[var(--nya-text)]">{title}</span>
                      <span className="mt-1 block leading-5 text-[var(--nya-text-secondary)]">{text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {form.mode === "existing" && (
              <Label>
                已有频道
                <Select value={form.targetChannelId} onChange={(event) => setForm({ ...form, targetChannelId: event.target.value })}>
                  <option value="">请选择频道</option>
                  {channelOptions.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name} / {channel.slug}
                    </option>
                  ))}
                </Select>
                {fieldError.targetChannelId && <span className="text-xs font-semibold text-[var(--nya-danger-text)]">{fieldError.targetChannelId}</span>}
              </Label>
            )}

            {form.mode === "new" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Label>
                  建议 slug
                  <Input value={form.suggestedSlug} onChange={(event) => setForm({ ...form, suggestedSlug: event.target.value.toLowerCase() })} />
                  {fieldError.suggestedSlug && <span className="text-xs font-semibold text-[var(--nya-danger-text)]">{fieldError.suggestedSlug}</span>}
                </Label>
                <Label>
                  建议名称
                  <Input value={form.suggestedName} onChange={(event) => setForm({ ...form, suggestedName: event.target.value })} />
                  {fieldError.suggestedName && <span className="text-xs font-semibold text-[var(--nya-danger-text)]">{fieldError.suggestedName}</span>}
                </Label>
              </div>
            )}

            <Label>
              备注
              <Textarea value={form.note} maxLength={500} onChange={(event) => setForm({ ...form, note: event.target.value })} />
              <span className="text-xs text-[var(--nya-text-tertiary)]">{form.note.length}/500</span>
            </Label>
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <Label>
                联系方式类型
                <Select value={form.contactType} onChange={(event) => setForm({ ...form, contactType: event.target.value as ContactType })}>
                  <option value="email">邮箱</option>
                  <option value="qq">QQ</option>
                </Select>
              </Label>
              <Label>
                联系方式
                <Input
                  value={form.contact}
                  maxLength={100}
                  inputMode={form.contactType === "qq" ? "numeric" : "email"}
                  placeholder={form.contactType === "qq" ? "例如 123456789" : "name@example.com"}
                  onChange={(event) => setForm({ ...form, contact: event.target.value })}
                />
                {fieldError.contact && <span className="text-xs font-semibold text-[var(--nya-danger-text)]">{fieldError.contact}</span>}
              </Label>
            </div>

            {fieldError.form && (
              <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                {fieldError.form}
              </div>
            )}

            <div className="flex justify-end">
              <Button disabled={create.isPending}>
                <Send className="size-4" />
                {create.isPending ? "提交中..." : "提交投稿"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
