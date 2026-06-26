import { listCandidates } from "@/lib/candidates";
import { PipelineBoard } from "./pipeline-board";

export default async function PipelinePage() {
  const candidates = await listCandidates();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag candidates across stages
        </p>
      </div>

      <PipelineBoard candidates={candidates} />
    </div>
  );
}
