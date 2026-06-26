"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

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

  // Create the user silently (no Supabase email) or detect if they already exist.
  let reused = false;
  let userId: string | undefined;

  const created = await admin.auth.admin.createUser({ email, email_confirm: false });
  if (created.error) {
    const msg = created.error.message.toLowerCase();
    const exists =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists");
    if (!exists) return { error: created.error.message };
    reused = true;
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email === email)?.id;
  } else {
    userId = created.data.user?.id;
  }

  if (userId) {
    await admin
      .from("profiles")
      .upsert({ id: userId, email, role }, { onConflict: "id" });
  }

  // Generate a setup link and send it via our own SMTP.
  const linkType = reused ? "recovery" : "invite";
  const gen = await admin.auth.admin.generateLink({
    type: linkType,
    email,
    options: { redirectTo },
  });
  const token = gen.data?.properties?.hashed_token;
  let setupLink: string | null = null;
  if (token) {
    setupLink = `${site}/auth/confirm?token_hash=${token}&type=${linkType}&next=${encodeURIComponent(
      "/auth/set-password",
    )}`;
  }

  let emailed = false;
  if (setupLink) {
    emailed = await sendMail({
      to: email,
      subject: "You've been invited to OpelSoft Dashboard",
      text: `Hi,

You've been invited to join the OpelSoft Dashboard as a ${role}.

Click the link below to set your password and access the dashboard:

${setupLink}

This link expires in 24 hours. If you didn't expect this, you can ignore it.

— OpelSoft Team`,
    });
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
