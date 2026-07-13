import { vendorOptions } from "@/lib/vendors";
import { Composer } from "./Composer";

export default async function NewCampaignPage() {
  const vendors = await vendorOptions();
  const senders = (process.env.EMAIL_SENDER_ADDRESSES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaultReplyTo = process.env.EMAIL_DEFAULT_REPLY_TO ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-muted-foreground">
          Compose an email and choose recipients. Sending starts as soon as you create the campaign.
        </p>
      </div>
      <Composer
        vendors={vendors.filter((v) => !!v.email)}
        senders={senders}
        defaultReplyTo={defaultReplyTo}
      />
    </div>
  );
}
