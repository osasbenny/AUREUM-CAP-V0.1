# SAVEPOINT-023 — Live Production Execution

**Status: PARTIAL — the corrective API and worker are live in ECS; provider readiness and several controlled tests remain blocked or unexecuted.**

## Executive result

The production rollout progressed successfully after the CloudShell deployment:

- The `production` ECR image was pushed.
- ECS now shows **2 active services** and **2 running tasks**.
- The API and worker services are present.
- The public API is serving the corrective implementation.
- PostgreSQL is authoritative in the live API.
- Acquisition target and email limit are live as `1000` and `250`.

The system is **not READY FOR CONTROLLED OUTREACH** because OpenAI, Hunter, SES, and S3 readiness checks are not all passing, and the required controlled provider tests have not all been executed.

## Final source and image evidence

| Item | Result |
|---|---|
| Repository | `osasbenny/AUREUM-CAP-V0.1` |
| Branch | `main` |
| Final Git SHA | `2c88b061b805ff7d42f536ed61d81d7f40cbfe90` |
| Git status | Clean; `main...origin/main` |
| ECR repository | `aureum-cap-v01-api` |
| ECR tag | `production` |
| ECR image digest | `sha256:dc5ec22d945d2d462a491248d2d1d88eb3a5f2aa36b60b642a31c9574d94e1fb` |
| API task revision | Registered during the manual ECS rollout; exact revision number was not captured in the console output available for this report |
| Worker task revision | Registered during the manual ECS rollout; exact revision number was not captured in the console output available for this report |

## ECS live state

Observed in the authenticated AWS ECS console at **2026-10-03 07:22 UTC+1**:

| Service | State | Running | Pending |
|---|---|---:|---:|
| `aureum-cap-v01-api` | Active | 1 | 0 |
| `aureum-cap-v01-worker` | Active | 1 | 0 |
| **Total** | **2 active services** | **2** | **0** |

The worker service was absent before rollout and is now present with one running task.

## Live API verification

### Health

`https://api.cactusdigitalmedia.ng/health` returned **HTTP 200**:

```json
{
  "ok": true,
  "service": "aureum-cap-v0-1",
  "region": "eu-north-1",
  "database_authoritative": true,
  "acquisition_target": 1000,
  "email_limit": 250
}
```

### Readiness

`https://api.cactusdigitalmedia.ng/readiness` returned **HTTP 503**, correctly reporting degraded provider readiness rather than falsely claiming production readiness:

- RDS: `READY`
- SQS: `READY`
- Twilio: `READY`
- Website verifier: `READY`
- OpenAI: `BLOCKED` — `openai_not_configured`
- Hunter: `DEGRADED` — `No user found for the API key supplied`
- SES: `BLOCKED` — ECS task role lacks `ses:GetAccount`
- S3: `BLOCKED` — `UnknownError`
- Email send gate: `true`
- SMS send gate: `true`

The API must remain blocked from uncontrolled outreach while these readiness failures remain.

## Required evidence matrix

| Required item | Result |
|---|---|
| Final Git SHA | **PASS** — `2c88b061b805ff7d42f536ed61d81d7f40cbfe90` |
| ECR image digest | **PASS** — `sha256:dc5ec22d945d2d462a491248d2d1d88eb3a5f2aa36b60b642a31c9574d94e1fb` |
| API ECS task revision | **PARTIAL** — rollout succeeded, exact revision number not captured in available output |
| Worker ECS task revision | **PARTIAL** — rollout succeeded, exact revision number not captured in available output |
| API/worker running counts | **PASS** — API 1, worker 1 |
| RDS live test | **PASS** — live readiness reported `PostgreSQL query succeeded` |
| SQS live test | **PASS** — live readiness reported queue attributes read succeeded |
| SES account/identity/DKIM/test | **BLOCKED** — ECS task role lacks `ses:GetAccount`; no controlled send was executed |
| SES MessageId | **NOT AVAILABLE** — no controlled production email was sent |
| SNS webhook test | **NOT EXECUTED** — signed SNS notification test remains outstanding |
| Twilio test | **PARTIAL** — authenticated account readiness passed; no outbound SMS was sent |
| Hunter test | **BLOCKED** — configured key rejected with `No user found for the API key supplied` |
| OpenAI exact state | **BLOCKED** — `openai_not_configured` in the live task |
| Acquisition discovery test | **NOT EXECUTED LIVE** — Overpass adapter is implemented; no live acquisition run was launched |
| Scheduled acquisition rule/task | **NOT CREATED** — remains an outstanding deployment item |
| 250-limit concurrency result | **NOT EXECUTED LIVE** — PostgreSQL advisory-lock reservation code is deployed; live concurrency evidence is outstanding |
| Persistent suppression test | **NOT EXECUTED LIVE** — suppression code is deployed; live bounce/complaint/STOP evidence is outstanding |
| Production unique prospect count | **669** from the 682-record source corpus, with 13 duplicate merges |
| High-intent count | **8** RFI/high-intent records |
| Acquisition target | **1000/day** configured live |
| Email limit | **250/day** configured live |
| Dashboard result | API health verified; frontend/dashboard live metric verification remains outstanding |

## Corpus reconciliation

| Metric | Result |
|---|---:|
| Source records | 682 |
| Production unique businesses | 669 |
| Duplicates merged | 13 |
| Conflicts requiring manual review | 0 |
| RFI/high-intent records | 8 |
| No web presence | 99 in the latest regenerated report |
| Functional website | 570 in the latest regenerated report |

The machine-readable reconciliation evidence is in `data/reconciliation-report.json`.

## Implemented production controls

- PostgreSQL-authoritative prospect state and queue state.
- Multi-identifier reconciliation by domain, email, phone, and company/location.
- Atomic daily email reservation with PostgreSQL advisory locking.
- 250/day email outreach limit.
- Persistent email and phone suppression records.
- Send-time suppression checks in the worker before SES or SMS provider calls.
- SES SNS signature verification and subscription confirmation handling.
- Real OpenAI, Hunter, SES, S3, SQS, and Twilio readiness checks.
- Overpass-based no-credit discovery adapter with geographic partitioning.
- Explicit internet-presence classification, including no-domain prospects.
- Deprecated fixture-based acquisition and legacy campaign queues remain hard-stop guards.

## Exact remaining external dependencies

1. **OpenAI runtime configuration/credits:** populate a valid production OpenAI secret and confirm the selected model is available.
2. **Hunter credential:** replace the rejected Hunter API key with a valid account key.
3. **SES IAM permission:** grant the API task role `ses:GetAccount` plus the required identity/configuration permissions.
4. **SES identity/DKIM:** verify the configured sender identity and DKIM status, then execute one controlled test send and record its SES `MessageId`.
5. **S3 permission/configuration:** resolve the live S3 readiness `UnknownError` and rerun the bucket check.
6. **SNS webhook:** configure the SES event destination/topic and execute a signed notification test through the live webhook.
7. **Live acquisition schedule:** create the daily EventBridge/ECS scheduled acquisition task and verify one bounded discovery run.
8. **Controlled tests:** execute the 250-reservation concurrency test, persistent suppression test, and dashboard metric verification.

No claim of full production readiness or bulk outreach authorization is made until these dependencies and tests are complete.
