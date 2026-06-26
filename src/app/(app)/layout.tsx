import type { CSSProperties } from "react";
import { requireProfile } from "@/lib/auth";
import { AppSidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "17.5rem" } as CSSProperties}
    >
      <AppSidebar role={profile.role} />
      <SidebarInset>
        <Topbar profile={profile} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
