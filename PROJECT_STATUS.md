# Project status — 2026-09-16

## Current status

**Pilot console and first authenticated production foundation are implemented and build-verified.** The repository contains a protected operator dashboard, normalized 100-lead seed dataset, deterministic scoring and product-fit services, website verification, fallback message preparation, approval/suppression/audit APIs, PostgreSQL schema migration tooling, server-only readiness boundary, AWS foundation documentation, and deployment metadata.

**Revenue activation milestone:** the 100 Houston records are now SMS-first. All 100 supplied `+1` numbers route to the Twilio adapter; every record has a prepared opener in `data/activation-manifest.json`. Termii remains available for future non-U.S. routes. No SMS was sent: the API requires human SMS approval, an established permission/compliance basis, suppression checks, provider configuration, and `CAP_SMS_SEND_ENABLED=true`.

**Audited completion: 25% of the supplied production definition of done.** The six fully satisfied checklist items are internal website verification, deterministic scoring, deterministic product matching, labelled fallback messages, backup/recovery documentation, and the no-uncontrolled-outbound safety gate. Partial foundations are deliberately not counted as complete until deployed, persistent, observable, and end-to-end verified. See [`COMPLETION_AUDIT.md`](COMPLETION_AUDIT.md) for the item-by-item calculation and blockers.

| Area | Status | Notes |
|---|---|---|
| Lead import | READY | 100 records normalized from supplied PDF |
| PostgreSQL schema | READY TO APPLY | `db/schema.sql`, `db/apply-schema.sh`, and `db/verify-schema.sql` are prepared; run from a VPC-connected runner |
| Server/API boundary | IMPLEMENTED FOUNDATION | Session login/logout, live dashboard, leads, approvals, campaigns, queue/events/revenue/product-fit endpoints; PostgreSQL persistence still to wire |
| AWS S3/SQS foundation | READY | Private bucket, processing queue, and DLQ created |
| RDS PostgreSQL | AVAILABLE | `aureum-cap-v01-db`, private `db.t4g.micro`, PostgreSQL 18.3, Single-AZ; endpoint is available in AWS |
| Deduplication | IMPROVED | Deterministic seed validation now checks normalized business keys; database-backed dedupe remains server work |
| Website verification | READY IN FOUNDATION | CAP internal bounded HTTP/DNS verifier and evidence response implemented; persistence/worker execution remains |
| Hunter enrichment | BLOCKED | Credential and provider adapter not configured |
| Email verification | BLOCKED | Provider adapter and suppression checks required |
| SMS activation | PREPARED / SEND BLOCKED | 100 U.S. routes prepared for Twilio; adapter and status-callback contract implemented; A2P 10DLC/provider setup, permission basis, durable queue, and operator approval remain |
| Lead scoring | READY IN FOUNDATION | Deterministic weighted scoring with version and evidence implemented |
| Product matching | READY IN FOUNDATION | Multi-fit deterministic matcher with evidence implemented |
| Message generation | SAFE FALLBACK READY | Clearly labelled template/fallback message preparation; OpenAI remains disabled |
| Queueing/scheduling | DOCUMENTED | SQS/DLQ contract, retry guidance, and incident runbook added; worker, redrive policy, and EventBridge target pending |
| SES delivery | BLOCKED SAFELY | SES sandbox and send gate remain disabled until identity status and dry-run controls are verified |
| Replies/handoff | BLOCKED | Inbound event capture and classifier pending |
| Revenue attribution | BLOCKED | Opportunities, deals, purchases, and revenue events pending |
| Monitoring | DOCUMENTED | Operational incident runbook added; CloudWatch alarms and runtime notifications remain pending |

## Remaining task list to reach 100% production CAP V0.1

- [ ] Apply `db/schema.sql` from a VPC-connected runner using the managed secret, then run `db/verify-schema.sql`.
- [x] Add deterministic seed validation; database-backed deduplication and audit events remain.
- [ ] Implement website verification with stored evidence, timestamps, status, and retry policy.
- [ ] Implement replaceable Hunter adapter, email verification, rate-limit handling, and secret retrieval.
- [ ] Implement configurable scoring weights and multi-product fit records.
- [ ] Implement OpenAI adapter with grounded prompts, JSON validation, cost controls, and human approval state.
- [ ] Implement SQS worker, DLQ redrive policy, idempotency, and disabled EventBridge schedules.
- [ ] Configure an approved SES identity and DNS; remain in sandbox until test evidence is reviewed.
- [ ] Implement bounce, complaint, unsubscribe, suppression, and duplicate-send prevention.
- [ ] Implement inbound reply capture and response classification with human handoff notifications.
- [ ] Implement opportunity/deal/purchase/revenue attribution and campaign reporting.
- [x] Add initial server-side authentication, role-ready session boundary, audit event capture, and protected operator UI; production identity provider, backups, and CloudWatch alarms remain.
- [x] Prepare all 100 supplied U.S. phone records for SMS routing and generate reviewable SMS openers without fabricating email data.
- [ ] Run an end-to-end dry run on 5–10 records, review evidence and generated messages, document the permission/compliance basis, and obtain explicit operator approval before any real send.

## Definition of done

A real campaign can discover a prospect, store it, enrich it, score it, identify a relevant product, generate a personalized offer, send it under controlled policy, receive/classify a response, hand the opportunity to the founder, record a sale, and attribute revenue to campaign and product.

**Current production-readiness assessment: 25%, not yet 100%.** SMS preparation is complete, but the remaining blockers require a deployed API, real production authentication, applied and verified RDS schema, PostgreSQL persistence, SQS workers, controlled scheduling, Twilio A2P/provider setup, permission/compliance evidence, SMS status/reply handling, monitoring, and end-to-end testing; the implementation does not claim those external prerequisites are complete.

## 2026-09-16 production activation update

The API now has a PostgreSQL repository path activated by `DATABASE_URL`, durable lead snapshots, queue job persistence, SQS worker code with retry/DLQ handling, Twilio signature-verified status and inbound webhooks, recipient STOP suppression, and a review-only first-50 batch manifest. Local dry-run fallback remains available when `DATABASE_URL` is absent.

The private RDS instance is confirmed **Available** in `eu-north-1`, but schema application is still blocked because AWS CloudShell is not VPC-connected and the account's RDS Query Editor path is unavailable. A VPC-connected runner or an approved temporary Lambda/EC2 runner with access to the managed Secrets Manager credential is required. No database migration is claimed complete until the verification query succeeds.

Twilio credentials, a valid U.S. sender or Messaging Service, A2P 10DLC registration, and permission/compliance evidence for the supplied phone records are still external prerequisites. The first 50 batch is generated in `data/first-50-sms-batch.json`, but every record is explicitly `BLOCKED_REVIEW_ONLY`; no live SMS send is enabled.

## 2026-09-17 implementation kickoff

The end-to-end production implementation plan is recorded in [`IMPLEMENTATION_PLAN_V0.1.md`](IMPLEMENTATION_PLAN_V0.1.md). The first safe work package is complete: `npm run pipeline:dry-run` processed all 100 seeded records locally through normalization, deterministic scoring, product matching, fallback/SMS preparation, and eligibility evaluation without calling Hunter, Twilio, SES, OpenAI, n8n, PostgreSQL, or SQS. The report is saved at `data/pipeline-dry-run-report.json` and confirms 100 unique records, 100 prepared messages, zero outbound calls, and 100 records blocked pending approval and an established permission/compliance basis.
