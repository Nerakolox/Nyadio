import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-[var(--nya-radius-pill)] border border-[var(--nya-border)] bg-[var(--nya-surface-subtle)] px-3 text-xs font-semibold text-[var(--nya-text-secondary)]",
        className
      )}
      {...props}
    />
  );
}
