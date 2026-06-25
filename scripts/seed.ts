import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const email = process.env.SEED_ADMIN_EMAIL!;
const password = process.env.SEED_ADMIN_PASSWORD!;

if (!url || !serviceKey || !email || !password) {
  throw new Error("Missing env: SUPABASE URL/SERVICE_ROLE/SEED_ADMIN_* required");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Create (or find) the admin auth user, email pre-confirmed
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "OpelSoft Admin" },
  });

  let userId = created?.user?.id;

  if (createErr) {
    if (!createErr.message.toLowerCase().includes("already")) throw createErr;
    // Already exists — look up the id
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    userId = list.users.find((u) => u.email === email)?.id;
  }

  if (!userId) throw new Error("Could not resolve admin user id");

  // Promote to admin (trigger created the profile with default 'coordinator')
  const { error: roleErr } = await admin
    .from("profiles")
    .update({ role: "admin", full_name: "OpelSoft Admin", is_active: true })
    .eq("id", userId);
  if (roleErr) throw roleErr;

  console.log(`Seeded admin: ${email} (id ${userId})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
