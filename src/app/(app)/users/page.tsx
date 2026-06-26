import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { InviteForm } from "./invite-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type UserStatus = "Active" | "Invited" | "Disabled";

function statusOf(isActive: boolean, lastSignInAt: string | null): UserStatus {
  if (!isActive) return "Disabled";
  return lastSignInAt ? "Active" : "Invited";
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === "Active") {
    return <Badge className="bg-success text-success-foreground">Active</Badge>;
  }
  if (status === "Invited") {
    return (
      <Badge className="bg-warning text-warning-foreground">Invited</Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Disabled
    </Badge>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function UsersPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .order("created_at", { ascending: true });

  // Read auth metadata (last sign-in) via the service role to derive real
  // status — profiles.is_active alone defaults to true and can't tell whether
  // an invited user has actually accepted and signed in.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const lastSignInById = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  const rows = (profiles ?? []).map((p) => {
    const lastSignInAt = lastSignInById.get(p.id) ?? null;
    return { ...p, lastSignInAt, status: statusOf(p.is_active, lastSignInAt) };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates and manage access. Invited users stay{" "}
          <span className="font-medium">Invited</span> until they accept and sign
          in for the first time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a user</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Name</th>
                <th className="font-medium">Email</th>
                <th className="font-medium">Role</th>
                <th className="font-medium">Status</th>
                <th className="font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2.5">{u.full_name ?? "—"}</td>
                  <td className="text-muted-foreground">{u.email}</td>
                  <td className="capitalize">{u.role}</td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="text-muted-foreground">
                    {formatDate(u.lastSignInAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
