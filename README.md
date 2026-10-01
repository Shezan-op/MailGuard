# MAILGUARD

> **Private, Self-Hosted Email Verification & Deliverability Intelligence Engine**

MailGuard is a production-grade, self-hosted email verification platform built for high-volume email operations. It deterministically validates syntax, resolves DNS and MX records, detects synthetic catch-all configurations, identifies disposable domains and role accounts, directly negotiates recipient SMTP validation (`MAIL FROM` / `RCPT TO` without ever sending `DATA`), maintains first-party bounce intelligence, and scores deliverability risk (0–100) — entirely on your own infrastructure.

**No paid APIs (ZeroBounce, NeverBounce, Hunter, etc.). No external API keys. No AI/LLM dependencies. Zero third-party telemetry.**

---

## 1. Core Verification Philosophy: Probabilistic Truth

Traditional email verification tools present a simplistic binary choice: `VALID` or `INVALID`. In real-world internet mail transport, this binary representation is fundamentally false:
* Receiving mail servers deliberately employ **greylisting** (450/451) to defer unknown senders.
* Many corporate servers configure **catch-all acceptance** to prevent directory harvesting attacks.
* Spam filters (Proofpoint, Mimecast, Spamhaus) block verifier connection attempts (554/571).
* Mailbox quotas or temporary maintenance windows trigger transient rejections.

**MailGuard never claims certainty where SMTP cannot provide certainty.** Instead of a naive binary output, MailGuard classifies addresses into 8 deterministic operational statuses:

1. **`DELIVERABLE`**: Address passed RFC syntax, domain resolves, active MX hosts exist, and the mailbox was explicitly confirmed by the recipient server during `RCPT TO` (and the domain is verified not to be a catch-all).
2. **`UNDELIVERABLE`**: Address has invalid RFC syntax, non-existent domain (NXDOMAIN), RFC 7505 Null MX record, is on an active suppression list, or was permanently rejected by the recipient server (`550 User unknown`).
3. **`RISKY`**: Address was accepted or deferred, but exhibits elevated risk signals (e.g. historical hard bounce recorded from a previous campaign, or connection blocked by receiving security filter).
4. **`CATCH_ALL`**: Receiving server accepts all synthetic, randomly generated recipient addresses. Individual mailbox existence cannot be confirmed via SMTP alone.
5. **`DISPOSABLE`**: Domain matches a verified database of temporary/throwaway email providers.
6. **`ROLE_BASED`**: Generic functional mailbox (`support@`, `sales@`, `billing@`, `admin@`) rather than an individual.
7. **`TEMPORARY`**: Server returned a transient 4xx code (greylisting, connection throttling, server busy). Eligible for automated backoff retries.
8. **`UNKNOWN`**: Insufficient or inconclusive evidence to classify the mailbox.

Every result provides an exact **Risk Score (0–100)**, **Confidence Level (HIGH/MEDIUM/LOW)**, human-readable **reason**, and complete **SMTP transcript audit logs**.

---

## 2. Technical Architecture

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
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌─────────────────────────────┐         ┌─────────────────────────────┐
│    PostgreSQL 16 / PGlite   │         │    Postgres-Backed Queue    │
│  (Drizzle ORM + Migrations) │◄────────┤     (Atomic Concurrency)    │
└──────────────▲──────────────┘         └──────────────┬──────────────┘
               │                                       │ Job Dispatch
┌──────────────┴───────────────────────────────────────▼──────────────┐
│                  Verification & Worker Pipeline                     │
│                                                                     │
│  1. Normalization & Punycode (RFC 5321 / RFC 6531)                  │
│  2. RFC-Aware Syntax Parsing (Zero fragile mega-regex)              │
│  3. Levenshtein Typo Detection (Gmail, Outlook, Yahoo, etc.)        │
│  4. SSRF Guard (Strict RFC 1918 / Loopback / CGNAT block)           │
│  5. Node.js DNS Resolver (A, AAAA, MX records, RFC 7505 Null MX)    │
│  6. Domain Intelligence & MX Priority Sorter                        │
│  7. Node.js `net` & `tls` Socket Client (Raw SMTP sequence)         │
│     - 220 Greeting Banner Verification                              │
│     - EHLO / HELO Capability Negotiation                            │
│     - Opportunistic STARTTLS Handshake                              │
│     - MAIL FROM:<verify@configured-domain>                          │
│     - RCPT TO:<target@recipient-domain>                             │
│     - NEVER EXECUTES DATA (Zero emails sent)                        │
│     - Bounded 2000-char sanitized transcript capture                │
│  8. Synthetic Catch-All Probe (__mg_catchall_<hex32>@domain)        │
│  9. Disposable Domain & Role-Based Classifier                       │
│ 10. Provider Signature Engine (Google, M365, Zoho, Fastmail, etc.)  │
│ 11. First-Party Bounce & Reputation Correlation                     │
│ 12. Deterministic Scoring & Multi-Layer Confidence Engine           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

* **Web & API Framework**: Next.js 15 (App Router), React 19, TypeScript (Strict Mode)
* **Styling & UI**: Tailwind CSS, Lucide Icons, Custom dark-first graphite theme (`#0A0D12`)
* **ORM & Database**: Drizzle ORM, PostgreSQL 16 (production), `@electric-sql/pglite` (embedded local fallback)
* **Job Queue & Concurrency**: PostgreSQL atomic transactional queues with domain rate-limiting
* **Network & Sockets**: Node.js built-in `net`, `tls`, `dns/promises`, `crypto`
* **Data Processing**: Streaming `papaparse` (CSV), `xlsx` (Excel), TXT chunking
* **Testing**: Vitest (Unit & Integration), `@playwright/test` (End-to-End browser tests), In-Process `FakeSmtpServer`

---

## 4. Quick Start: Docker Deployment (Recommended)

MailGuard includes a production-ready multi-stage Docker build and Docker Compose configuration.

### 1. Clone & Configure Environment
```bash
git clone https://github.com/your-org/mailguard.git
cd mailguard
cp .env.example .env
```

Edit `.env` to configure your admin credentials and verification domain:
```env
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=<generated-hash>
SESSION_SECRET=generate-a-secure-random-string-at-least-32-characters
HELO_DOMAIN=mail.yourdomain.com
VERIFICATION_FROM_ADDRESS=verify@yourdomain.com
```

> **Generating an Admin Password Hash:**
> Run `npm run auth:hash <YourPassword>` to generate the secure salted password hash for your `.env` file.

### 2. Launch with One Command
```bash
docker compose up -d --build
```

### 3. Access the Application
Open your browser at:
```
http://localhost:3000
```
Sign in with your configured admin credentials.

---

## 5. Local Development Setup (Without Docker)

MailGuard features an embedded zero-configuration database mode (`@electric-sql/pglite`) allowing immediate local execution without installing external database software.

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

## 6. Verification Pipeline: Layer by Layer

```text
Input Address
     │
     ▼
[ 1. Normalization & Punycode ] ──> Trim whitespace, lowercase domain, preserve original
     │
     ▼
[ 2. Syntax Validation ] ─────────> RFC 5321/5322 length (64 local / 254 total), labels, quotes
     │ (If FAIL ──> UNDELIVERABLE)
     ▼
[ 3. Typo Detection ] ────────────> Levenshtein distance check against major webmail providers
     │
     ▼
[ 4. Suppression Registry ] ──────> Local blacklist check for previous hard bounces / complaints
     │ (If Suppressed ──> UNDELIVERABLE)
     ▼
[ 5. DNS Resolution ] ────────────> Resolve MX records; RFC 7505 Null MX check; A/AAAA fallback
     │ (If NXDOMAIN or Null MX ──> UNDELIVERABLE)
     ▼
[ 6. Domain Intelligence Cache ] ─> Reuse cached MX, provider, and catch-all results
     │
     ▼
[ 7. SSRF Protection Guard ] ─────> Validate MX IP: Blocks RFC 1918, 127.0.0.1, 169.254.169.254, IPv6 local
     │
     ▼
[ 8. SMTP Recipient Probing ] ────> Raw socket connection, greeting, EHLO, STARTTLS, MAIL FROM, RCPT TO
     │ (NEVER issues DATA; socket closed with QUIT)
     ▼
[ 9. Synthetic Catch-All Check ] ─> Probe __mg_catchall_<random32>@domain. If accepted ──> CATCH_ALL
     │
     ▼
[ 10. Disposable & Role Check ] ──> Match against vendored disposable domains and functional prefixes
     │
     ▼
[ 11. Historical Correlation ] ───> Query first-party campaign events for past delivery/bounce records
     │
     ▼
[ 12. Scoring & Classification ] ─> Weighted risk calculation (0-100), confidence level, and verdict
```

---

## 7. Operational Limitations & SMTP Realities

To maintain honest, dependable intelligence, users must understand the natural constraints of internet mail protocols:

### A. SMTP Verification is Inherently Probabilistic
* **Greylisting**: Some mail servers defer verification attempts with a `450` or `451` code upon first contact. MailGuard retries with exponential backoff, but if retries are exhausted, the status remains `TEMPORARY` or `UNKNOWN`. It is never converted falsely to `UNDELIVERABLE`.
* **Catch-All Ambiguity**: A domain configured with catch-all accepts any arbitrary address. MailGuard detects this behavior via synthetic random probing and classifies the result as `CATCH_ALL` (Medium Confidence). No verification engine on earth can confirm mailbox existence on catch-all domains through SMTP alone.
* **False Positives on Inactive Accounts**: Certain mail hosts accept all recipients during `RCPT TO` and only bounce non-existent mailboxes later asynchronously via DSN (Delivery Status Notification). MailGuard tracks these asynchronously via the **Campaign Bounce Importer**.

### B. Outbound Port 25 Network Firewall Constraints
* Many residential Internet Service Providers (ISPs) and cloud providers (e.g., standard AWS EC2 instances, DigitalOcean droplets, Hetzner, Google Cloud Platform) block outbound TCP port 25 by default to combat spam.
* **Requirement**: To perform live SMTP verification, the server hosting MailGuard must have outbound TCP port 25 traffic unblocked by the cloud hosting provider.
* Use MailGuard's built-in diagnostic tool at `/system` to run an immediate port 25 connectivity check.

### C. Spam Traps
* Anyone claiming to detect 100% of spam traps using automated algorithms is being dishonest. Spam traps (both pristine and recycled) are legitimate, syntactically valid mailboxes that accept incoming mail.
* MailGuard supports a local **Suppression List** to store and share known traps, hard bounces, and complaint addresses.

---

## 8. Command-Line Scripts & Tooling

```bash
# Start Next.js development server
npm run dev

# Run TypeScript strict type-checking
npm run typecheck

# Execute Vitest unit and integration test suites
npm run test

# Run Playwright end-to-end browser tests
npm run test:e2e

# Run production Next.js build
npm run build

# Start production Next.js web server
npm run start

# Start the background verification queue worker
npm run worker

# Start the maintenance cleanup daemon (temp file prune & job recovery)
npm run maintenance

# Apply database schema migrations
npm run db:migrate

# Seed baseline intelligence (role prefixes, free providers, disposable list)
npm run db:seed

# Reset and re-migrate database
npm run db:reset

# Create a structured timestamped database backup
npm run db:backup
```

---

## 9. API Reference

All API routes return consistent JSON payloads:

### Single Verification
* `POST /api/verify`
  * Body: `{ "email": "john@company.com", "forceReverify": false, "conservativeMode": true }`
  * Returns complete `VerificationResult` including syntax, DNS, SMTP status, risk score, and protocol logs.

### Bulk Verification
* `POST /api/verify/bulk`
  * Body: `{ "name": "Q4 Campaign", "emails": ["user1@domain.com", "user2@domain.com"], "mode": "standard" }`
  * Returns created job details: `{ "jobId": "job-...", "totalCount": 2, "status": "running" }`

### Job Management
* `GET /api/jobs`: List verification jobs with progress and counters.
* `GET /api/jobs/:id`: Job details, metrics, and completion percentage.
* `POST /api/jobs/:id/pause`: Pause active processing.
* `POST /api/jobs/:id/resume`: Resume paused job.
* `POST /api/jobs/:id/cancel`: Cancel job and terminate pending tasks.
* `POST /api/jobs/:id/retry`: Re-queue failed or temporary addresses.

### Ledger & Data Management
* `GET /api/emails`: Query verified addresses with search, risk range, and status filters.
* `GET /api/domains/:domain`: Domain-level health, MX inspection, and historical deliverability rate.
* `GET /api/suppressions`: List active suppressions.
* `POST /api/suppressions`: Add email or domain suppression.
* `POST /api/history/import`: Import campaign delivery and bounce CSV reports.
* `GET /api/system/health`: System status, queue depth, and worker health.
* `POST /api/system/diagnostic`: Test live outbound DNS, MX, and SMTP socket connectivity.

---

## 10. Security & Privacy

* **Strict SSRF Guard**: Prohibits SMTP probes against `127.0.0.1`, RFC 1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), AWS/cloud metadata (`169.254.169.254`), carrier-grade NAT, and IPv6 unique-local targets.
* **Never Sends Message DATA**: Sockets are strictly closed after `RCPT TO` interpretation using the standard `QUIT` sequence.
* **Single-Admin Authentication**: Protected with secure HTTP-only cookies, Web Crypto HMAC SHA-256 signatures, and login rate limiting.
* **Data Privacy**: No third-party network requests are ever made during verification. All intelligence remains local to your database.

---

## License
Private / Proprietary. For internal organizational email deliverability operations.
