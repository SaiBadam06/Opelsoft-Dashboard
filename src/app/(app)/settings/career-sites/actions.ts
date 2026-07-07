"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

export async function updateCareerSite(_prev: unknown, fd: FormData) {
  await requireAdmin();

  const id = String(fd.get("id") ?? "").trim();
  if (!id) return { error: "Missing site id." };

  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const primaryColor = str(fd, "primary_color") ?? "#2563eb";
  const isActive = ["on", "true", "1"].includes(
    String(fd.get("is_active") ?? "").toLowerCase(),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("career_sites")
    .update({
      name,
      domain: str(fd, "domain"),
      logo_url: str(fd, "logo_url"),
      primary_color: primaryColor,
      hero_headline: str(fd, "hero_headline"),
      hero_subtext: str(fd, "hero_subtext"),
      is_active: isActive,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/settings/career-sites");
  revalidatePath("/careers");
  return { ok: true as const };
}
