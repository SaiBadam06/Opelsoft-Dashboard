"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, canAccess, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => canAccess(role, i.minRole));

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
      <div className="px-5 py-4 text-lg font-semibold">OpelSoft</div>
      <nav className="flex flex-col gap-1 px-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                active && "bg-muted font-medium text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
