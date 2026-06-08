import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full cursor-pointer rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 text-sm text-[var(--nya-text)] shadow-[var(--nya-shadow-sm)] outline-none transition focus:border-[var(--nya-primary)] focus:ring-4 focus:ring-[var(--nya-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
