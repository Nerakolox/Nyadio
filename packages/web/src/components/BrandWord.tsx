import { cn } from "../lib/utils";

interface BrandWordProps {
  className?: string;
}

export function BrandWord({ className }: BrandWordProps) {
  return (
    <span className={cn("font-[var(--nya-font-display)] text-xl", className)}>
      Nyadi<span className="text-[#fe728c]">o</span>
    </span>
  );
}
