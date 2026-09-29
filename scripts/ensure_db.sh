#!/usr/bin/env bash
# Idempotent PostgreSQL bootstrap for Lexora.
# Safe to run on every boot: starts the cluster, ensures the DB + role exist,
# and pushes the Drizzle schema if the tables are missing.
set +e

CLUSTER_VER="$(ls /usr/lib/postgresql 2>/dev/null | sort -n | tail -1)"
[ -z "$CLUSTER_VER" ] && CLUSTER_VER=15
DATA_DIR="/var/lib/postgresql/${CLUSTER_VER}/main"

# Create cluster if the data dir was wiped (fresh pod).
if [ ! -f "${DATA_DIR}/PG_VERSION" ]; then
  pg_createcluster "${CLUSTER_VER}" main >/dev/null 2>&1
fi

# Start cluster if not already online.
if ! pg_lsclusters -h 2>/dev/null | grep -q "online"; then
  pg_ctlcluster "${CLUSTER_VER}" main start >/dev/null 2>&1
fi

# Wait until Postgres accepts connections.
for i in $(seq 1 30); do
  pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1 && break
  sleep 1
done

# Ensure the postgres role password and the lexora database.
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" >/dev/null 2>&1
HAS_DB="$(su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='lexora'\"" 2>/dev/null)"
if [ "$HAS_DB" != "1" ]; then
  su postgres -c "createdb lexora" >/dev/null 2>&1
fi

# Push the Drizzle schema if the core table is missing.
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/lexora"
HAS_TABLE="$(PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d lexora -tAc "SELECT to_regclass('public.projects')" 2>/dev/null | tr -d '[:space:]')"
if [ "$HAS_TABLE" != "projects" ]; then
  echo "[ensure_db] Pushing Drizzle schema..."
  cd /app && echo "y" | ./node_modules/.bin/drizzle-kit push >/dev/null 2>&1
fi

echo "[ensure_db] PostgreSQL ready."
exit 0
