#!/usr/bin/env bash
# Runs every SQL suite against the linked hosted project (no Docker, no DB password).
# Each suite rolls back; finish(true) raises on a failed assertion, which the CLI reports as an Error.
set -uo pipefail
failed=0
for f in supabase/tests/*.test.sql; do
  out=$(supabase db query --linked -f "$f" 2>&1)
  if grep -q '"_tag":"Error"' <<<"$out"; then
    echo "FAIL $f"; grep -o '"message":"[^}]*' <<<"$out" | head -3; failed=1
  else
    echo "ok   $f"
  fi
done
exit $failed
