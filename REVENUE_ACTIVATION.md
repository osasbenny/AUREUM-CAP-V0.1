# CAP V0.1 Revenue Activation Day

**Date:** 2026-09-16  
**Campaign:** CAP V0.1 — Campaign 001 — Houston Website Opportunity  
**Outcome:** **STATE B — PROVIDER BLOCKER**

## What was verified

The original supplied PDF contains exactly 100 business records. Each record contains a business name, category, location/address, and phone number. The source contains **zero email addresses**, **zero supplied websites**, and no verified consent or contact permission. CAP therefore does not fabricate addresses, infer email addresses, or mark any contact as sendable.

The activation manifest now represents all 100 records and deterministically prepares each one for the next safe stage. Each record includes its normalized business key, duplicate status, website/email/contact status, deterministic score and evidence, ranked product fits, selected offer, fallback message, lifecycle state, send eligibility, and blocker reason.

## Current activation metrics

| Metric | Result |
|---|---:|
| Supplied businesses | 100 |
| Unique business records | 100 |
| Duplicate records | 0 |
| Website records supplied in PDF | 0 |
| Email addresses supplied in PDF | 0 |
| Verified email addresses | 0 |
| Send-eligible records | 0 |
| Personalized fallback offers prepared | 100 |
| Outbound messages sent | 0 |

## Why this is a provider blocker

The requested outcome requires email discovery and verification, but the source data does not contain email addresses. Hunter was intentionally excluded from the original project scope and no enrichment credential is configured. AWS SES is also not a substitute for address discovery; it is only the delivery provider. Sending to guessed or unverified addresses would risk bounces, complaints, unlawful unsolicited outreach, and loss of deliverability.

This is not a successful 100-email send. It is a technically honest provider-blocker state with the safe activation pipeline prepared.

## What CAP can do now

The repository can import and deduplicate the 100 source records, calculate deterministic scores, rank products, prepare clearly labelled `TEMPLATE/FALLBACK` offers, enforce approval and suppression gates, and report that no record is eligible for sending without a verified email and an approved message.

The generated artifact is `data/activation-manifest.json`. It is reproducible with:

```bash
npm run activation:manifest
npm run validate:activation
```

## Exact next steps to reach legitimate sending

First, configure an approved email-discovery and email-verification provider, or import an independently sourced, permission-appropriate contact file. For each address, store its source, verification result, timestamp, and consent/compliance basis. Do not mark an address verified based only on syntax or domain existence.

Next, apply and verify the PostgreSQL schema from a VPC-connected runner, import the manifest into PostgreSQL, and make PostgreSQL the authoritative state store. Then connect the provider adapters for enrichment, verification, queue processing, SES delivery, bounce/complaint events, suppression, and replies.

Finally, run the required human-reviewed sequence: process 10–20 records, inspect website evidence and messages, approve a controlled subset, send only within SES/account limits, record provider message IDs and delivery events, and expand gradually only after deliverability and complaint signals are acceptable. Never automatically send all 100.

## Safety decision

`CAP_SEND_ENABLED` must remain `false` while verified addresses, durable persistence, suppression enforcement, provider event capture, and an approved smoke-test subset are unavailable. The system is prepared to continue without Hunter/OpenAI, but it cannot ethically or technically send legitimate offers to records that have no verified destination address.
