# Aureum CAP V0.1

Aureum CAP (Client Acquisition Pipeline) is a pilot operations console for **Campaign 001 — Houston Website Opportunity**. It packages the supplied 100-business seed list into a review-first workflow: import, deduplicate, verify, enrich, score, match, generate, approve, queue, and only then send.

## Run locally

```bash
pnpm install
pnpm dev
```

Build verification:

```bash
pnpm build
pnpm check
```

The browser console is safe by default: it does not send email, call Hunter/OpenAI, or mutate production AWS resources. The server boundary exposes `/health` and `/readiness`; provider credentials and database connection strings are server-only environment variables.

## Database

`db/schema.sql` is the first PostgreSQL migration for the documented source-of-truth model. It includes organizations, people, contacts, campaigns, prospects, products, product fit, website audits, offers, messages, responses, opportunities, deals, purchases, suppression, and events, together with the critical indexes and safe starter products/campaign.

Apply it only after RDS reports `Available`, using the managed database secret from AWS Secrets Manager. Never place the generated RDS password in Git, Vercel client variables, or the browser.

## Pilot operating rules

- Treat the supplied claim that businesses may not have websites as **unverified**.
- Start with 10–20 highly qualified prospects after human review.
- Never send to suppressed, unsubscribed, hard-bounced, or manually blocked contacts.
- Do not use LinkedIn scraping as a core dependency.
- AI-generated messaging must be grounded in observed evidence and reviewed during the pilot.
- The founder/operator remains the human handoff owner: Osagie Bernard Ebhuomhan.

## Data

`data/leads.json` is a normalized, reproducible extraction of the supplied PDF. It contains 100 records and intentionally leaves website/email status unverified. The UI supports CSV export for operator workflows.

## Production integration boundary

`.env.example` documents the server-only configuration for AWS, PostgreSQL, Hunter, OpenAI, and SES. `server/index.mjs` reports whether each dependency is configured and deliberately keeps outbound sending disabled unless both `CAP_SEND_ENABLED=true` and `SES_FROM_EMAIL` are present. Provider adapters, migrations, queue workers, authentication, and operator approval APIs remain required before live outreach.

## Deployment

The static console is deployed to Vercel as a production project. Configure the project root as the repository root and use:

- Build command: `pnpm build`
- Output directory: `dist`
- Install command: `pnpm install`

No environment variables are required for the static review console. Do not expose server secrets as `VITE_*` variables.

## AWS foundation

See [`AWS_SETUP.md`](./AWS_SETUP.md) for the verified S3, SQS, RDS, SES, cost-control, and remaining-integration status.
