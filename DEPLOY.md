# Deploying to Google Cloud Run

**This is the only supported production deploy path.** The legacy GCE/PM2 script lives
under `scripts/legacy/` for reference only.

The app is an SSR Next.js server (server actions, proxy auth, SMTP), so it runs as a
container on **Cloud Run**. Cloud Build builds the image in the cloud — you do **not**
need Docker installed locally.

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time (passed as
build args). Secret values (service-role key, SMTP password) are injected at runtime
via Secret Manager and never go into the image.

Replace `PROJECT_ID` and `REGION` (e.g. `us-central1`) throughout.

---

## Quick redeploy (after one-time setup)

```bash
export GCP_PROJECT_ID=PROJECT_ID
export GCP_REGION=us-central1
export SITE_URL=https://YOUR-SERVICE-URL
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
export SMTP_USER=you@opelsoft.com
export SMTP_FROM=you@opelsoft.com

./scripts/deploy-cloudrun.sh
```

---

## 0. Log in and select your project

```sh
gcloud auth login
gcloud config set project PROJECT_ID
```

## 1. Enable the required APIs

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 2. Create an Artifact Registry repo (image storage)

```sh
gcloud artifacts repositories create opelsoft --repository-format=docker --location=REGION
```

## 3. Store secrets in Secret Manager

Use the values from your `.env.local`. (Files avoid a trailing newline that can
break the SMTP password / JWT.)

PowerShell:

```powershell
"YOUR_SERVICE_ROLE_KEY" | Out-File -NoNewline -Encoding ascii sr.txt
gcloud secrets create opelsoft-service-role --data-file=sr.txt ; Remove-Item sr.txt

"YOUR_SMTP_APP_PASSWORD" | Out-File -NoNewline -Encoding ascii smtp.txt
gcloud secrets create opelsoft-smtp-pass --data-file=smtp.txt ; Remove-Item smtp.txt

"YOUR_GEMINI_API_KEY" | Out-File -NoNewline -Encoding ascii gemini.txt
gcloud secrets create opelsoft-gemini-key --data-file=gemini.txt ; Remove-Item gemini.txt
```

## 4. Let Cloud Run read those secrets

```sh
gcloud projects describe PROJECT_ID --format="value(projectNumber)"
```

Take the number it prints, then (`PROJECT_NUMBER` = that value):

```sh
gcloud secrets add-iam-policy-binding opelsoft-service-role --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding opelsoft-smtp-pass --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding opelsoft-gemini-key --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

## 5. Build and push the image

```sh
gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest,_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,_SUPABASE_ANON_KEY=YOUR_ANON_KEY,_SITE_URL=https://placeholder.run.app
```

## 6. Deploy to Cloud Run

```sh
gcloud run deploy opelsoft-dashboard --image REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest --region REGION --no-invoker-iam-check --port 8080 --memory 1Gi --max-instances 3 --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY,NEXT_PUBLIC_SITE_URL=https://YOUR-SERVICE-URL,SITE_URL=https://YOUR-SERVICE-URL,SMTP_USER=you@opelsoft.com,SMTP_FROM=you@opelsoft.com" --set-secrets "SUPABASE_SERVICE_ROLE_KEY=opelsoft-service-role:latest,SMTP_PASS=opelsoft-smtp-pass:latest,GEMINI_API_KEY=opelsoft-gemini-key:latest"
```

This prints a **Service URL** like `https://opelsoft-dashboard-xxxx.REGION.run.app`.

## 7. Point the app and Supabase at the real URL

```sh
gcloud run services update opelsoft-dashboard --region REGION --update-env-vars "NEXT_PUBLIC_SITE_URL=https://YOUR-SERVICE-URL,SITE_URL=https://YOUR-SERVICE-URL"
```

Then in **Supabase dashboard → Authentication → URL Configuration**:

- Set **Site URL** to the Cloud Run URL.
- Add the Cloud Run URL (and `.../auth/callback`, `.../auth/confirm`) to **Redirect URLs**.

Login, invites, and password setup links won't work until this is done.

## 8. Database

The Cloud Run app talks to the same Supabase project as your `.env.local`. Apply
**all** migrations under `supabase/migrations/` (through `0016`) in the SQL Editor,
then `npm run seed` / `npm run seed:all`.

The AI features (requirement email intake, ATS scoring) additionally require:
- `GEMINI_API_KEY` — stored as the `opelsoft-gemini-key` secret (steps 3–4) and
  injected via `--set-secrets` (step 6 / the deploy scripts).
- migrations `0014` (requirement intake columns), `0015` (`candidate_screenings`
  table) and `0016` (its RLS) applied **before** deploying app code, or intake
  saves and screening upserts will fail.

---

## Cost (typical internal dashboard)

Cloud Run bills per request and CPU time. A low-traffic internal app is often **$0–15/month**.
You can set `--min-instances 0` (default) so it scales to zero when idle.

**Shut down the old GCE VM** after migrating to avoid paying for both.

### Public access (org policy)

If your GCP organization blocks `allUsers` IAM bindings, use `--no-invoker-iam-check`
on deploy instead of `--allow-unauthenticated`. Without this, browsers get **403
Forbidden** even though the container is healthy.

---

## Redeploying after code changes

Use `./scripts/deploy-cloudrun.sh` or:

```sh
gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest,_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,_SUPABASE_ANON_KEY=YOUR_ANON_KEY,_SITE_URL=https://YOUR-SERVICE-URL
gcloud run deploy opelsoft-dashboard --image REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest --region REGION
```
