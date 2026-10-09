"""GitHub API requests; credentials never follow artifact-storage redirects."""
import json
import time
import urllib.error
import urllib.parse
import urllib.request


def api_request(url, token, binary=False, opener=None, sleep=time.sleep):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.netloc != 'api.github.com':
        raise RuntimeError('invalid_github_api_origin')
    open_request = opener or urllib.request.urlopen
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'AureumCAP-ArtifactArchive',
            })
            # urllib's normal headers follow redirects; GitHub's token must not.
            req.add_unredirected_header('Authorization', 'Bearer ' + token)
            with open_request(req, timeout=60) as response:
                body = response.read()
            return body if binary else json.loads(body)
        except urllib.error.HTTPError as error:
            reason = 'github_archive_http_' + str(error.code)
            if error.code not in (408, 429) and error.code < 500:
                raise RuntimeError(reason) from None
        except Exception:
            reason = 'github_archive_transport_or_decode_failed'
        if attempt == 5:
            raise RuntimeError(reason) from None
        sleep(min(30, 2 ** attempt))
