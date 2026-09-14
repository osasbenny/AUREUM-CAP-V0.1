# AUREUM CAP V0.1 — Remaining Work for Manus

**Date:** 2026-09-14  
**Scope:** Complete the CAP V0.1 frontend + backend foundation while intentionally excluding OpenAI and Hunter integrations.

## Mission

Turn the existing Aureum CAP V0.1 repository into a **fully operational, authenticated Command Center and controlled lead-processing pipeline**, ready to run a real 50-lead smoke test.

After this work, CAP should be operational except for:
1. **OpenAI** — AI reasoning/message generation.
2. **Hunter** — email discovery/enrichment/verification.
3. **n8n** — external orchestration, connected separately.

Do not fake or hard-code these integrations. Build provider interfaces/placeholders so they can be connected later without restructuring CAP.

## Hard Safety Rules

### DO
- Inspect the existing repository before modifying it.
- Reuse existing schema, AWS resources, seed data, UI structure, and environment conventions.
- Make the Command Center PostgreSQL-backed, not static.
- Keep secrets server-side.
- Preserve review-before-send.
- Implement idempotency and duplicate-send prevention.
- Implement unsubscribe, hard-bounce, complaint, and manual suppression.
- Log consequential actions.
- Keep OpenAI/Hunter behind provider interfaces.
- Make the 50-lead smoke test reproducible and observable.

### DO NOT
- Do not delete/replace unrelated AWS resources.
- Do not add unnecessary AWS services.
- Do not enable uncontrolled bulk sending.
- Do not automatically send all 50.
- Do not expose secrets as browser/Vercel `VITE_*` variables.
- Do not make LinkedIn scraping a dependency.
- Do not bypass suppression or approval.
- Do not invent Hunter/OpenAI results.
- Do not mark unverified data as verified.

# FRONTEND — COMMAND CENTER

## 1. Authentication
Implement a real front-facing login page:
- Login route/page.
- Protected dashboard routes.
- Session handling and logout.
- Unauthorized users cannot access operations.
- Server-side authentication boundary.
- Roles prepared for `admin` and `operator`.

## 2. Live Overview Dashboard
Replace hard-coded metrics with live API/database data:
- Imported, verified, enriched, qualified.
- Awaiting approval, approved, scheduled, queued.
- Sent, delivered, bounced, replied, positive replies.
- Opportunities, proposals, won deals.
- Pipeline value, expected revenue, won revenue.
- Revenue by campaign/product.

## 3. Lead Review Workspace
For each prospect show:
- Business, location, phone, website.
- Website verification/evidence.
- Email status.
- Lead score + breakdown.
- Business type.
- Product-fit rankings + evidence.
- Opportunity summary.
- Proposed offer.
- Message preview.
- Campaign/lifecycle.
- Audit history.

Actions:
- Approve, reject, request changes.
- Edit message.
- Suppress/block.
- Schedule/unschedule.
- Return to review.

Every action must persist to the backend.

## 4. Approval Center
Dedicated queue with filters for:
- Campaign, product, score, location, industry, status, approval state.

Support controlled bulk approval without bypassing validation/suppression.

## 5. Campaign Center
Lifecycle:
`DRAFT → REVIEW → APPROVED → SCHEDULED → ACTIVE → PAUSED → COMPLETED`

Configuration:
- Name/objective/ICP/geography/industry.
- Product/offer.
- Daily limit/batch size.
- Send window.
- Sender.
- Follow-up schedule.
- Approval requirement.

Controls:
Create, edit, approve, schedule, start, pause, resume, stop, retry.

Starting a campaign must never bypass approval.

## 6. Queue Monitor
Show queued, processing, completed, failed, retrying, DLQ.

Show job ID, prospect, campaign, attempts, errors, timestamps and retry controls.

## 7. Activity/Audit Log
Show import, dedupe, verification, scoring, product match, approval, scheduling, queue, send, delivery, bounce, complaint, unsubscribe, reply, handoff, opportunity, deal and revenue events.

## 8. Revenue Command Center
Implement:
`Campaign → Prospect → Opportunity → Proposal → Deal → Purchase → Revenue Event`

Report pipeline, expected value, won revenue, product revenue, campaign revenue and conversion rates.

# BACKEND

## 9. Business API
Preserve `/health`, `/readiness`, `/api/v1/pilot/summary` and add real APIs such as:

```text
GET    /api/v1/dashboard
GET    /api/v1/leads
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
POST   /api/v1/leads/:id/approve
POST   /api/v1/leads/:id/reject
POST   /api/v1/leads/:id/suppress
GET    /api/v1/approvals
POST   /api/v1/approvals/bulk
GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/approve
POST   /api/v1/campaigns/:id/start
POST   /api/v1/campaigns/:id/pause
POST   /api/v1/campaigns/:id/resume
POST   /api/v1/campaigns/:id/stop
GET    /api/v1/queue
POST   /api/v1/queue/:jobId/retry
GET    /api/v1/events
GET    /api/v1/revenue
GET    /api/v1/products
GET    /api/v1/product-fit/:prospectId
```

Use consistent JSON responses/errors and server-side validation.

## 10. PostgreSQL
- Apply `db/schema.sql` to RDS from an approved VPC-connected runner.
- Run `db/verify-schema.sql`.
- Never commit database passwords.
- Implement database-backed deduplication.
- Normalize business/contact identifiers.
- Store duplicate evidence/audit.
- Make PostgreSQL the authoritative state store.

## 11. Website Verification — WITHOUT HUNTER
Implement an internal verifier:
1. Identify likely official website.
2. Resolve URL.
3. HTTP/HTTPS check.
4. Follow safe redirects.
5. Record status/evidence/timestamp.
6. Record failure reason.
7. Bounded retry for transient failures.

Statuses:
`UNKNOWN`, `FOUND`, `ACTIVE`, `INACTIVE`, `NOT_FOUND`, `BLOCKED`, `ERROR`.

Never treat the supplied PDF's website claim as verified evidence.

## 12. Deterministic Lead Scoring — WITHOUT OPENAI
Initial weights:
- Company Fit — 25%
- Buying Signal — 20%
- Website Opportunity — 20%
- Decision Maker — 15%
- Contact Quality — 10%
- Location — 5%
- Business Size — 5%

Persist total, components, evidence, scoring version and timestamp. Make weights configurable.

## 13. Deterministic Product Matching — WITHOUT OPENAI
Examples:
- Restaurant → AuraPOS / Premium Website / Automation.
- Church → FaithConnect / Website / Automation.
- Freelancer/agency → AuraReach.
- Startup → MVP/custom software.
- NGO/fundraiser → AURA.
- School/parent/education → AuraKidsBooks.
- SME with weak website → Premium Website.
- Logistics with weak digital systems → Digital Transformation / Custom Software.

Do not permanently assign one product. Store multiple product-fit records with scores/evidence and support cross-sell relationships.

## 14. Offer + Message Fallback
Because OpenAI is excluded:
- Create `AIProvider` interface.
- Create deterministic/template fallback.
- Label fallback messages `TEMPLATE/FALLBACK`.
- Store versions, evidence/inputs and approval state.
- Never claim AI-generated content when OpenAI is disabled.

## 15. SQS Workers
Use existing SQS foundation.

Support queues for:
- Lead processing.
- Verification.
- Scoring/matching.
- Message preparation.
- Email sending.

Implement job IDs, idempotency keys, attempts, exponential backoff, max attempts, DLQ, structured errors, safe redrive and persisted job state.

Never send the same approved email twice because of a retry.

## 16. EventBridge
Implement controlled scheduling:
- Store schedule in DB.
- EventBridge triggers processing.
- Paused/stopped campaigns cannot dispatch.
- Approval is rechecked at execution time.
- Scheduling is visible in Command Center.

## 17. SES
Complete SES independently:
- Sender identity.
- DNS/DKIM where applicable.
- Respect SES sandbox.
- Server-side configuration.
- Only approved messages may send.
- Persist SES/message IDs.
- Track delivery/failures.
- Do not increase volume aggressively during smoke test.

## 18. Compliance + Suppression
Implement:
- Unsubscribe handling.
- Suppression table.
- Hard-bounce suppression.
- Complaint suppression.
- Manual suppression.
- Duplicate-send prevention.
- Accurate sender/subject metadata.
- Audit trail.

Check suppression immediately before every send.

## 19. Delivery/Bounce/Complaint Events
Capture SES events and persist:
- Delivery.
- Bounce.
- Complaint.
- Reject/failure.
- Timestamp.
- Message ID.
- Prospect/contact.

Automatically suppress hard bounces and complaints.

## 20. Replies + Human Handoff
Prepare inbound response capture.

Categories:
- Interested.
- Positive.
- Question.
- Later.
- Not interested.
- Unsubscribe.
- Unknown.

OpenAI classification is deferred. Provide capture + manual classification + Command Center display + human handoff records.

High-intent responses must be prominent for founder/operator action.

## 21. Authorization + Audit
Roles:
- `admin`
- `operator`

Protect campaign controls, approval, suppression, send controls, configuration and revenue edits. Audit consequential operations.

## 22. Monitoring
Configure CloudWatch for:
- API errors.
- Worker errors.
- Queue/DLQ depth.
- SES failures.
- Bounce rate.
- Complaint events.
- Scheduling failures.
- Database connectivity.

Keep monitoring cost-conscious.

## 23. Backups + Recovery
Verify RDS backups and document:
- Retention.
- Recovery expectations.
- S3 protection/versioning where applicable.
- Recovery procedure.

Do not add expensive infrastructure unless required.

# N8N BOUNDARY

n8n must NOT be a hard dependency for CAP's core business logic.

CAP remains the source of truth.

n8n later handles orchestration such as:
- Campaign triggers.
- Google Sheets synchronization.
- Notifications.
- External integrations.
- Operational workflows.

Expose stable APIs/webhooks for n8n. Do not move scoring, dedupe, state machines, revenue attribution or security into n8n.

# 50-LEAD SMOKE TEST

Prepare the system to run **50 real leads**.

### Phase A
`50 leads → import → dedupe → website verification → deterministic scoring → product matching → opportunity detection → message preparation → Command Center review`

### Phase B
Stop for human review. Operator sees all 50 and approves a controlled subset.

Suggested first send batch: **10 highly qualified prospects**, subject to actual results and SES limits.

### Phase C
`Approved → scheduled → SQS → SES → delivery tracking → response capture → handoff`

Never automatically send all 50.

The Command Center must report actual:
- Imported.
- Duplicates.
- Valid prospects.
- Website verification results.
- Qualified prospects.
- Product-fit distribution.
- Messages prepared.
- Approved/scheduled/sent.
- Delivered/bounced/complaints.
- Replies/positive replies.
- Opportunities.
- Pipeline value.
- Won revenue, if any.

Do not invent target outcomes. The smoke test measures reality.

# PROVIDER INTERFACES

Implement replaceable interfaces:

```text
AIProvider
EmailFinderProvider
EmailVerificationProvider
EmailProvider
QueueProvider
StorageProvider
WebsiteVerificationProvider
```

V0.1 providers:

```text
AIProvider                   = DISABLED / fallback template
EmailFinderProvider         = DISABLED / Hunter later
EmailVerificationProvider   = DISABLED / Hunter later
EmailProvider               = AWS SES
QueueProvider               = AWS SQS
StorageProvider             = AWS S3
WebsiteVerificationProvider = CAP internal HTTP verifier
```

# DEFINITION OF DONE

- [ ] Login protects Command Center.
- [ ] Command Center is live-data backed.
- [ ] Lead review persists to PostgreSQL.
- [ ] Approval workflow is real and auditable.
- [ ] Campaign controls are persistent.
- [ ] Queue monitor is real.
- [ ] Website verification works without Hunter.
- [ ] Deterministic scoring works without OpenAI.
- [ ] Deterministic product matching works without OpenAI.
- [ ] Fallback messages work without OpenAI and are clearly labelled.
- [ ] PostgreSQL schema is applied and verified.
- [ ] Database-backed dedupe works.
- [ ] SQS worker has retry/DLQ/idempotency.
- [ ] EventBridge scheduling works.
- [ ] SES delivery works subject to AWS sandbox/identity status.
- [ ] Suppression/unsubscribe/bounce/complaint protection works.
- [ ] Inbound response/manual classification works.
- [ ] Human handoff appears in Command Center.
- [ ] Revenue attribution is operational.
- [ ] CloudWatch monitoring is configured.
- [ ] Audit trail works.
- [ ] Backup/recovery posture is documented.
- [ ] 50-lead smoke-test mode is ready.
- [ ] No uncontrolled outbound campaign can start without operator approval.

# FINAL REPORT REQUIRED FROM MANUS

After implementation provide:
1. Files created/modified.
2. Database migrations applied.
3. AWS resources used/created/changed.
4. Environment variables.
5. Authentication setup.
6. API endpoints.
7. Queue/worker status.
8. EventBridge status.
9. SES identity/sandbox status.
10. CloudWatch alarms.
11. Smoke-test readiness.
12. Known limitations.
13. Exact local commands.
14. Exact Vercel settings.
15. Exact steps for the first 50-lead test.

# STOP CONDITIONS

Stop and request operator approval before:
- Unexpected AWS cost.
- Destructive database migration.
- Deletion of AWS resources.
- Production DNS changes.
- Broad IAM permissions.
- Changes that could send unsolicited bulk email.
- SES production-limit changes.
- External service subscriptions.

# FINAL PRINCIPLE

**CAP is the system of record and decision/control layer. n8n is orchestration. OpenAI is intelligence. Hunter is enrichment.**

CAP must remain functional and testable when OpenAI, Hunter and n8n are disconnected.

> **Immediate objective: make the machine real enough that 50 businesses can enter CAP, be processed, scored, matched, reviewed, approved, scheduled, and — for an explicitly approved subset — sent through SES, producing measurable real-world results.**
