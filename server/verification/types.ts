export type VerificationStatus =
  | "DELIVERABLE"
  | "UNDELIVERABLE"
  | "RISKY"
  | "CATCH_ALL"
  | "DISPOSABLE"
  | "ROLE_BASED"
  | "TEMPORARY"
  | "UNKNOWN";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type SyntaxStatus = "PASS" | "FAIL" | "UNCERTAIN";

export type DnsStatus = "PASS" | "FAIL" | "TIMEOUT" | "NO_MX" | "NULL_MX" | "ERROR";

export type SmtpStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "TEMPORARY_FAILURE"
  | "TIMEOUT"
  | "CONNECTION_ERROR"
  | "TLS_ERROR"
  | "BLOCKED"
  | "SKIPPED"
  | "UNKNOWN";

export interface MxRecord {
  exchange: string;
  priority: number;
}

export interface SyntaxResult {
  status: SyntaxStatus;
  reason?: string;
  normalizedEmail?: string;
  localPart?: string;
  domain?: string;
}

export interface TypoResult {
  detected: boolean;
  originalDomain: string;
  suggestedDomain?: string;
  suggestedEmail?: string;
}

export interface DnsResult {
  status: DnsStatus;
  domainExists: boolean;
  mxRecords: MxRecord[];
  primaryMx?: string;
  primaryMxIp?: string;
  reason?: string;
}

export interface SmtpEventLog {
  stage: "CONNECT" | "GREETING" | "EHLO" | "STARTTLS" | "MAIL_FROM" | "RCPT_TO" | "QUIT";
  command?: string;
  code?: number;
  response?: string;
  latencyMs?: number;
  timestamp: string;
}

export interface SmtpResult {
  status: SmtpStatus;
  code?: number;
  response?: string;
  stage?: string;
  latencyMs?: number;
  retryable?: boolean;
  supportsStarttls?: boolean;
  events: SmtpEventLog[];
  reason?: string;
}

export interface CatchAllResult {
  isCatchAll: boolean;
  confidence: ConfidenceLevel;
  testedAddress?: string;
  code?: number;
  response?: string;
}

export interface VerificationOptions {
  heloDomain?: string;
  verificationFromAddress?: string;
  smtpTimeoutMs?: number;
  dnsTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  retryBackoffMultiplier?: number;
  catchAllEnabled?: boolean;
  conservativeMode?: boolean;
  allowPrivateIps?: boolean;
  forceReverify?: boolean;
  cacheTtlHours?: number;
}

export interface VerificationResult {
  email: string;
  normalizedEmail: string;
  localPart: string;
  domain: string;
  normalizedDomain: string;

  finalStatus: VerificationStatus;
  riskScore: number;
  confidence: ConfidenceLevel;
  classificationReason: string;

  syntax: SyntaxResult;
  typo: TypoResult;
  dns: DnsResult;
  smtp: SmtpResult;

  isCatchAll: boolean;
  isDisposable: boolean;
  isRoleBased: boolean;
  isFreeProvider: boolean;
  providerName: string;

  isSuppressed: boolean;
  suppressionReason?: string;

  hasHistoricalHardBounce?: boolean;
  historicalDeliverabilityRate?: number;
  historicalBounceRate?: number;

  engineVersion: string;
  verifiedAt: string;
}
