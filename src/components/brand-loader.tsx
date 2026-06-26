import Image from "next/image";
import { cn } from "@/lib/utils";

// Full-viewport branded loader: two counter-rotating gradient arcs orbiting the
// logo mark, centered on the whole page. Pure Tailwind (border arcs + animate-spin),
// no custom keyframes, so it always runs.
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
        "fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-7">
        <div className="relative grid size-20 place-items-center">
          {/* Outer arc — clockwise */}
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary [animation-duration:0.9s]" />
          {/* Inner arc — counter-clockwise, slower */}
          <span className="absolute inset-[0.45rem] animate-spin rounded-full border-2 border-transparent border-b-primary/50 border-l-primary/50 [animation-direction:reverse] [animation-duration:1.5s]" />
          <Image
            src="/logo.svg"
            alt="OpelSoft"
            width={36}
            height={36}
            priority
            className="size-7 object-cover object-left"
          />
        </div>
        <span className="text-sm font-medium tracking-wide text-muted-foreground animate-pulse">
          {label}
        </span>
      </div>
    </div>
  );
}
