import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const local = loadEnv(join(root, ".env.local"));
const GCP_PROJECT_ID = "staffingos-500618";
const GCP_REGION = "us-central1";
const SITE_URL = "https://opelsoft-dashboard-ulla3fdzha-uc.a.run.app";
const SUPABASE_URL = local.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SMTP_USER = local.SMTP_USER;
const SMTP_FROM = local.SMTP_FROM ?? local.SMTP_USER;
const SERVICE_NAME = "opelsoft-dashboard";
const IMAGE_TAG = "latest";
const IMAGE = `${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/opelsoft/${SERVICE_NAME}:${IMAGE_TAG}`;

for (const [key, val] of Object.entries({
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SMTP_USER,
  SMTP_FROM,
})) {
  if (!val) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
}

function run(cmd, args) {
  console.log(`\n==> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("gcloud", [
  "builds",
  "submit",
  "--project",
  GCP_PROJECT_ID,
  "--config",
  "cloudbuild.yaml",
  "--substitutions",
  `_IMAGE=${IMAGE},_SUPABASE_URL=${SUPABASE_URL},_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},_SITE_URL=${SITE_URL}`,
]);

const envVars = [
  `NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}`,
  `NEXT_PUBLIC_SITE_URL=${SITE_URL}`,
  `SITE_URL=${SITE_URL}`,
  `DEFAULT_CAREER_SITE_SLUG=opelsoft`,
  `SMTP_USER=${SMTP_USER}`,
  `SMTP_FROM=${SMTP_FROM}`,
].join(",");

run("gcloud", [
  "run",
  "deploy",
  SERVICE_NAME,
  "--project",
  GCP_PROJECT_ID,
  "--image",
  IMAGE,
  "--region",
  GCP_REGION,
  "--no-invoker-iam-check",
  "--port",
  "8080",
  "--memory",
  "1Gi",
  "--max-instances",
  "3",
  "--set-env-vars",
  envVars,
  "--set-secrets",
  "SUPABASE_SERVICE_ROLE_KEY=opelsoft-service-role:latest,SMTP_PASS=opelsoft-smtp-pass:latest,GEMINI_API_KEY=opelsoft-gemini-key:latest",
]);

console.log(`\nDeployed: ${SITE_URL}`);
