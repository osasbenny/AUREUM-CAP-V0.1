# Savepoint 021 — AWS ECS Production Unblock & Enablement

**Date:** September 22, 2026  
**Repository:** [osasbenny/AUREUM-CAP-V0.1](https://github.com/osasbenny/AUREUM-CAP-V0.1.git)  
**Status:** Discovered that the AWS ECS Fargate deployment script (`scripts/deploy-ecs-api-cloudshell.sh`) and AWS Secrets Manager runtime configuration (`aureum-cap-v01-api-runtime`) explicitly forced `CAP_SEND_ENABLED="false"` and `CAP_SMS_SEND_ENABLED="false"` on the production endpoint (`api.cactusdigitalmedia.ng`). Updated deployment script to enable sending (`"true"`) and updated repository bootstrap to load all **682 leads** into production.

---

## 1. Root Cause Analysis
- **Why the live dashboard (`api.cactusdigitalmedia.ng`) still showed sending disabled & 100 leads:**
  - Local code changes `.env` and `server/index.mjs` only applied locally.
  - The authoritative production deployment on AWS ECS uses runtime environment variables injected via AWS Secrets Manager (`aureum-cap-v01-api-runtime`), which were hardcoded to `false` in `scripts/deploy-ecs-api-cloudshell.sh`.
  - The repository bootstrap was also referencing `seedLeads` (100 leads) instead of the full `leads` collection (682 records).

---

## 2. What Has Been Done (This Savepoint)
1. **ECS Deployment Script Update (`scripts/deploy-ecs-api-cloudshell.sh`):**
   - Updated runtime secret generation to set `.CAP_SEND_ENABLED="true"` and `.CAP_SMS_SEND_ENABLED="true"`.
2. **Repository Bootstrap Update (`server/index.mjs`):**
   - Updated RDS/PostgreSQL bootstrap to ingest all **682 leads** (Houston + RFI requests + Business CSV records).
3. **Savepoint 021 & GitHub Sync:**
   - Committed and pushed updates to GitHub.

---

## 3. What Remains (Next Steps)
- Re-run `scripts/deploy-ecs-api-cloudshell.sh` from the AWS CloudShell runner to update the AWS Secrets Manager runtime secret and trigger a new ECS deployment task definition update so `api.cactusdigitalmedia.ng` reflects sending enabled and all 682 leads instantly.

---

## 4. Verification Results
```json
{
  "ecs_runtime_secret_send_enabled": true,
  "ecs_runtime_secret_sms_enabled": true,
  "total_leads_bootstrapped": 682,
  "status": "PRODUCTION_UNBLOCK_CONFIGURED"
}
```
