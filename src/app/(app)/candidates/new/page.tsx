import { CandidateForm } from "@/app/(app)/candidates/candidate-form";

export default function NewCandidatePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">New candidate</h1>
        <p className="text-sm text-muted-foreground">
          Add a candidate to the bench and start tracking them through the
          pipeline.
        </p>
      </div>
      <CandidateForm />
    </div>
  );
}
