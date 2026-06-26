"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";

export async function signIn(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setPassword(_prev: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your link has expired. Ask an admin to re-invite you." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function inviteUser(_prev: unknown, formData: FormData) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Not authorized" };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "coordinator");
  if (!email) return { error: "Email is required." };
  if (role !== "admin" && role !== "coordinator") {
    return { error: "Invalid role" };
  }

  // Restrict invites to the company domains.
  const ALLOWED_DOMAINS = ["personaon.com", "opelsoft.com"];
  const domain = email.split("@")[1] ?? "";
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return {
      error: "Invites are limited to @personaon.com and @opelsoft.com addresses.",
    };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = `${site}/auth/callback`;

  // Send the email (via Supabase's configured SMTP). New email -> invite email
  // (also creates the user); existing -> password-recovery email.
  let reused = false;
  let userId: string | undefined;
  let emailed = true;

  const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inv.error) {
    const msg = inv.error.message.toLowerCase();
    const exists =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists");
    if (!exists) return { error: inv.error.message };
    reused = true;
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email === email)?.id;
    const anon = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const rec = await anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (rec.error) emailed = false;
  } else {
    userId = inv.data.user?.id;
  }

  if (userId) {
    // Upsert so a profile is guaranteed even if one is missing.
    await admin
      .from("profiles")
      .upsert({ id: userId, email, role }, { onConflict: "id" });
  }

  // Always also produce a copyable setup link (works even if email delivery
  // isn't configured yet). Uses a fresh recovery token via /auth/confirm.
  let setupLink: string | null = null;
  const gen = await admin.auth.admin.generateLink({ type: "recovery", email });
  const token = gen.data?.properties?.hashed_token;
  if (token) {
    setupLink = `${site}/auth/confirm?token_hash=${token}&type=recovery&next=${encodeURIComponent(
      "/auth/set-password",
    )}`;
  }

  return {
    ok: true as const,
    email,
    role,
    reused,
    emailed,
    setupLink,
  };
}

export async function updateUserRole(
  userId: string,
  role: "admin" | "coordinator",
) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Not authorized" };
  if (userId === me.id) {
    return { error: "You can't change your own role." };
  }
  if (role !== "admin" && role !== "coordinator") {
    return { error: "Invalid role" };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function deleteUser(userId: string) {
  const me = await getCurrentProfile();
  if (me?.role !== "admin") return { error: "Not authorized" };
  if (userId === me.id) {
    return { error: "You can't delete your own account." };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  // Deleting the auth user cascades to the profiles row (FK on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return { ok: true as const };
}
