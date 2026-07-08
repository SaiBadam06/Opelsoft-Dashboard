import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveCareerSite } from "@/lib/career-sites";
import { withCareersSiteQuery } from "@/lib/career-urls";

export default async function ApplyThankYouPage() {
  const site = await resolveCareerSite();
  const careersHref = site
    ? withCareersSiteQuery("/careers", site)
    : "/careers";

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
      <CheckCircle2 className="mx-auto size-12 text-success" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Application received</h1>
        <p className="text-muted-foreground">
          Thank you for applying. Our recruiting team will review your
          application and reach out if there is a match.
        </p>
      </div>
      <Button render={<Link href={careersHref} />}>Browse more jobs</Button>
    </div>
  );
}
