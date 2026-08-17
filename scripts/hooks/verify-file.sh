#!/usr/bin/env bash
#
# PostFileSave hook helper.
#
# Kiro passes session context as JSON on STDIN. We pull the saved file path out of
# it, run ESLint with --fix on just that file (fast), then type-check the whole
# project (the only way to catch a break the file itself does not contain).
#
# Never exits non-zero for a lint warning: this hook is here to fix and inform,
# not to interrupt a session.
set -uo pipefail

payload="$(cat || true)"

file_path="$(printf '%s' "$payload" \
  | python3 -c 'import json,sys
try:
    data = json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
for key in ("file_path", "filePath", "path"):
    value = data.get(key)
    if isinstance(value, str) and value:
        print(value); break
else:
    ctx = data.get("context") or {}
    print(ctx.get("file_path") or ctx.get("filePath") or "")
' 2>/dev/null)"

if [[ -n "$file_path" && -f "$file_path" ]]; then
  echo "› eslint --fix $file_path"
  pnpm exec eslint --fix "$file_path" || echo "  (eslint reported issues)"
fi

echo "› tsc --noEmit"
if ! pnpm exec tsc --noEmit; then
  echo "  TYPE ERRORS above — fix them before continuing."
fi

exit 0
