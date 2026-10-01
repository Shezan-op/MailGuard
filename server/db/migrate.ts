import { getDb } from "./index";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  const db = getDb();
  console.log("[MailGuard] Running database migrations...");

  const migrationQueries = [
    `CREATE TABLE IF NOT EXISTS verification_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_filename TEXT,
      total_count INTEGER DEFAULT 0 NOT NULL,
      processed_count INTEGER DEFAULT 0 NOT NULL,
      pending_count INTEGER DEFAULT 0 NOT NULL,
      deliverable_count INTEGER DEFAULT 0 NOT NULL,
      undeliverable_count INTEGER DEFAULT 0 NOT NULL,
      risky_count INTEGER DEFAULT 0 NOT NULL,
      catch_all_count INTEGER DEFAULT 0 NOT NULL,
      disposable_count INTEGER DEFAULT 0 NOT NULL,
      role_based_count INTEGER DEFAULT 0 NOT NULL,
      temporary_count INTEGER DEFAULT 0 NOT NULL,
      unknown_count INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'queued' NOT NULL,
      progress_percentage INTEGER DEFAULT 0 NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS jobs_status_idx ON verification_jobs(status);`,
    `CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON verification_jobs(created_at);`,

    `CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      normalized_email TEXT NOT NULL,
      original_email TEXT NOT NULL,
      local_part TEXT NOT NULL,
      domain TEXT NOT NULL,
      normalized_domain TEXT NOT NULL,
      syntax_status TEXT DEFAULT 'PASS',
      syntax_reason TEXT,
      suggested_email TEXT,
      typo_detected BOOLEAN DEFAULT FALSE NOT NULL,
      domain_exists BOOLEAN DEFAULT TRUE NOT NULL,
      dns_status TEXT DEFAULT 'PASS',
      mx_status TEXT,
      mx_host TEXT,
      mx_priority INTEGER,
      smtp_status TEXT,
      smtp_code INTEGER,
      smtp_response TEXT,
      smtp_stage TEXT,
      catch_all_status BOOLEAN DEFAULT FALSE NOT NULL,
      disposable_status BOOLEAN DEFAULT FALSE NOT NULL,
      role_based_status BOOLEAN DEFAULT FALSE NOT NULL,
      free_provider_status BOOLEAN DEFAULT FALSE NOT NULL,
      provider_name TEXT DEFAULT 'Unknown' NOT NULL,
      final_status TEXT DEFAULT 'UNKNOWN' NOT NULL,
      risk_score INTEGER DEFAULT 50 NOT NULL,
      confidence TEXT DEFAULT 'LOW' NOT NULL,
      classification_reason TEXT,
      first_verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      last_verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      verification_count INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS emails_normalized_email_unique ON emails(normalized_email);`,
    `CREATE INDEX IF NOT EXISTS emails_domain_idx ON emails(domain);`,
    `CREATE INDEX IF NOT EXISTS emails_final_status_idx ON emails(final_status);`,
    `CREATE INDEX IF NOT EXISTS emails_risk_score_idx ON emails(risk_score);`,
    `CREATE INDEX IF NOT EXISTS emails_last_verified_idx ON emails(last_verified_at);`,

    `CREATE TABLE IF NOT EXISTS verification_runs (
      id TEXT PRIMARY KEY,
      email_id TEXT NOT NULL,
      job_id TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      syntax_result JSONB,
      dns_result JSONB,
      mx_result JSONB,
      smtp_result JSONB,
      catch_all_result JSONB,
      disposable_result BOOLEAN,
      role_result BOOLEAN,
      provider_result TEXT,
      smtp_code INTEGER,
      smtp_response TEXT,
      smtp_latency_ms INTEGER,
      retry_count INTEGER DEFAULT 0 NOT NULL,
      final_status TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      confidence TEXT NOT NULL,
      reason TEXT,
      engine_version TEXT DEFAULT '1.0.0' NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS runs_email_id_idx ON verification_runs(email_id);`,
    `CREATE INDEX IF NOT EXISTS runs_job_id_idx ON verification_runs(job_id);`,
    `CREATE INDEX IF NOT EXISTS runs_created_at_idx ON verification_runs(created_at);`,

    `CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      normalized_domain TEXT NOT NULL,
      exists BOOLEAN DEFAULT TRUE NOT NULL,
      dns_status TEXT DEFAULT 'PASS',
      mx_present BOOLEAN DEFAULT FALSE NOT NULL,
      mx_records_json JSONB,
      primary_mx TEXT,
      provider TEXT DEFAULT 'Unknown' NOT NULL,
      is_free_provider BOOLEAN DEFAULT FALSE NOT NULL,
      is_disposable BOOLEAN DEFAULT FALSE NOT NULL,
      is_catch_all BOOLEAN DEFAULT FALSE NOT NULL,
      catch_all_confidence TEXT DEFAULT 'LOW' NOT NULL,
      last_smtp_check TIMESTAMP,
      last_dns_check TIMESTAMP,
      smtp_policy TEXT,
      supports_starttls BOOLEAN DEFAULT FALSE NOT NULL,
      average_smtp_latency INTEGER DEFAULT 0 NOT NULL,
      verification_count INTEGER DEFAULT 0 NOT NULL,
      deliverable_count INTEGER DEFAULT 0 NOT NULL,
      undeliverable_count INTEGER DEFAULT 0 NOT NULL,
      temporary_count INTEGER DEFAULT 0 NOT NULL,
      unknown_count INTEGER DEFAULT 0 NOT NULL,
      historical_bounce_rate INTEGER DEFAULT 0 NOT NULL,
      historical_deliverability_rate INTEGER DEFAULT 10000 NOT NULL,
      risk_score INTEGER DEFAULT 0 NOT NULL,
      confidence TEXT DEFAULT 'LOW' NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS domains_domain_unique ON domains(domain);`,
    `CREATE INDEX IF NOT EXISTS domains_provider_idx ON domains(provider);`,
    `CREATE INDEX IF NOT EXISTS domains_risk_score_idx ON domains(risk_score);`,

    `CREATE TABLE IF NOT EXISTS smtp_events (
      id TEXT PRIMARY KEY,
      email_id TEXT,
      domain_id TEXT,
      mx_host TEXT,
      connection_ip TEXT,
      port INTEGER DEFAULT 25 NOT NULL,
      tls_used BOOLEAN DEFAULT FALSE NOT NULL,
      ehlo_result TEXT,
      mail_from_result TEXT,
      rcpt_to_result TEXT,
      smtp_code INTEGER,
      smtp_response TEXT,
      latency_ms INTEGER,
      failure_type TEXT,
      retryable BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS smtp_events_email_idx ON smtp_events(email_id);`,
    `CREATE INDEX IF NOT EXISTS smtp_events_domain_idx ON smtp_events(domain_id);`,

    `CREATE TABLE IF NOT EXISTS suppressions (
      id TEXT PRIMARY KEY,
      email TEXT,
      domain TEXT,
      type TEXT NOT NULL,
      reason TEXT,
      source TEXT DEFAULT 'manual' NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS suppressions_email_idx ON suppressions(email);`,
    `CREATE INDEX IF NOT EXISTS suppressions_domain_idx ON suppressions(domain);`,
    `CREATE INDEX IF NOT EXISTS suppressions_type_idx ON suppressions(type);`,

    `CREATE TABLE IF NOT EXISTS delivery_events (
      id TEXT PRIMARY KEY,
      email_id TEXT,
      email TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source TEXT DEFAULT 'import' NOT NULL,
      campaign_name TEXT,
      smtp_code INTEGER,
      smtp_response TEXT,
      event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS delivery_events_email_idx ON delivery_events(email);`,
    `CREATE INDEX IF NOT EXISTS delivery_events_type_idx ON delivery_events(event_type);`,

    `CREATE TABLE IF NOT EXISTS disposable_domains (
      domain TEXT PRIMARY KEY,
      source TEXT DEFAULT 'seed' NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      active BOOLEAN DEFAULT TRUE NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS disposable_domains_active_idx ON disposable_domains(active);`,

    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);`,
    `CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);`,

    `CREATE TABLE IF NOT EXISTS data_versions (
      dataset TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      source TEXT NOT NULL,
      record_count INTEGER DEFAULT 0 NOT NULL,
      imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );`
  ];

  for (const query of migrationQueries) {
    await db.execute(sql.raw(query));
  }

  console.log("[MailGuard] Database migrations completed successfully.");
}

// Allow direct execution
if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => {
      console.log("[MailGuard] Migration finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[MailGuard] Migration failed:", err);
      process.exit(1);
    });
}
