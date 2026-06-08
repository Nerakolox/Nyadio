import faviconUrl from "../../favicon.png";
import { cn } from "../lib/utils";

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
}

export function BrandMark({ className, imageClassName }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center",
        className
      )}
    >
      <img src={faviconUrl} alt="Nyadio" className={cn("size-full object-contain", imageClassName)} />
    </span>
  );
}

export { faviconUrl };
