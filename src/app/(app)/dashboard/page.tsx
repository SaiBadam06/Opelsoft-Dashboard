import {
  getDashboardMetrics,
  getPipelineDistribution,
  getRecentActivity,
} from "@/lib/dashboard";
import { StatCards } from "@/components/dashboard/stat-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";

export default async function DashboardPage() {
  const [metrics, activity, pipeline] = await Promise.all([
    getDashboardMetrics(),
    getRecentActivity(),
    getPipelineDistribution(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Today&apos;s overview</p>
      </div>
      <StatCards metrics={metrics} />
      <div className="grid gap-4 lg:grid-cols-3">
        <PipelineChart data={pipeline} className="lg:col-span-2" />
        <RecentActivity items={activity} />
      </div>
    </div>
  );
}
