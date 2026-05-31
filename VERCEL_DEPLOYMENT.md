# Vercel Deployment (Frontend + Backend Services)

This repo is configured for Vercel Services with:

- `frontend` service at route prefix `/`
- `backend` service at route prefix `/api`

Config file: [`vercel.json`](./vercel.json)

## 1) Deploy from Vercel portal

1. Import the GitHub repo into Vercel.
2. Keep the detected multi-service setup:
   - `frontend` root: `frontend`
   - `backend` root: `backend`
3. Deploy.

## 2) Set Backend environment variables

In Vercel project settings, set these for **Production** and **Preview**:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL=gpt-image-1`
- `DATABASE_URL` (Postgres URL)
- `JWT_SECRET` (long random secret)
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`
- `BACKEND_PUBLIC_URL` (your Vercel project URL, e.g. `https://your-app.vercel.app`)
- `FRONTEND_ORIGIN` (same domain as frontend, e.g. `https://your-app.vercel.app`)
- `STORAGE_BACKEND=s3`
- `STORAGE_BUCKET_NAME`
- `STORAGE_REGION`
- `STORAGE_ENDPOINT_URL` (optional for non-AWS S3)
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`

## 3) Frontend environment variables

Recommended:

- `NEXT_PUBLIC_API_BASE_URL=/api`

Alternative:

- Leave `NEXT_PUBLIC_API_BASE_URL` empty and use Vercel-generated
  `NEXT_PUBLIC_BACKEND_URL` from Services (already supported in code).

## 4) Run database migration once

Run this locally against your production DB URL before first use:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:DATABASE_URL="<your production postgres url>"
alembic upgrade head
```

## 5) Validate after deploy

- Frontend: `https://<your-domain>/`
- Backend health: `https://<your-domain>/api/health`
- Studio API calls should hit `/api/...` and succeed.

## Notes

- Do not use local SQLite on Vercel for production.
- Do not use local filesystem storage for generated images in production.
  Use S3-compatible storage env vars.

