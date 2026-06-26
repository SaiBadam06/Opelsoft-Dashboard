"use client";

import { useEffect, useState } from "react";
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
  type LucideIcon,
} from "lucide-react";

import { type Role, canAccess, NAV_ITEMS } from "@/lib/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/consultants": Users,
  "/pipeline": KanbanSquare,
  "/requirements": Briefcase,
  "/submissions": Send,
  "/interviews": CalendarClock,
  "/placements": Award,
  "/vendors": Building2,
  "/tasks": ListTodo,
  "/users": ShieldCheck,
};

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = NAV_ITEMS.filter((item) => canAccess(role, item.minRole));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex h-8 items-center px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Image
            src="/logo.svg"
            alt="OpelSoft"
            width={120}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => {
              const Icon = ICON_MAP[item.href];
              const isActive =
                mounted &&
                (pathname === item.href ||
                  pathname.startsWith(`${item.href}/`));
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    {Icon ? <Icon /> : null}
                    <span>{item.label}</span>
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
