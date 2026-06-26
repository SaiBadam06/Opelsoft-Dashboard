import Image from "next/image";
import { cn } from "@/lib/utils";

// Branded loading animation: the OpelSoft logo with a pulsing glow and an
// indeterminate progress bar in the brand color.
export function BrandLoader({
  className,
  label = "Loading…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center py-24",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <Image
          src="/logo.svg"
          alt="OpelSoft"
          width={180}
          height={48}
          priority
          className="h-10 w-auto animate-pulse"
        />
        <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="brand-loader-bar h-full w-1/2 rounded-full bg-primary" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
