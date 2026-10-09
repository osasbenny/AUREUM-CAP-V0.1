import io, unittest, urllib.error, urllib.request
from scripts.github_artifact_http import api_request

class ArchiveHTTPTests(unittest.TestCase):
    def test_token_authenticates_api_but_never_follows_storage_redirect(self):
        def opener(req, timeout):
            self.assertEqual(req.get_header('Authorization'), 'Bearer fixture-token')
            redirected = urllib.request.HTTPRedirectHandler().redirect_request(
                req, None, 302, 'Found', {}, 'https://storage.example.invalid/archive.zip')
            self.assertIsNone(redirected.get_header('Authorization'))
            return io.BytesIO(b'zip fixture')
        self.assertEqual(api_request('https://api.github.com/repos/x/y/actions/artifacts/1/zip', 'fixture-token', True, opener), b'zip fixture')

    def test_terminal_http_errors_are_safe_and_not_retried(self):
        calls=[]
        def opener(req, timeout):
            calls.append(req)
            raise urllib.error.HTTPError(req.full_url, 403, 'sensitive body', {}, None)
        with self.assertRaisesRegex(RuntimeError, '^github_archive_http_403$'):
            api_request('https://api.github.com/repos/x/y/actions/artifacts/1/zip', 'fixture-token', True, opener)
        self.assertEqual(len(calls), 1)

    def test_rate_limit_retries_are_bounded(self):
        sleeps=[]
        def opener(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 429, 'rate limited', {}, None)
        with self.assertRaisesRegex(RuntimeError, 'github_archive_http_429'):
            api_request('https://api.github.com/repos/x/y', 'fixture-token', opener=opener, sleep=sleeps.append)
        self.assertEqual(sleeps, [1,2,4,8,16])

    def test_non_github_origin_cannot_receive_token(self):
        with self.assertRaisesRegex(RuntimeError, 'invalid_github_api_origin'):
            api_request('https://storage.example.invalid/archive.zip', 'fixture-token')

if __name__ == '__main__': unittest.main()
