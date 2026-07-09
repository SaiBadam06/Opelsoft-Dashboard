/**
 * Apply a SQL migration file to the linked Supabase project via Management API.
 *
 * Get a personal access token from https://supabase.com/dashboard/account/tokens
 * then run:
 *
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/apply-migration-remote.mjs supabase/migrations/0007_submission_status_pipeline.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnvLocal() {
  const envPath = join(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnvLocal();

const projectRef = "zhohylkyzuqawpygmjbf";
const file = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!file) {
  console.error("Usage: node scripts/apply-migration-remote.mjs <sql-file>");
  process.exit(1);
}
if (!token) {
  console.error(
    "Set SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)",
  );
  process.exit(1);
}

const sql = readFileSync(resolve(file), "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await res.text();
if (!res.ok) {
  console.error(`Migration failed (${res.status}):`, body);
  process.exit(1);
}

console.log("Migration applied successfully.");
if (body && body !== "[]" && body !== "{}") console.log(body);
