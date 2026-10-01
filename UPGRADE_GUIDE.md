# MailGuard Upgrade & Migration Guide

Last Updated: September 2026  
Status: Production Guide  
Engine Version: 1.0.0-hardened

---

## 1. Supported Runtime & Dependency Matrix

| Component | Minimum Supported | Recommended / Tested | Target Policy |
|---|---|---|---|
| **Node.js** | v20.10.0 LTS (Iron) | v22.x LTS (Jod) / v24.x Current | Active LTS releases |
| **Next.js** | 15.0.0 | 15.5.25 | Stable App Router |
| **PostgreSQL** | 14.0 | 16.x / 17.x / Embedded PGlite 0.2.x | ACID-compliant relational DB |
| **Docker Engine** | 24.0.0 | 28.0+ with BuildKit | Multi-stage OCI compliant |
| **Operating System** | Linux (Ubuntu 22.04+, Alpine 3.19+), Windows 11 WSL2, macOS 14+ | Ubuntu 22.04 LTS / Alpine 3.20 | POSIX networking stack |

---

## 2. Upgrade Order & Operational Sequence

When upgrading MailGuard across versions, follow this strict sequential order:

```text
1. Pre-upgrade Database Snapshot (npx tsx scripts/db-backup.ts)
                    ↓
2. Graceful Drain of Verification Worker (kill -15 <PID_WORKER>)
                    ↓
3. Upgrade Node.js / Runtime Environment (if applicable)
                    ↓
4. Deploy Updated Application Code / Docker Container
                    ↓
5. Automated Execution of Schema Migrations (server/db/migrations.ts)
                    ↓
6. Integrity & Consistency Audit (npm run system:verify)
                    ↓
7. Start Updated Worker Daemon & Verify Health (npm run doctor)
```

---

## 3. Schema Migration Safety & Forward-Recovery Policy

### 3.1 Migration Design Principles
1. **Strictly Idempotent:** All migration statements utilize `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
2. **Non-Destructive & Non-Blocking:** Schema migrations are strictly additive. Columns are never dropped or renamed in-place in active tables. New columns must either have default values or allow `NULL`.
3. **Execution Ordering:** Migrations execute during application bootstrap before web listeners or background workers accept traffic.

### 3.2 Rollback vs Forward-Recovery Policy
> [!IMPORTANT]
> **Downgrade Safety Declaration:**  
> MailGuard enforces a **Forward-Recovery Policy**. Arbitrary database schema downgrades ("down migrations") are explicitly **NOT SUPPORTED**.  
> Attempting to run an older MailGuard application version against a newer database schema will trigger validation errors and risks data corruption if columns or foreign keys are unreferenced.

### 3.3 Recovery from Failed Upgrades
If a deployment fails during an upgrade:
1. **If migration aborted mid-way:** Restore the point-in-time snapshot created in Step 1 using `npx tsx scripts/db-restore.ts storage/backups/pre_upgrade_<TIMESTAMP>.json`.
2. **If application code has a defect:** Re-deploy the previous application code version alongside the restored database snapshot.
3. **Forward-Fix:** If new data has already been written to the newer schema, develop and apply a targeted forward migration rather than attempting to rollback.

---

## 4. Step-by-Step Production Upgrade Procedure

### 4.1 Native Node.js Deployment
```bash
# Step 1: Create backup snapshot
cd /opt/mailguard
npx tsx scripts/db-backup.ts

# Step 2: Stop background worker
kill -15 $(pgrep -f "tsx workers/verification-worker.ts")

# Step 3: Fetch latest release
git fetch --tags
git checkout v1.1.0

# Step 4: Install dependencies cleanly from lockfile
npm ci

# Step 5: Build production assets
npm run build

# Step 6: Verify migrations & integrity
npm run system:verify

# Step 7: Restart services
pm2 restart mailguard-web
pm2 restart mailguard-worker

# Step 8: Run system doctor
npm run doctor
```

### 4.2 Docker Deployment
```bash
# Step 1: Create backup snapshot from container
docker compose exec mailguard npx tsx scripts/db-backup.ts

# Step 2: Pull or build updated images
docker compose pull
# or
docker compose build --no-cache

# Step 3: Recreate containers with zero downtime
docker compose up -d --remove-orphans

# Step 4: Verify health
docker compose exec mailguard npm run doctor
```
