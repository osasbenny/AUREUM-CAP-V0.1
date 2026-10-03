# SAVEPOINT-022 — Corrective Production Verification

**Status: PARTIAL — corrective code is pushed and locally verified; live ECS rollout and AWS controlled tests remain unverified.**

## Final Git and frontend state

- Repository: `osasbenny/AUREUM-CAP-V0.1`
- Branch: `main`
- Final Git SHA: `943c6edde6eb10675fe976214826860da4e95b54`
- Git status: `main...origin/main`, clean
- Frontend: https://aureum-cap-v0-1.vercel.app
- Vercel deployment for final SHA: `dpl_CGhQvKkE9JRrTLz11TiZbNvS1htC`
- Vercel state: `READY`
- Frontend HTTP verification: `200`

## Corrective implementation completed

The legacy fixture-based email path is no longer executable. `scripts/daily-acquisition-worker.mjs` is a hard-stop deprecation guard, and the old 59to10k campaign queue is also a hard-stop guard. No remaining production code path assigns `email_status = 'SENT'`; the new worker assigns `ACCEPTED` only after SES returns a real `MessageId` and persists that ID in the outreach ledger.

The acquisition engine now exists as `scripts/acquisition-engine.mjs` and is exposed as `npm run acquire`. It requires a discovery input rather than selecting rows from `data/leads.json`, caps new unique imports at 1,000/day, performs normalization and multi-identifier reconciliation, classifies internet presence, checks website activity, uses Hunter only when a domain exists, preserves no-domain prospects, runs qualification with deterministic fallback, matches products, and records per-day acquisition metrics in PostgreSQL.

Internet-presence classification is explicit: `NO_WEB_PRESENCE`, `SOCIAL_ONLY`, `DIRECTORY_ONLY`, `WEAK_WEBSITE`, `OUTDATED_WEBSITE`, `FUNCTIONAL_WEBSITE`, and `STRONG_WEBSITE`. Website Development scoring prioritizes no-web, social/directory-only, weak/outdated, and deficient sites; strong sites rank lower for generic website outreach.

Deduplication now unions any matching strong identifier: normalized domain, normalized email, normalized E.164 phone, or normalized company/location. Conflicting identifier groups are retained as manual-review conflicts rather than silently merged. PostgreSQL receives a `cap_lead_identifiers` unique identifier table to prevent application-level misses from becoming duplicate database identities.

The 250/day email control is now PostgreSQL-backed through `cap_outreach_ledger`. Reservations are atomic, idempotent, date-bucketed, campaign-scoped, count while queued, and protected by uniqueness constraints. SQS retries and ECS restarts do not create new reservations for the same lead/campaign/day.

The SQS worker now persists successful job state to the prospect: SES provider ID and accepted timestamp, Hunter enrichment and source evidence, Hunter verification status/provider/timestamp, and structured OpenAI qualification/model/request metadata. Jobs are marked `COMPLETED`, `RETRY`, or `DLQ` in PostgreSQL.

SES readiness now checks production access, configured sender identity, verified sending status, DKIM status, quota, and a controlled-test MessageId. SES webhook handling requires an HMAC signature and persists bounce/complaint suppressions. Manual and Twilio opt-out suppressions are persisted in PostgreSQL.

The deployment script now creates `aureum-cap-v01-worker` automatically when absent, reuses the API service networking configuration, injects Secrets Manager values, and waits for both API and worker services to stabilize.

## Local verification evidence

- `node --check server/index.mjs`: **PASS**
- `node --check server/services.mjs`: **PASS**
- `node --check db/repository.mjs`: **PASS**
- `node --check workers/sqs-worker.mjs`: **PASS**
- `node --check scripts/acquisition-engine.mjs`: **PASS**
- `bash -n scripts/deploy-ecs-api-cloudshell.sh`: **PASS**
- `npm run smoke`: **PASS**
- `npm run reconcile`: **PASS**
- Legacy worker execution: exits with deprecation error and performs no I/O.
- Legacy 59to10k queue execution: exits with deprecation error and creates no jobs.
- Local `/health`: HTTP `200`; reports acquisition target `1000` and email limit `250`.
- Local `/readiness`: HTTP `503` with honest provider degradation/blocking when local runtime secrets are absent.
- Local unauthenticated SES webhook: HTTP `403` (`unauthenticated_ses_webhook`).
- Local dashboard: `total_unique_prospects=682`, `acquisition_target=1000`, `email_outreach_limit=250`, `high_intent=8`.

## Reconciliation evidence from current 682-record corpus

| Metric | Result |
|---|---:|
| Input records | 682 |
| Unique businesses | 669 |
| Duplicates merged | 13 |
| Conflicting records requiring manual review | 0 |
| RFI/high-intent records | 8 |
| No-web-presence | 100 |
| Social-only | 0 |
| Directory-only | 0 |
| Weak website | 0 |
| Outdated website | 0 |
| Functional website | 582 |
| Strong website | 0 |

The eight RFI/high-intent businesses are: **Nik Shipping and Logistics; Best House Buyer; Blogging and Best-Selling Introduction; Lynx London; Hspg; Mda Consulting; Prime Estates; UK Mail Courier.** The full machine-readable evidence is in `data/reconciliation-report.json`.

## Production ECS state — not complete

| Item | Observed state |
|---|---|
| API ECS service | `aureum-cap-v01-api`, active |
| API task definition | `aureum-cap-v01-api:1` — old revision |
| API running task count | 1 before corrective rollout |
| Worker ECS service | Not observed before corrective rollout |
| Worker task definition | Not verified live |
| API deployment of SHA `943c6ed` | **Not completed** |
| Worker deployment of SHA `943c6ed` | **Not completed** |

The authenticated AWS CloudShell drawer accepted visible text but did not execute commands. It repeatedly returned to a blank `$` prompt or `Preparing your terminal...`; therefore the deployment script could not be run from the AWS environment. The sandbox has no AWS CLI/Docker credential path suitable for replacing the ECS services.

## Live API evidence

At verification time, the live API remained the previous ECS implementation:

- `https://api.cactusdigitalmedia.ng/health`: HTTP `200`, response included `send_enabled:false` and did **not** include the new corrective health fields.
- `https://api.cactusdigitalmedia.ng/readiness`: HTTP `503`, response used the old readiness shape and old policy text referencing `CAP_SEND_ENABLED`.

Because the live API remains on the old revision, this savepoint does **not** claim production completion.

## Controlled provider tests

| Provider/test | Evidence and result |
|---|---|
| Hunter | Previous controlled authenticated test succeeded for `cactusdigitalmedia.ng`, returning one evidence-backed generic contact. No-domain prospects now skip Hunter instead of being rejected. A fresh corrective AWS-runtime persistence test was not possible because ECS was not deployed. |
| OpenAI | Previous authenticated Responses API test returned HTTP `429` with zero credits. Corrective code reports `DEGRADED` for quota/credit errors and uses deterministic fallback; no false success is reported. A fresh successful qualification test is blocked until credits are restored. |
| SES | No controlled production SendEmail was executed in this pass. No SES MessageId exists for this savepoint. Readiness remains blocked/degraded until identity, DKIM, quota, and a controlled MessageId are verified. |
| SQS | No controlled enqueue/worker completion test was executed because the worker was not deployed. |
| RDS | No live bootstrap/restart persistence test was executed because the new ECS task did not reach RDS. |
| Twilio | No authenticated readiness call was executed in the corrective pass. No bulk SMS was launched. |
| Suppression | Local unauthenticated SES webhook rejection passed. Live PostgreSQL bounce/complaint and STOP persistence were not tested because the new API was not deployed. |
| Daily email cap | Atomic reservation code and PostgreSQL constraints are implemented. A live concurrency test was not executed because RDS/API was not on the corrective revision. |

## Configuration targets

- Acquisition target: **1,000 new unique prospects/day**
- Email outreach limit: **250 PostgreSQL reservations/attempts/day**
- Bulk email campaign: **not enabled or launched**
- System status: **not READY FOR CONTROLLED OUTREACH**, because live ECS/API/worker and SES/SQS/RDS controlled evidence are incomplete.

## Exact remaining blockers

1. **AWS CloudShell execution:** the authenticated terminal UI is not executing typed commands. Run `bash scripts/deploy-ecs-api-cloudshell.sh` from a functioning authenticated AWS deployment runner using current main SHA `943c6ed`.
2. **Live ECS rollout:** confirm API task revision, create/confirm worker service, wait for both services to be stable, and verify running task counts.
3. **OpenAI credits:** restore provider credits before attempting a successful Responses API qualification test.
4. **Controlled AWS verification:** run the controlled RDS bootstrap/restart, SQS job, SES test send, suppression event, daily reservation concurrency, and Twilio readiness tests.
5. **Live dashboard verification:** confirm the frontend reads the corrective API and reports the new live provider states and reconciliation metrics.

This task is intentionally marked **PARTIAL**, as required by the pasted instructions, because the live ECS API and worker are not yet proven to run the corrective code.
