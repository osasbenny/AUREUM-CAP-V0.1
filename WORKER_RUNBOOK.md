# CAP V0.1 worker and incident runbook

## Operating mode

The CAP pilot remains **dry-run only**. `CAP_SEND_ENABLED` must remain `false` until the operator has reviewed a 10–20 lead run, suppression checks, generated messages, and SES identity verification. No worker may bypass this gate.

## Queue contract

The source queue is `aureum-cap-v01-lead-processing` and the dead-letter queue is `aureum-cap-v01-lead-processing-dlq` in `eu-north-1`. Each message must contain an idempotency key, an operation name, the lead or entity identifier, and a schema version. The worker must acknowledge a message only after the operation is durably recorded or safely determined to be a duplicate.

Recommended initial visibility timeout is 300 seconds with a maximum receive count of 5 before redrive to the DLQ. These values are a deployment decision and must be applied only after the worker timeout and retry behavior are finalized. No schedule should be enabled before a validated consumer target exists.

## Required worker safeguards

The worker must validate the message schema, reject unknown operation types, enforce the suppression list before any email operation, and use a database uniqueness or idempotency record before creating an outbound message. Retries must use bounded exponential backoff. Permanent validation failures belong in the DLQ with an operator-readable reason; transient provider failures may retry.

## Monitoring baseline

Create CloudWatch alarms for source queue age, visible message count, DLQ visible messages, worker error count, RDS availability, and SES bounce or complaint signals after the runtime role and worker target exist. Alarm actions should notify an operator rather than trigger an unreviewed outbound campaign.

## Incident procedure

When a DLQ alarm fires, pause the worker or remove the consumer target, inspect a sample of failed payloads without exposing secrets, classify failures as validation, provider, or infrastructure errors, and only then redrive corrected messages. Do not bulk-redrive while `CAP_SEND_ENABLED` is true unless the operator has explicitly reviewed duplicate-send risk.

When SES reports a bounce, complaint, or unsubscribe, add the address to `suppression_list` before any retry. When RDS is unavailable, stop mutation workers, preserve the queue, and verify the database state before redriving.

## Remaining implementation gate

The repository currently provides the health/readiness boundary and pilot summary endpoint. The actual SQS worker, runtime IAM role, EventBridge target, CloudWatch alarms, and database-backed idempotency implementation remain intentionally unconfigured until the RDS endpoint and managed secret are available.
