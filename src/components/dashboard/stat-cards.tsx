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
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Metric = {
  label: string;
  icon: LucideIcon;
  chip: string;
};

const METRICS: Metric[] = [
  { label: "Total Candidates", icon: Users, chip: "bg-info text-info-foreground" },
  { label: "Active Candidates", icon: UserCheck, chip: "bg-success text-success-foreground" },
  { label: "Active Requirements", icon: Briefcase, chip: "bg-brand text-primary-foreground" },
  { label: "Recruiters", icon: Headset, chip: "bg-info text-info-foreground" },
  { label: "Interviews Today", icon: CalendarClock, chip: "bg-warning text-warning-foreground" },
  { label: "Placements", icon: Award, chip: "bg-success text-success-foreground" },
  { label: "Pending Follow-ups", icon: BellRing, chip: "bg-warning text-warning-foreground" },
  { label: "Submissions Today", icon: Send, chip: "bg-brand text-primary-foreground" },
  { label: "Offers Released", icon: FileCheck, chip: "bg-info text-info-foreground" },
  { label: "Rejected", icon: XCircle, chip: "bg-destructive text-white" },
];

export function StatCards() {
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
      {METRICS.map(({ label, icon: Icon, chip }) => (
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
            <span className="text-3xl font-semibold tracking-tight">—</span>
            <span className="text-xs text-muted-foreground">Live in Plan 4</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
