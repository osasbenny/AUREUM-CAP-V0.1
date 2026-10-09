import hashlib, json, pathlib, subprocess, sys, tempfile, unittest, zipfile
SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'scripts/materialize-cap-ledger.py'
class LedgerTests(unittest.TestCase):
    def run_fixture(self, member='leads-fixture.json', wrong_checksum=False):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp); source = root/'ledger'/'1';source.mkdir(parents=True)
            archive = source/'artifact.zip'
            with zipfile.ZipFile(archive,'w') as z:
                z.writestr(member, '{"run":{},"records":[]}')
                z.writestr('executable.sh', 'exit 99')
            digest=hashlib.sha256(archive.read_bytes()).hexdigest()
            (source/'manifest.json').write_text(json.dumps({'archive_sha256':'incorrect' if wrong_checksum else digest}))
            result=subprocess.run([sys.executable,str(SCRIPT),str(root/'ledger'),str(root/'out')],capture_output=True,text=True)
            files=[p.name for p in (root/'out').rglob('*') if p.is_file()] if (root/'out').exists() else []
            return result, files
    def test_valid_archive_extracts_inert_evidence_only(self):
        result,files=self.run_fixture();self.assertEqual(result.returncode,0);self.assertEqual(set(files),{'leads-fixture.json','manifest.json'})
    def test_checksum_mismatch_stops_replay(self):
        result,files=self.run_fixture(wrong_checksum=True);self.assertNotEqual(result.returncode,0);self.assertIn('checksum_mismatch',result.stderr);self.assertEqual(files,[])
    def test_path_traversal_is_rejected(self):
        result,files=self.run_fixture(member='../leads-escape.json');self.assertNotEqual(result.returncode,0);self.assertIn('invalid_archive_member',result.stderr);self.assertEqual(files,[])
if __name__ == '__main__': unittest.main()
