#!/usr/bin/env bash
#
# PreToolUse hook helper. Exits non-zero to block the tool call.
#
# Two things are refused:
#   1. writing to an environment or credential file
#   2. writing content that contains something shaped like a live credential
#      (a Supabase JWT, an AWS bearer token, a private key block)
#
# This is the one mistake a later commit cannot undo, so it is enforced by a gate
# rather than by good intentions.
set -uo pipefail

payload="$(cat || true)"

verdict="$(printf '%s' "$payload" | python3 -c '
import json, re, sys

try:
    data = json.load(sys.stdin)
except Exception:
    print("allow"); raise SystemExit

blob = json.dumps(data)

# Target path, wherever the tool put it.
paths = re.findall(r"\"(?:file_path|filePath|path)\"\s*:\s*\"([^\"]+)\"", blob)

FORBIDDEN = re.compile(r"(^|/)(\.env(\.[^/]*)?|\.db-password\.local|[^/]*\.local)$")
for path in paths:
    if FORBIDDEN.search(path):
        print("block:refusing to write to the credential file " + path)
        raise SystemExit

SECRETS = [
    (r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.", "a JWT (Supabase key?)"),
    (r"ABSK[A-Za-z0-9+/=]{20,}", "an AWS Bedrock API key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "a private key"),
    (r"sbp_[0-9a-f]{40,}", "a Supabase access token"),
]
for pattern, label in SECRETS:
    if re.search(pattern, blob):
        print("block:content looks like it contains " + label)
        raise SystemExit

print("allow")
' 2>/dev/null)"

if [[ "$verdict" == block:* ]]; then
  echo "BLOCKED by guard-secrets hook: ${verdict#block:}" >&2
  echo "Put the value in .env.local (git-ignored) and reference it through src/lib/env.ts." >&2
  exit 2
fi

exit 0
