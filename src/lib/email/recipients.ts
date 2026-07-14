import * as XLSX from "xlsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SPREADSHEET_ROWS = 20_000;

export type ParsedRecipient = { email: string; mergeData: Record<string, string> };

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}
export function isValidEmail(e: string): boolean {
  return EMAIL_RE.test(e.trim());
}
export function parseManualList(raw: string): ParsedRecipient[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email: normalizeEmail(email), mergeData: {} }));
}
export function dedupe(list: ParsedRecipient[]): ParsedRecipient[] {
  const seen = new Set<string>();
  const out: ParsedRecipient[] = [];
  for (const r of list) {
    const key = normalizeEmail(r.email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, email: key });
  }
  return out;
}
export function validate(list: ParsedRecipient[]): { valid: ParsedRecipient[]; invalid: string[] } {
  const valid: ParsedRecipient[] = [];
  const invalid: string[] = [];
  for (const r of list) {
    if (isValidEmail(r.email)) valid.push(r);
    else invalid.push(r.email);
  }
  return { valid, invalid };
}
export function parseSpreadsheet(buf: ArrayBuffer): ParsedRecipient[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // ponytail: hard row cap, not a streaming parser — fine at this campaign scale, revisit if a legit list exceeds it.
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).slice(0, MAX_SPREADSHEET_ROWS);
  const out: ParsedRecipient[] = [];
  for (const row of rows) {
    const entries = Object.entries(row).map(
      ([k, v]) => [k.toLowerCase().trim().replace(/\W+/g, "_"), String(v ?? "").trim()] as const,
    );
    const emailEntry = entries.find(([k]) => k === "email" || k.includes("email"));
    if (!emailEntry || !emailEntry[1]) continue;
    const mergeData: Record<string, string> = {};
    for (const [k, v] of entries) mergeData[k] = v;
    out.push({ email: normalizeEmail(emailEntry[1]), mergeData });
  }
  return out;
}
