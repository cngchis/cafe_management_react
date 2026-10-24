# Deploy to Railway with Neon

The app runs as one Railway web service. Fastify serves the React frontend and `/api` endpoints; PostgreSQL remains on Neon.

## Railway service settings

Connect the GitHub repository and use the repository root as the service root. Set these commands in the service's Build and Deploy settings:

- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Healthcheck Path: `/api/health`

The build command installs Vite and TypeScript from `devDependencies` before compiling the frontend and API. The server listens on Railway's injected `PORT` value.

## Environment variables

Add these variables to the Railway service:

- `NODE_ENV=production`
- `DATABASE_URL`: the pooled connection string copied from Neon, including its SSL query parameters.
- `JWT_SECRET`: a new random secret with at least 32 characters. Keep it private; changing it invalidates existing login sessions.

Never commit `.env` or paste secret values into source code. The app requires both `DATABASE_URL` and `JWT_SECRET` at startup. The health endpoint also checks PostgreSQL, so it returns `503` until Neon is reachable.

## Deploy and verify

After adding the variables, deploy the service and generate a Railway public domain in its Networking settings. Open `https://<railway-domain>/api/health`; the expected response is `{"status":"ok","database":"connected"}`. Then verify login, POS, and order history.

No database migration is run automatically by deployment. Before deploying invoice cancellation, apply `database/migrations/0007_invoice_cancellations.sql` to Neon so inventory history accepts cancellation movements. Keep Neon as the source of truth unless a separate database migration is planned.

## Updates

Push commits to the connected GitHub branch. Railway can automatically deploy new commits from the linked repository.
