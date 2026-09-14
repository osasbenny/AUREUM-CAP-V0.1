# Project status — 2026-09-14

## Current status

**Pilot console and first production integration slice are implemented and build-verified.** The repository contains the responsive operator dashboard, normalized 100-lead seed dataset, export support, review-before-send interaction, PostgreSQL schema migration, server-only readiness boundary, AWS foundation documentation, and deployment metadata.

| Area | Status | Notes |
|---|---|---|
| Lead import | READY | 100 records normalized from supplied PDF |
| PostgreSQL schema | READY TO APPLY | `db/schema.sql` covers the documented source-of-truth model; apply after RDS becomes Available |
| Server/API boundary | PARTIALLY READY | `/health` and `/readiness` implemented; business API/auth still required |
| AWS S3/SQS foundation | READY | Private bucket, processing queue, and DLQ created |
| RDS PostgreSQL | PROVISIONING | `aureum-cap-v01-db`, private `db.t4g.micro`, PostgreSQL 18.3, Single-AZ |
| Deduplication | PARTIALLY READY | PDF numbering artifacts handled; business-level dedupe remains server work |
| Website verification | BLOCKED | Needs approved verifier/provider and evidence storage |
| Hunter enrichment | BLOCKED | Credential and provider adapter not configured |
| Email verification | BLOCKED | Provider adapter and suppression checks required |
| Lead scoring | PARTIALLY READY | Scoring model documented; persistence and evidence UI pending |
| Product matching | PARTIALLY READY | Starter product graph seeded in migration; fit engine pending |
| Message generation | BLOCKED | OpenAI secret and human-review API required |
| Queueing/scheduling | PARTIALLY READY | SQS and DLQ exist; worker, redrive policy, and EventBridge target pending |
| SES delivery | BLOCKED SAFELY | SES sandbox, no identities, no sends; approved sender identity and DNS required |
| Replies/handoff | BLOCKED | Inbound event capture and classifier pending |
| Revenue attribution | BLOCKED | Opportunities, deals, purchases, and revenue events pending |
| Monitoring | PARTIALLY READY | RDS enhanced monitoring is configuring; alarms and incident runbook pending |

## Remaining task list to reach 100% production CAP V0.1

- [ ] Wait for RDS to become `Available`, retrieve its endpoint from AWS, and apply `db/schema.sql` using the managed secret.
- [ ] Add deterministic import, business-level deduplication, and audit events.
- [ ] Implement website verification with stored evidence, timestamps, status, and retry policy.
- [ ] Implement replaceable Hunter adapter, email verification, rate-limit handling, and secret retrieval.
- [ ] Implement configurable scoring weights and multi-product fit records.
- [ ] Implement OpenAI adapter with grounded prompts, JSON validation, cost controls, and human approval state.
- [ ] Implement SQS worker, DLQ redrive policy, idempotency, and disabled EventBridge schedules.
- [ ] Configure an approved SES identity and DNS; remain in sandbox until test evidence is reviewed.
- [ ] Implement bounce, complaint, unsubscribe, suppression, and duplicate-send prevention.
- [ ] Implement inbound reply capture and response classification with human handoff notifications.
- [ ] Implement opportunity/deal/purchase/revenue attribution and campaign reporting.
- [ ] Add authentication, authorization, audit logging, backups, CloudWatch alarms, and incident runbook.
- [ ] Run an end-to-end dry run on 10–20 records, review evidence and generated messages, and obtain explicit operator approval before any real send.

## Definition of done

A real campaign can discover a prospect, store it, enrich it, score it, identify a relevant product, generate a personalized offer, send it under controlled policy, receive/classify a response, hand the opportunity to the founder, record a sale, and attribute revenue to campaign and product.

**Current production-readiness assessment: not yet 100%.** The remaining blockers require credentials, a verified sending identity, server-side integrations, and end-to-end testing; the implementation does not claim those external prerequisites are complete.
