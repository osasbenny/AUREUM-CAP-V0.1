#!/usr/bin/env python3
"""Archive only raw evidence from known main-branch acquisition workflows. No cloud calls."""
import hashlib, json, os, pathlib, re, urllib.request, zipfile, io, time
from github_artifact_http import api_request
TOKEN = os.environ['GH_TOKEN']
REPO = os.environ.get('GITHUB_REPOSITORY', 'osasbenny/AUREUM-CAP-V0.1')
ROOT = pathlib.Path(os.environ.get('CAP_LEDGER_DIR', 'ledger/.cap-ledger'))
WORKFLOWS = {'.github/workflows/cap-four-lane-acquisition.yml', '.github/workflows/cap-autonomous-acquisition.yml'}

def request(route, binary=False):
    url = route if route.startswith('https://') else 'https://api.github.com/repos/' + REPO + route
    return api_request(url, TOKEN, binary=binary)

ROOT.mkdir(parents=True, exist_ok=True)
report = {'archived': [], 'already_archived': [], 'expired': [], 'failed': [], 'failure_details': []}
run_cache = {}
page = 1
while True:
    artifacts = request('/actions/artifacts?per_page=100&page=' + str(page))['artifacts']
    if not artifacts:
        break
    for artifact in artifacts:
        if not re.fullmatch(r'cap-(?:webdev|dating|hashnomads|books|acquisition)-\d+', artifact['name']):
            continue
        run_id = artifact['workflow_run']['id']
        if run_id not in run_cache:
            run_cache[run_id] = request('/actions/runs/' + str(run_id))
        run = run_cache[run_id]
        if run['head_branch'] != 'main' or run['path'] not in WORKFLOWS or run['status'] != 'completed' or run['head_repository']['full_name'] != REPO:
            continue
        folder = ROOT / str(artifact['id'])
        if (folder / 'manifest.json').exists():
            report['already_archived'].append(artifact['id']); continue
        if artifact['expired']:
            report['expired'].append(artifact['id']); continue
        try:
            raw = request('/actions/artifacts/' + str(artifact['id']) + '/zip', binary=True)
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                allowed = []
                for item in archive.infolist():
                    # Read inert JSON/CSV only. Do not extract paths or execute artifact files.
                    name = pathlib.PurePosixPath(item.filename).name
                    if re.fullmatch(r'leads-.*\.(?:json|csv)', name) or name == 'latest-run.json':
                        if item.file_size > 100_000_000 or item.filename != name:
                            raise ValueError('invalid_artifact_member')
                        allowed.append((name, archive.read(item)))
            folder.mkdir(parents=True, exist_ok=True)
            (folder / 'artifact.zip').write_bytes(raw)
            manifest = {'artifact_id': artifact['id'], 'artifact_name': artifact['name'], 'run_id': run_id, 'head_sha': run['head_sha'], 'workflow_path': run['path'], 'run_url': run['html_url'], 'created_at': artifact['created_at'], 'archive_sha256': hashlib.sha256(raw).hexdigest(), 'github_digest': artifact.get('digest')}
            (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2))
            report['archived'].append(artifact['id'])
        except Exception as error:
            report['failed'].append(artifact['id'])
            reason = str(error) if isinstance(error, (RuntimeError, ValueError)) else type(error).__name__
            report['failure_details'].append({'artifact_id': artifact['id'], 'reason': reason})
    page += 1
pathlib.Path('archive-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({k: len(v) for k, v in report.items()}))
if report['failed']:
    raise SystemExit(1)
