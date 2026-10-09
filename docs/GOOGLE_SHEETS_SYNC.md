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

## Verified production authentication

The user executed the Cloud Shell setup script. Repository variables were saved through authenticated GitHub settings and independently read back. Google Drive permission metadata independently confirmed Editor (`writer`) access for `aureum-cap-sheets@aureum-cap.iam.gserviceaccount.com` on the central Sheet.

PR #1 was merged with user approval: https://github.com/osasbenny/AUREUM-CAP-V0.1/pull/1, merge commit `53ef7dcf99444dae2062bfff65c8a0fea7c2f644`. Production GitHub OIDC/service-account impersonation succeeded and the worker read/wrote the Sheets API successfully. No service-account key was generated. The Cloud console remains inaccessible to this task, so full administrative IAM policy introspection has not been independently performed.

Successful historical replay: https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37931552146, attempts 1 and 2. Both verified all four lane totals with **0 inserted rows, 0 email updates and 0 retries**, using the service-account token. Valid historical rows stayed WebDev 2,264, Dating 2, HashNomads 1, Books 3. Qualification exclusions stayed 1,835; they are retained as audit evidence rather than imported.

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

These **repository variables** and service-account Sheet **Editor** permission are configured and verified:

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

Production execution independently demonstrated that the configured federation provider and service account authenticate and have access to the Sheet.

## Architecture and durable replay

Raw acquisition remains scheduled at `17 */6 * * *` UTC with matrix WebDev, Dating, HashNomads, Books and a target of 250 records per run per lane. Legacy WebDev remains manual with no schedule. Acquisition never calls Google APIs. The raw four-lane artifact retention increases to 90 days.

`CAP Sheets Sync` is a separate workflow, triggered after completed acquisition, at `47 */6 * * *` UTC, and when its workflow/worker/archive code changes on main. Its archive job has GitHub Actions read and repository contents write, but no Google credentials or OIDC permission. It persists trusted main-branch acquisition artifact ZIPs and provenance/checksum manifests in `cap-acquisition-ledger/.cap-ledger/<artifact_id>/`. Only that workflow's sync job receives `id-token: write`. Google authentication failure cannot change an upstream acquisition result.

The data branch now holds all 44 original ZIP archives and 44 provenance manifests. All 88 repository blob contents were independently checked against local originals, and all 44 ZIP checksums matched the GitHub artifact digests. The data branch is durable beyond artifact expiry. New archives are committed before any Sheets authentication. Failures report artifact IDs and can be recovered by manual dispatch of `CAP Sheets Sync`, which scans all available artifacts and replays the complete durable ledger. The branch is required and must not be deleted. Production archive/materialization jobs succeeded on main. New artifacts become eligible for archival when their acquisition workflow run completes.

The worker materializes only bounded JSON/CSV acquisition files after checking the archived ZIP's checksum. It never executes artifact contents or extracts paths outside the replay directory. JSON is preferred when the paired CSV exists, preserving richer evidence. CSV-only files lacking required provenance are rejected rather than embellished.

## Synchronization contract

Existing columns A:P remain in place. Q:T contain stable source ID, original source evidence, ACQUIRED lifecycle and artifact/run synchronization evidence. All source strings use RAW writes, preventing formula execution from source text.

Deduplication uses acquisition IDs and stable OSM element IDs (or explicit manual IDs), within each lane. A compatibility fingerprint covers old rows without source IDs. Chronological replay keeps the first acquisition timestamp. Later publicly sourced email observations fill an absent email without changing original acquisition metadata or human consent/qualification fields. Conflicting existing nonblank emails are preserved.

Writes target the next verified empty row range instead of using the ambiguous append endpoint. Retrying a lost write response updates the same range, preventing duplicate appends. One GitHub workflow concurrency group serializes Sheet writers. Treat the ledger's acquisition columns as pipeline-owned: concurrent manual sorting/insertion during synchronization is not supported. Do not run an independent second synchronization writer.

Headers are validated and unexpected schema changes fail the affected lane. HTTP 429/transient 5xx and transport failures use bounded exponential backoff (maximum 7 retries, 30 seconds per delay). Errors omit credentials and request bodies. Full-grid reads use batches of up to ten bounded 1,000-row ranges per API request, preserving row positions while avoiding quota exhaustion. Every written batch is read back; separate lane failures are reported while other lanes continue. Reports include attempted, inserted, updated-email, skipped, excluded/failed and retried counts. OVERVIEW counts are recalculated from the actual Sheet readback. Authentication/archival failures are visible in Actions logs even when the worker cannot start. Reports use 90-day Actions artifacts; raw ledger remains durable.

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

16 Node tests and 3 Python tests passed locally and the deployed CI workflow passed. Tests cover routing, source/ID deduplication, idempotence, timestamp/email provenance preservation, authorization failures, bounded retries, uncertain writes, isolated failures, false-match exclusion, downstream-independent acquisition, ZIP checksum verification and path traversal rejection. Actual WIF-authenticated historical replay and its repeat both inserted 0 rows and updated 0 email fields in all four lanes.

The first production attempt (run `37931097219`) hit a real Sheets 429 after seven bounded retries, with no duplicate inserts and an uploaded failure report. Commit `c06ce5c57dec3d395e42f7265f40456a5e51033a` batches the grid reads; the failed run was retried successfully using current main code. Deployment-trigger commit: `7e92640dad86033aa70d5df05caa5a584a371ba4`. Failed and successful attempt reports are retained in Actions artifacts.

Post-merge acquisition run https://github.com/osasbenny/AUREUM-CAP-V0.1/actions/runs/37930787256 has a successful WebDev job and real JSON/CSV artifact (`11616326180`): 8,000 source records discovered, 1,759 previously acquired sources rejected, 250 net-new records persisted, 9 sourced emails and 241 requiring email discovery. At this checkpoint Books, Dating and HashNomads jobs are still querying sources. Their yield and new-artifact automatic import remain unverified. The six-hour schedule is deployed; an actual scheduled post-deployment acquisition and downstream sync remain to be observed.

The integration is deployed and historical production replay is verified. Full four-lane production acceptance remains pending the in-flight acquisition outputs and scheduled execution evidence. No acquisition target or outreach completion is inferred from a green workflow status.
