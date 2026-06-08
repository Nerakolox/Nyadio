import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[var(--nya-radius-md)] border border-[var(--nya-border)] bg-[var(--nya-surface)] px-3 text-sm text-[var(--nya-text)] shadow-[var(--nya-shadow-sm)] outline-none transition placeholder:text-[var(--nya-text-tertiary)] focus:border-[var(--nya-primary)] focus:ring-4 focus:ring-[var(--nya-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
