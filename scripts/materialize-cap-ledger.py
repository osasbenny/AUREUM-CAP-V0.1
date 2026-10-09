#!/usr/bin/env python3
"""Verify durable archives and extract only inert, bounded acquisition outputs."""
import hashlib, json, pathlib, re, sys, zipfile
source, destination = map(pathlib.Path, sys.argv[1:3])
count = 0
for folder in sorted(source.iterdir()):
    if not folder.is_dir():
        continue
    manifest = json.loads((folder / 'manifest.json').read_text())
    raw = (folder / 'artifact.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest['archive_sha256']:
        raise SystemExit('archive_checksum_mismatch')
    output = destination / folder.name
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(folder / 'artifact.zip') as archive:
        for item in archive.infolist():
            name = pathlib.PurePosixPath(item.filename).name
            if re.fullmatch(r'leads-.*\.(?:json|csv)', name) or name == 'latest-run.json':
                if name != item.filename or item.file_size > 100_000_000:
                    raise SystemExit('invalid_archive_member')
                (output / name).write_bytes(archive.read(item))
                count += 1
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps({'archives': len(list(source.iterdir())), 'evidence_files': count}))
