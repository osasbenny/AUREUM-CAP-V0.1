# CAP Google Sheets integration

## Verified on 9 October 2026

The central spreadsheet is https://docs.google.com/spreadsheets/d/1gdMmNR9P9Osm61ei-KpsdoXD84ncz9j0SGIMueuYobQ/edit.

44 actual GitHub acquisition artifacts from 17 acquisition runs were downloaded and inspected. They contain 6,017 persisted records. Historical import used the original acquisition IDs, timestamps, source evidence and lane routing. The entire written range was independently read back and compared with the import data.

| Lane | Verified rows | Distinct sources within lane | Email present with evidence |
| --- | ---: | ---: | ---: |
| WebDev | 2,264 | 2,264 | 21 |
| Dating | 2 | 2 | 1 |
| HashNomads | 1 | 1 | 1 |
| Books | 3 | 3 | 0 |

1,912 duplicated WebDev inputs were skipped. 1,835 historical specialized-lane mismatches were excluded: Dating 18, HashNomads 2, Books 1,815. Historical evidence is retained even when a record is excluded from the Sheet.

Dating contains one senior-center organization and one operator-assigned B2B record. HashNomads contains the same explicit B2B assignment. Those are not opt-in dating members or verified mining buyers. No outreach was sent and consent was not inferred. Method B Zoey stays identified in its own field; unassigned acquisition is not silently marked Method A.

The latest pre-change acquisition run https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37913562993 produced 250 WebDev records (13 with sourced email), and zero net-new records in each specialized lane. A green run is not proof that numerical targets were reached.

## Authentication configuration pending verification

The browser was also signed out of GitHub repository settings, preventing repository-variable changes through that route. Google Cloud console access returned `Site Unavailable` in the task's browser. No connected Google Cloud administrative action or authenticated gcloud CLI was available. Sheets connector access worked independently. Therefore enabled API, service-account existence, WIF, impersonation, Sheet sharing and repository variables are **unverified**, and no long-lived key was generated.

The executable setup script `scripts/setup-cap-sheets-gcp.sh` enables the required APIs and configures:

- Project `aureum-cap`, project number `295598149511`.
- Service account `aureum-cap-sheets@aureum-cap.iam.gserviceaccount.com`, with no project-wide Editor/Owner role.
- Pool `cap-github`, OIDC provider `cap-sheets`.
- Trust restricted by immutable repository and owner IDs, repository name, `refs/heads/main` and the exact `cap-sheets-sync.yml` workflow reference.
- Service-account-level `roles/iam.workloadIdentityUser` for that repository only.
- OAuth access restricted to the Sheets scope; no service-account key file.

Run the script from an authenticated Cloud Shell after reviewing it:

```bash
bash scripts/setup-cap-sheets-gcp.sh
```

Grant the verified service account **Editor** access to the central spreadsheet. Then set these **repository variables**, not secrets:

```text
CAP_GCP_WORKLOAD_IDENTITY_PROVIDER=projects/295598149511/locations/global/workloadIdentityPools/cap-github/providers/cap-sheets
CAP_GCP_SERVICE_ACCOUNT=aureum-cap-sheets@aureum-cap.iam.gserviceaccount.com
CAP_SHEETS_ID=1gdMmNR9P9Osm61ei-KpsdoXD84ncz9j0SGIMueuYobQ
```

The GitHub connector used for this task does not expose repository-variable writes. If using an authenticated GitHub CLI:

```bash
gh variable set CAP_GCP_WORKLOAD_IDENTITY_PROVIDER --repo osasbenny/AUREUM-CAP-V0.1 --body 'projects/295598149511/locations/global/workloadIdentityPools/cap-github/providers/cap-sheets'
gh variable set CAP_GCP_SERVICE_ACCOUNT --repo osasbenny/AUREUM-CAP-V0.1 --body 'aureum-cap-sheets@aureum-cap.iam.gserviceaccount.com'
gh variable set CAP_SHEETS_ID --repo osasbenny/AUREUM-CAP-V0.1 --body '1gdMmNR9P9Osm61ei-KpsdoXD84ncz9j0SGIMueuYobQ'
```

These identifiers are proposed values, not proof that the resources were created.

## Architecture and durable replay

Raw acquisition remains scheduled at `17 */6 * * *` UTC with matrix WebDev, Dating, HashNomads, Books and a target of 250 records per run per lane. Legacy WebDev remains manual with no schedule. Acquisition never calls Google APIs. The raw four-lane artifact retention increases to 90 days.

`CAP Sheets Sync` is a separate workflow, triggered after completed acquisition and at `47 */6 * * *` UTC. Its archive job has GitHub Actions read and repository contents write, but no Google credentials or OIDC permission. It persists trusted main-branch acquisition artifact ZIPs and provenance/checksum manifests in `cap-acquisition-ledger/.cap-ledger/<artifact_id>/`. Only that workflow's sync job receives `id-token: write`. Google authentication failure cannot change an upstream acquisition result.

The data branch now holds all 44 original ZIP archives and 44 provenance manifests. All 88 repository blob contents were independently checked against local originals, and all 44 ZIP checksums matched the GitHub artifact digests. The data branch is durable beyond artifact expiry. New archives are committed before any Sheets authentication. Failures report artifact IDs and can be recovered by manual dispatch of `CAP Sheets Sync`, which scans all available artifacts and replays the complete durable ledger. The branch is required and must not be deleted. New archival automation remains unverified until merge and execution on main.

The worker materializes only bounded JSON/CSV acquisition files after checking the archived ZIP's checksum. It never executes artifact contents or extracts paths outside the replay directory. JSON is preferred when the paired CSV exists, preserving richer evidence. CSV-only files lacking required provenance are rejected rather than embellished.

## Synchronization contract

Existing columns A:P remain in place. Q:T contain stable source ID, original source evidence, ACQUIRED lifecycle and artifact/run synchronization evidence. All source strings use RAW writes, preventing formula execution from source text.

Deduplication uses acquisition IDs and stable OSM element IDs (or explicit manual IDs), within each lane. A compatibility fingerprint covers old rows without source IDs. Chronological replay keeps the first acquisition timestamp. Later publicly sourced email observations fill an absent email without changing original acquisition metadata or human consent/qualification fields. Conflicting existing nonblank emails are preserved.

Writes target the next verified empty row range instead of using the ambiguous append endpoint. Retrying a lost write response updates the same range, preventing duplicate appends. One GitHub workflow concurrency group serializes Sheet writers. Treat the ledger's acquisition columns as pipeline-owned: concurrent manual sorting/insertion during synchronization is not supported. Do not run an independent second synchronization writer.

Headers are validated and unexpected schema changes fail the affected lane. HTTP 429/transient 5xx and transport failures use bounded exponential backoff (maximum 7 retries, 30 seconds per delay). Errors omit credentials and request bodies. Every batch is read back; separate lane failures are reported while other lanes continue. Reports include attempted, inserted, updated-email, skipped, excluded/failed and retried counts. OVERVIEW counts are recalculated from the actual Sheet readback. Authentication/archival failures are visible in Actions logs even when the worker cannot start. Reports use 90-day Actions artifacts; raw ledger remains durable.

Statuses are ACQUIRED plus EMAIL_DISCOVERY_REQUIRED or EMAIL_PRESENT. OUTREACH_COMPLETE is never inferred by this worker. Manual or sourced addresses are not consent. No Hunter, Zoey, OpenAI, SQS, scoring, email verification or marketing send is introduced into raw acquisition.

## Source correction

Previously all four lanes queried the same general local-business dataset. Specialty filtering also accepted geographic names such as College Station and themed businesses such as The Library bar. The shared lightweight acquisition qualification module now uses organization names/categories, excludes unrelated hospitality/salon matches, and preserves explicitly assigned B2B records. Per-lane Overpass queries now target relevant audience-source organizations directly. This remains raw acquisition, with no downstream enrichment dependency.

The new discovery queries have syntax/unit coverage but have not yet been observed in a scheduled production run. Yield and 1,000/day/lane are not guaranteed. The original geographic search coverage is unchanged.

## Validation and deployment

```bash
node --test tests/sheets-sync.test.mjs
python3 -m unittest discover -s tests -p 'test_ledger.py'
bash -n scripts/setup-cap-sheets-gcp.sh
python3 -m py_compile scripts/archive-acquisition-artifacts.py scripts/materialize-cap-ledger.py
```

15 Node tests and 3 Python tests passed locally. Tests cover routing, source/ID deduplication, idempotence, timestamp/email provenance preservation, authorization failures, bounded retries, uncertain writes, isolated failures, false-match exclusion, downstream-independent acquisition, ZIP checksum verification and path traversal rejection. Real historical replay against independently verified Sheet contents would insert 0 rows and update 0 email fields in all four lanes. This is not a WIF-authenticated production replay.

After tests pass, obtain user deployment approval before merging the pull request. Then dispatch `CAP Sheets Sync` on main, verify the WIF job, independently compare Sheet counts and evidence to archived outputs, dispatch a second time to confirm zero duplicates, and verify a scheduled four-lane acquisition run plus downstream sync. Production acceptance is not complete until those checks and cloud readbacks succeed.
