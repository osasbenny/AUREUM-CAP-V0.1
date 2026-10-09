#!/usr/bin/env bash
# Run from an authenticated Google Cloud Shell. No keys are created.
set -euo pipefail
PROJECT_ID=aureum-cap
PROJECT_NUMBER=295598149511
REPOSITORY=osasbenny/AUREUM-CAP-V0.1
REPOSITORY_ID=1369189969
OWNER_ID=45604235
POOL_ID=cap-github
PROVIDER_ID=cap-sheets
SERVICE_ACCOUNT=aureum-cap-sheets@aureum-cap.iam.gserviceaccount.com
WORKFLOW_REF='osasbenny/AUREUM-CAP-V0.1/.github/workflows/cap-sheets-sync.yml@refs/heads/main'
CONDITION="assertion.repository_id == '${REPOSITORY_ID}' && assertion.repository_owner_id == '${OWNER_ID}' && assertion.repository == '${REPOSITORY}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${WORKFLOW_REF}'"
MAPPING='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id'
actual_number=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
test "$actual_number" = "$PROJECT_NUMBER"
gcloud services enable sheets.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT_ID"
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create aureum-cap-sheets --display-name='Aureum CAP Sheets Sync' --project="$PROJECT_ID"
fi
if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" --location=global --display-name='CAP GitHub Actions' --project="$PROJECT_ID"
fi
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --workload-identity-pool="$POOL_ID" --location=global --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" --workload-identity-pool="$POOL_ID" --location=global --issuer-uri='https://token.actions.githubusercontent.com' --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION" --project="$PROJECT_ID"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" --workload-identity-pool="$POOL_ID" --location=global --issuer-uri='https://token.actions.githubusercontent.com' --attribute-mapping="$MAPPING" --attribute-condition="$CONDITION" --project="$PROJECT_ID"
fi
gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT" --project="$PROJECT_ID" --role='roles/iam.workloadIdentityUser' --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository_id/${REPOSITORY_ID}"
# Independent readback. No project-wide Editor or Owner role is granted.
gcloud services list --enabled --project="$PROJECT_ID" --filter='config.name:sheets.googleapis.com' --format='value(config.name)'
gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT_ID" --format='value(email,disabled)'
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --workload-identity-pool="$POOL_ID" --location=global --project="$PROJECT_ID" --format='yaml(name,state,attributeMapping,attributeCondition,oidc)'
gcloud iam service-accounts get-iam-policy "$SERVICE_ACCOUNT" --project="$PROJECT_ID" --format=json
printf '\nNonsecret GitHub repository variables:\nCAP_GCP_WORKLOAD_IDENTITY_PROVIDER=projects/%s/locations/global/workloadIdentityPools/%s/providers/%s\nCAP_GCP_SERVICE_ACCOUNT=%s\nCAP_SHEETS_ID=1gdMmNR9P9Osm61ei-KpsdoXD84ncz9j0SGIMueuYobQ\n' "$PROJECT_NUMBER" "$POOL_ID" "$PROVIDER_ID" "$SERVICE_ACCOUNT"
printf '\nGrant this service account Editor access to the central spreadsheet. Do not create a service-account key.\n'
