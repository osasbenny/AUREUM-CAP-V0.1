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
```

The app is intentionally static in this pilot cut. It does not send email, call Hunter/OpenAI, or mutate production AWS resources. The UI communicates those gates explicitly so the console cannot be mistaken for a live outreach system.

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

The next production slice should add a server-side API and PostgreSQL persistence, then managed secrets, provider adapters, queue workers, SES identity verification, EventBridge scheduling, and CloudWatch events. No provider credential belongs in the browser or repository.

## Deployment

This is a Vite static build and can be deployed to Vercel as a production project. Configure the project root as the repository root and use:

- Build command: `pnpm build`
- Output directory: `dist`
- Install command: `pnpm install`

No environment variables are required for this static review console.
