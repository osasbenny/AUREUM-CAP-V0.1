# Project status — 2026-09-14

## Current status

**Pilot console: built and build-verified.** The repository contains a responsive operator dashboard, the normalized 100-lead seed dataset, export support, readiness indicators, and a review-before-send interaction. The app is safe by default: it does not send outreach or invoke paid providers.

| Area | Status | Notes |
|---|---|---|
| Lead import | READY | 100 records normalized from supplied PDF |
| Deduplication | PARTIALLY READY | PDF numbering artifacts handled; business-level dedupe remains server work |
| Website verification | BLOCKED | Needs approved verifier/provider and evidence storage |
| Hunter enrichment | BLOCKED | Credential and provider adapter not configured |
| Email verification | BLOCKED | Provider adapter and suppression checks required |
| Lead scoring | PARTIALLY READY | Scoring model documented; persistence and evidence UI pending |
| Product matching | PARTIALLY READY | Premium Website Development is campaign offer; multi-product graph pending |
| Message generation | BLOCKED | OpenAI secret and human-review API required |
| Queueing/scheduling | BLOCKED | SQS/EventBridge integration pending |
| SES delivery | BLOCKED | Sending identity, sandbox review, DNS, bounce/complaint handling pending |
| Replies/handoff | BLOCKED | Inbound event capture and classifier pending |
| Revenue attribution | BLOCKED | Opportunities, deals, purchases, and revenue events pending |
| Monitoring | PARTIALLY READY | Console readiness state documented; CloudWatch wiring pending |

## Remaining task list to reach 100% production CAP V0.1

- [ ] Add server/API boundary and PostgreSQL migrations for organizations, contacts, prospects, campaigns, products, product-fit, offers, messages, responses, opportunities, deals, purchases, suppression, and events.
- [ ] Add deterministic import, business-level deduplication, and audit events.
- [ ] Implement website verification with stored evidence, timestamps, status, and retry policy.
- [ ] Implement replaceable Hunter adapter, email verification, rate-limit handling, and secret retrieval.
- [ ] Implement configurable scoring weights and multi-product fit records.
- [ ] Implement OpenAI adapter with grounded prompts, JSON validation, cost controls, and human approval state.
- [ ] Implement SQS queue + DLQ and EventBridge schedules for controlled batches.
- [ ] Configure SES identity and DNS only after owner approval; keep sandbox mode until test evidence is reviewed.
- [ ] Implement bounce, complaint, unsubscribe, suppression, and duplicate-send prevention.
- [ ] Implement inbound reply capture and response classification with human handoff notifications.
- [ ] Implement opportunity/deal/purchase/revenue attribution and campaign reporting.
- [ ] Add authentication, authorization, audit logging, backups, CloudWatch alarms, and incident runbook.
- [ ] Run an end-to-end dry run on 10–20 records, review evidence and generated messages, and obtain explicit operator approval before any real send.

## Definition of done

A real campaign can discover a prospect, store it, enrich it, score it, identify a relevant product, generate a personalized offer, send it under controlled policy, receive/classify a response, hand the opportunity to the founder, record a sale, and attribute revenue to campaign and product.
