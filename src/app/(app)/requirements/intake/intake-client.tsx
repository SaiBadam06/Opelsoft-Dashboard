"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Loader2,
  Sparkles,
  RotateCcw,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  Mail,
  ClipboardCheck,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  createRequirementFromIntake,
  extractRequirementAction,
} from "../actions";
import type { IntakeFormValues, VendorOption } from "@/lib/intake-map";
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  WORK_MODES,
  type RequirementPriority,
  type RequirementStatus,
} from "@/lib/job-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Field({
  label,
  name,
  defaultValue,
  hint,
  className,
  multiline,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="mb-1.5">
        {label}
      </Label>
      {multiline ? (
        <Textarea id={name} name={name} defaultValue={defaultValue} className="min-h-16" />
      ) : (
        <Input id={name} name={name} defaultValue={defaultValue} />
      )}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Bucket({
  title,
  tone,
  items,
  onRemove,
  onAdd,
  onMove,
  moveDir,
}: {
  title: string;
  tone: "must" | "nice";
  items: string[];
  onRemove: (i: number) => void;
  onAdd: (v: string) => void;
  onMove: (i: number) => void;
  moveDir: "right" | "left";
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (v) onAdd(v);
    setDraft("");
  };
  const chip =
    tone === "must"
      ? "bg-primary/10 text-primary ring-primary/20"
      : "bg-secondary text-secondary-foreground ring-foreground/10";
  return (
    <div className="rounded-lg border border-input p-3">
      <p className="mb-2 text-sm font-medium">
        {title}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          ({items.length})
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          items.map((skill, i) => (
            <span
              key={`${skill}-${i}`}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 ${chip}`}
            >
              <button
                type="button"
                title={moveDir === "right" ? "Move to nice-to-have" : "Move to must-have"}
                onClick={() => onMove(i)}
                className="opacity-60 hover:opacity-100"
              >
                {moveDir === "right" ? (
                  <ArrowRight className="size-3" />
                ) : (
                  <ArrowLeft className="size-3" />
                )}
              </button>
              {skill}
              <button
                type="button"
                title="Remove"
                onClick={() => onRemove(i)}
                className="opacity-60 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add skill…"
          className="h-7 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={commit}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}

// Two editable skill buckets. Hidden inputs keep the server action's
// comma-separated `skills` / `nice_to_have_skills` fields in sync.
// Defensive: always coerce to an array of skills. If a comma/newline string
// slips through (e.g. a stale build), split it instead of spreading it into
// individual characters.
function asSkillList(v: string[] | string): string[] {
  if (Array.isArray(v)) return v;
  return String(v)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function SkillBuckets({ must, nice }: { must: string[]; nice: string[] }) {
  const [mustList, setMustList] = useState(() => asSkillList(must));
  const [niceList, setNiceList] = useState(() => asSkillList(nice));

  return (
    <div>
      <input type="hidden" name="skills" value={mustList.join(", ")} />
      <input type="hidden" name="nice_to_have_skills" value={niceList.join(", ")} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Bucket
          title="Must-have skills"
          tone="must"
          items={mustList}
          moveDir="right"
          onRemove={(i) => setMustList((l) => l.filter((_, x) => x !== i))}
          onAdd={(v) => setMustList((l) => [...l, v])}
          onMove={(i) =>
            setMustList((l) => {
              setNiceList((n) => [...n, l[i]]);
              return l.filter((_, x) => x !== i);
            })
          }
        />
        <Bucket
          title="Nice-to-have skills"
          tone="nice"
          items={niceList}
          moveDir="left"
          onRemove={(i) => setNiceList((l) => l.filter((_, x) => x !== i))}
          onAdd={(v) => setNiceList((l) => [...l, v])}
          onMove={(i) =>
            setNiceList((l) => {
              setMustList((m) => [...m, l[i]]);
              return l.filter((_, x) => x !== i);
            })
          }
        />
      </div>
    </div>
  );
}

export function IntakeClient({ vendors }: { vendors: VendorOption[] }) {
  const [rawText, setRawText] = useState("");
  const [values, setValues] = useState<IntakeFormValues | null>(null);
  // Bumped on every extraction so the review form fully remounts with fresh
  // values (uncontrolled inputs otherwise keep stale defaults from the last run).
  const [runId, setRunId] = useState(0);
  const [isExtracting, startExtract] = useTransition();

  function handleExtract() {
    startExtract(async () => {
      const res = await extractRequirementAction(rawText, vendors);
      if ("error" in res) {
        toast.error(res.error);
        // Still let them fill manually when the AI fails but text exists.
        if (rawText.trim()) {
          setValues(BLANK);
          setRunId((n) => n + 1);
        }
        return;
      }
      setValues(res.values);
      setRunId((n) => n + 1);
      toast.success("Extracted — review and confirm below.");
    });
  }

  function reset() {
    setValues(null);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            Paste vendor email
          </CardTitle>
          <CardDescription>
            Paste the raw requirement email. AI extracts the fields; you review
            and confirm before anything is saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the full email here…"
            className="min-h-48 font-mono text-xs"
            disabled={isExtracting}
          />
          <div className="flex gap-2">
            <Button onClick={handleExtract} disabled={isExtracting || !rawText.trim()}>
              {isExtracting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {isExtracting ? "Extracting…" : "Extract with AI"}
            </Button>
            {values ? (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw />
                Clear review
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {values ? (
        <ReviewForm key={runId} values={values} vendors={vendors} sourceEmail={rawText} />
      ) : null}
    </div>
  );
}

const BLANK: IntakeFormValues = {
  title: "",
  vendor_id: "",
  vendor_name: "",
  end_client: "",
  location: "",
  skills: [],
  nice_to_have_skills: [],
  work_authorization: "",
  duration: "",
  work_mode: "",
  rate: "",
  closing_date: "",
  contact_name: "",
  contact_email: "",
  priority: "medium",
  status: "open",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReviewForm({
  values,
  vendors,
  sourceEmail,
}: {
  values: IntakeFormValues;
  vendors: VendorOption[];
  sourceEmail: string;
}) {
  const [state, formAction, pending] = useActionState(
    createRequirementFromIntake,
    null,
  );
  const [vendorId, setVendorId] = useState(values.vendor_id);
  const [priority, setPriority] = useState<RequirementPriority>(values.priority);
  const [status, setStatus] = useState<RequirementStatus>(values.status);
  const [workMode, setWorkMode] = useState(values.work_mode);

  useEffect(() => {
    if (state && "error" in state && state.error) toast.error(state.error);
  }, [state]);

  // The email named a vendor that isn't in the list and none is picked yet →
  // offer to add it, but only if the user explicitly confirms.
  const showAddVendor = !vendorId && !!values.vendor_name;

  const duplicate =
    state && "duplicate" in state ? state.duplicate : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" />
          Review extracted requirement
        </CardTitle>
        <CardDescription>
          Edit anything before saving. The original email is stored for
          traceability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="source_email_text" value={sourceEmail} />
          <input type="hidden" name="vendor_id" value={vendorId} />
          <input type="hidden" name="priority" value={priority} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="work_mode" value={workMode} />

          <Section title="Role & client">
          <Field label="Job title *" name="title" defaultValue={values.title} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => setVendorId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select vendor…" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="End client" name="end_client" defaultValue={values.end_client} />
          </div>

          {showAddVendor ? (
            <div className="space-y-2 rounded-lg border border-dashed border-input bg-muted/30 p-3">
              <p className="text-xs font-medium text-warning-foreground">
                “{values.vendor_name}” isn’t in your vendor list. Confirm the
                details and tick the box to add it.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <Label htmlFor="new_vendor_name" className="mb-1 text-xs text-muted-foreground">Vendor name</Label>
                  <Input id="new_vendor_name" name="new_vendor_name" defaultValue={values.vendor_name} />
                </div>
                <div>
                  <Label htmlFor="new_vendor_contact" className="mb-1 text-xs text-muted-foreground">Contact name</Label>
                  <Input id="new_vendor_contact" name="new_vendor_contact" defaultValue={values.contact_name} />
                </div>
                <div>
                  <Label htmlFor="new_vendor_email" className="mb-1 text-xs text-muted-foreground">Email</Label>
                  <Input id="new_vendor_email" name="new_vendor_email" defaultValue={values.contact_email} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="add_vendor" value="on" className="size-4 accent-primary" />
                Add this vendor to my list with the details above
              </label>
              <p className="text-xs text-muted-foreground">
                Leave unticked to save the requirement without a vendor, or pick an existing vendor above.
              </p>
            </div>
          ) : null}
          </Section>

          <Section title="Skills">
          <SkillBuckets must={values.skills} nice={values.nice_to_have_skills} />
          </Section>

          <Section title="Position details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Location" name="location" defaultValue={values.location} />
            <Field label="Rate" name="rate" defaultValue={values.rate} hint="Number is parsed from text (e.g. $70/hr → 70)." />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5">Work mode</Label>
              <Select value={workMode} onValueChange={(v) => setWorkMode(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Work authorization" name="work_authorization" defaultValue={values.work_authorization} />
            <Field label="Duration" name="duration" defaultValue={values.duration} />
          </div>
          </Section>

          <Section title="Contact & timeline">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contact name" name="contact_name" defaultValue={values.contact_name} />
            <Field label="Contact email" name="contact_email" defaultValue={values.contact_email} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5">Submission deadline</Label>
              <Input type="date" name="closing_date" defaultValue={values.closing_date} />
            </div>
            <div>
              <Label className="mb-1.5">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as RequirementPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_PRIORITIES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RequirementStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_STATUSES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          </Section>

          <details className="rounded-lg border border-input bg-muted/20 text-sm [&_summary]:cursor-pointer">
            <summary className="flex items-center gap-2 px-3 py-2 font-medium text-muted-foreground select-none">
              <FileText className="size-4" />
              Original email (stored for traceability)
            </summary>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t px-3 py-2 font-mono text-xs text-muted-foreground">
              {sourceEmail}
            </pre>
          </details>

          {duplicate ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-warning-foreground">
                <AlertTriangle className="size-4" />
                Possible duplicate
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                “{duplicate.title}” was already added for this vendor/client on{" "}
                {new Date(duplicate.created_at).toLocaleDateString()}. Edit the
                title or vendor and re-check, or create anyway if it’s genuinely
                a new requirement.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            {duplicate ? (
              <>
                <Button type="submit" variant="outline" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : null}
                  Re-check
                </Button>
                <Button
                  type="submit"
                  name="force"
                  value="1"
                  variant="destructive"
                  disabled={pending}
                >
                  Create anyway
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {pending ? "Saving…" : "Confirm & create requirement"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
