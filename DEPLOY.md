# Deploying to Google Cloud Run

The app is an SSR Next.js server (server actions, middleware, SMTP), so it runs
as a container on **Cloud Run**. Cloud Build builds the image in the cloud — you
do **not** need Docker installed locally.

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time (passed as
build args). The **secret** values (service-role key, SMTP password) are injected
at runtime via Secret Manager and never go into the image.

Replace `PROJECT_ID` and `REGION` (e.g. `us-central1`) throughout.

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

## 3. Store the two secrets in Secret Manager

Use the values from your `.env.local`. (Files avoid a trailing newline that can
break the SMTP password / JWT.)

PowerShell:
```powershell
"YOUR_SERVICE_ROLE_KEY" | Out-File -NoNewline -Encoding ascii sr.txt
gcloud secrets create opelsoft-service-role --data-file=sr.txt ; Remove-Item sr.txt

"YOUR_SMTP_APP_PASSWORD" | Out-File -NoNewline -Encoding ascii smtp.txt
gcloud secrets create opelsoft-smtp-pass --data-file=smtp.txt ; Remove-Item smtp.txt
```

## 4. Let Cloud Run read those secrets

```sh
gcloud projects describe PROJECT_ID --format="value(projectNumber)"
```
Take the number it prints, then (PROJECT_NUMBER = that value):
```sh
gcloud secrets add-iam-policy-binding opelsoft-service-role --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding opelsoft-smtp-pass --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

## 5. Build and push the image

```sh
gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest,_SUPABASE_URL=https://zhohylkyzuqawpygmjbf.supabase.co,_SUPABASE_ANON_KEY=sb_publishable_KKdORMftsQ-d97ogobySyQ_UPE1uPHT,_SITE_URL=https://placeholder.run.app
```

## 6. Deploy to Cloud Run

```sh
gcloud run deploy opelsoft-dashboard --image REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest --region REGION --allow-unauthenticated --port 8080 --memory 1Gi --max-instances 3 --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://zhohylkyzuqawpygmjbf.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KKdORMftsQ-d97ogobySyQ_UPE1uPHT,SMTP_USER=alex.smith@opelsoft.com,SMTP_FROM=alex.smith@opelsoft.com" --set-secrets "SUPABASE_SERVICE_ROLE_KEY=opelsoft-service-role:latest,SMTP_PASS=opelsoft-smtp-pass:latest"
```

This prints a **Service URL** like `https://opelsoft-dashboard-xxxx.REGION.run.app`.

## 7. Point the app and Supabase at the real URL

```sh
gcloud run services update opelsoft-dashboard --region REGION --update-env-vars "NEXT_PUBLIC_SITE_URL=https://YOUR-SERVICE-URL"
```

Then in the **Supabase dashboard → Authentication → URL Configuration**:
- Set **Site URL** to the Cloud Run URL.
- Add the Cloud Run URL (and `.../auth/callback`) to **Redirect URLs**.

Login, invites, and password setup links won't work until this is done.

## 8. Database

The Cloud Run app talks to the same Supabase project as your `.env.local`. Make
sure the schema + seed have been applied there (migrations `0001`–`0006` in the
SQL Editor, then `npm run seed` / `npm run seed:all`).

---

## Redeploying after code changes

```sh
gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest,_SUPABASE_URL=https://zhohylkyzuqawpygmjbf.supabase.co,_SUPABASE_ANON_KEY=sb_publishable_KKdORMftsQ-d97ogobySyQ_UPE1uPHT,_SITE_URL=https://YOUR-SERVICE-URL
gcloud run deploy opelsoft-dashboard --image REGION-docker.pkg.dev/PROJECT_ID/opelsoft/opelsoft-dashboard:latest --region REGION
```
