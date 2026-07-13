"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import type { Candidate } from "@/lib/candidates";
import {
  PIPELINE_STAGES,
  stageLabel,
  type Option,
  type PipelineStage,
} from "@/lib/candidate-constants";
import { setStage } from "@/app/(app)/candidates/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function CandidateCard({
  candidate,
  overlay = false,
}: {
  candidate: Candidate;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: candidate.id });

  const style = overlay
    ? undefined
    : { transform: CSS.Translate.toString(transform) };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      size="sm"
      className={cn(
        "cursor-grab gap-1 p-3 ring-1 ring-foreground/10 select-none",
        isDragging && !overlay && "opacity-50",
        overlay && "cursor-grabbing shadow-lg",
      )}
      {...listeners}
      {...attributes}
    >
      <div className="text-sm font-medium">{candidate.full_name}</div>
      <div className="text-xs text-muted-foreground">
        ${candidate.rate ?? "—"}/hr · {candidate.visa ?? "—"}
      </div>
      {candidate.location ? (
        <div className="text-xs text-muted-foreground">{candidate.location}</div>
      ) : null}
    </Card>
  );
}

function Column({
  stage,
  candidates,
}: {
  stage: Option<PipelineStage>;
  candidates: Candidate[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-sm font-medium">{stage.label}</span>
        <Badge variant="secondary">{candidates.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-col gap-2 rounded-xl border bg-muted/40 p-2",
          isOver && "ring-2 ring-primary",
        )}
      >
        {candidates.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground/60">
            Drop here
          </div>
        ) : (
          candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({ candidates }: { candidates: Candidate[] }) {
  const [items, setItems] = useState<Candidate[]>(candidates);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [synced, setSynced] = useState<Candidate[]>(candidates);

  // Re-sync when the server sends fresh data (e.g. after adding/editing a
  // candidate elsewhere). Adjusting state during render when a prop changes is
  // the React-blessed pattern — no effect, no extra render pass.
  if (synced !== candidates) {
    setSynced(candidates);
    setItems(candidates);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeCandidate = activeId
    ? items.find((c) => c.id === activeId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const id = String(active.id);
    const newStage = over.id as PipelineStage;
    const candidate = items.find((c) => c.id === id);
    if (!candidate || candidate.pipeline_stage === newStage) return;

    const snapshot = items;
    setItems((cur) =>
      cur.map((c) =>
        c.id === id ? { ...c, pipeline_stage: newStage } : c,
      ),
    );

    const result = await setStage(id, newStage);
    if ("error" in result) {
      toast.error(result.error);
      setItems(snapshot);
    } else {
      toast.success(`Moved to ${stageLabel(newStage)}`);
    }
  }

  return (
    <DndContext
      id="pipeline-board"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <Column
            key={stage.value}
            stage={stage}
            candidates={items.filter(
              (c) => c.pipeline_stage === stage.value,
            )}
          />
        ))}
      </div>

      <DragOverlay>
        {activeCandidate ? (
          <CandidateCard candidate={activeCandidate} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
