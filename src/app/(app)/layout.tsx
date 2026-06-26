import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={profile.role} />
      <div className="flex flex-1 flex-col">
        <Topbar profile={profile} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
