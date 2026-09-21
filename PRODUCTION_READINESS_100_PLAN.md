# AUREUM CAP V0.1 — Production Readiness and Controlled Sending Plan

## Objective

Move AUREUM CAP V0.1 from technically operational to **100% production readiness across infrastructure, Command Center behavior, data quality, compliance controls, provider configuration, and controlled email/SMS execution**. Live sending must remain disabled until the exact recipient set, channel, message, provider configuration, suppression state, and lawful-contact evidence have been reviewed and explicitly approved.

## Non-negotiable operating constraints

1. No uncontrolled sending. `CAP_SEND_ENABLED` and `CAP_SMS_SEND_ENABLED` remain `false` until the controlled activation gate is approved.
2. No approval is inferred from the existence of an email address or phone number. Every recipient requires channel-specific eligibility evidence.
3. No channel substitution. An unresolved restriction on email cannot be bypassed by sending SMS, and vice versa.
4. No bulk activation without a bounded pilot. The first live run must use a small, explicitly approved batch with a daily limit.
5. Credentials must be entered through AWS Secrets Manager, Vercel environment variables, or the provider console. They must never be pasted into chat, Git, screenshots, or source files.
6. Every state transition must be persisted to RDS and recorded in the audit trail.

## Phase 1 — Baseline and deployment verification

Confirm the latest Vercel deployment containing the dashboard-control fix is successful. Verify that the Command Center login, sidebar navigation, refresh, search, lead selection, select-all, individual verification, bulk verification, bulk approval, logout, campaign view, and revenue view all produce visible results or actionable errors. Confirm that bulk approval persists after refresh and after an ECS task restart.

Verify the public API health endpoint, HTTPS certificate, DNS route, ALB target health, ECS desired/running count, RDS connectivity, SQS configuration, S3 configuration, and CloudWatch logs. Confirm the Vercel production variable `VITE_API_BASE_URL=https://api.cactusdigitalmedia.ng` is present in the production environment.

**Exit criteria:** all UI controls work; API and database are healthy; no secrets are present in the repository; sending gates remain disabled.

## Phase 2 — Data, research, and compliance qualification

Run the 100-lead readiness workflow against the authoritative database records. For each lead, record the business identity, source, category, website result, contact fields and source, missing data, opportunity hypothesis, fit, recommended offer, recommended channel, channel eligibility evidence, suppression status, research confidence, outreach readiness, and blocker.

Assign every lead to one of five states: ready for human-approved outreach; needs research; compliance review required; not a current fit; or suppressed/do not contact. A lead may only enter the ready state if the relevant channel has a documented lawful basis, the record is not suppressed, and all required contact and identity checks pass.

Create a first-pilot cohort of no more than 5–10 prospects selected by transparent business-fit criteria. For every selected prospect, prepare a personalized draft, evidence summary, proposed scope, proposal price range clearly marked as a proposal, and the reason the channel is eligible.

**Exit criteria:** the pilot cohort and exact drafts are available in the Command Center; all non-eligible leads remain blocked; suppression and opt-out checks are complete.

## Phase 3 — Email provider configuration

Select and configure the approved email provider. Minimum required information is the provider account, verified sending domain or address, SPF, DKIM, DMARC, bounce/complaint handling, reply mailbox, sender display name, unsubscribe mechanism, and a confirmed lawful basis for each recipient. If SES is used, configure the verified identity, production access, configuration set, event destination, and sending limits.

Store provider credentials and signing material in AWS Secrets Manager. Add only non-sensitive provider flags and identifiers to ECS task configuration. Implement provider health checks, bounce/complaint suppression, unsubscribe handling, idempotency keys, rate limits, and delivery-event persistence before enabling email.

**Exit criteria:** a provider test can be performed without contacting a real lead, delivery and suppression events are recorded, and the exact pilot email payload is reviewed.

## Phase 4 — Twilio SMS configuration

Required Twilio information, entered securely and never sent in chat:

| Item | Required value or decision |
|---|---|
| Account SID | Twilio Account SID |
| Auth Token | Twilio Auth Token, stored in AWS Secrets Manager |
| Sender | Approved Twilio phone number or Messaging Service SID |
| Sender capability | SMS-capable sender in the destination countries |
| Regulatory registration | A2P 10DLC, toll-free verification, or applicable destination registration |
| Status callback | `https://api.cactusdigitalmedia.ng/api/v1/webhooks/sms/status` |
| Inbound webhook | `https://api.cactusdigitalmedia.ng/api/v1/webhooks/sms/inbound` |
| Message policy | Approved message, opt-out wording, identity, and contact instructions |
| Limits | Per-run and per-day maximums, retry policy, and stop conditions |
| Compliance evidence | Per-recipient lawful basis, source, date, and suppression check |

The Twilio Auth Token must be rotated if it has ever been exposed. Configure Twilio webhooks to use HTTPS and verify signatures. Confirm inbound STOP, UNSUBSCRIBE, CANCEL, QUIT, END, and REVOKE handling. Persist provider message IDs and statuses, prevent duplicates, and automatically suppress opt-outs.

**Exit criteria:** Twilio credentials are stored in AWS Secrets Manager; the sender and destination regulatory requirements are satisfied; webhook signatures validate; a test message can be sent only to an operator-owned test number; live lead sending remains disabled.

## Phase 5 — Command Center completion

Add or verify UI workflows for lead detail, compliance evidence, suppression, draft preview, channel eligibility, approval history, provider readiness, pilot configuration, and send preview. Every send button must show the exact recipient, channel, message, provider, lawful-basis evidence, suppression result, and batch limit before it can be enabled.

Add explicit separate controls for email and SMS. Enabling one channel must not enable the other. Add a dry-run mode that exercises queueing, idempotency, provider request construction, audit logging, and callback handling without external delivery.

**Exit criteria:** every visible control has a working action, clear loading state, success state, error state, and audit event; no hidden or silent failures remain.

## Phase 6 — Staged activation

1. Keep both send gates disabled while completing all phases above.
2. Run provider-connected dry runs against test recipients only.
3. Review and approve the exact first pilot payload.
4. Enable only the selected channel for the approved pilot, with a small daily limit.
5. Monitor delivery, bounce, complaint, opt-out, response, and cost events.
6. Pause immediately on unexpected delivery, complaint, opt-out, provider error, duplicate, or compliance discrepancy.
7. Reconcile provider events with RDS and the Command Center.
8. Expand only after the pilot passes its success and safety criteria.

## Final 100% definition of done

The system is 100% ready only when infrastructure, frontend controls, API routes, RDS persistence, provider credentials, provider webhooks, suppression, lawful-basis evidence, audit logs, rate limits, dry-run tests, test-recipient delivery, pilot review, and rollback/stop controls are all verified. “100%” does not mean all 100 leads are automatically contacted; it means the platform can execute approved outreach safely and reproducibly, while ineligible records remain blocked.

## Required user inputs before provider activation

Provide or configure the following through the secure AWS/Vercel/provider interfaces: the chosen email provider; verified sender/domain; Twilio Account SID; Twilio Auth Token; Twilio sender or Messaging Service SID; destination countries; regulatory registration status; approved sender identity; pilot daily limit; approved message templates; lawful-basis policy; and the exact pilot cohort. Do not send passwords, auth tokens, or API keys in chat.

## Current state

The AWS API, HTTPS ALB, RDS import, ECS service, Vercel connection, authentication, and dashboard-control fixes are operational. The current safe state is `CAP_SEND_ENABLED=false` and `CAP_SMS_SEND_ENABLED=false`. The next executable milestone is Phase 1 verification followed by the compliance-qualified pilot queue, not unrestricted activation of all 100 records.
