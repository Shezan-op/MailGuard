# MailGuard Production Operations Manual

Last Updated: September 2026  
Status: Production Runbook  
Engine Version: 1.0.0-hardened

---

## 1. Quick Reference: System Commands

| Action | Command | Description |
|---|---|---|
| **System Diagnostics** | `npm run doctor` | Comprehensive health check across App, DB, Worker, DNS, SMTP Port 25, Storage |
| **Integrity Audit** | `npm run system:verify` | Audits orphan records, counter drift, stale jobs, and missing settings |
| **Point-in-time Backup** | `npx tsx scripts/db-backup.ts` | Creates full relational snapshot in `storage/backups/` |
| **Database Restore** | `npx tsx scripts/db-restore.ts <path>` | Restores complete relational database from JSON backup snapshot |
| **Disaster Recovery Drill** | `npx tsx scripts/db-backup-restore-test.ts` | Automated drill: Seed → Backup → Wipe → Restore → Verify |
| **Start Web Application** | `npm run start` | Launches Next.js production server on `PORT` (default 3000) |
| **Start Verification Worker** | `npm run worker` | Launches background verification queue processing daemon |
| **Full Local Test Battery** | `npm run test` | Executes all 16 test files (116 unit & integration tests) |

---

## 2. Service Management (Start, Stop, Restart)

### 2.1 Native Node.js / Systemd Deployment

#### Starting the Services
```bash
# Terminal 1: Production Web Server
export NODE_ENV=production
export PORT=3000
npm run start

# Terminal 2: Verification Queue Worker Daemon
export NODE_ENV=production
npm run worker
```

#### Stopping the Services
Both the Next.js server and Worker daemon implement graceful shutdown handlers on `SIGINT` and `SIGTERM`:
```bash
# Gracefully notify processes to drain in-flight sockets and finish current batches
kill -15 <PID_WEB>
kill -15 <PID_WORKER>
```
Shutdown sequence:
1. Worker pauses polling and rejects new task assignments.
2. In-flight SMTP connections are allowed up to 10 seconds to finish or terminate cleanly.
3. Database connections and write buffers are flushed and closed.
4. Process exits with code 0.

#### Restarting Services
```bash
# For zero downtime: restart worker first, then reload web server
kill -15 <PID_WORKER>
npm run worker &
kill -15 <PID_WEB>
npm run start &
```

### 2.2 Docker Compose Deployment

```bash
# Launch MailGuard web and Postgres services in background
docker compose up -d

# Check live logs
docker compose logs -f --tail=100

# Graceful restart
docker compose restart

# Graceful shutdown (stops containers cleanly with 15s timeout)
docker compose down
```

---

## 3. System Diagnostics & Health Monitoring

### 3.1 Running the Doctor Command
The first action an operator should take during an incident is running `npm run doctor`:

```bash
npm run doctor
```

Sample output when fully operational:
```text
==================================================================
MAILGUARD SYSTEM DIAGNOSTIC
==================================================================
Application          PASS (Node v24.5.0)
Database             PASS (Connected successfully)
Schema               PASS (11 tables verified)
Migrations           PASS (All migrations applied)
Worker               PASS (Daemon active (0 running jobs))
Queue                PASS (0 queued, 0 running)
DNS                  PASS (Resolved 1 MX records)
SMTP outbound        PASS (Direct port 25 connection established)
Storage              PASS (All directories present and writable)
Configuration        PASS (Production configuration active)

Overall:
HEALTHY
==================================================================
```

### 3.2 Interpreting Degraded States
- If **SMTP outbound** reports `BLOCKED`: Outbound port 25 is restricted by host ISP or cloud provider firewall (see Section 8 for resolution). Overall status will report `DEGRADED`.
- If **Database** reports `FAIL`: Check database connection string, file permissions on `storage/db`, or container connectivity.
- If **Queue** reports high pending counts: Workers may be stopped or paused.

---

## 4. Queue, Worker, and Database Inspection

### 4.1 Checking Queue Depth & Active Jobs
Operators can inspect the queue directly via CLI or API:

```bash
# Query active jobs via system check
npm run system:verify
```

Or query via REST API:
```bash
curl -s http://localhost:3000/api/system/health | jq .
```

### 4.2 Inspecting Stuck or Orphaned Jobs
If a server rebooted during a verification run, some jobs may remain in `RUNNING` status without an active worker process:
1. `npm run system:verify` automatically flags stale jobs where `updated_at < NOW() - 30 minutes`.
2. The worker's built-in `reclaimStaleJobs()` automatically resets orphaned `PENDING` runs back to `QUEUED` upon next polling cycle.
3. Job counters are reconciled using `reconcileJobCounters(jobId)`.

---

## 5. Security & Secret Rotation

### 5.1 Rotating Session Secrets
MailGuard supports zero-downtime secret rotation using the `SESSION_SECRET_FALLBACK` environment variable:

1. Generate a new cryptographically secure 64-character secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Update `.env`:
   ```bash
   # Shift old secret to fallback; promote new secret to primary
   SESSION_SECRET_FALLBACK="<OLD_SECRET>"
   SESSION_SECRET="<NEW_HEX_SECRET>"
   ```
3. Restart the web server. Existing active user sessions signed with `<OLD_SECRET>` will continue to be validated. Newly created sessions will be signed with `<NEW_HEX_SECRET>`.
4. After 24 hours (session expiration window), remove `SESSION_SECRET_FALLBACK`.

### 5.2 Changing Admin Password
Set the `ADMIN_PASSWORD` variable in `.env` to a strong, high-entropy password (min 12 characters). Never deploy to production with the default password.

---

## 6. Updating Intelligence Datasets

MailGuard ships with bundled intelligence datasets in `data/`:
- `data/disposable-domains.json` (List of temporary/throwaway email providers)
- `data/free-providers.json` (Public webmail domains: Gmail, Yahoo, Outlook, etc.)
- `data/role-prefixes.json` (Generic departmental addresses: info@, sales@, billing@, etc.)

### 6.1 Atomic Dataset Update Procedure
To refresh datasets without application restart:
1. Validate new dataset format (must be valid JSON array of lowercase strings without empty entries):
   ```bash
   node -e "const d = JSON.parse(require('fs').readFileSync('new-disposables.json')); if (!Array.isArray(d)) throw new Error('Invalid');"
   ```
2. Atomically copy the validated file over `data/disposable-domains.json`.
3. In-memory sets refresh automatically on file modification or server restart.

---

## 7. Disaster Recovery & Database Maintenance

### 7.1 Automated Nightly Backup Cron
Schedule in operator crontab:
```bash
0 2 * * * cd /opt/mailguard && npx tsx scripts/db-backup.ts >> /var/log/mailguard-backup.log 2>&1
```

### 7.2 Manual Database Restore
```bash
npx tsx scripts/db-restore.ts storage/backups/mailguard_backup_2026-09-18T00-00-00-000Z.json
npm run system:verify
```

---

## 8. Troubleshooting Production Incidents

### 8.1 Incident: Outbound TCP Port 25 Blocked (`doctor` reports `BLOCKED`)
- **Symptoms:** `npm run doctor` reports `SMTP outbound BLOCKED`. Verifications stall or fail at SMTP stage with timeout.
- **Root Cause:** DigitalOcean, AWS EC2, GCP, and residential ISPs default to blocking outbound TCP port 25 to prevent spam abuse.
- **Remediation Steps:**
  1. **Request Port 25 Unblock:** Submit a reverse-DNS and port 25 unblock ticket to your cloud hosting provider.
  2. **Alternative Host:** Deploy MailGuard on VPS providers that permit outbound port 25 with clean IP reputation (e.g., OVH, Hetzner with request, Linode).
  3. **Smarthost Relay:** Configure an authenticated outbound relay in `server/verification/smtp/smtp-client.ts`.

### 8.2 Incident: SMTP Temporary Failure Spikes (421 / 450 / 451 Greylisting)
- **Symptoms:** High percentage of addresses marked as `TEMPORARY_FAILURE`.
- **Root Cause:** Remote MTA (e.g., Microsoft EOP or Yahoo) is rate-limiting the MailGuard IP address.
- **Remediation Steps:**
  1. Reduce concurrency per domain in settings (`MAX_CONCURRENT_PER_DOMAIN=1`).
  2. Increase inter-probe delay to 2,000ms.
  3. Allow MailGuard worker to execute automatic retry backoff (retries are scheduled with exponential backoff + jitter).

### 8.3 Incident: Database Corrupted or Stale Lockfile
- **Symptoms:** Server logs report `lock acquisition failed` or `database locked`.
- **Root Cause:** Abrupt host reboot left an unreleased lock in `storage/db/`.
- **Remediation Steps:**
  1. Stop all Node processes: `killall node`
  2. Check and remove stale `.lock` files: `rm -f storage/db/*.lock`
  3. Run `npm run doctor` to confirm clean database re-initialization.
  4. Run `npm run system:verify` to reconcile in-flight jobs.
