# Savepoint 022 — ECS Acquisition Task & EventBridge Scheduler

**Date:** September 22, 2026  
**Repository:** [osasbenny/AUREUM-CAP-V0.1](https://github.com/osasbenny/AUREUM-CAP-V0.1.git)  
**Status:** Created automated AWS deployment script (`scripts/deploy-acquisition-scheduler.sh`) to register the dedicated ECS Fargate acquisition task (`npm run acquire`, target 1000 leads/day) and create the EventBridge Scheduler schedule (`aureum-cap-v01-daily-acquisition`).

---

## 1. Architecture & Schedule Configuration
- **Task Definition Family:** `aureum-cap-v01-acquisition`
- **Command:** `npm run acquire`
- **Environment Variables:** `CAP_DAILY_ACQUISITION_TARGET=1000`, `CAP_DISCOVERY_PROVIDER=overpass`
- **EventBridge Schedule:** `aureum-cap-v01-daily-acquisition`
  - Schedule Expression: `rate(1 day)`
  - Flexible Time Window: `OFF`
  - State: `ENABLED`
  - Target: ECS `RunTask` on cluster `aureum-cap-v01-api` (Fargate, 1 task count)

---

## 2. What Has Been Done (This Savepoint)
1. **CloudShell Script Created (`scripts/deploy-acquisition-scheduler.sh`):**
   - Configured full AWS CLI automation for registering the task definition, setting up the EventBridge scheduler, running an immediate task, and querying completion status.
2. **Savepoint 022 & GitHub Sync:**
   - Committed and pushed to GitHub.

---

## 3. Verification Results
```json
{
  "task_family": "aureum-cap-v01-acquisition",
  "schedule_name": "aureum-cap-v01-daily-acquisition",
  "command": "npm run acquire",
  "target_daily_leads": 1000,
  "status": "SCRIPT_READY_FOR_CLOUDSHELL"
}
```
