export type Role = "admin" | "coordinator";
export type Access = "admin" | "any";

export function canAccess(role: Role, required: Access): boolean {
  if (required === "any") return true;
  return role === "admin";
}

export interface NavItem {
  label: string;
  href: string;
  minRole: Access;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", minRole: "any" },
  { label: "Candidates", href: "/candidates", minRole: "any" },
  { label: "Skill Search", href: "/search", minRole: "any" },
  { label: "Pipeline", href: "/pipeline", minRole: "any" },
  { label: "Requirements", href: "/requirements", minRole: "any" },
  { label: "Submissions", href: "/submissions", minRole: "any" },
  { label: "Interviews", href: "/interviews", minRole: "any" },
  { label: "Placements", href: "/placements", minRole: "any" },
  { label: "Vendors", href: "/vendors", minRole: "any" },
  { label: "Tasks", href: "/tasks", minRole: "any" },
  { label: "Activity Logs", href: "/logs", minRole: "admin" },
  { label: "Users", href: "/users", minRole: "admin" },
];
