# Savepoint 014 — Twilio Geo-Permissions Audit & Configuration

**Date:** September 22, 2026  
**Repository:** [osasbenny/AUREUM-CAP-V0.1](https://github.com/osasbenny/AUREUM-CAP-V0.1.git)  
**Status:** Executed the live 100-lead campaign dispatch for the **$10 59to10k Guide**. Identified Twilio Error 21408: **Permission to send an SMS has not been enabled for the region indicated by the 'To' number**.

---

## 1. Error Analysis & Root Cause
- **Twilio Error Code:** `21408` — *Permission to send an SMS has not been enabled for the region indicated by the 'To' number.*
- **Cause:** Twilio has outbound geographic permissions (Geo-Permissions) disabled by default for certain regions/countries on newly upgraded accounts or toll-free numbers. Even though the account is upgraded with a positive balance ($20.00), outbound SMS to the United States (`+1`) must be explicitly enabled in the Twilio Console settings.

---

## 2. Actionable Resolution (Enable US Geo-Permissions)
1. Open your [Twilio Console](https://console.twilio.com/).
2. Navigate to **Messaging** -> **Settings** -> **Geo Permissions** (or search for **Geo Permissions** in the top search bar).
3. Find **United States (US)** in the list of countries.
4. Check the box to enable outbound SMS for the United States.
5. Click **Save**.

---

## 3. What Remains (Next Steps)
- Once US Geo-Permissions are checked and saved in the Twilio Console, re-run the dispatch script:
  ```bash
  node --env-file=.env scripts/execute-59to10k-campaign.mjs
  ```
- All 100 messages will then dispatch successfully to the U.S. pilot cohort.

---

## 4. Verification Results
```json
{
  "campaign": "59to10k Guide Campaign ($10 Offer)",
  "total_leads": 100,
  "twilio_error": "GEOGRAPHIC_PERMISSION_DISABLED_US_21408",
  "resolution": "ENABLE_US_GEO_PERMISSIONS_IN_TWILIO_CONSOLE"
}
```
