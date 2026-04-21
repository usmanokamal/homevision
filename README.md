# Room Vision

Room Vision is structured as a small production-style image product rather than a stateless demo.

It supports:

- Email/password accounts
- Credit-based billing
- Paddle checkout for credit packs
- Persistent generation history with before/after images
- Regeneration that spends another credit
- One guest preview before signup, downgraded with a watermark
- Admin visibility into revenue, users, generations, and free-preview usage
- Storage-backed image persistence

## Recommended services

- Payments: Paddle
- Storage: S3-compatible object storage
  - AWS S3, Cloudflare R2, and Backblaze B2 all work if they expose S3-compatible credentials
- Database:
  - Local development uses SQLite by default
  - Production should use Postgres via `DATABASE_URL`

This gives you a practical split:

- Paddle handles checkout, merchant-of-record tax/compliance, and payment collection
- Your FastAPI backend owns users, credits, history, and authorization
- Storage stays portable instead of locking the project to a single backend platform

## Stack

- `frontend/`: Next.js app router UI
- `backend/`: FastAPI API with auth, credits, billing, storage, and OpenAI image editing

## Product rules implemented

1. Guests can generate exactly one free preview.
2. That guest preview is low-quality and watermarked.
3. Signed-in users spend `1` credit for each generation.
4. Regenerating a saved image also spends `1` credit.
5. Credit packs are currently configured as:
   - `1` credit for `$2`
   - `10` credits for `$18`
   - `25` credits for `$40`
   - `50` credits for `$75`
   - `100` credits for `$140`
6. Each signed-in account can view all saved before/after generations.
7. Admin users can see operational and revenue summaries.

You can change the plans in `backend/app/config.py`.

## Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API no longer creates tables automatically at startup. Run migrations explicitly before launching the backend.

If you already have a local SQLite database created by the old `create_all()` flow and want Alembic to start tracking it without rebuilding the database, run:

```powershell
alembic stamp head
```

### Backend environment

Required for the image pipeline:

```text
OPENAI_API_KEY=your_openai_key
```

Required for sessions:

```text
JWT_SECRET=replace-with-a-long-random-secret
```

Required for Paddle:

```text
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=pdl_sdbx_or_live_key
PADDLE_CLIENT_SIDE_TOKEN=test_or_live_client_token
PADDLE_WEBHOOK_SECRET=webhook_secret_from_notification_destination
PADDLE_CHECKOUT_BASE_URL=http://localhost:3000/checkout
```

`PADDLE_CHECKOUT_BASE_URL` should point to your frontend checkout page. This implementation creates transaction-specific Paddle checkout links that redirect customers to `/checkout?_ptxn=...`, where Paddle.js opens the actual checkout.

Production database:

```text
DATABASE_URL=postgresql+psycopg://user:password@host:5432/roomvision
```

Production storage using S3-compatible credentials:

```text
STORAGE_BACKEND=s3
STORAGE_BUCKET_NAME=roomvision-assets
STORAGE_REGION=auto_or_your_region
STORAGE_ENDPOINT_URL=https://your-s3-endpoint
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
```

Admin bootstrap:

```text
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-this
```

If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the API will create or elevate that user to admin at startup.

## Paddle setup

Create both of these in your Paddle dashboard:

1. API key for the backend
2. Client-side token for Paddle.js

Then:

1. Create a webhook notification destination pointing to:
   - `http://localhost:8000/api/billing/paddle-webhook` for local development
2. Copy the endpoint secret from that notification destination into `PADDLE_WEBHOOK_SECRET`
3. In live mode, approve the domain used by `PADDLE_CHECKOUT_BASE_URL`
4. Set `PADDLE_CHECKOUT_BASE_URL` to your deployed frontend `/checkout` route

Official docs I used for this integration:

- Transactions API: https://developer.paddle.com/api-reference/transactions/create-transaction
- Pass a transaction to checkout: https://developer.paddle.com/build/transactions/pass-transaction-checkout
- Webhook verification: https://developer.paddle.com/webhooks/signature-verification
- Sandbox/live environments: https://developer.paddle.com/build/tools/sandbox

## Frontend setup

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by execution policy.

```powershell
cd frontend
npm.cmd install
Copy-Item .env.local.example .env.local
npm.cmd run dev
```

Frontend environment:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_or_live_client_token
NEXT_PUBLIC_PADDLE_ENV=sandbox
```

For live deployments, set `NEXT_PUBLIC_PADDLE_ENV=production`.

## Deploying with Vercel + Render

Recommended production split:

- `Vercel` for the Next.js frontend
- `Render` for the FastAPI backend
- `Supabase Postgres` for `DATABASE_URL`
- `Cloudflare R2` or another S3-compatible provider for image storage

### 1. Deploy the frontend to Vercel

In the Vercel dashboard:

1. Import this GitHub repository.
2. Set the Vercel project `Root Directory` to `frontend`.
3. Add these environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=your_live_paddle_client_token
NEXT_PUBLIC_PADDLE_ENV=production
```

4. Attach your custom domain, such as `roomvision.com`.

### 2. Deploy the backend to Render

This repo includes a root-level `render.yaml` for the API service.

In the Render dashboard:

1. Connect the GitHub repo.
2. Create a new `Blueprint` from the repository.
3. Review the generated `room-vision-api` web service from `render.yaml`.
4. Fill in all `sync: false` environment variables in the Render dashboard.
5. Attach a custom domain such as `api.your-domain.com`.

Important backend environment values:

```text
FRONTEND_ORIGIN=https://your-domain.com
BACKEND_PUBLIC_URL=https://api.your-domain.com
DATABASE_URL=postgresql+psycopg://...
OPENAI_API_KEY=...
JWT_SECRET=...
PADDLE_API_KEY=...
PADDLE_CLIENT_SIDE_TOKEN=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_CHECKOUT_BASE_URL=https://your-domain.com/checkout
STORAGE_BACKEND=s3
STORAGE_BUCKET_NAME=...
STORAGE_REGION=...
STORAGE_ENDPOINT_URL=...
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

The Render service starts with:

```text
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

So migrations are applied during deploy.

### 3. Point your Namecheap domain

Recommended DNS layout:

- `your-domain.com` -> Vercel frontend
- `www.your-domain.com` -> Vercel frontend or redirect to apex
- `api.your-domain.com` -> Render backend

### 4. Configure Paddle live mode

After both deployments are live:

1. Set `PADDLE_CHECKOUT_BASE_URL` to `https://your-domain.com/checkout`
2. Create a Paddle webhook endpoint at:

```text
https://api.your-domain.com/api/billing/paddle-webhook
```

3. Use your live frontend and API domains when submitting the site for Paddle review.

## Local URLs

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## API overview

Main user endpoints:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/pricing/plans`
- `POST /api/billing/checkout-link`
- `GET /api/billing/payments`
- `POST /api/edit-image`
- `GET /api/generations`
- `POST /api/generations/{generation_id}/regenerate`

Admin endpoint:

- `GET /api/admin/overview`

Paddle webhook:

- `POST /api/billing/paddle-webhook`

## Notes

- Local development defaults to SQLite and local filesystem storage in `backend/data/`.
- Migrations live in `backend/alembic/` and are run with `alembic upgrade head`.
- Saved generation images are persisted and served through signed backend asset links.
- Guest renders are intentionally downgraded after generation using Pillow.
- The backend default image model is `gpt-image-1`.
- For production, run the API behind HTTPS and set `COOKIE_SECURE=true`.
- The current payment model is one-time credit packs through Paddle transactions, not subscriptions.
