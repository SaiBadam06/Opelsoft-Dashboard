import Image from "next/image";
import { cn } from "@/lib/utils";

// Modern branded loader: pulsing logo + a conic-gradient ring spinner driven by
// Tailwind's built-in `animate-spin` (no custom keyframes, so it always runs).
export function BrandLoader({
  className,
  label = "Loading…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("flex flex-1 items-center justify-center py-24", className)}
    >
      <div className="flex flex-col items-center gap-6">
        <Image
          src="/logo.svg"
          alt="OpelSoft"
          width={170}
          height={46}
          priority
          className="h-9 w-auto animate-pulse drop-shadow-md"
        />
        <div className="relative flex items-center justify-center">
          <div className="absolute size-10 animate-ping rounded-full bg-primary/20" />
          <div className="absolute size-6 animate-pulse rounded-full bg-primary/40" />
          <div className="size-3 rounded-full bg-primary" />
        </div>
        <span className="text-sm font-medium tracking-wide text-muted-foreground animate-pulse">{label}</span>
      </div>
    </div>
  );
}
