#!/usr/bin/env bash
# One-shot local bootstrap: Keycloak realm + tenant + users + demo data + RAG embeddings.
# Prereqs: `docker compose up -d postgres keycloak minio` and `api/.env` configured.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/api"

RESET_FLAG=""
if [[ "${1:-}" == "--reset" ]]; then
  RESET_FLAG="--reset"
  echo "▶ Reset mode: existing demo rows will be cleared before reseeding."
fi

run() {
  echo ""
  echo "▶ $1"
  shift
  "$@"
}

run "Applying Prisma migrations" npx prisma migrate deploy
run "Provisioning Keycloak realm" npx ts-node -r tsconfig-paths/register src/scripts/provision-keycloak.ts
run "Seeding tenant"              npx ts-node -r tsconfig-paths/register src/scripts/seed-tenant.ts
run "Seeding demo users"          npx ts-node -r tsconfig-paths/register src/scripts/seed-users.ts
run "Seeding demo content"        npm run seed:demo -- $RESET_FLAG
run "Backfilling RAG embeddings"  npm run backfill:document-embeddings

echo ""
echo "✅ Bootstrap complete. Log in at http://localhost:3000 as admin@lms.dev / Admin@1234"