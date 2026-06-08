import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--nya-radius-md)] px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--nya-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[var(--nya-primary-fill)] bg-[var(--nya-primary-fill)] text-[var(--nya-on-primary)] shadow-[var(--nya-shadow-sm)] hover:bg-[var(--nya-primary-hover)]",
        secondary:
          "border border-[var(--nya-border-strong)] bg-[var(--nya-surface)] text-[var(--nya-text)] hover:border-[var(--nya-primary)] hover:bg-[var(--nya-surface-subtle)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--nya-text-secondary)] hover:bg-[var(--nya-surface-subtle)] hover:text-[var(--nya-text)]",
        danger:
          "border border-[var(--nya-danger)] bg-[var(--nya-danger)] text-white hover:bg-[var(--nya-danger-text)]"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10 px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
