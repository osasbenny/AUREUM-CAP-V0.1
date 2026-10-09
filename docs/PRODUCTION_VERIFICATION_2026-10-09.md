# Production verification — 9 October 2026

Verified at 22:07 UTC / 23:07 Lagos.

- PR #1 is merged; integration is deployed on main.
- Scheduled acquisition run [37935807926](https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37935807926) succeeded in all four jobs and produced genuine JSON/CSV artifacts.
- Scheduled yield: WebDev250 (8 sourced emails), Books250 (3 sourced emails), Dating21 (0 emails), HashNomads0. Targets are250 perlane perrun; Dating shortfall229 and HashNomads shortfall250. Audience organizations are not consumer opt-ins or outreach-complete leads.
- Initial automatic sync failed during eight new artifact downloads. Commit [2f65dfa6723bad1e6edf9d9ceb542d0f69d52856](https://github.com/osasbenny/AUREUM-CAP-V0.1/commit/2f65dfa6723bad1e6edf9d9ceb542d0f69d52856) keeps GitHub authorization on the API request only, excluding it from storage redirects; adds bounded HTTP retries, safe diagnostics and four regression tests.
- [Production repair run37997231139](https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37997231139) archived all eight new artifacts and inserted1074 rows, with zero Sheets retries.
- [Scheduled sync run37973857378](https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37973857378) was retried successfully against currentmain. Repeat replay inserted0 rows; retries0.
- Latest [CI37997230994](https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37997230994) passed:16 Node tests and7 Python tests.
- Full independent Sheet readback and reconstructed qualified records from52 archived ZIPs match: no duplicate acquisition/source IDs, missing dates, metadata mismatches, pending insertions or pending email upgrades.

| Lane | Sheet rows / unique sources | Sourced emails | Added in repair |
|---|---:|---:|---:|
| WebDev |2764|38|500|
| Dating |74|2|72|
| HashNomads |3|2|2|
| Books |503|10|500|

Historical mismatches1835 remain excluded (Dating18, HashNomads2, Books1815), with original raw evidence retained. OVERVIEW's PARTIAL_REJECTED_INPUTS represents those historical exclusions, not a new transport failure.

Google Sheets API, OIDC provider/service-account authentication, editor access, source-based lane routing, durable replay, retry recovery and idempotence are verified through actual production operations. Full administrative IAM policy introspection remains unavailable from the task's cloud console. Acquisition ran successfully while downstream archive/sync was failing, independently confirming the separation. No service-account keys or marketing sends were created. Raw acquisition/EMAIL_PRESENT never establishes eligibility, consent or OUTREACH_COMPLETE.

The integration is operational. Daily1000-per-lane targets are not demonstrated; Dating/HashNomads source coverage requires further acquisition work. GitHub schedules can start late; an exact punctual six-hour execution guarantee is not claimed.
