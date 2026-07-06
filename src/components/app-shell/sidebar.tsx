"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Briefcase,
  Send,
  CalendarClock,
  Award,
  Building2,
  ListTodo,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { type Role, canAccess, NAV_ITEMS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/candidates": Users,
  "/pipeline": KanbanSquare,
  "/requirements": Briefcase,
  "/submissions": Send,
  "/interviews": CalendarClock,
  "/placements": Award,
  "/vendors": Building2,
  "/tasks": ListTodo,
  "/logs": ScrollText,
  "/users": ShieldCheck,
};

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => canAccess(role, item.minRole));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 py-4">
        <Link
          href="/dashboard"
          className="flex h-9 items-center px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Image
            src="/logo.svg"
            alt="OpelSoft"
            width={150}
            height={36}
            priority
            className="h-9 w-auto group-data-[collapsible=icon]:hidden"
          />
          <Image
            src="/logo.svg"
            alt="OpelSoft"
            width={36}
            height={36}
            priority
            className="hidden h-8 w-8 max-w-8 object-cover object-left group-data-[collapsible=icon]:block"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[0.7rem] font-semibold tracking-wider text-muted-foreground/70 uppercase">
            Workspace
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {items.map((item) => {
              const Icon = ICON_MAP[item.href];
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      "h-11 gap-3 rounded-xl text-sm font-medium transition-colors [&>svg]:size-[1.15rem] [&>svg]:shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary hover:text-primary-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                    )}
                    render={<Link href={item.href} />}
                  >
                    {Icon ? <Icon strokeWidth={2} /> : null}
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
