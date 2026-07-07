"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import type { CareerSite } from "@/lib/career-sites";
import { buildCareersListUrl } from "@/lib/career-urls";
import { cn } from "@/lib/utils";
import { updateCareerSite } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function CareerSiteForm({ site }: { site: CareerSite }) {
  const [state, formAction, pending] = useActionState(updateCareerSite, null);
  const previewUrl = buildCareersListUrl(site);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={site.id} />

      {state && "error" in state ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state && "ok" in state ? (
        <p className="text-sm text-success">Saved.</p>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Branding</CardTitle>
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink />
            Preview careers page
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`name-${site.id}`}>Display name</Label>
            <Input
              id={`name-${site.id}`}
              name="name"
              required
              defaultValue={site.name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`slug-${site.id}`}>Slug</Label>
            <Input
              id={`slug-${site.id}`}
              value={site.slug}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`domain-${site.id}`}>Domain (production)</Label>
            <Input
              id={`domain-${site.id}`}
              name="domain"
              placeholder="opelsoft.com"
              defaultValue={site.domain ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`logo-${site.id}`}>Logo URL</Label>
            <Input
              id={`logo-${site.id}`}
              name="logo_url"
              type="url"
              placeholder="https://…"
              defaultValue={site.logo_url ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`color-${site.id}`}>Primary color</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`color-${site.id}`}
                name="primary_color"
                defaultValue={site.primary_color ?? "#2563eb"}
              />
              <span
                className="size-9 shrink-0 rounded-md border"
                style={{
                  backgroundColor: site.primary_color ?? "#2563eb",
                }}
                aria-hidden
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id={`active-${site.id}`}
              name="is_active"
              defaultChecked={site.is_active}
              className="size-4 rounded border"
            />
            <Label htmlFor={`active-${site.id}`}>Site active</Label>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`headline-${site.id}`}>Hero headline</Label>
            <Input
              id={`headline-${site.id}`}
              name="hero_headline"
              defaultValue={site.hero_headline ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`subtext-${site.id}`}>Hero subtext</Label>
            <Textarea
              id={`subtext-${site.id}`}
              name="hero_subtext"
              rows={3}
              defaultValue={site.hero_subtext ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save {site.name}
        </Button>
      </div>
    </form>
  );
}

export function CareerSiteEditor({ sites }: { sites: CareerSite[] }) {
  const [activeSlug, setActiveSlug] = useState(sites[0]?.slug ?? "");
  const active = sites.find((s) => s.slug === activeSlug) ?? sites[0];

  if (!active) {
    return (
      <p className="text-sm text-muted-foreground">
        No career sites found. Run migration 0008 first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => setActiveSlug(site.slug)}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              site.slug === activeSlug
                ? "border-primary bg-primary/10 text-primary"
                : "hover:bg-muted",
            )}
          >
            {site.name}
            {!site.is_active ? (
              <span className="ml-2 text-xs text-muted-foreground">
                (inactive)
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <CareerSiteForm key={active.id} site={active} />
    </div>
  );
}
