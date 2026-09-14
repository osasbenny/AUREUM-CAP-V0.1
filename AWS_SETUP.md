# AWS setup report — CAP V0.1

**Inspection date:** 2026-09-14  
**Account:** `795804715712`  
**Region:** Europe (Stockholm), `eu-north-1`  
**Project:** Aureum CAP V0.1

## Existing relevant resources discovered

Three existing S3 buckets were present and were not modified:

- `aureum-aurareach-prod-assets-795804715712`
- `aureum-aurastudio-prod-assets-795804715712`
- `aureum-silo-prod-assets-795804715712`

No existing RDS databases and no existing SQS queues were present in `eu-north-1` during inspection.

## CAP resources created

| Service | Resource | Purpose | Cost category | Status |
|---|---|---|---|---|
| S3 | `aureum-cap-v01-assets-795804715712` | Private CAP imports, campaign exports, audits, snapshots, and reports | Low usage-based storage/request cost | Created |
| SQS | `aureum-cap-v01-lead-processing` | Standard processing queue for CAP jobs | Low usage-based request cost | Created |
| SQS | `aureum-cap-v01-lead-processing-dlq` | Dead-letter queue for failed processing jobs | Low usage-based request cost | Created |

The S3 bucket was created with private ownership/access defaults, public access blocked, and SSE-S3 default encryption. The queues use standard SQS delivery, owner-only access policy, and SQS-managed encryption.

## Not created / approval required

- **RDS PostgreSQL:** no instance exists. Creating one can create ongoing charges and requires selecting instance class, storage, network/security groups, backups, and credentials. It is intentionally gated pending owner approval.
- **SES:** no sending identity, DNS change, sandbox/production change, or campaign sending was performed. Sending configuration can affect email reputation and external domains, so it remains gated.
- **IAM roles/policies:** no broad or application execution roles were created. Least-privilege policies require the final runtime/API architecture and target principals.
- **Secrets Manager / SSM:** no secret values were entered or stored. Hunter/OpenAI/database credentials are not available in the repository or browser workflow.
- **EventBridge:** no active rule was created because there is not yet a target worker/API and an active schedule without a validated consumer would be unsafe.
- **CloudWatch:** no alarms were created because there are no CAP workers or delivery metrics to monitor yet.

## Next AWS steps after approval

1. Approve a low-cost RDS PostgreSQL configuration and networking plan.
2. Configure secret storage without exposing credential values.
3. Create least-privilege runtime role(s) for the eventual API/worker.
4. Attach the DLQ redrive policy to the processing queue.
5. Create disabled EventBridge schedules with validated worker targets.
6. Configure SES identity and DNS only after confirming the sending domain and sandbox policy.
7. Add CloudWatch alarms for queue age/failures and provider events.
