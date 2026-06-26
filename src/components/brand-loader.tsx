import Image from "next/image";
import { cn } from "@/lib/utils";

// Branded loading animation: the OpelSoft logo with a gentle float and a
// Material-style indeterminate progress bar that sweeps across the track.
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
      <div className="flex flex-col items-center gap-5">
        <Image
          src="/logo.svg"
          alt="OpelSoft"
          width={180}
          height={48}
          priority
          className="brand-loader-logo h-10 w-auto"
        />
        <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-muted">
          <div className="brand-loader-bar bg-gradient-to-r from-primary to-info" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
