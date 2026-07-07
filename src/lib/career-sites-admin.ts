import { createClient } from "@/lib/supabase/server";

import type { CareerSite } from "@/lib/career-sites";



const SITE_COLUMNS =

  "id, slug, name, domain, logo_url, primary_color, hero_headline, hero_subtext, is_active";



/** All career sites for admin settings (includes inactive). */

export async function listAllCareerSites(): Promise<CareerSite[]> {

  const supabase = await createClient();

  const { data } = await supabase

    .from("career_sites")

    .select(SITE_COLUMNS)

    .order("slug");

  return (data as CareerSite[]) ?? [];

}



export async function getCareerSiteById(

  id: string,

): Promise<CareerSite | null> {

  const supabase = await createClient();

  const { data } = await supabase

    .from("career_sites")

    .select(SITE_COLUMNS)

    .eq("id", id)

    .maybeSingle();

  return (data as CareerSite | null) ?? null;

}


