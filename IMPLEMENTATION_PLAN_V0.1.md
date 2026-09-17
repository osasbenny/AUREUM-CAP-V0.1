# AUREUM CAP V0.1 — 100% Production Implementation Plan

**Date:** 17 September 2026  
**Repository:** `osasbenny/AUREUM-CAP-V0.1`  
**Command Center:** https://aureum-cap-v0-1.vercel.app/  
**Seed:** 100 Houston business records  
**Current assessment:** Foundation implemented; production activation is not complete.

## Executive objective

Make CAP the durable, auditable system of record for the supplied 100-lead campaign. Every record must move through import, normalization, deduplication, website evidence, permitted enrichment, deterministic scoring, product matching, message preparation, human review, approval, controlled queueing, provider delivery where legally and technically eligible, response capture, founder handoff, opportunity/deal/purchase tracking, and revenue attribution.

**100% does not mean automatically messaging all 100 leads.** It means the system can process all 100 deterministically and durably, while every outbound action remains blocked unless recipient eligibility, permission/compliance basis, suppression clearance, provider readiness, and explicit operator approval are present.

## Current baseline

The repository smoke suite passes. The normalized seed contains 100 unique records, zero supplied emails, zero verified emails, 100 prepared fallback/SMS artifacts, and zero send-eligible records. The CAP API and SQS worker have code foundations, but production persistence, deployment, runtime identity, queue execution, monitoring, provider configuration, and external compliance evidence are not yet verified.

## Completion gates

| Gate | Required evidence | Status |
|---|---|---|
| Source integrity | 100 imported, normalized, unique records; reproducible manifest | Passed locally |
| Durable state | RDS schema applied and verified; PostgreSQL is authoritative | Blocked by private VPC access |
| Production API | HTTPS API, real admin identity, secure cookies, readiness checks | Not deployed/verified |
| Command Center | Vercel frontend uses production API and authenticated live data | Not connected |
| Processing | Website evidence, score, product fit, offer/message records persist | Partial foundation |
| Queue | SQS redrive policy, worker IAM, idempotency, retry/DLQ tests | Not deployed/verified |
| Enrichment | Hunter adapter, key, rate limits, source/timestamp/evidence | Credential not supplied |
| SMS | Twilio account, sender/Messaging Service, A2P 10DLC, callbacks | Not verified |
| Compliance | Per-recipient permission basis, suppression, quiet hours, stop rules | Not established |
| Responses | Twilio inbound/status events, classification, handoff records | Partial code only |
| Revenue | Opportunity → proposal → deal → purchase → revenue events | Not operational |
| Observability | CloudWatch alarms, structured logs, operator notification | Documentation only |
| Controlled pilot | 5–10 dry run, then explicitly approved subset; measured results | Not started |
| 100-lead run | All 100 processed and reported; no uncontrolled send | Not started |

## Architecture decision

CAP remains the **source of truth and control plane**. n8n is optional orchestration only; it must call stable CAP APIs/webhooks and must not own deduplication, scoring, approvals, suppression, state transitions, or revenue attribution.

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| **AWS API + worker runtime**: deploy the existing Node API behind HTTPS in AWS, attach it to the RDS VPC, run the SQS worker as a separate managed process, keep Vercel as the frontend | Best fit for private RDS, SQS, Twilio callbacks, and long-running worker; requires container/runtime setup and IAM | Usage-based AWS cost; stay within current credits and free-tier-sized resources | Medium/high |
| **Serverless AWS split**: convert API routes and worker processing to Lambda + API Gateway + SQS triggers | Lower idle cost and managed scaling; requires refactoring the current HTTP server, session model, and worker lifecycle | Lower idle cost; more request/integration components | High |
| **Temporary/manual runner only**: use a VPC-connected migration runner and local API for the first dry run | Fastest way to validate data and schema; not production-ready and cannot receive webhooks reliably | Lowest initial cost | Low/medium |

**Recommended sequence:** use a temporary VPC-connected runner for migration verification, then deploy the existing Node API and worker in AWS-compatible managed runtime. Do not enable outbound sends during infrastructure work.

## Approved AWS cost envelope before resource creation

The existing RDS instance is already provisioned and observed in the AWS console as `aureum-cap-v01-db`, PostgreSQL, `db.t4g.micro`, private in VPC `vpc-02f0b750c4f333666`, Availability Zone `eu-north-1b`, status **Available**, Single-AZ. It is not being resized, replaced, or deleted.

| Proposed resource | Size/configuration | Purpose | Estimated cost envelope |
|---|---|---|---:|
| Temporary EC2 migration runner | 1 × ARM `t4g.micro`, short-lived, one small encrypted EBS volume, same VPC; stopped/terminated after verification | Apply/verify PostgreSQL schema and import the manifest | Approximately **$0.01/hour plus minimal EBS**, region pricing to be confirmed in AWS; expected one-session cost is a few cents to low dollars |
| RDS already present | Existing `db.t4g.micro`, 20 GiB, Single-AZ, private | Authoritative CAP database | Existing cost continues; no new RDS instance or scale-up |
| SQS already present | Existing processing queue and DLQ | Durable job transport | Existing usage-based queue cost; no new queue |
| S3 already present | Existing private CAP bucket | Reports/imports/audits | Existing usage-based storage/request cost; no new bucket |
| Future API runtime | 1 × ARM Fargate task, target 0.25 vCPU / 0.5–1 GiB, no autoscaling during pilot | HTTPS API | Usage-based compute; official pricing is per-second with a one-minute minimum. Load balancer, public IPv4, logs, and data transfer are separate and must be costed before deployment |
| Future worker runtime | 1 × ARM Fargate task, same minimum sizing, only while processing | SQS worker | Usage-based compute; keep stopped until the API, schema, and queue tests pass |

**Cost controls:** no NAT Gateway, no Multi-AZ changes, no RDS resize, no production SES-limit request, no paid Hunter/n8n activation, no autoscaling, and no outbound provider calls. The temporary runner will be removed or disabled after the migration report is captured. AWS’s official pricing pages state that Lambda is usage-priced with a free tier, Fargate is billed per second with a one-minute minimum, and RDS charges depend on instance hours, storage, backups, I/O, and transfer; exact Stockholm totals depend on the final networking/runtime configuration.

**Migration recommendation:** use a temporary EC2 `t4g.micro` runner rather than Lambda for the first migration because the current repository already has shell-based schema/bootstrap tooling and the private RDS path can be tested directly without introducing a new VPC endpoint or Lambda packaging layer. No resource should be created until the operator confirms this specific cost envelope.

## Phase 0 — Governance and external prerequisites

1. Keep `CAP_SMS_SEND_ENABLED=false` and `CAP_SEND_ENABLED=false`.
2. Record the campaign’s lawful contact basis per selected recipient. A public phone number alone is not consent.
3. Decide whether the first activation channel is SMS only, email only, or both. The repository currently routes U.S. `+1` records to Twilio and has no email addresses.
4. Obtain the Twilio Account SID, Auth Token, sender number or Messaging Service SID, status callback URL, and completed A2P 10DLC status through the approved secret-sharing path. Never commit secrets.
5. Obtain a Hunter API key only if email discovery/verification is authorized and desired. Store source, verification result, timestamp, and permission basis for every returned address.
6. Confirm the n8n hosting/account and webhook base URL. n8n remains optional and must not become a CAP core dependency.
7. Choose the production API runtime from the architecture table and approve any AWS cost or IAM scope before creation.

## Phase 1 — Database and authoritative state

1. Create a temporary VPC-connected migration runner using the least-privilege path approved by the operator.
2. Read the RDS managed secret from AWS Secrets Manager without exposing it in chat, Git, or browser variables.
3. Apply `db/schema.sql`; run `db/verify-schema.sql`; capture row/table/extension evidence.
4. Import `data/activation-manifest.json` into normalized organization, people, contacts, campaign, prospect, product-fit, offer, message, suppression, event, and queue records.
5. Add durable CAP-specific records for approvals, idempotency keys, provider events, website audits, inbound responses, handoffs, opportunities, deals, purchases, and revenue events where the current schema is insufficient.
6. Replace in-process collections in `server/index.mjs` with repository transactions and optimistic locking/idempotency checks.
7. Verify 100 records, zero duplicate normalized keys, repeatable bootstrap, and safe restart behavior.

**Exit evidence:** schema verification output, imported counts, duplicate report, restart/reload test, and no secrets in Git.

## Phase 2 — Production API and Command Center

1. Deploy the API behind HTTPS with a stable public URL, health/readiness endpoints, structured logs, and restart policy.
2. Configure server-only secrets through AWS Secrets Manager/SSM: `DATABASE_URL`, admin identity, AWS region/resources, Twilio/Hunter/SES credentials only when approved, and feature gates.
3. Replace the development fallback credential with a real password-hashed admin identity or approved identity provider. Use secure, production cookies and explicit CORS for the Vercel frontend.
4. Set Vercel `VITE_API_BASE_URL` to the HTTPS API URL and redeploy the Command Center.
5. Verify login/logout, dashboard, 100-lead list, lead details, approvals, suppression, campaign controls, queue, events, readiness, and logout from the public URLs.

**Exit evidence:** public API health/readiness, authenticated browser smoke test, live database metrics, and no fallback credentials in production.

## Phase 3 — Durable processing pipeline

1. Implement persisted jobs for website verification, scoring, product matching, message preparation, and SMS/email preparation.
2. Store evidence, timestamps, versions, status, retry count, and errors for every stage.
3. Implement SQS source-queue redrive policy with maximum receive count and DLQ.
4. Deploy the worker with least-privilege IAM. Add idempotency keys before provider calls and durable completion/failure records after processing.
5. Test success, transient retry, permanent failure, duplicate delivery, visibility timeout, DLQ redrive, and restart recovery.
6. Add disabled-by-default EventBridge schedules that re-check campaign approval and suppression immediately before dispatch.

**Exit evidence:** queue/DLQ test report, worker logs, idempotency replay test, and no message dispatch while gates are false.

## Phase 4 — Enrichment and evidence

1. Implement replaceable `EmailFinderProvider` and `EmailVerificationProvider` interfaces.
2. If Hunter is approved and a key is provided, configure server-side key access, rate limits, retry handling, and source/timestamp storage.
3. Never infer email validity from syntax alone. Persist Hunter result, confidence/status, source, timestamp, and failure reason.
4. Keep all 100 records usable without Hunter; records without verified contacts remain review-only.
5. Run website verification in bounded batches and persist `UNKNOWN`, `ACTIVE`, `INACTIVE`, `NOT_FOUND`, `BLOCKED`, and `ERROR` evidence.

## Phase 5 — Twilio SMS readiness

1. Complete Twilio account authentication and verify API access.
2. Configure a U.S. sender number or Messaging Service SID.
3. Complete/verify A2P 10DLC brand and campaign registration where applicable.
4. Register public HTTPS status and inbound webhook URLs.
5. Verify Twilio signatures using the final public URL.
6. Persist provider message IDs, accepted/queued/sent/delivered/failed/undelivered status, errors, inbound replies, and opt-outs.
7. Enforce STOP/UNSUBSCRIBE/CANCEL/QUIT/END/REVOKE suppression before every send and on every inbound opt-out.
8. Keep the send gate disabled until technical and compliance reviews pass.

## Phase 6 — Observability, security, and recovery

1. Add CloudWatch alarms for API errors, worker errors, queue age, visible queue depth, DLQ depth, RDS availability, webhook failures, provider failures, bounce/complaint/opt-out spikes, and schedule failures.
2. Send alarms to an operator notification channel without triggering outbound campaigns.
3. Confirm RDS backups, S3 private access/versioning, secret rotation posture, and restore procedure.
4. Review IAM for least privilege and remove temporary migration resources after verification.
5. Add audit-log queries and exportable run reports.

## Phase 7 — 100-lead deterministic dry run

Run all 100 records through the no-send pipeline:

```text
100 → import → normalize → deduplicate → website verification
→ deterministic scoring → product matching → message preparation
→ suppression check → Command Center review → report
```

Produce a run report containing imported, duplicate, website-status, enrichment, score-band, product-fit, prepared-message, blocked, approved, and error counts. This phase must not call Twilio, SES, Hunter, OpenAI, or n8n unless those providers are explicitly enabled for a bounded test.

## Phase 8 — Controlled 5–10 record provider dry run

1. Select 5–10 records based on evidence and operator review.
2. Verify contact basis, message, sender, quiet hours, suppression, and stop conditions.
3. Process through the durable queue with provider gates still disabled first.
4. Validate provider payloads, webhook signatures, response capture, audit events, and dashboard counts.
5. Only after explicit operator approval may an approved subset be sent. Never send all 100 automatically.

## Phase 9 — Business outcomes

1. Add manual response classification: interested, positive, question, later, not interested, unsubscribe, unknown.
2. Create visible founder handoff records for high-intent replies.
3. Add opportunity, proposal, deal, purchase, and revenue-event mutations with audit trail.
4. Report pipeline value, expected revenue, won revenue, conversion rates, and revenue by campaign/product.
5. Connect n8n only for approved orchestration, notifications, and external synchronization through CAP APIs/webhooks.

## First implementation work package started with this plan

The first safe work package is a reproducible local 100-lead dry-run report. It exercises the deterministic CAP stages without external providers or outbound side effects, producing a machine-readable artifact that becomes the baseline for the durable database run.

**Success criteria:** `npm run pipeline:dry-run` passes, reports 100 unique records, zero send-eligible records while permission is not established, and records stage counts/errors without claiming delivery.

## Explicit approval gates

Stop and request operator approval before:

- Creating paid or unexpected AWS resources.
- Applying destructive database changes.
- Broadening IAM permissions.
- Adding provider subscriptions or paid plans.
- Enabling Hunter, Twilio, SES, OpenAI, or n8n calls.
- Registering production DNS or public webhooks.
- Setting any send gate to `true`.
- Sending any message to a real recipient.

## Definition of 100% for CAP V0.1

The project is complete only when the implementation and evidence show: authenticated live Command Center; durable PostgreSQL state; complete 100-record processing; persistent approvals/suppression/audit; deployed SQS worker with retry/DLQ/idempotency; controlled scheduling; verified provider callbacks; lawful contact basis; measured 5–10 record dry run; human handoff; revenue attribution; CloudWatch alarms; backup/recovery evidence; and a documented, explicitly approved subset send. The final state must still prevent uncontrolled bulk outreach.
