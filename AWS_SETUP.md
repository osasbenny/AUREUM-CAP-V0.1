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
| RDS PostgreSQL | `aureum-cap-v01-db` | CAP source-of-truth database | PostgreSQL 18.3, `db.t4g.micro`, 20 GB, Single-AZ, encrypted, private, port 5432, no Multi-AZ | **Available** |

RDS credentials are managed by AWS Secrets Manager; the generated password was not displayed or stored in source control. The RDS instance is being provisioned in the default VPC with a default security group and is **not publicly accessible**.

## SES status

SES is healthy in `eu-north-1` but remains in the **sandbox**. Sending quota is 200 emails per 24 hours with a maximum send rate of 1 email/second; current usage is 0. No emails were sent.

The approved sender identity `mail.cactusdigitalmedia.ng` was created in SES with Easy DKIM. The three required CNAME records were successfully saved in cPanel Zone Editor for `cactusdigitalmedia.ng`:

| Name | Target | Status |
|---|---|---|
| `i3sz72eiwqfr7ew2vjzgdxcot77cqf6r._domainkey.mail.cactusdigitalmedia.ng` | `i3sz72eiwqfr7ew2vjzgdxcot77cqf6r.dkim.amazonses.com` | Saved; SES verification pending |
| `3yicgkffgdb53lrt5l27gud3w4jazydo._domainkey.mail.cactusdigitalmedia.ng` | `3yicgkffgdb53lrt5l27gud3w4jazydo.dkim.amazonses.com` | Saved; SES verification pending |
| `hn472d2bidcbblpl37nfmbfs7t7hj4we._domainkey.mail.cactusdigitalmedia.ng` | `hn472d2bidcbblpl37nfmbfs7t7hj4we.dkim.amazonses.com` | Saved; SES verification pending |

SES verification status must be refreshed in the authenticated AWS console after DNS propagation. `aureum.cap@cactusdigitalmedia.ng` is the intended From address once the domain identity is verified. SMTP credentials were not created or stored; any future SMTP/API secret must be placed in AWS Secrets Manager or SSM, never in Git.

## Not created / pending integration

- **IAM runtime role/policies:** pending final API/worker target; no broad policies were created.
- **EventBridge rules:** pending a validated worker/API target; no schedule was activated without a consumer.
- **CloudWatch alarms:** pending worker and delivery metrics; baseline AWS-managed RDS/SQS metrics are available.
- **Hunter/OpenAI secrets:** no Hunter credential was supplied; the repository only contains server-side placeholders and no provider call is enabled.
- **Database schema/migrations:** RDS is now Available. `db/apply-schema.sh` and `db/verify-schema.sql` are committed; apply them only from a VPC-connected runner using the managed Secrets Manager value. AWS CloudShell was opened and confirmed unsuitable because it is not connected to the private RDS VPC; the RDS Query Editor is unavailable under the current free-plan limitation.
- **Server/API boundary:** dynamic health/readiness plus protected session login, dashboard, lead review, approvals, campaigns, events, revenue, and product-fit endpoints are implemented in the safe in-process foundation; PostgreSQL/SQS persistence and worker execution remain.
- **DLQ redrive wiring:** queues exist; source-queue redrive policy should be attached after the worker retry policy is finalized.
- **SES domain verification:** DKIM records are saved in cPanel; wait for DNS propagation and refresh SES until the identity becomes verified.
- **Worker/incident operations:** queue contract, retry guidance, DLQ handling, and incident procedure are documented in `WORKER_RUNBOOK.md`; no consumer or schedule is enabled.

## Next steps

1. Use a VPC-connected runner to apply `db/apply-schema.sh` with the managed Secrets Manager credential and run its verification query.
2. Implement the server-side API and least-privilege worker role.
4. Attach the DLQ redrive policy and add disabled EventBridge schedules.
5. Add CloudWatch alarms for queue age/failures and RDS availability.
6. Wait for SES DKIM verification, then request production access only after suppression and dry-run controls are reviewed.
7. Run a 10–20 lead dry run and require human approval before any real send.
