# MAILGUARD

> **Private, Self-Hosted Email Verification & Deliverability Intelligence Engine**

[![GitHub Repository](https://img.shields.io/badge/GitHub-Shezan--op%2FMailGuard-181717?style=flat&logo=github)](https://github.com/Shezan-op/MailGuard)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.2.1-000000?style=flat&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL_16_%7C_PGlite-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Test Suite](https://img.shields.io/badge/Test_Suite-116_Passing-success?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Zero External APIs](https://img.shields.io/badge/External_APIs-Zero_(100%25_First--Party)-orange?style=flat)](https://github.com/Shezan-op/MailGuard)

---

MailGuard is a production-grade, self-hosted email verification platform engineered for high-volume, privacy-critical email operations. It deterministically validates syntax, resolves DNS and MX records, detects synthetic catch-all configurations, identifies disposable domains and role accounts, directly negotiates recipient SMTP validation (`MAIL FROM` / `RCPT TO` without ever transmitting `DATA`), correlates first-party campaign bounce history, and scores deliverability risk (0–100) — entirely on your own private infrastructure.

**No paid APIs (ZeroBounce, NeverBounce, Hunter, Debounce). No per-verification credits. Zero external telemetry. Complete data privacy.**

---

## Table of Contents

- [1. Core Verification Philosophy: Probabilistic Truth](#1-core-verification-philosophy-probabilistic-truth)
- [2. Technical Architecture & Verification Pipeline](#2-technical-architecture--verification-pipeline)
- [3. Technology Stack](#3-technology-stack)
- [4. Quick Start: Docker Deployment (Recommended)](#4-quick-start-docker-deployment-recommended)
- [5. Local Development Setup (Native Node.js & PGlite)](#5-local-development-setup-native-nodejs--pglite)
- [6. CLI Verification & Operational Tooling](#6-cli-verification--operational-tooling)
- [7. Complete Environment Configuration](#7-complete-environment-configuration)
- [8. REST API Specification](#8-rest-api-specification)
- [9. Real-World SMTP Constraints & Network Realities](#9-real-world-smtp-constraints--network-realities)
- [10. Security & Privacy Guarantees](#10-security--privacy-guarantees)
- [11. Documentation & Engineering Runbooks](#11-documentation--engineering-runbooks)
- [12. License](#12-license)

---

## 1. Core Verification Philosophy: Probabilistic Truth

Traditional email verification tools present a simplistic binary choice: `VALID` or `INVALID`. In real-world internet mail transport, this binary representation is fundamentally inaccurate:
* Receiving mail servers deliberately employ **greylisting** (450/451) to defer unfamiliar senders.
* Corporate and enterprise mail gateways (Proofpoint, Mimecast, Microsoft EOP) configure **catch-all acceptance** to prevent directory harvesting attacks.
* Security filters block verifier connection attempts or rate-limit probes (554/571/421).
* Mailbox quotas or temporary maintenance windows trigger transient rejections.

**MailGuard never claims certainty where SMTP cannot provide certainty.** Instead of a naive binary output, MailGuard classifies addresses into 8 deterministic operational statuses:

| Status | Description | Actionable Guidance |
|---|---|---|
| **`DELIVERABLE`** | Address passed RFC syntax, domain resolves, active MX hosts exist, and mailbox was explicitly confirmed by the recipient server during `RCPT TO` (and domain is verified not to be catch-all). | Safe to send. Highest deliverability rate. |
| **`UNDELIVERABLE`** | Address has invalid syntax, non-existent domain (NXDOMAIN), RFC 7505 Null MX record, is on an active suppression list, or was permanently rejected by the recipient server (`550 User unknown`). | Do not send. Immediate hard bounce risk. |
| **`RISKY`** | Address was accepted or deferred, but exhibits elevated risk signals (e.g. historical hard bounce recorded from a previous campaign, or connection blocked by receiving security filter). | Send with caution; segment into low-priority warmup pools. |
| **`CATCH_ALL`** | Receiving server accepts all synthetic, randomly generated recipient addresses. Individual mailbox existence cannot be confirmed via SMTP alone. | Keep only if high-value lead; monitor bounce thresholds. |
| **`DISPOSABLE`** | Domain matches a verified database of temporary/throwaway email providers (10MinuteMail, TempMail, GuerrillaMail). | Exclude from mailing lists to prevent bounce spikes. |
| **`ROLE_BASED`** | Generic functional mailbox (`support@`, `sales@`, `billing@`, `admin@`) rather than an individual person. | High unsubscribe and low engagement likelihood. |
| **`TEMPORARY`** | Server returned a transient 4xx code (greylisting, connection throttling, server busy). Eligible for automated backoff retries. | Automatically re-queued with exponential backoff. |
| **`UNKNOWN`** | Insufficient or inconclusive evidence to classify the mailbox (e.g. timeout on all MX records, code 252). | Verify network connectivity or retry later. |

Every result provides an exact **Risk Score (0–100)**, **Confidence Level (HIGH / MEDIUM / LOW)**, human-readable **reason**, and complete **sanitized SMTP transcript logs**.

---

## 2. Technical Architecture & Verification Pipeline

MailGuard is structured as a modular TypeScript monolith engineered for high throughput and zero memory leaks:

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 15 Web App                     │
│    (Tailwind CSS, TanStack Table, React Hook Form, Zod)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API
┌──────────────────────────────▼──────────────────────────────┐
│                    API Layer & Auth Guard                   │
│   (Single-Admin HMAC Sessions, SSRF Guard, Rate Limiting)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┴───────────────────────┐
        ▼                                               ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│    PostgreSQL 16 / PGlite   │         │    Postgres-Backed Queue    │
│  (Drizzle ORM + Migrations) │◄────────┤  (FOR UPDATE SKIP LOCKED)   │
└──────────────▲──────────────┘         └──────────────┬──────────────┘
               │                                       │ Job Dispatch
┌──────────────┴───────────────────────────────────────▼──────────────┐
│                  Verification & Worker Pipeline                     │
│                                                                     │
│  1. Normalization & Punycode (RFC 5321 / RFC 6531)                  │
│  2. RFC-Aware Syntax Parsing (Zero fragile mega-regex)              │
│  3. Levenshtein Typo Detection (Gmail, Outlook, Yahoo, etc.)        │
│  4. Suppression List Check (Blacklist & historical bounces)         │
│  5. Node.js DNS Resolver (A, AAAA, MX records, RFC 7505 Null MX)    │
│  6. SSRF Protection Guard (Strict RFC 1918 / Loopback / CGNAT block)│
│  7. Domain Intelligence Cache & MX Priority Sorter                  │
│  8. Node.js `net` & `tls` Socket Client (Raw SMTP sequence)         │
│     - 220 Greeting Banner Verification                              │
│     - EHLO / HELO Capability Negotiation                            │
│     - Opportunistic STARTTLS Handshake                              │
│     - MAIL FROM:<verify@configured-domain>                          │
│     - RCPT TO:<target@recipient-domain>                             │
│     - NEVER EXECUTES DATA (Zero emails sent; closes with QUIT)      │
│     - Bounded 2,000-char sanitized transcript capture               │
│  9. Synthetic Catch-All Probe (__mg_catchall_<hex32>@domain)        │
│ 10. Disposable Domain & Role-Based Classifier                       │
│ 11. Provider Signature Engine (Google, M365, Zoho, Fastmail, etc.)  │
│ 12. First-Party Bounce & Reputation Correlation                     │
│ 13. Deterministic Scoring & Multi-Layer Confidence Engine           │
└─────────────────────────────────────────────────────────────────────┘
```

For deeper architectural details, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 3. Technology Stack

* **Web & API Framework**: Next.js 15 (App Router), React 19, TypeScript 5.8 (Strict Mode)
* **Styling & UI**: Tailwind CSS, Lucide Icons, Custom dark-first graphite interface (`#0A0D12`)
* **ORM & Database**: Drizzle ORM, PostgreSQL 16 (production), `@electric-sql/pglite` (embedded local fallback)
* **Job Queue & Concurrency**: PostgreSQL transactional atomic queues (`FOR UPDATE SKIP LOCKED`) with domain rate limiting
* **Network & Sockets**: Node.js native `net`, `tls`, `dns/promises`, `crypto`
* **Data Processing**: Streaming `papaparse` (CSV), `xlsx` (Excel), TXT chunking
* **Testing & Quality**: Vitest (Unit & Integration), Playwright (E2E browser testing), in-process `FakeSmtpServer`

---

## 4. Quick Start: Docker Deployment (Recommended)

MailGuard includes a production-ready multi-stage Docker build and Docker Compose configuration.

### 1. Clone & Configure Environment

```bash
git clone https://github.com/Shezan-op/MailGuard.git
cd MailGuard
cp .env.example .env
```

### 2. Generate Admin Credentials & Configure `.env`

Generate your salted SHA-256 admin password hash:
```bash
npm run auth:hash YourSecurePasswordHere
```

Configure `.env`:
```env
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=<output_from_npm_run_auth_hash>
SESSION_SECRET=a_random_32_plus_character_secure_session_secret
HELO_DOMAIN=mail.yourdomain.com
VERIFICATION_FROM_ADDRESS=verify@yourdomain.com
DATABASE_URL=postgresql://mailguard:mailguard_secret_password@postgres:5432/mailguard
```

### 3. Launch with One Command

```bash
docker compose up -d --build
```

### 4. Access the Web Dashboard

Open your browser at `http://localhost:3000` and sign in with your configured admin email and password.

---

## 5. Local Development Setup (Native Node.js & PGlite)

MailGuard features an embedded zero-configuration database mode (`@electric-sql/pglite`) allowing immediate local execution without needing external database servers.

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Database Migrations & Seeds

```bash
npm run db:migrate
npm run db:seed
```

### 3. Start Next.js Development Server

```bash
npm run dev
```

### 4. Start Background Verification Worker

In a separate terminal:
```bash
npm run worker
```

---

## 6. CLI Verification & Operational Tooling

MailGuard ships with a comprehensive set of automated diagnostic, verification, and disaster recovery commands:

| Command | Purpose |
|---|---|
| `npm run doctor` | Comprehensive health check across App, Database, Worker, DNS, SMTP Port 25, and Storage. |
| `npm run system:verify` | Audits orphan records, counter drift, stale jobs, and missing settings. |
| `npm run auth:hash <pwd>` | Generates a cryptographically secure salted hash for your admin password. |
| `npm run db:backup` | Creates a point-in-time relational backup in `storage/backups/`. |
| `npm run db:restore <path>` | Restores complete relational database from a JSON backup snapshot. |
| `npm run test:disaster-recovery` | Executes an end-to-end automated recovery drill (Seed → Backup → Wipe → Restore → Verify). |
| `npm run test` | Runs the full Vitest suite (116 unit & integration tests across 16 test files). |
| `npm run test:e2e` | Runs Playwright browser end-to-end testing battery. |
| `npm run typecheck` | Validates strict TypeScript compilation (`tsc --noEmit`). |

### Headless Programmatic / Script Verification

You can verify lists directly from the command line without the web UI:

```bash
# Execute custom CLI verification scripts
npx tsx scripts/verify-schools.ts
```

Using the core engine in your own custom scripts:
```typescript
import { VerificationOrchestrator } from "./server/verification/orchestrator";

const result = await VerificationOrchestrator.verify("user@example.com", {
  persist: false,
  smtpTimeoutMs: 6000,
  dnsTimeoutMs: 4000,
});

console.log(result.finalStatus);  // "DELIVERABLE" | "UNDELIVERABLE" | "CATCH_ALL" | ...
console.log(result.riskScore);    // 0 to 100
console.log(result.confidence);   // "HIGH" | "MEDIUM" | "LOW"
```

---

## 7. Complete Environment Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Optional | `production` | Application runtime environment (`development` / `production` / `test`). |
| `APP_URL` | Yes | `http://localhost:3000` | Canonical URL of the application. |
| `DATABASE_URL` | Optional | *Empty (PGlite)* | PostgreSQL connection URL. If empty, runs embedded zero-config PGlite. |
| `PGLITE_DIR` | Optional | `./storage/db` | Storage path for embedded PGlite database files when `DATABASE_URL` is omitted. |
| `SESSION_SECRET` | **Yes** | — | Cryptographically random string (min 32 characters) for signing session cookies. |
| `ADMIN_EMAIL` | **Yes** | — | Single-tenant administrator login email address. |
| `ADMIN_PASSWORD_HASH` | **Yes** | — | Salted SHA-256 password hash generated via `npm run auth:hash <password>`. |
| `HELO_DOMAIN` | **Yes** | `mailguard.local` | FQDN sent during SMTP `HELO`/`EHLO` negotiation. Must have forward DNS in production. |
| `VERIFICATION_FROM_ADDRESS` | **Yes** | `verify@mailguard.local` | Return-path address sent in `MAIL FROM:<address>`. |
| `SMTP_TIMEOUT_MS` | Optional | `10000` | Socket timeout for individual SMTP commands in milliseconds. |
| `DNS_TIMEOUT_MS` | Optional | `5000` | Timeout for DNS resolution (MX, A, AAAA) in milliseconds. |
| `MAX_GLOBAL_CONCURRENCY` | Optional | `10` | Maximum simultaneous outbound verification threads across the engine. |
| `MAX_DOMAIN_CONCURRENCY` | Optional | `2` | Maximum concurrent connections to a single recipient domain to prevent throttling. |
| `MAX_RETRIES` | Optional | `3` | Maximum automatic retries for transient greylisting (`4xx`) responses. |
| `RETRY_DELAY_MS` | Optional | `5000` | Initial delay before retrying greylisted addresses in milliseconds. |
| `RETRY_BACKOFF_MULTIPLIER`| Optional | `2` | Exponential backoff multiplier for subsequent retry attempts. |
| `CACHE_TTL_HOURS` | Optional | `24` | Cache lifespan in hours for individual email verification results. |
| `DOMAIN_CACHE_TTL_HOURS` | Optional | `24` | Cache lifespan in hours for domain-level intelligence (MX, catch-all status). |
| `CONSERVATIVE_MODE` | Optional | `true` | Adds defensive inter-probe pacing to protect verifier IP reputation. |
| `ALLOW_PRIVATE_IPS` | Optional | `false` | **SSRF Guard Override.** MUST remain `false` in production. Only enable for local test suites with fake mock SMTP servers. |

---

## 8. REST API Specification

All endpoints communicate via authenticated JSON. Authentication uses an `HttpOnly` HMAC session cookie created upon login.

### Single Email Verification
`POST /api/verify`
```json
// Request
{
  "email": "sarah@company.com",
  "forceReverify": false,
  "conservativeMode": true
}

// Response
{
  "email": "sarah@company.com",
  "domain": "company.com",
  "finalStatus": "DELIVERABLE",
  "riskScore": 5,
  "confidence": "HIGH",
  "reason": "Recipient mailbox explicitly confirmed via SMTP RCPT TO",
  "isCatchAll": false,
  "isRoleBased": false,
  "isDisposable": false,
  "dns": {
    "domainExists": true,
    "hasMx": true,
    "primaryMx": "mail.company.com",
    "allMx": ["mail.company.com"]
  },
  "smtp": {
    "status": "ACCEPTED",
    "code": 250,
    "response": "250 2.1.5 Recipient OK"
  },
  "transcript": "[CONNECT] mail.company.com:25\n[RECEIVE] 220 mail.company.com ESMTP\n[SEND] EHLO mailguard.local\n[RECEIVE] 250-STARTTLS\n[SEND] MAIL FROM:<verify@mailguard.local>\n[RECEIVE] 250 2.1.0 Sender OK\n[SEND] RCPT TO:<sarah@company.com>\n[RECEIVE] 250 2.1.5 Recipient OK\n[SEND] QUIT"
}
```

### Bulk Job Creation
`POST /api/verify/bulk`
```json
// Request
{
  "name": "October Lead List",
  "emails": ["user1@domain.com", "user2@domain.com"],
  "mode": "standard"
}

// Response
{
  "jobId": "c0a80123-7b12-4c91-a1b2-9d8e7f6a5b4c",
  "name": "October Lead List",
  "totalCount": 2,
  "status": "queued"
}
```

### Job Management Endpoints
- `GET /api/jobs`: List verification jobs with progress and status counters.
- `GET /api/jobs/:id`: Retrieve detailed job metrics and progress.
- `POST /api/jobs/:id/pause`: Pause an active verification run.
- `POST /api/jobs/:id/resume`: Resume a paused verification job.
- `POST /api/jobs/:id/cancel`: Terminate pending verification tasks.
- `POST /api/jobs/:id/retry`: Re-queue failed or transiently deferred addresses.

### Export & Ledger Endpoints
- `GET /api/emails`: Query verified email ledger with filtering by status, search, and risk threshold.
- `GET /api/emails/:id`: Retrieve full verification record including audit transcripts.
- `POST /api/emails/:id/reverify`: Force immediate re-verification of a specific address.
- `GET /api/exports`: List available CSV/Excel export files.
- `GET /api/exports/:id`: Download generated export dataset.
- `GET /api/domains/:domain`: Domain deliverability profile and MX inspection.
- `GET /api/suppressions` & `POST /api/suppressions`: View and manage the suppression list.
- `POST /api/history/import`: Ingest ESP campaign bounce reports for historical correlation.
- `GET /api/system/health`: Live queue depth, worker heartbeats, and database status.
- `POST /api/system/diagnostic`: Test live outbound port 25, DNS, and MX connectivity.

---

## 9. Real-World SMTP Constraints & Network Realities

To maintain honest, dependable deliverability intelligence, operators should understand the fundamental mechanics of internet mail transport:

### A. Outbound TCP Port 25 Firewall Rules
* Standard residential Internet Service Providers (ISPs) and mainstream cloud platforms (standard AWS EC2, DigitalOcean, Hetzner, GCP) block outbound TCP port 25 by default to combat spam abuse.
* **Requirement**: For live SMTP verification, host MailGuard on a cloud instance with port 25 unblocked (request an unblock ticket from your VPS provider or use providers like OVH or Linode that permit legitimate port 25 traffic).
* Use MailGuard's built-in diagnostic tool (`npm run doctor` or the Web UI `/system` page) to instantly test your server's outbound port 25 connectivity.

### B. Catch-All Domains
* Many enterprise domains configure catch-all mail handling, accepting any arbitrary recipient address during `RCPT TO`.
* MailGuard probes each domain with a synthetic non-existent address (`__mg_catchall_<random32>@domain`). When catch-all is detected, the status is reported as `CATCH_ALL` with `MEDIUM` confidence. No tool on the internet can guarantee mailbox existence on catch-all domains through SMTP alone.

### C. Greylisting (4xx Codes)
* Defensive MTAs defer initial connection attempts with `450` or `451` temporary rejection codes. MailGuard automatically reschedules these addresses using exponential backoff retries. If deferred after maximum retries, the address is accurately labeled `TEMPORARY`, never falsely marked as `UNDELIVERABLE`.

---

## 10. Security & Privacy Guarantees

* **Strict SSRF Guard**: Prevents verifier probes against `127.0.0.1`, RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), AWS/cloud metadata services (`169.254.169.254`), and CGNAT ranges.
* **Zero Mail Transmission**: Socket interactions are strictly terminated with `QUIT` after interpreting `RCPT TO`. The `DATA` command is **never** transmitted under any circumstance.
* **Memory & Buffer Caps**: Outbound socket buffers enforce an unyielding 64KB response ceiling and bounded 2,000-character audit log storage to eliminate buffer overflow attacks.
* **100% First-Party Data**: Verification never touches third-party commercial APIs. Your email lists, customer contact data, and verification results remain entirely within your private infrastructure.

---

## 11. Documentation & Engineering Runbooks

MailGuard includes an exhaustive library of operational runbooks and engineering specifications:

| Guide | Description |
|---|---|
| [OPERATIONS.md](OPERATIONS.md) | Production runbook: service management, monitoring, secret rotation, dataset updates, incident response. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Complete architectural specifications, pipeline state machines, concurrency controls, and ER diagrams. |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Hardening audit report detailing all 14 resolved defects, benchmarks, and regression tests. |
| [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) | Backup procedures, point-in-time recovery, failover steps, and automated recovery drill instructions. |
| [PRODUCTION_FAILURE_REGISTER.md](PRODUCTION_FAILURE_REGISTER.md) | Catalog of 12 real-world SMTP/network failure scenarios and their defensive mitigations. |
| [TEST_MATRIX.md](TEST_MATRIX.md) | Test coverage matrix across 116 Vitest unit/integration tests and Playwright E2E browser tests. |
| [UPGRADE_GUIDE.md](UPGRADE_GUIDE.md) | Supported runtime matrix, upgrade sequence, and forward-recovery database migration policies. |

---

## 12. License

Private / Proprietary. Built for high-volume self-hosted email deliverability operations.
