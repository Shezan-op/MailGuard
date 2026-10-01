import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const verificationJobs = pgTable(
  "verification_jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull(), // csv, xlsx, txt, paste
    sourceFilename: text("source_filename"),
    totalCount: integer("total_count").default(0).notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    pendingCount: integer("pending_count").default(0).notNull(),
    deliverableCount: integer("deliverable_count").default(0).notNull(),
    undeliverableCount: integer("undeliverable_count").default(0).notNull(),
    riskyCount: integer("risky_count").default(0).notNull(),
    catchAllCount: integer("catch_all_count").default(0).notNull(),
    disposableCount: integer("disposable_count").default(0).notNull(),
    roleBasedCount: integer("role_based_count").default(0).notNull(),
    temporaryCount: integer("temporary_count").default(0).notNull(),
    unknownCount: integer("unknown_count").default(0).notNull(),
    status: text("status").default("queued").notNull(), // queued, running, paused, completed, cancelled, failed
    progressPercentage: integer("progress_percentage").default(0).notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_created_at_idx").on(table.createdAt),
  ]
);

export const emails = pgTable(
  "emails",
  {
    id: text("id").primaryKey(),
    normalizedEmail: text("normalized_email").notNull(),
    originalEmail: text("original_email").notNull(),
    localPart: text("local_part").notNull(),
    domain: text("domain").notNull(),
    normalizedDomain: text("normalized_domain").notNull(),

    syntaxStatus: text("syntax_status").default("PASS"),
    syntaxReason: text("syntax_reason"),

    suggestedEmail: text("suggested_email"),
    typoDetected: boolean("typo_detected").default(false).notNull(),

    domainExists: boolean("domain_exists").default(true).notNull(),
    dnsStatus: text("dns_status").default("PASS"),

    mxStatus: text("mx_status"),
    mxHost: text("mx_host"),
    mxPriority: integer("mx_priority"),

    smtpStatus: text("smtp_status"),
    smtpCode: integer("smtp_code"),
    smtpResponse: text("smtp_response"),
    smtpStage: text("smtp_stage"),

    catchAllStatus: boolean("catch_all_status").default(false).notNull(),
    disposableStatus: boolean("disposable_status").default(false).notNull(),
    roleBasedStatus: boolean("role_based_status").default(false).notNull(),
    freeProviderStatus: boolean("free_provider_status").default(false).notNull(),

    providerName: text("provider_name").default("Unknown").notNull(),

    finalStatus: text("final_status").default("UNKNOWN").notNull(), // DELIVERABLE, UNDELIVERABLE, RISKY, etc.
    riskScore: integer("risk_score").default(50).notNull(),
    confidence: text("confidence").default("LOW").notNull(), // HIGH, MEDIUM, LOW
    classificationReason: text("classification_reason"),

    firstVerifiedAt: timestamp("first_verified_at").defaultNow().notNull(),
    lastVerifiedAt: timestamp("last_verified_at").defaultNow().notNull(),
    verificationCount: integer("verification_count").default(1).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("emails_normalized_email_unique").on(table.normalizedEmail),
    index("emails_domain_idx").on(table.domain),
    index("emails_final_status_idx").on(table.finalStatus),
    index("emails_risk_score_idx").on(table.riskScore),
    index("emails_last_verified_idx").on(table.lastVerifiedAt),
  ]
);

export const verificationRuns = pgTable(
  "verification_runs",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id").notNull(),
    jobId: text("job_id"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at").defaultNow().notNull(),

    syntaxResult: jsonb("syntax_result"),
    dnsResult: jsonb("dns_result"),
    mxResult: jsonb("mx_result"),
    smtpResult: jsonb("smtp_result"),
    catchAllResult: jsonb("catch_all_result"),
    disposableResult: boolean("disposable_result"),
    roleResult: boolean("role_result"),
    providerResult: text("provider_result"),

    smtpCode: integer("smtp_code"),
    smtpResponse: text("smtp_response"),
    smtpLatencyMs: integer("smtp_latency_ms"),

    retryCount: integer("retry_count").default(0).notNull(),

    finalStatus: text("final_status").notNull(),
    riskScore: integer("risk_score").notNull(),
    confidence: text("confidence").notNull(),
    reason: text("reason"),

    engineVersion: text("engine_version").default("1.0.0").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("runs_email_id_idx").on(table.emailId),
    index("runs_job_id_idx").on(table.jobId),
    index("runs_created_at_idx").on(table.createdAt),
  ]
);

export const domains = pgTable(
  "domains",
  {
    id: text("id").primaryKey(),
    domain: text("domain").notNull(),
    normalizedDomain: text("normalized_domain").notNull(),

    exists: boolean("exists").default(true).notNull(),
    dnsStatus: text("dns_status").default("PASS"),

    mxPresent: boolean("mx_present").default(false).notNull(),
    mxRecordsJson: jsonb("mx_records_json"),

    primaryMx: text("primary_mx"),
    provider: text("provider").default("Unknown").notNull(),

    isFreeProvider: boolean("is_free_provider").default(false).notNull(),
    isDisposable: boolean("is_disposable").default(false).notNull(),

    isCatchAll: boolean("is_catch_all").default(false).notNull(),
    catchAllConfidence: text("catch_all_confidence").default("LOW").notNull(),

    lastSmtpCheck: timestamp("last_smtp_check"),
    lastDnsCheck: timestamp("last_dns_check"),

    smtpPolicy: text("smtp_policy"),
    supportsStarttls: boolean("supports_starttls").default(false).notNull(),

    averageSmtpLatency: integer("average_smtp_latency").default(0).notNull(),

    verificationCount: integer("verification_count").default(0).notNull(),
    deliverableCount: integer("deliverable_count").default(0).notNull(),
    undeliverableCount: integer("undeliverable_count").default(0).notNull(),
    temporaryCount: integer("temporary_count").default(0).notNull(),
    unknownCount: integer("unknown_count").default(0).notNull(),

    historicalBounceRate: integer("historical_bounce_rate").default(0).notNull(), // Basis points (e.g. 180 = 1.8%)
    historicalDeliverabilityRate: integer("historical_deliverability_rate").default(10000).notNull(), // Basis points (10000 = 100%)

    riskScore: integer("risk_score").default(0).notNull(),
    confidence: text("confidence").default("LOW").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("domains_domain_unique").on(table.domain),
    index("domains_provider_idx").on(table.provider),
    index("domains_risk_score_idx").on(table.riskScore),
  ]
);

export const smtpEvents = pgTable(
  "smtp_events",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id"),
    domainId: text("domain_id"),
    mxHost: text("mx_host"),
    connectionIp: text("connection_ip"),
    port: integer("port").default(25).notNull(),
    tlsUsed: boolean("tls_used").default(false).notNull(),

    ehloResult: text("ehlo_result"),
    mailFromResult: text("mail_from_result"),
    rcptToResult: text("rcpt_to_result"),

    smtpCode: integer("smtp_code"),
    smtpResponse: text("smtp_response"),

    latencyMs: integer("latency_ms"),
    failureType: text("failure_type"),
    retryable: boolean("retryable").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("smtp_events_email_idx").on(table.emailId),
    index("smtp_events_domain_idx").on(table.domainId),
  ]
);

export const suppressions = pgTable(
  "suppressions",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    domain: text("domain"),
    type: text("type").notNull(), // hard_bounce, spam_complaint, manual, known_bad, known_trap, unsubscribe, other
    reason: text("reason"),
    source: text("source").default("manual").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("suppressions_email_idx").on(table.email),
    index("suppressions_domain_idx").on(table.domain),
    index("suppressions_type_idx").on(table.type),
  ]
);

export const deliveryEvents = pgTable(
  "delivery_events",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id"),
    email: text("email").notNull(),
    eventType: text("event_type").notNull(), // delivered, hard_bounce, soft_bounce, blocked, deferred, complaint, unsubscribe, unknown
    source: text("source").default("import").notNull(),
    campaignName: text("campaign_name"),
    smtpCode: integer("smtp_code"),
    smtpResponse: text("smtp_response"),
    eventDate: timestamp("event_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("delivery_events_email_idx").on(table.email),
    index("delivery_events_type_idx").on(table.eventType),
  ]
);

export const disposableDomains = pgTable(
  "disposable_domains",
  {
    domain: text("domain").primaryKey(),
    source: text("source").default("seed").notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    active: boolean("active").default(true).notNull(),
  },
  (table) => [
    index("disposable_domains_active_idx").on(table.active),
  ]
);

export const settings = pgTable(
  "settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

export const dataVersions = pgTable(
  "data_versions",
  {
    dataset: text("dataset").primaryKey(),
    version: text("version").notNull(),
    source: text("source").notNull(),
    recordCount: integer("record_count").default(0).notNull(),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
  }
);
