export type SpamWarning = { rule: string; message: string; severity: "low" | "high" };
export type SpamResult = { score: number; warnings: SpamWarning[] };

const TRIGGER_WORDS = [
  "free", "guarantee", "act now", "limited time", "urgent", "risk-free", "100%",
  "click here", "winner", "cash", "$$$", "earn money", "no cost", "cheap", "order now",
  "buy now", "double your", "extra income",
];

export function spamCheck(input: { subject: string; html: string }): SpamResult {
  const warnings: SpamWarning[] = [];
  const subject = input.subject ?? "";
  const html = input.html ?? "";
  const text = html.replace(/<[^>]+>/g, " ");
  const hay = `${subject} ${text}`.toLowerCase();
  const add = (rule: string, message: string, severity: "low" | "high") =>
    warnings.push({ rule, message, severity });

  for (const w of TRIGGER_WORDS) if (hay.includes(w)) add("trigger-word", `Spammy phrase: "${w}"`, "high");
  if (!subject.trim()) add("empty-subject", "Subject is empty", "high");
  if (subject.length > 90) add("long-subject", "Subject is very long (>90 chars)", "low");
  if (/!!!/.test(hay) || (hay.match(/!/g)?.length ?? 0) > 3) add("exclamation", "Too many exclamation marks", "low");
  if ((subject.match(/\b[A-Z]{4,}\b/g) ?? []).length > 0) add("all-caps", "ALL-CAPS word(s) in subject", "low");

  const links = (html.match(/<a\s/gi) ?? []).length;
  if (links > 5) add("many-links", `${links} links — keep cold outreach lean`, "low");
  if (/\b(bit\.ly|tinyurl|goo\.gl|t\.co)\b/i.test(html)) add("shortener", "URL shortener detected", "high");

  const imgs = (html.match(/<img\s/gi) ?? []).length;
  const textLen = text.replace(/\s+/g, " ").trim().length;
  if (imgs > 0 && textLen < 200) add("image-heavy", "Very little text relative to images", "high");
  if (/<img\s(?![^>]*\balt\s*=)[^>]*>/i.test(html)) add("img-alt", "Image missing alt text", "low");
  if (/color\s*:\s*(#c8[0-9a-f]{4}|#ff0000|red)\b/i.test(html)) add("red-text", "Red-colored text is a spam signal", "low");
  if (!/unsubscribe/i.test(html)) add("no-unsub-in-body", "No unsubscribe in body (auto-added at send)", "low");

  const score = warnings.reduce((s, w) => s + (w.severity === "high" ? 25 : 8), 0);
  return { score, warnings };
}
