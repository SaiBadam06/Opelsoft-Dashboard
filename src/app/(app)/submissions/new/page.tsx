import { candidateOptions } from "@/lib/candidates";
import { requirementOptions } from "@/lib/requirements";
import { vendorOptions } from "@/lib/vendors";
import { SubmissionForm } from "../submission-form";

export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ candidate_id?: string; requirement_id?: string }>;
}) {
  const sp = await searchParams;
  const [candidates, requirements, vendors] = await Promise.all([
    candidateOptions(),
    requirementOptions(),
    vendorOptions(),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          New submission
        </h1>
        <p className="text-sm text-muted-foreground">
          Submit a candidate to a requirement
        </p>
      </div>

      <SubmissionForm
        candidates={candidates}
        requirements={requirements}
        vendors={vendors}
        today={today}
        defaultCandidateId={sp.candidate_id}
        defaultRequirementId={sp.requirement_id}
      />
    </div>
  );
}
