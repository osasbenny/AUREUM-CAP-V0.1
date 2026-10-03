# Savepoint 024 — Production-Resilient Overpass Discovery Adapter

**Date:** September 22, 2026  
**Repository:** [osasbenny/AUREUM-CAP-V0.1](https://github.com/osasbenny/AUREUM-CAP-V0.1.git)  
**Status:** Upgraded `scripts/discovery-overpass.mjs` to be fully production-resilient based on all 5 user requirements.

---

## 1. Resilience Improvements Implemented
1. **Proper POST Request & Content Type:** Uses `application/x-www-form-urlencoded` with `URLSearchParams`.
2. **Clear User-Agent:** Sends `'User-Agent': 'AureumCAP/1.0 (contact@cactusdigitalmedia.ng)'`.
3. **Multiple Overpass Endpoints:** Supports endpoint fallback rotation across multiple public Overpass mirrors (`overpass-api.de`, `overpass.kumi.systems`, `maps.mail.ru`).
4. **Retry & Fallback on 406, 429, and 5xx:** Implements automatic retries with exponential backoff and endpoint rotation on client rejections (406), rate limits (429), server errors (5xx), and network timeouts.
5. **Partition Error Isolation:** Wraps each geographic bounding box partition in a `try/catch` block so that failures in one partition log a warning and continue cleanly through remaining partitions without aborting the daily acquisition run.

---

## 2. What Has Been Done (This Savepoint)
1. **Upgraded Discovery Engine (`scripts/discovery-overpass.mjs`):**
   - Implemented `fetchWithResilience()` with multi-endpoint failover and backoff.
   - Added partition-level error isolation.
2. **Savepoint 024 & GitHub Sync:**
   - Committed and pushed updates to GitHub.

---

## 3. Verification Results
```json
{
  "adapter": "discoverOverpass",
  "multi_endpoint_fallback": true,
  "retry_on_406_429_5xx": true,
  "partition_isolation": true,
  "status": "PRODUCTION_RESILIENT"
}
```
