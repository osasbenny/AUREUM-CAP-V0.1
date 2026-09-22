# AUREUM CAP V0.1 — Product Requirements Document

**Product:** Aureum Client Acquisition Pipeline (CAP) V0.1  
**Repository:** `osasbenny/AUREUM-CAP-V0.1`  
**Document status:** Audited product definition and as-built specification  
**Audit date:** 22 September 2026  
**Owner/operator:** Osagie Bernard Ebhuomhan  
**Current release posture:** Production foundation and controlled-pilot preparation; live outreach remains disabled

> **Purpose of this document:** Give a new contributor, operator, reviewer, or implementation partner a comprehensive understanding of what Aureum CAP is intended to do, what has been built, how the system is structured, what the data model contains, how the Command Center behaves, and what remains before the product can be called fully production-ready.

## 1. Executive summary

Aureum CAP is a **review-first client acquisition and revenue-operations system**. It transforms a source list of potential businesses into a controlled, auditable workflow for research, qualification, offer preparation, human approval, outbound communication, response handling, commercial handoff, and revenue attribution.

The initial campaign is **Campaign 001 — Houston Website Opportunity**. Its seed is a supplied PDF containing 100 Houston-area business records with business names, categories, locations, and U.S. phone numbers. The source contains no email addresses and no verified websites. CAP therefore does not invent contact details or treat a phone number as consent. The current safe state is a deterministic, review-only pipeline with zero outreach-eligible records.

The product is not simply a CRM, a bulk SMS tool, an email sender, or a landing-page generator. It is the **control plane and source of truth for evidence-backed acquisition activity**. External providers such as Twilio, AWS SES, Hunter, OpenAI, SQS, S3, and optional n8n orchestration may support individual capabilities, but they must not own deduplication, approvals, suppression, state transitions, or revenue attribution.

The product’s central promise is controlled execution:

```text
Source data
  → normalize and deduplicate
  → verify and enrich
  → score and match an offer
  → prepare a grounded message
  → review evidence and compliance
  → approve an exact payload
  → queue with limits and idempotency
  → send through an approved provider
  → capture delivery and replies
  → hand off opportunities
  → record deals, purchases, and revenue
```

**100% completion does not mean automatically contacting all 100 businesses.** It means the system can process the full cohort deterministically and durably, while every outbound action remains blocked unless the recipient, channel, permission basis, suppression status, provider, message, batch limit, and operator approval are all valid.

## 2. Product vision and goals

### 2.1 Vision

Build a reusable acquisition engine that helps Aureum identify legitimate business opportunities, make relevant offers, and convert qualified conversations into revenue without sacrificing data integrity, operator control, or compliance discipline.

### 2.2 Primary goals

1. **Turn raw records into usable prospect intelligence.** CAP must preserve the original source while adding normalized identity, contact status, website evidence, scoring, fit hypotheses, and explicit uncertainty.
2. **Make every outbound action reviewable.** Operators must see the exact recipient, channel, message, provider, evidence, suppression result, and batch limits before approving a send.
3. **Keep external communications safe by default.** The system must fail closed when credentials, sender approval, suppression checks, lawful-contact evidence, or operator approval are absent.
4. **Create a durable system of record.** Lead state, approvals, messages, queue jobs, provider events, replies, opportunities, deals, purchases, and revenue must survive process restarts and be queryable from PostgreSQL.
5. **Support multiple acquisition channels without conflating them.** SMS, email, and future channels must have separate eligibility and provider gates.
6. **Create a measurable path from outreach to revenue.** CAP must capture responses, human handoffs, proposals, deals, purchases, and campaign/product attribution rather than stopping at message delivery.
7. **Provide a reusable project factory.** Prospect-specific demonstrations such as Zoey Vincent’s Personal Brand HQ should be built from CAP research and opportunity artifacts while remaining separate from the CAP control plane and automatic outreach.

### 2.3 Non-goals

CAP does not infer consent from publicly available contact information. It does not fabricate email addresses, websites, testimonials, audience metrics, business needs, or revenue. It does not make legal determinations without the required review. It does not automatically send all imported leads. It does not make n8n, Hunter, OpenAI, or any external provider the authoritative owner of prospect state. It does not treat a demo website as evidence that a prospect has a confirmed need.

## 3. Users and roles

### 3.1 Founder/operator

The founder/operator owns campaign strategy, reviews evidence, approves or rejects records, confirms lawful-contact basis, supervises sends, handles high-intent replies, prepares proposals, and records commercial outcomes. The repository names Osagie Bernard Ebhuomhan as the human handoff owner.

### 3.2 Acquisition operator

An acquisition operator reviews leads, verifies websites, prepares messages, checks suppression, approves bounded batches, monitors queue and provider events, and pauses campaigns when a safety condition is triggered.

### 3.3 Implementation and operations team

Engineering and operations maintain the API, frontend, PostgreSQL schema, AWS infrastructure, SQS worker, provider adapters, webhooks, observability, deployments, backups, and incident runbooks. They must not bypass the approval model to make a campaign appear complete.

### 3.4 Prospect or respondent

A prospect may receive a message only when the relevant channel is eligible and the exact payload is approved. A respondent may opt out, ask a question, express interest, or enter a human handoff. Their response and suppression state must be respected across future campaigns.

## 4. Core operating principles

### 4.1 Review before send

No send may occur from the existence of a phone number, email address, or provider account alone. The system must require recipient-level evidence, channel-specific eligibility, suppression clearance, exact-message approval, and a live provider gate.

### 4.2 No channel substitution

An unresolved email restriction cannot be bypassed by sending SMS. An unresolved SMS restriction cannot be bypassed by sending email. Each channel has its own provider, permission, compliance, suppression, and delivery requirements.

### 4.3 Evidence before certainty

CAP distinguishes observed facts from hypotheses. A supplied business name, category, location, and phone number are facts about the source record. A website opportunity, product fit, buying signal, or expected revenue is a hypothesis until verified.

### 4.4 Durable state before scale

A workflow is not production-ready because code exists locally. It is complete only when the state is persisted, the worker is restart-safe, provider events are recorded, dashboards reconcile with the database, and stop controls have been tested.

### 4.5 Secret isolation

Provider credentials, database passwords, signing material, and administrator secrets must remain server-side. They must never be stored in Git, browser variables, screenshots, public reports, or chat.

## 5. Product scope

CAP consists of the following functional areas:

| Area | Product responsibility |
|---|---|
| Source intake | Import supplied files and preserve source references |
| Normalization | Normalize names, phone numbers, locations, and deterministic keys |
| Deduplication | Detect and prevent duplicate organizations and prospects |
| Verification | Check website status and store evidence with timestamp and version |
| Enrichment | Optionally discover and verify contacts through approved providers |
| Qualification | Score records and classify readiness, blockers, and confidence |
| Product matching | Match prospects to Aureum products with evidence-backed fit hypotheses |
| Offer preparation | Create clearly labelled fallback or generated offers with approval state |
| Review workspace | Let operators search, select, verify, approve, reject, suppress, and audit leads |
| Campaign control | Manage draft, approved, active, paused, and completed campaigns |
| Queue processing | Persist jobs, enforce limits, retry safely, and route failures to a DLQ |
| Provider delivery | Send through approved SMS or email providers only after gates pass |
| Webhooks | Receive delivery statuses, inbound replies, and opt-outs |
| Handoff and revenue | Convert responses into handoffs, opportunities, deals, purchases, and revenue events |
| Reporting | Reconcile source, pipeline, delivery, response, and revenue metrics |
| Demo factory | Build prospect-specific websites and supporting evidence without automatic outreach |

## 6. Current campaign and data reality

### 6.1 Campaign 001

Campaign 001 is named **Houston Website Opportunity**. It targets U.S. local businesses across categories such as car wash, lawn care, roofing, window tinting, real estate, plumbing, carpentry, and barber shops. Its initial product hypothesis is Premium Website Development, with Business Automation as a secondary fit.

### 6.2 Seed data

The normalized seed contains 100 unique records. Every record has a phone number, and the numbers are U.S. `+1` destinations suitable for Twilio routing at the technical adapter level. The source contains zero email addresses and zero supplied websites. Website status, email status, named decision-maker, lawful-contact basis, suppression result, business need, timeline, budget, and decision process remain unverified.

### 6.3 Current qualification state

The latest readiness artifacts classify all 100 records as **Category C — Needs contact-permission or compliance review**. Current counts are:

| Metric | Current value |
|---|---:|
| Source records | 100 |
| Unique records | 100 |
| Duplicate records | 0 |
| Phone records | 100 |
| Verified emails | 0 |
| Send-eligible records | 0 |
| Prepared SMS/fallback artifacts | 100 |
| Outbound provider calls | 0 |
| Current live sends | 0 |

The first 10 and first 50 artifacts are review-only. Their records currently contain `permission_basis: NOT_ESTABLISHED`, `operator_approval: PENDING`, `suppression_check: REQUIRED_AT_SEND`, and `send_status: BLOCKED_REVIEW_ONLY`.

## 7. Functional requirements

### 7.1 Source intake and normalization

CAP must accept a structured import derived from the supplied PDF or another approved source. The import process must preserve the source filename or URL, source date, original fields, extraction notes, and normalized fields. It must generate a deterministic business key and report duplicates without silently discarding source evidence.

Phone numbers must be normalized to E.164 where possible. Invalid numbers must remain visible as blocked records with a reason. U.S. `+1` numbers route to Twilio by default; non-U.S. numbers route to Termii only when that provider is configured and the destination is eligible.

### 7.2 Website verification

The internal verifier must accept a supplied website, normalize missing schemes, follow redirects, enforce a bounded timeout, record HTTP status, final URL, latency, DNS outcome, error reason, verification version, and timestamp, and classify the result as `ACTIVE`, `INACTIVE`, `NOT_FOUND`, `BLOCKED`, `ERROR`, or `UNKNOWN`.

Absence of a website in the seed data must remain `UNKNOWN` or `NOT_SUPPLIED`. It must not be represented as proof that a business has no website.

### 7.3 Scoring and qualification

The deterministic scorer must produce a versioned total and component scores. The current implementation considers company fit, buying signal, website opportunity, decision-maker presence, contact quality, location, and business size. Its evidence currently includes supplied PDF metadata, phone presence, and location match.

Scores are prioritization aids. They are not consent, intent, verified need, or authorization to contact. The database must preserve score version, inputs, evidence, calculation time, and later recalculation history.

### 7.4 Product matching and offers

The matcher may identify Premium Website Development, AuraPOS, AuraReach, FaithConnect, Business Automation, or Custom Software depending on category and evidence. Every fit must store score, evidence, recommendation, and version. A product fit is a hypothesis until research validates the business need.

Fallback messages must be labelled `TEMPLATE/FALLBACK`, grounded in observed facts, and marked `approval_required`. OpenAI remains disabled unless separately approved, configured, grounded, cost-controlled, schema-validated, and reviewed.

### 7.5 Review and approval

The Command Center must support:

- Searching and filtering the lead list.
- Selecting individual records or all visible records.
- Verifying selected or individual websites.
- Reviewing score, product fit, lifecycle stage, contact data, and blockers.
- Approving or rejecting records.
- Suppressing records manually.
- Preparing email and SMS drafts separately.
- Viewing approvals, audit events, queue state, campaigns, and revenue.
- Pausing or stopping campaigns.
- Reviewing the exact payload before send.

Approval of a lead must not automatically send a message. SMS approval and email approval must remain separate. Reapproval is required when the recipient, message, sender, provider, campaign, or batch changes.

### 7.6 SMS workflow

The U.S. SMS workflow is:

```text
eligible lead → personalized draft → human review → SMS approval
→ suppression recheck → queue → worker gate check
→ Twilio request → provider status callback → delivery/reply outcome
```

The Twilio adapter must support an approved phone number or Messaging Service SID, status callback URL, server-side credentials, E.164 recipients, idempotency, bounded rate limits, provider message IDs, and durable status events.

The production callback endpoints are:

- `POST /api/v1/webhooks/sms/status`
- `POST /api/v1/webhooks/sms/inbound`

Twilio signatures must be verified against the final public URL and server-side secret. Status events must be idempotent. Inbound `STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT`, `END`, and `REVOKE` must immediately create suppression and block future outbound jobs.

### 7.7 Email workflow

Email is a separate product path. It requires a verified sender/domain, SPF, DKIM, DMARC, provider access, bounce and complaint processing, unsubscribe handling, reply mailbox, idempotency, suppression, and recipient-level lawful basis. SES remains sandboxed and gated in the current project evidence. SMS cannot be used as a substitute for unresolved email requirements.

### 7.8 Queue and worker workflow

SQS is the durable transport for processing and outbound jobs. The worker must:

1. Receive a job with bounded visibility timeout.
2. Recheck campaign status, provider readiness, recipient eligibility, suppression, approval, and limits.
3. Construct an idempotent provider request.
4. Persist the result before deleting the queue message.
5. Retry transient failures with bounded backoff.
6. Move exhausted jobs to the DLQ.
7. Stop immediately when the global or campaign-level kill switch is active.

The current worker code provides the beginning of this behavior, but production readiness still requires deployed IAM, redrive policy, durable idempotency, restart tests, observability, and reconciliation.

### 7.9 Response, handoff, and revenue workflow

Inbound responses must be stored with provider message ID, matched prospect, body, timestamp, classification, confidence, and operator action. Supported classifications should include interested, positive, question, later, not interested, unsubscribe, and unknown.

A positive or high-intent response must create a human handoff. The operator records discovery findings, proposed scope, proposal, opportunity stage, deal status, purchase, amount, currency, campaign, product, and attributable revenue. CAP must not infer revenue from a message response.

## 8. System architecture

### 8.1 Logical architecture

```text
                         ┌────────────────────────┐
                         │  Vercel Command Center │
                         │  Vite + vanilla JS     │
                         └───────────┬────────────┘
                                     │ HTTPS/API + cookies
                                     ▼
                         ┌────────────────────────┐
                         │  CAP Node.js API       │
                         │  auth, review, gates,  │
                         │  webhooks, reporting   │
                         └──────┬─────────┬───────┘
                                │         │
                                │         ├──────────────┐
                                ▼         ▼              ▼
                     ┌──────────────┐ ┌────────────┐ ┌─────────────┐
                     │ PostgreSQL   │ │ SQS + DLQ  │ │ S3          │
                     │ RDS source   │ │ jobs       │ │ imports and │
                     │ of truth     │ │ retries    │ │ reports     │
                     └──────┬───────┘ └──────┬─────┘ └─────────────┘
                            │                │
                            │                ▼
                            │       ┌────────────────┐
                            │       │ SQS worker     │
                            │       │ idempotent     │
                            │       │ provider jobs  │
                            │       └──────┬─────────┘
                            │              │
                            ▼              ▼
                     ┌──────────────┐ ┌──────────────┐
                     │ Audit/events │ │ Twilio / SES │
                     │ and revenue  │ │ callbacks    │
                     └──────────────┘ └──────────────┘
```

### 8.2 Deployment model

The frontend is deployed to Vercel. The production API is intended to run behind HTTPS in AWS with access to private RDS, SQS, S3, Secrets Manager, and CloudWatch. The repository contains deployment tooling for an AWS-compatible container/runtime path and documents a temporary VPC-connected migration runner for applying the schema.

The current public evidence confirms the API health URL and Vercel frontend are reachable. The full authenticated production control flow, direct RDS schema verification, deployed worker, IAM, webhook delivery, alarms, and end-to-end persistence still require explicit verification.

### 8.3 External providers

| Provider | Role | Current state |
|---|---|---|
| AWS RDS PostgreSQL | Durable source of truth | Instance reported Available; direct schema/import verification remains required |
| AWS S3 | Private imports, reports, snapshots, and exports | Foundation created and documented |
| AWS SQS | Processing queue and dead-letter queue | Foundation created; deployed worker/redrive verification remains |
| AWS SES | Email delivery | Sandbox; sender/DKIM verification and event path remain gated |
| Twilio | U.S. SMS delivery and callbacks | Adapter and routes exist; credentials, sender registration, callbacks, suppression, and eligibility remain blocked |
| Termii | Future African-number SMS fallback | Adapter exists; not the U.S. pilot provider |
| Hunter | Optional email discovery/verification | Disabled; no credential configured |
| OpenAI | Optional grounded message generation | Disabled; fallback templates are the current path |
| n8n | Optional orchestration and notifications | Not a core dependency; must call stable CAP APIs if later enabled |
| Vercel | Static frontend deployment | Production console URL is live |

## 9. Data model and database schema

### 9.1 Core entities

The intended PostgreSQL schema is centered on organizations, people, contacts, campaigns, prospects, products, product fits, website audits, offers, messages, responses, opportunities, deals, purchases, suppression, and events.

| Entity | Purpose | Key relationships |
|---|---|---|
| `organizations` | Business identity and source metadata | Parent of people, contacts, prospects, website audits, purchases |
| `people` | Named contact and role | Linked to organization and contacts |
| `contacts` | Channel-specific email/phone record and verification | Linked to person or organization |
| `campaigns` | Acquisition objective, audience, offer, channel, status, limits | Parent of prospects, messages, purchases |
| `prospects` | Campaign-specific business/contact state | Links organization, person, campaign, scores, lifecycle, suppression |
| `products` | Aureum revenue lanes and offerable products | Parent of product fits, offers, opportunities, purchases |
| `product_fit` | Evidence-backed product hypothesis | Links prospect and product |
| `website_audits` | Versioned website evidence | Links organization |
| `offers` | Proposed offer, reasoning, generated text, approval | Links prospect and product |
| `messages` | Channel payload and delivery lifecycle | Links prospect, campaign, product, provider message ID |
| `responses` | Inbound response classification and summary | Links prospect and optional message |
| `opportunities` | Commercial opportunity and expected value | Links prospect and product |
| `deals` | Commercial outcome and won/lost state | Links opportunity |
| `purchases` | Actual purchase and revenue event | Links person, organization, product, campaign |
| `suppression_list` | Email/phone do-not-contact records | Used before every outbound action |
| `events` | Audit, provider, workflow, and state-transition trail | Polymorphic entity reference and JSON payload |

### 9.2 Current persistence implementation

The repository contains a normalized schema migration and a separate repository layer. The repository layer currently creates CAP-specific `cap_leads`, `cap_queue_jobs`, and `cap_provider_events` tables when `DATABASE_URL` is present, imports records idempotently by lead ID, saves lead snapshots, saves events, enqueues jobs, lists queue jobs, claims jobs with `FOR UPDATE SKIP LOCKED`, and completes jobs.

This is a valuable persistence foundation, but the PRD treats full persistence as incomplete until the canonical schema is applied and verified in private RDS, all required state transitions use normalized transactions, campaign and approval state are durable, and the deployed API and worker reconcile against PostgreSQL after restart.

### 9.3 Required data guarantees

The database must enforce stable identifiers, source traceability, uniqueness where appropriate, suppression uniqueness, provider-event idempotency, audit timestamps, lifecycle transitions, and transactional approval/queue behavior. JSON evidence may preserve provider-specific payloads, but core business state must remain queryable without parsing arbitrary blobs.

## 10. API contract inventory

The current Node API exposes the following logical routes:

| Route | Purpose | Access |
|---|---|---|
| `GET /health` | Liveness and send-enabled state | Public |
| `GET /readiness` | Dependency and provider readiness | Public, non-secret status only |
| `POST /api/v1/auth/login` | Operator session creation | Public entry point |
| `GET /api/v1/auth/me` | Current operator session | Session |
| `POST /api/v1/auth/logout` | End operator session | Session |
| `GET /api/v1/pilot/summary` | Pilot summary | Public summary |
| `GET /api/v1/dashboard` | Dashboard metrics | Authenticated |
| `GET /api/v1/leads` | Search/filter leads | Authenticated |
| `GET /api/v1/leads/:id` | Lead detail | Authenticated |
| `PATCH /api/v1/leads/:id` | Lead update | Authenticated |
| `POST /api/v1/leads/:id/verify` | Website verification | Authenticated |
| `POST /api/v1/leads/:id/prepare` | Fallback offer preparation | Authenticated |
| `POST /api/v1/leads/:id/prepare-sms` | SMS draft preparation | Authenticated |
| `POST /api/v1/leads/:id/approve` | General lead approval | Authenticated |
| `POST /api/v1/leads/:id/approve-sms` | SMS approval | Authenticated |
| `POST /api/v1/leads/:id/reject` | Reject lead | Authenticated |
| `POST /api/v1/leads/:id/suppress` | Suppress lead | Authenticated |
| `POST /api/v1/leads/:id/queue-sms` | Queue eligible SMS job | Authenticated and gated |
| `POST /api/v1/leads/:id/send-sms` | Direct provider send path | Authenticated and gated |
| `GET /api/v1/approvals` | Pending approvals | Authenticated |
| `POST /api/v1/approvals/bulk` | Bulk approval | Authenticated |
| `GET/POST /api/v1/campaigns` | Campaign list and creation | Authenticated |
| `PATCH/POST /api/v1/campaigns/:id/...` | Campaign lifecycle controls | Authenticated |
| `GET /api/v1/queue` | Queue view | Authenticated |
| `GET /api/v1/events` | Audit/event view | Authenticated |
| `GET /api/v1/revenue` | Revenue view | Authenticated |
| `GET /api/v1/products` | Product-fit list | Authenticated |
| `GET /api/v1/product-fit/:id` | Lead product fits | Authenticated |
| `POST /api/v1/webhooks/sms/status` | Twilio delivery callback | Signed provider webhook |
| `POST /api/v1/webhooks/sms/inbound` | Twilio inbound/reply callback | Signed provider webhook |

The API contract must evolve toward durable transactions, explicit schema validation, structured errors, idempotency, rate limits, and provider-readiness checks before production sending is enabled.

## 11. Command Center UI and design system

### 11.1 Visual language

The Command Center uses a restrained operations-console design. The visual system is built around a deep green navigation rail, pale botanical background, lime accent marker, white cards, rounded controls, compact monospace eyebrow labels, and high-contrast status pills. The UI emphasizes calm review and operational clarity rather than promotional energy.

The login page uses a split layout with a dark green visual panel and centered white authentication card. It includes a dynamic copyright year and creator attribution link. The public login surface does not expose backend environment variable names or credentials.

### 11.2 Main surfaces

The authenticated shell contains:

- A left navigation rail with Overview, Leads, Approvals, Campaigns, and Revenue.
- An operator identity and audit notice.
- A logout control.
- A header showing live API context, Command Center title, send-disabled status, and refresh action.
- An operations brief with imported prospect count and deterministic qualification progress.
- Metric cards for imported, verified, awaiting approval, and pipeline value.
- A lead review table with selection, business, phone, category, website status, score, product fit, lifecycle stage, and verification action.
- Search and batch verification controls.
- Bulk approval control that explicitly states approval does not send a message.
- A readiness panel for database, website verifier, fallback messages, queue, SES, Hunter, and OpenAI.
- A safety panel stating that human approval, suppression, and audit checks precede future queue/provider integration.
- Campaign and revenue panels.

### 11.3 Interaction requirements

Every control must produce a visible result or actionable error. Search filters the live lead list. Selection supports individual and select-all states. Verification calls the API and refreshes state. Bulk approval records approval but does not send. Logout destroys the session. Campaign controls must support approval, start, pause, resume, and stop only when their state requirements are satisfied.

The UI must add a dedicated send-preview and provider-readiness experience before any live send gate is enabled. That view must show exact recipient, message, sender, provider, evidence, suppression result, rate limit, batch size, approval history, and stop controls.

### 11.4 Accessibility and responsive behavior

The existing styles include responsive layouts for smaller screens, visible focus treatment, semantic form labels, reduced-motion support where implemented in the broader project artifacts, and keyboard-visible controls. Final production readiness requires authenticated browser verification on desktop and mobile, not only static or local checks.

## 12. Security, privacy, and compliance requirements

CAP must use secure, server-side secrets and avoid exposing database URLs, provider tokens, administrator passwords, or signing material. Production authentication must use a real operator identity with secure password handling or an approved identity provider. Cookies must be secure in production, CORS must be explicit, and authorization must protect all operational routes.

Twilio signatures must be validated using the final callback URL. Webhooks must be replay-safe and idempotent. Provider payloads and logs must avoid secrets and minimize unnecessary personal data. Suppression records must be authoritative, queryable, and enforced before every outbound job.

For every selected recipient, CAP must preserve the source, collection date, identity evidence, channel eligibility, lawful-contact basis, suppression result, and approval history. The product must allow a record to remain blocked when the evidence is insufficient.

The system must support immediate stop behavior for operator pause, campaign stop, provider failure, duplicate detection, compliance mismatch, unexpected opt-out volume, and abnormal delivery failure. These controls must be tested in the production-like environment.

## 13. Reporting and success metrics

### 13.1 Operational metrics

The dashboard and reports should show imported, unique, duplicate, verified, enriched, qualified, awaiting approval, approved, suppressed, queued, sent, delivered, failed, undelivered, replied, opted out, and error counts. Metrics must identify their source and timestamp.

### 13.2 Funnel metrics

The business funnel is:

```text
source record → qualified prospect → approved contact
→ provider accepted → delivered → reply
→ qualified conversation → proposal → opportunity
→ deal → purchase → attributable revenue
```

CAP must distinguish provider acceptance from delivery and delivery from response. It must not treat a prepared message, a high score, or an estimated pipeline value as actual revenue.

### 13.3 Pilot success criteria

A first pilot succeeds when the exact approved recipients receive only the approved messages, every provider response is durable, status callbacks reconcile, STOP suppression works, inbound replies are captured, no duplicate or unauthorized send occurs, and the operator can trace each result from source record through provider event. Revenue success is measured separately through observed qualified conversations, proposals, deals, purchases, and attributable revenue.

## 14. Deployment and operations

### 14.1 Repository and development commands

The project is a Vite frontend and Node.js ESM backend. The main commands are:

```bash
pnpm install
pnpm dev
pnpm build
pnpm check
npm run validate:pilot
npm run activation:manifest
npm run validate:activation
npm run pipeline:dry-run
npm run db:bootstrap
npm run worker
npm run smoke
```

The repository also contains scripts for building manifests, readiness reports, human-review queues, first-50 batches, ECS deployment, schema bootstrap, validation, and deterministic pipeline dry runs.

### 14.2 AWS foundation

The documented AWS region is `eu-north-1`. The foundation includes a private encrypted RDS PostgreSQL instance, a private S3 bucket, an SQS processing queue, and an SQS dead-letter queue. RDS credentials are managed through Secrets Manager. The approved cost posture avoids NAT Gateway, Multi-AZ changes, RDS resize, unnecessary autoscaling, and unbounded provider activation.

The remaining operations work includes applying and verifying the schema from a VPC-connected runner, finalizing least-privilege IAM, attaching redrive policy, deploying the worker, configuring CloudWatch alarms, testing backups and restore, and removing temporary migration resources after verification.

### 14.3 Release and savepoint discipline

A workstream is complete only after its implementation, redacted verification evidence, updated blocker record, deployment identifier, and relevant approval record are committed. Secrets must never enter the repository. Project-specific demo work is documented with savepoints under the Demo Building Factory.

## 15. Demo Building Factory relationship

The repository contains a separate **Demo Building Factory**. It stores prospect-specific research, intelligence, opportunity hypotheses, briefs, assets, websites, deployment records, analytics status, and outreach boundaries. Its projects are outputs or demonstrations produced from the CAP workflow; they are not the same thing as the CAP Command Center.

The current example is `Demo Building Factory/001-Zoey-Vincent/`. It represents Zoey Vincent Vevakpor’s Personal Brand HQ. Its project manifest records a deployed Vercel website, automated QA, source-linked research, and an outreach state of human approval required. The website is live and traceable, but it does not automatically send outreach. This relationship demonstrates how CAP can produce a prospect-specific owned destination while preserving the separation between marketing asset, acquisition control plane, and external contact.

## 16. Current state assessment

The repository has a credible foundation and several verified capabilities:

- The 100-record seed is normalized and reproducible.
- Deterministic scoring, product matching, and labelled fallback messages exist.
- The Command Center frontend, authentication boundary, dashboard, review table, approvals, campaign view, and revenue view exist.
- SMS routing, Twilio request construction, webhook routes, signature validation, and STOP suppression logic exist in code.
- PostgreSQL schema, repository tooling, SQS worker, DLQ handling, deployment scripts, and operational documentation exist.
- The Vercel Command Center and public API health endpoint are reachable in the current evidence.
- Zoey’s prospect-specific demo is deployed and QA-passing.

The project is not yet 100% production-ready because the following are not fully evidenced end to end:

- Direct private-RDS schema application and verification.
- Complete replacement of in-process state with normalized durable transactions.
- Production worker, IAM, redrive, idempotency, and restart verification.
- Twilio secret rotation, secure injection, sender verification, and applicable U.S. registration.
- Production webhook delivery, provider-event reconciliation, and suppression lookup.
- Recipient-level lawful-contact evidence for the supplied 100 leads.
- Authenticated production UI control verification across all workflows.
- SES sender/DKIM verification, event processing, and email suppression.
- CloudWatch alarms, operator notifications, backup/restore testing, and incident rehearsal.
- Operational response handoff, opportunity/deal/purchase state, and revenue attribution.
- A compliant, explicitly approved 5–10-recipient provider test.

The current maturity is best described as **production foundation plus review-only activation preparation**, not a completed outbound revenue machine.

## 17. Prioritized roadmap

### P0 — Protect and verify

Rotate any exposed provider credentials. Keep both send gates disabled. Apply and verify the schema from a VPC-connected runner. Confirm production authentication, API/frontend connection, ALB/ECS health, RDS connectivity, SQS configuration, and CloudWatch logs.

### P1 — Make the control plane durable

Move all lead, approval, campaign, suppression, queue, provider, webhook, and audit state to PostgreSQL transactions. Deploy and verify the worker with retry, DLQ, idempotency, pause, and kill-switch behavior.

### P1 — Complete Twilio readiness

Verify the sender or Messaging Service, complete applicable U.S. registration, inject fresh secrets securely, configure signed callbacks, run operator-owned test delivery, and prove delivery/reply/STOP reconciliation.

### P1 — Qualify a real pilot

Research and document recipient identity, lawful-contact basis, suppression result, business evidence, and exact message for 5–10 prospects. Present the exact payload to the operator and obtain explicit approval.

### P2 — Finish business operations

Implement durable reply classification, human handoff, opportunity and revenue workflow, reporting, analytics, alarms, backup/restore tests, and a post-pilot outcome report.

### P2 — Complete email independently

Verify SES identity and DNS, configure delivery events and unsubscribe, add suppression and bounce/complaint handling, and enable only after a separate email readiness gate passes.

## 18. Acceptance criteria for the next production release

The next release may be labelled **Controlled Pilot Ready** only when:

1. The API and Command Center are connected to the same verified production state store.
2. The schema/import verification report confirms the 100 records and zero duplicate normalized keys.
3. A test worker restart does not lose or duplicate a job.
4. Twilio sender, secrets, registration, callbacks, and test recipient are verified.
5. The Command Center displays evidence and the exact payload before approval.
6. A provider-connected test message to an operator-owned number is fully reconciled.
7. STOP creates suppression and blocks the next outbound attempt.
8. The chosen 5–10 prospects have recipient-level eligibility evidence.
9. The exact pilot batch is approved with a limit and stop conditions.
10. Every send and callback produces durable audit and provider-event records.
11. A post-pilot report can distinguish delivery, response, handoff, proposal, deal, purchase, and revenue.
12. Email remains independently gated and no feature silently enables it.

## 19. Repository map

```text
AUREUM-CAP-V0.1/
├── src/                         Vite Command Center frontend
├── server/                      Node API, services, SMS adapters
├── workers/                     SQS worker
├── db/                          PostgreSQL schema, repository, verification
├── scripts/                     Build, bootstrap, dry-run, validation, deployment
├── data/                        Leads, manifests, queues, dry-run reports
├── Demo Building Factory/       Prospect-specific demo projects
├── README.md                    Project entry point
├── IMPLEMENTATION_PLAN_V0.1.md Production implementation plan
├── PRODUCTION_READINESS_100_PLAN.md
├── CAP_PHASE1_EVIDENCE_REPORT.md
├── COMPLETION_AUDIT.md
├── PROJECT_STATUS.md
├── SMS_ACTIVATION.md
├── WORKER_RUNBOOK.md
└── REVENUE_ACTIVATION.md
```

## 20. Glossary

**CAP:** Client Acquisition Pipeline, the Aureum product described in this document.  
**Command Center:** The authenticated operator UI for review, approval, campaign, queue, and revenue operations.  
**Prospect:** A campaign-specific record representing a potential business/contact relationship.  
**Suppression:** A durable do-not-contact state for a phone or email address.  
**Provider readiness:** Verified configuration and compliance state for a delivery provider.  
**Lawful-contact basis:** The documented reason and evidence permitting the selected communication channel for a recipient.  
**DLQ:** Dead-letter queue for jobs that exhausted their retry policy or require intervention.  
**Idempotency:** The guarantee that retrying the same job does not create a duplicate send or duplicate state transition.  
**Demo Building Factory:** The repository area for prospect-specific owned destinations and evidence-led demonstrations.

## References

[1]: README.md "Aureum CAP V0.1 repository overview"
[2]: IMPLEMENTATION_PLAN_V0.1.md "AUREUM CAP V0.1 100% production implementation plan"
[3]: PRODUCTION_READINESS_100_PLAN.md "AUREUM CAP V0.1 production readiness and controlled sending plan"
[4]: CAP_PHASE1_EVIDENCE_REPORT.md "AUREUM CAP V0.1 Phase 1 evidence report"
[5]: COMPLETION_AUDIT.md "Aureum CAP V0.1 completion audit"
[6]: PROJECT_STATUS.md "Aureum CAP V0.1 project status"
[7]: REVENUE_ACTIVATION.md "CAP V0.1 revenue activation record"
[8]: AWS_SETUP.md "AWS setup report for CAP V0.1"
[9]: db/schema.sql "Aureum CAP PostgreSQL schema"
[10]: server/index.mjs "Aureum CAP Node.js API"
[11]: server/services.mjs "Aureum CAP scoring, matching, and verification services"
[12]: server/sms.mjs "Aureum CAP SMS routing and provider adapters"
[13]: workers/sqs-worker.mjs "Aureum CAP SQS worker"
[14]: src/main.js "Aureum CAP Command Center frontend"
[15]: Demo Building Factory/README.md "Demo Building Factory overview"
[16]: Demo Building Factory/001-Zoey-Vincent/project.json "Zoey Vincent demo project manifest"
[17]: data/activation-manifest.json "Authoritative 100-lead activation manifest"
[18]: data/first-10-human-review-queue.json "First 10 human-review queue"
[19]: data/first-50-sms-batch.json "First 50 SMS review-only batch manifest"
[20]: WORKER_RUNBOOK.md "Worker and incident operations runbook"
[21]: SMS_ACTIVATION.md "SMS activation plan"
