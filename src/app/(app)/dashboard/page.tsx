import { StatCards } from "@/components/dashboard/stat-cards";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Today&apos;s overview</p>
      </div>
      <StatCards />
    </div>
  );
}
