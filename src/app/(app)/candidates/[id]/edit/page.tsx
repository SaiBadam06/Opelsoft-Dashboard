import { notFound } from "next/navigation";

import { getCandidate } from "@/lib/candidates";
import { CandidateForm } from "@/app/(app)/candidates/candidate-form";

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Edit candidate</h1>
        <p className="text-sm text-muted-foreground">
          Update {candidate.full_name}&apos;s details.
        </p>
      </div>
      <CandidateForm candidate={candidate} />
    </div>
  );
}
