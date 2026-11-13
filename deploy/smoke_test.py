"""Public deployment checks. Credentials/tokens are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /api/health      -> {"status": "ok"}
      2. GET /api/ready       -> {"db": "connected"}   (proves the DB works)
      3. GET /                -> HTML page (the built React app is served)
      4. GET /api/catalog     -> non-empty list (migration + seed worked)
      5. OPTIONAL login test  -> login, /api/auth/me, logout. Runs only if BOTH
         env vars SMOKE_EMAIL and SMOKE_PASSWORD are set (set both or neither).
         The session is always logged out, even if a check fails.

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    Offline unit tests: deploy/tests/test_smoke.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


def request(base, path, data=None, token=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(
        base + path,
        headers=headers,
        data=json.dumps(data).encode() if data is not None else None
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def check(base):
    def catalog_predicate(b):
        try:
            payload = json.loads(b)
            items = payload.get('data') if isinstance(payload, dict) else payload
            return isinstance(items, list) and len(items) > 0
        except Exception:
            return False

    # --- Public checks ---
    for path, predicate in (
        ('/api/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', lambda b: json.loads(b).get('db') == 'connected'),
        ('/', lambda b: b'<html' in b.lower()),
        ('/api/catalog', catalog_predicate),
    ):
        for attempt in range(5):
            try:
                if not predicate(request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    # --- Optional login check (only when both credentials are provided) ---
    email, password = os.getenv('SMOKE_EMAIL'), os.getenv('SMOKE_PASSWORD')
    if bool(email) != bool(password):
        raise RuntimeError('Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.')
    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return
    token = None
    try:
        login = json.loads(request(base, '/api/auth/login', {'email': email, 'password': password}))
        token = login.get('token') or login.get('data', {}).get('token')
        if not token:
            raise ValueError('Token missing from login response')
        request(base, '/api/auth/me', token=token)
        print('PASS login and authenticated /api/auth/me')
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Login smoke check failed') from None
    finally:
        if token:
            request(base, '/api/auth/logout', data={}, token=token)
            print('PASS logout')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
