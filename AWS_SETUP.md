# AWS setup report — CAP V0.1

**Inspection date:** 2026-09-14  
**Account:** `795804715712`  
**Region:** Europe (Stockholm), `eu-north-1`  
**Project:** Aureum CAP V0.1

## Account and cost controls

The AWS console shows **$100 USD in account credits** with 177 days remaining. The approved configuration uses the RDS free-tier-sized `db.t4g.micro`, Single-AZ, 20 GB storage, private access, no NAT Gateway, no Multi-AZ, and SES sandbox only.

## Existing relevant resources discovered

Three existing S3 buckets were present and were not modified:

- `aureum-aurareach-prod-assets-795804715712`
- `aureum-aurastudio-prod-assets-795804715712`
- `aureum-silo-prod-assets-795804715712`

No existing RDS databases or SQS queues were present in `eu-north-1` during inspection.

## CAP resources created

| Service | Resource | Purpose | Configuration | Status |
|---|---|---|---|---|
| S3 | `aureum-cap-v01-assets-795804715712` | Private CAP imports, campaign exports, audits, snapshots, and reports | Private, Block Public Access, SSE-S3 | Created |
| SQS | `aureum-cap-v01-lead-processing` | Standard processing queue for CAP jobs | Owner-only access, SQS-managed encryption | Created |
| SQS | `aureum-cap-v01-lead-processing-dlq` | Dead-letter queue for failed processing jobs | Owner-only access, SQS-managed encryption | Created |
| RDS PostgreSQL | `aureum-cap-v01-db` | CAP source-of-truth database | PostgreSQL 18.3, `db.t4g.micro`, 20 GB, Single-AZ, encrypted, private, port 5432, no Multi-AZ | Backing-up / not yet Available |

RDS credentials are managed by AWS Secrets Manager; the generated password was not displayed or stored in source control. The RDS instance is being provisioned in the default VPC with a default security group and is **not publicly accessible**.

## SES status

SES is healthy in `eu-north-1` but remains in the **sandbox**. Sending quota is 200 emails per 24 hours with a maximum send rate of 1 email/second; current usage is 0. No identities are verified, no domain or DNS records were changed, and no emails were sent.

A sending domain or email identity must be supplied and verified before SES can be used. Production access should remain disabled until the operator reviews the dry-run messages and suppression controls.

## Not created / pending integration

- **IAM runtime role/policies:** pending final API/worker target; no broad policies were created.
- **EventBridge rules:** pending a validated worker/API target; no schedule was activated without a consumer.
- **CloudWatch alarms:** pending worker and delivery metrics; baseline AWS-managed RDS/SQS metrics are available.
- **Hunter/OpenAI secrets:** no Hunter credential was supplied; the repository only contains server-side placeholders and no provider call is enabled.
- **Database schema/migrations:** `db/schema.sql` is committed and syntax-checked; application requires the RDS endpoint and managed secret before applying it.
- **Server/API boundary:** `/health` and `/readiness` are implemented; business API, authentication, and worker endpoints remain pending.
- **DLQ redrive wiring:** queues exist; source-queue redrive policy should be attached after the worker retry policy is finalized.

## Next steps

1. Wait for `aureum-cap-v01-db` to become available and capture its endpoint without exposing the password.
2. Apply CAP PostgreSQL schema and migrations.
3. Implement the server-side API and least-privilege worker role.
4. Attach the DLQ redrive policy and add disabled EventBridge schedules.
5. Add CloudWatch alarms for queue age/failures and RDS availability.
6. Supply and verify an approved SES sender identity; remain in sandbox.
7. Run a 10–20 lead dry run and require human approval before any real send.
