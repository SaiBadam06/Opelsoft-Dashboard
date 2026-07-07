import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listDistributionChannels } from "@/lib/distribution-channels";
import { ChannelsTable } from "./channels-table";

export default async function DistributionChannelsPage() {
  await requireAdmin();
  const channels = await listDistributionChannels();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Distribution channels
        </h1>
        <p className="text-sm text-muted-foreground">
          Registry of where job postings can be distributed — careers sites,
          LinkedIn, Indeed, and other sources. Job board integrations are
          schema-ready but disabled until API work in a future sprint. Manage
          branding per site on{" "}
          <Link
            href="/settings/career-sites"
            className="text-primary underline-offset-4 hover:underline"
          >
            Career sites
          </Link>
          .
        </p>
      </div>

      <ChannelsTable channels={channels} />
    </div>
  );
}
