"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { slugifyJobTitle } from "@/lib/job-posting-slug";
import type { JobPostingStatus, WorkplaceType } from "@/lib/career-constants";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const supabase = await createClient();
  let slug = base;
  let n = 0;
  while (true) {
    let q = supabase.from("job_postings").select("id").eq("public_slug", slug);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

function parseWorkplace(v: string | null): WorkplaceType {
  if (v === "remote" || v === "hybrid" || v === "onsite") return v;
  return "onsite";
}

function postingPayload(fd: FormData) {
  return {
    title: String(fd.get("title") ?? "").trim(),
    location: str(fd, "location"),
    workplace_type: parseWorkplace(str(fd, "workplace_type")),
    employment_type: str(fd, "employment_type"),
    description: str(fd, "description"),
    skills: str(fd, "skills"),
    public_slug: str(fd, "public_slug"),
  };
}

function selectedSiteIds(fd: FormData): string[] {
  return fd
    .getAll("career_site_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

async function syncDistributions(
  postingId: string,
  siteIds: string[],
  publish: boolean,
) {
  const supabase = await createClient();
  const { data: channel } = await supabase
    .from("distribution_channels")
    .select("id")
    .eq("slug", "careers_site")
    .single();
  if (!channel) return { error: "Careers channel not configured." };

  const { data: existing } = await supabase
    .from("posting_distributions")
    .select("id, career_site_id")
    .eq("job_posting_id", postingId);

  const existingBySite = new Map(
    (existing ?? []).map((d) => [d.career_site_id as string, d.id as string]),
  );
  const selected = new Set(siteIds);
  const now = new Date().toISOString();

  for (const siteId of siteIds) {
    const distId = existingBySite.get(siteId);
    if (distId) {
      const { error } = await supabase
        .from("posting_distributions")
        .update({
          is_active: true,
          published_at: publish ? now : null,
        })
        .eq("id", distId);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("posting_distributions").insert({
        job_posting_id: postingId,
        distribution_channel_id: channel.id,
        career_site_id: siteId,
        is_active: true,
        published_at: publish ? now : null,
      });
      if (error) return { error: error.message };
    }
  }

  for (const [siteId, distId] of existingBySite) {
    if (!siteId || selected.has(siteId)) continue;
    const { error } = await supabase
      .from("posting_distributions")
      .update({ is_active: false })
      .eq("id", distId);
    if (error) return { error: error.message };
  }

  return { ok: true as const };
}

async function upsertPosting(
  requirementId: string,
  fd: FormData,
  status: JobPostingStatus,
) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const p = postingPayload(fd);
  if (!p.title) return { error: "Public title is required." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("job_postings")
    .select("id, public_slug")
    .eq("requirement_id", requirementId)
    .maybeSingle();

  const baseSlug = slugifyJobTitle(p.public_slug || p.title);
  const public_slug = existing
    ? (p.public_slug?.trim() || existing.public_slug)
    : await uniqueSlug(baseSlug);

  const row = {
    requirement_id: requirementId,
    public_slug,
    title: p.title,
    location: p.location,
    workplace_type: p.workplace_type,
    employment_type: p.employment_type,
    description: p.description,
    skills: p.skills,
    status,
    created_by: me.id,
  };

  if (existing) {
    const { error } = await supabase
      .from("job_postings")
      .update(row)
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { ok: true as const, postingId: existing.id, public_slug };
  }

  const { data, error } = await supabase
    .from("job_postings")
    .insert(row)
    .select("id, public_slug")
    .single();
  if (error) return { error: error.message };
  return { ok: true as const, postingId: data.id, public_slug: data.public_slug };
}

export async function saveJobPostingDraft(_prev: unknown, fd: FormData) {
  const requirementId = String(fd.get("requirement_id") ?? "");
  if (!requirementId) return { error: "Missing requirement." };

  const res = await upsertPosting(requirementId, fd, "draft");
  if ("error" in res) return res;

  const siteIds = selectedSiteIds(fd);
  if (siteIds.length > 0) {
    const sync = await syncDistributions(res.postingId, siteIds, false);
    if ("error" in sync) return sync;
  }

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/careers");
  return { ok: true as const, public_slug: res.public_slug };
}

export async function publishJobPosting(_prev: unknown, fd: FormData) {
  const requirementId = String(fd.get("requirement_id") ?? "");
  if (!requirementId) return { error: "Missing requirement." };

  const siteIds = selectedSiteIds(fd);
  if (siteIds.length === 0) {
    return { error: "Select at least one careers site to publish." };
  }

  const res = await upsertPosting(requirementId, fd, "published");
  if ("error" in res) return res;

  const sync = await syncDistributions(res.postingId, siteIds, true);
  if ("error" in sync) return sync;

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/careers");
  return { ok: true as const, public_slug: res.public_slug };
}

export async function closeJobPosting(requirementId: string) {
  const me = await getCurrentProfile();
  if (!me) return { error: "Not authorized" };

  const supabase = await createClient();
  const { data: posting } = await supabase
    .from("job_postings")
    .select("id")
    .eq("requirement_id", requirementId)
    .maybeSingle();
  if (!posting) return { error: "No posting found." };

  const { error } = await supabase
    .from("job_postings")
    .update({ status: "closed" })
    .eq("id", posting.id);
  if (error) return { error: error.message };

  await supabase
    .from("posting_distributions")
    .update({ is_active: false })
    .eq("job_posting_id", posting.id);

  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/careers");
  return { ok: true as const };
}
