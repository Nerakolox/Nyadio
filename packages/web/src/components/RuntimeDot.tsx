import type { RuntimeState } from "../api/admin/types";
import { cn } from "../lib/utils";

const labels: Record<RuntimeState, string> = {
  running: "运行中",
  starting: "启动中",
  error: "异常",
  idle: "空闲",
  inactive: "已停用"
};

export function runtimeStateText(state: RuntimeState): string {
  return labels[state];
}

export function RuntimeDot({ state }: { state: RuntimeState }) {
  const tone = {
    running: "border-[var(--nya-success)] bg-[var(--nya-success-bg)] text-[var(--nya-success-text)] [&>span]:bg-[var(--nya-success)]",
    starting: "border-[var(--nya-warning)] bg-[var(--nya-warning-bg)] text-[var(--nya-warning-text)] [&>span]:bg-[var(--nya-warning)]",
    error: "border-[var(--nya-danger)] bg-[var(--nya-danger-bg)] text-[var(--nya-danger-text)] [&>span]:bg-[var(--nya-danger)]",
    idle: "border-[var(--nya-border-strong)] bg-[var(--nya-surface-subtle)] text-[var(--nya-text-secondary)] [&>span]:bg-[var(--nya-text-tertiary)]",
    inactive: "border-[var(--nya-border-strong)] bg-[var(--nya-surface-subtle)] text-[var(--nya-text-secondary)] [&>span]:bg-[var(--nya-text-tertiary)]"
  } satisfies Record<RuntimeState, string>;

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-20 items-center justify-center gap-2 rounded-[var(--nya-radius-pill)] border px-3 text-xs font-bold",
        tone[state]
      )}
    >
      <span className="size-2 rounded-full" />
      {labels[state]}
    </span>
  );
}
