import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Save, Settings } from "lucide-react";
import { useAdminSettings, useUpdateAdminSettings } from "../../api/admin/hooks";
import type { AppConfigKey } from "../../api/admin/types";
import { getRole } from "../../api/client";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const settingCopy: Record<AppConfigKey, { label: string; unit: string; description: string }> = {
  MAX_ACTIVE_CHANNELS: {
    label: "最大活跃频道数",
    unit: "个",
    description: "限制同时处于启动或运行状态的频道数量。"
  },
  ALWAYS_ON_ACTIVE_CHANNELS: {
    label: "启用频道常驻",
    unit: "0/1",
    description: "1 表示每个启用频道保留一个虚拟听众并自动预热，0 表示按空闲回收。"
  },
  HLS_SEGMENT_DURATION: {
    label: "HLS 分片时长",
    unit: "秒",
    description: "仅对新启动的 ffmpeg 进程生效，已运行频道不受影响。"
  },
  HLS_WINDOW_SIZE: {
    label: "HLS 窗口大小",
    unit: "段",
    description: "控制播放列表保留的最近分片数量，仅对新启动频道生效。"
  },
  IDLE_TIMEOUT_MS: {
    label: "空闲回收时间",
    unit: "毫秒",
    description: "频道没有听众和 HLS 轮询后，超过该时间会回收 ffmpeg。"
  },
  MAX_RETRY: {
    label: "最大重试次数",
    unit: "次",
    description: "ffmpeg 异常退出后的指数退避重试上限。"
  },
  SUBMISSION_RATE_LIMIT: {
    label: "投稿限流",
    unit: "次/小时/IP",
    description: "公开投稿接口按 IP 统计的每小时提交上限，保存后立即参与后续判断。"
  }
};

export function SettingsPage() {
  if (getRole() !== "SUPERADMIN") return <Navigate to="/admin/submissions" replace />;

  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();
  const [values, setValues] = useState<Partial<Record<AppConfigKey, string>>>({});
  const [saved, setSaved] = useState(false);

  const items = useMemo(() => settings.data ?? [], [settings.data]);

  useEffect(() => {
    if (!settings.data) return;
    setValues(Object.fromEntries(settings.data.map((item) => [item.key, String(item.value)])) as Record<AppConfigKey, string>);
  }, [settings.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const changed: Partial<Record<AppConfigKey, number>> = {};
    for (const item of items) {
      const next = Number.parseInt(values[item.key] ?? "", 10);
      if (Number.isFinite(next) && next !== item.value) changed[item.key] = next;
    }
    if (Object.keys(changed).length === 0) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
      return;
    }
    await update.mutateAsync(changed);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-4 rounded-[var(--nya-radius-xl)] border border-[var(--nya-border)] bg-[rgba(255,255,255,0.68)] p-5 shadow-[var(--nya-shadow-md)] backdrop-blur-xl md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 py-1 text-xs font-bold text-[var(--nya-primary-strong)]">
            <Settings className="size-3.5" />
            运行参数
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--nya-text)]">系统设置</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--nya-text-secondary)]">
            调整频道并发、HLS 输出、空闲回收、重试和投稿限流等运行时参数。
          </p>
        </div>
        <Badge>{items.length} 项配置</Badge>
      </div>

      <Card>
        <CardHeader className="border-b border-[var(--nya-border)] bg-[var(--nya-surface-subtle)]">
          <CardTitle>AppConfig</CardTitle>
          <CardDescription>配置值以数字形式保存到数据库，保存后后端会刷新内存配置。</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {settings.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[var(--nya-radius-lg)] bg-[var(--nya-surface-subtle)]" />
              ))}
            </div>
          ) : settings.error ? (
            <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
              系统设置加载失败。
            </div>
          ) : (
            <form className="grid gap-5" onSubmit={submit}>
              <div className="grid gap-4 lg:grid-cols-2">
                {items.map((item) => {
                  const copy = settingCopy[item.key];
                  return (
                    <Label
                      key={item.key}
                      className="rounded-[var(--nya-radius-lg)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] p-4"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-base font-bold text-[var(--nya-text)]">{copy.label}</span>
                          <span className="mt-1 block font-mono text-xs text-[var(--nya-text-tertiary)]">{item.key}</span>
                        </span>
                        <Badge>{copy.unit}</Badge>
                      </span>
                      <Input
                        className="mt-4"
                        type="number"
                        min={item.min}
                        max={item.max}
                        value={values[item.key] ?? String(item.value)}
                        onChange={(event) => setValues({ ...values, [item.key]: event.target.value })}
                        required
                      />
                      <span className="mt-2 block text-xs leading-5 text-[var(--nya-text-tertiary)]">
                        当前 {item.value}，默认 {item.defaultValue}，范围 {item.min}-{item.max}。{copy.description}
                      </span>
                    </Label>
                  );
                })}
              </div>

              {update.error && (
                <div className="rounded-[var(--nya-radius-md)] border border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] px-3 py-2 text-sm font-medium text-[var(--nya-danger-text)]">
                  {update.error.message}
                </div>
              )}

              <div className="flex justify-end">
                <Button disabled={update.isPending}>
                  <Save />
                  {update.isPending ? "保存中..." : "保存设置"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {saved && (
        <div className="fixed bottom-5 right-5 z-50 rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-4 py-3 text-sm font-semibold text-[var(--nya-success-text)] shadow-[var(--nya-shadow-lg)]">
          配置已保存并生效
        </div>
      )}
    </section>
  );
}
