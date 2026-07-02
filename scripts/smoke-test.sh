#!/usr/bin/env bash
set -euo pipefail

# ── LMS Smoke Test ─────────────────────────────
# Verifies all services are reachable after deployment.

BASE_URL="${1:-http://localhost}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected" ]; then
    echo "  ✅  $name ($url) → $status"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $name ($url) → $status (expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "🔍 LMS Smoke Test — $(date)"
echo "   Base URL: $BASE_URL"
echo "────────────────────────────────────────"

echo ""
echo "Nginx:"
check "Nginx health" "$BASE_URL/health"

echo ""
echo "API (via Nginx):"
check "API liveness" "$BASE_URL/api/health"
check "API readiness" "$BASE_URL/api/health/ready"

echo ""
echo "Frontend (via Nginx):"
check "Frontend root" "$BASE_URL/"

echo ""
echo "Keycloak:"
check "Keycloak" "http://localhost:8080/health/ready"

echo ""
echo "MinIO:"
check "MinIO health" "http://localhost:9000/minio/health/live"

echo ""
echo "────────────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  Some checks failed!"
  exit 1
else
  echo "🎉 All checks passed!"
  exit 0
fi
