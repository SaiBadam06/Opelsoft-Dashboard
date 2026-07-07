import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ApplyThankYouPage() {
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
      <Button render={<Link href="/careers" />}>Browse more jobs</Button>
    </div>
  );
}
