"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Award,
  BellRing,
  Briefcase,
  CalendarClock,
  FileCheck,
  Headset,
  Send,
  UserCheck,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/dashboard";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Metric = {
  label: string;
  icon: LucideIcon;
  chip: string;
  key: keyof DashboardMetrics;
};

const METRICS: Metric[] = [
  { label: "Total Candidates", icon: Users, chip: "bg-info text-info-foreground", key: "totalCandidates" },
  { label: "Active Candidates", icon: UserCheck, chip: "bg-success text-success-foreground", key: "activeCandidates" },
  { label: "Active Requirements", icon: Briefcase, chip: "bg-brand text-primary-foreground", key: "activeRequirements" },
  { label: "Recruiters", icon: Headset, chip: "bg-info text-info-foreground", key: "recruiters" },
  { label: "Interviews Today", icon: CalendarClock, chip: "bg-warning text-warning-foreground", key: "interviewsToday" },
  { label: "Placements", icon: Award, chip: "bg-success text-success-foreground", key: "placements" },
  { label: "Pending Follow-ups", icon: BellRing, chip: "bg-warning text-warning-foreground", key: "pendingFollowups" },
  { label: "Submissions Today", icon: Send, chip: "bg-brand text-primary-foreground", key: "submissionsToday" },
  { label: "Selected", icon: FileCheck, chip: "bg-info text-info-foreground", key: "offersReleased" },
  { label: "Rejected", icon: XCircle, chip: "bg-destructive text-white", key: "rejected" },
];

export function StatCards({ metrics }: { metrics: DashboardMetrics }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".stat-card", {
          opacity: 0,
          y: 14,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.06,
        });
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {METRICS.map(({ label, icon: Icon, chip, key }) => (
        <Card key={label} className="stat-card">
          <CardHeader>
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                chip,
              )}
            >
              <Icon className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-3xl font-semibold tracking-tight">
              {metrics[key]}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
