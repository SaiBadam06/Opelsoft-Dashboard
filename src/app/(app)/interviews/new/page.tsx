import { candidateOptions } from "@/lib/candidates";
import { requirementOptions } from "@/lib/requirements";
import { InterviewForm } from "../interview-form";

export default async function NewInterviewPage() {
  const [candidates, requirements] = await Promise.all([
    candidateOptions(),
    requirementOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Log interview</h1>
        <p className="text-sm text-muted-foreground">
          Record an interview round and outcome
        </p>
      </div>

      <InterviewForm candidates={candidates} requirements={requirements} />
    </div>
  );
}
