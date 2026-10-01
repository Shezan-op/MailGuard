import crypto from "crypto";
import {
  VerificationOptions,
  VerificationResult,
  SyntaxResult,
  DnsResult,
  SmtpResult,
} from "./types";
import { SyntaxValidator } from "./syntax/syntax-validator";
import { TypoDetector } from "./typo/typo-detector";
import { DnsService } from "./dns/dns-service";
import { SmtpClient } from "./smtp/smtp-client";
import { CatchAllDetector } from "./catchall/catchall-detector";
import { DisposableDomainService } from "./disposable/disposable-service";
import { RoleAddressService } from "./role/role-service";
import { FreeProviderService } from "./provider/free-providers";
import { ProviderDetector } from "./provider/provider-detector";
import { ReputationService } from "./reputation/reputation-service";
import { RiskEngine } from "./scoring/risk-engine";
import { ConfidenceEngine } from "./scoring/confidence-engine";
import { ClassificationEngine } from "./scoring/classification-engine";
import { getDb } from "../db";
import { emails, verificationRuns, domains, smtpEvents } from "../db/schema";
import { eq, and } from "drizzle-orm";

export class VerificationOrchestrator {
  private static ENGINE_VERSION = "1.0.0";

  /**
   * Complete verification pipeline for a single email address.
   */
  static async verify(
    rawEmail: string,
    options?: VerificationOptions & { jobId?: string; persist?: boolean }
  ): Promise<VerificationResult> {
    const trimmed = (rawEmail || "").trim();
    const shouldPersist = options?.persist ?? true;
    const now = new Date();

    // 1. Syntax Validation
    const syntax: SyntaxResult = SyntaxValidator.validate(trimmed);

    if (syntax.status === "FAIL" || !syntax.normalizedEmail || !syntax.domain || !syntax.localPart) {
      const failDns: DnsResult = { status: "FAIL", domainExists: false, mxRecords: [] };
      const failSmtp: SmtpResult = { status: "SKIPPED", events: [] };
      const emptyReputation = {
        isSuppressed: false,
        hasHistoricalHardBounce: false,
        historicalDeliveries: 0,
        historicalBounces: 0,
      };

      const classification = ClassificationEngine.classify({
        syntax,
        dns: failDns,
        smtp: failSmtp,
        isCatchAll: false,
        isDisposable: false,
        isRoleBased: false,
        isFreeProvider: false,
        reputation: emptyReputation,
      });

      const result: VerificationResult = {
        email: trimmed,
        normalizedEmail: trimmed.toLowerCase(),
        localPart: "",
        domain: "",
        normalizedDomain: "",
        finalStatus: classification.status,
        riskScore: 100,
        confidence: "HIGH",
        classificationReason: classification.reason,
        syntax,
        typo: { detected: false, originalDomain: "" },
        dns: failDns,
        smtp: failSmtp,
        isCatchAll: false,
        isDisposable: false,
        isRoleBased: false,
        isFreeProvider: false,
        providerName: "Unknown",
        isSuppressed: false,
        engineVersion: this.ENGINE_VERSION,
        verifiedAt: now.toISOString(),
      };

      if (shouldPersist) {
        await this.persistResult(result, options?.jobId);
      }

      return result;
    }

    const normalizedEmail = syntax.normalizedEmail;
    const localPart = syntax.localPart;
    const domain = syntax.domain;

    // 2. Typo Detection
    const typo = TypoDetector.check(normalizedEmail, localPart, domain);

    // 3. Suppression & Historical Reputation Check
    const reputation = await ReputationService.checkReputation(normalizedEmail, domain);

    // 4. DNS & MX Resolution
    const dnsResult = await DnsService.resolveDomain(domain, {
      timeoutMs: options?.dnsTimeoutMs,
      allowPrivateIps: options?.allowPrivateIps,
      bypassCache: options?.forceReverify,
      cacheTtlHours: options?.cacheTtlHours,
    });

    // 5. Provider & Domain Intelligence
    const providerName = ProviderDetector.identify(dnsResult.mxRecords);
    const isFreeProvider = FreeProviderService.isFreeProvider(domain);
    const isDisposable = DisposableDomainService.isDisposable(domain);
    const isRoleBased = RoleAddressService.isRoleAddress(localPart);

    // Early termination if domain or MX is fundamentally broken
    if (!dnsResult.domainExists || dnsResult.status === "NULL_MX" || (dnsResult.mxRecords.length === 0 && dnsResult.status === "NO_MX")) {
      const skippedSmtp: SmtpResult = {
        status: "SKIPPED",
        reason: dnsResult.reason || "Skipped SMTP probe because domain has no usable mail servers",
        events: [],
      };

      const riskInput = {
        syntax,
        dns: dnsResult,
        smtp: skippedSmtp,
        isCatchAll: false,
        isDisposable,
        isRoleBased,
        isFreeProvider,
        reputation,
      };

      const riskScore = RiskEngine.calculate(riskInput);
      const confidence = ConfidenceEngine.evaluate(syntax, dnsResult, skippedSmtp, false);
      const classification = ClassificationEngine.classify(riskInput);

      const result: VerificationResult = {
        email: trimmed,
        normalizedEmail,
        localPart,
        domain,
        normalizedDomain: domain,
        finalStatus: classification.status,
        riskScore,
        confidence,
        classificationReason: classification.reason,
        syntax,
        typo,
        dns: dnsResult,
        smtp: skippedSmtp,
        isCatchAll: false,
        isDisposable,
        isRoleBased,
        isFreeProvider,
        providerName,
        isSuppressed: reputation.isSuppressed,
        suppressionReason: reputation.suppressionReason,
        hasHistoricalHardBounce: reputation.hasHistoricalHardBounce,
        engineVersion: this.ENGINE_VERSION,
        verifiedAt: now.toISOString(),
      };

      if (shouldPersist) {
        await this.persistResult(result, options?.jobId);
      }

      return result;
    }

    // 6. Direct SMTP Recipient Probing
    const primaryMxHost = dnsResult.primaryMx || (dnsResult.mxRecords[0]?.exchange ?? domain);
    const primaryMxIp = dnsResult.primaryMxIp;
    const maxRetries = options?.maxRetries ?? 2;
    const retryDelay = options?.retryDelayMs ?? 1000;
    const backoffMultiplier = options?.retryBackoffMultiplier ?? 2;

    let smtpResult: SmtpResult = {
      status: "CONNECTION_ERROR",
      events: [],
    };

    let currentDelay = retryDelay;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      smtpResult = await SmtpClient.probeRecipient(normalizedEmail, {
        host: primaryMxHost,
        ip: primaryMxIp,
        heloDomain: options?.heloDomain || "mailguard.local",
        mailFrom: options?.verificationFromAddress || "verify@mailguard.local",
        timeoutMs: options?.smtpTimeoutMs || 10000,
        enableStarttls: true,
      });

      // If successful or definitive permanent rejection, do not retry
      if (!smtpResult.retryable) {
        break;
      }

      // If retryable (greylisting, temporary 4xx), wait and retry unless exhausted
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }

    // 7. Catch-All Detection
    let isCatchAll = false;
    const catchAllEnabled = options?.catchAllEnabled ?? true;

    if (catchAllEnabled && dnsResult.domainExists && smtpResult.status === "ACCEPTED") {
      const catchAllResult = await CatchAllDetector.checkCatchAll(
        domain,
        {
          host: primaryMxHost,
          ip: primaryMxIp,
          heloDomain: options?.heloDomain,
          mailFrom: options?.verificationFromAddress,
          timeoutMs: options?.smtpTimeoutMs,
        },
        {
          bypassCache: options?.forceReverify,
          cacheTtlHours: options?.cacheTtlHours,
        }
      );

      isCatchAll = catchAllResult.isCatchAll;
    }

    // 8. Scoring & Classification
    const riskInput = {
      syntax,
      dns: dnsResult,
      smtp: smtpResult,
      isCatchAll,
      isDisposable,
      isRoleBased,
      isFreeProvider,
      reputation,
    };

    const riskScore = RiskEngine.calculate(riskInput);
    const confidence = ConfidenceEngine.evaluate(syntax, dnsResult, smtpResult, isCatchAll);
    const classification = ClassificationEngine.classify(riskInput);

    const result: VerificationResult = {
      email: trimmed,
      normalizedEmail,
      localPart,
      domain,
      normalizedDomain: domain,
      finalStatus: classification.status,
      riskScore,
      confidence,
      classificationReason: classification.reason,
      syntax,
      typo,
      dns: dnsResult,
      smtp: smtpResult,
      isCatchAll,
      isDisposable,
      isRoleBased,
      isFreeProvider,
      providerName,
      isSuppressed: reputation.isSuppressed,
      suppressionReason: reputation.suppressionReason,
      hasHistoricalHardBounce: reputation.hasHistoricalHardBounce,
      historicalDeliverabilityRate: reputation.domainDeliverabilityRate,
      historicalBounceRate: reputation.domainBounceRate,
      engineVersion: this.ENGINE_VERSION,
      verifiedAt: now.toISOString(),
    };

    // 9. Persistence
    if (shouldPersist) {
      await this.persistResult(result, options?.jobId);
    }

    return result;
  }

  /**
   * Persists verification results, runs, domain intelligence, and SMTP events.
   */
  private static async persistResult(result: VerificationResult, jobId?: string): Promise<void> {
    try {
      const db = getDb();
      const emailId = crypto.randomUUID();
      const runId = crypto.randomUUID();
      const domainId = crypto.randomUUID();

      // Upsert into emails table
      await db
        .insert(emails)
        .values({
          id: emailId,
          normalizedEmail: result.normalizedEmail,
          originalEmail: result.email,
          localPart: result.localPart,
          domain: result.domain,
          normalizedDomain: result.normalizedDomain,
          syntaxStatus: result.syntax.status,
          syntaxReason: result.syntax.reason,
          suggestedEmail: result.typo.suggestedEmail,
          typoDetected: result.typo.detected,
          domainExists: result.dns.domainExists,
          dnsStatus: result.dns.status,
          mxStatus: result.dns.status,
          mxHost: result.dns.primaryMx,
          smtpStatus: result.smtp.status,
          smtpCode: result.smtp.code,
          smtpResponse: result.smtp.response,
          smtpStage: result.smtp.stage,
          catchAllStatus: result.isCatchAll,
          disposableStatus: result.isDisposable,
          roleBasedStatus: result.isRoleBased,
          freeProviderStatus: result.isFreeProvider,
          providerName: result.providerName,
          finalStatus: result.finalStatus,
          riskScore: result.riskScore,
          confidence: result.confidence,
          classificationReason: result.classificationReason,
          lastVerifiedAt: new Date(result.verifiedAt),
        })
        .onConflictDoUpdate({
          target: emails.normalizedEmail,
          set: {
            syntaxStatus: result.syntax.status,
            syntaxReason: result.syntax.reason,
            suggestedEmail: result.typo.suggestedEmail,
            typoDetected: result.typo.detected,
            domainExists: result.dns.domainExists,
            dnsStatus: result.dns.status,
            mxStatus: result.dns.status,
            mxHost: result.dns.primaryMx,
            smtpStatus: result.smtp.status,
            smtpCode: result.smtp.code,
            smtpResponse: result.smtp.response,
            smtpStage: result.smtp.stage,
            catchAllStatus: result.isCatchAll,
            disposableStatus: result.isDisposable,
            roleBasedStatus: result.isRoleBased,
            freeProviderStatus: result.isFreeProvider,
            providerName: result.providerName,
            finalStatus: result.finalStatus,
            riskScore: result.riskScore,
            confidence: result.confidence,
            classificationReason: result.classificationReason,
            lastVerifiedAt: new Date(result.verifiedAt),
          },
        });

      // Update existing pending run if present for this job, else insert
      let existingPendingRunId: string | null = null;
      if (jobId) {
        const pending = await db
          .select({ id: verificationRuns.id })
          .from(verificationRuns)
          .where(and(eq(verificationRuns.jobId, jobId), eq(verificationRuns.emailId, result.normalizedEmail)))
          .limit(1);
        if (pending.length > 0) {
          existingPendingRunId = pending[0].id;
        }
      }

      if (existingPendingRunId) {
        await db
          .update(verificationRuns)
          .set({
            syntaxResult: result.syntax as any,
            dnsResult: result.dns as any,
            mxResult: result.dns.mxRecords as any,
            smtpResult: {
              status: result.smtp.status,
              code: result.smtp.code,
              response: result.smtp.response,
              stage: result.smtp.stage,
            } as any,
            catchAllResult: { isCatchAll: result.isCatchAll } as any,
            disposableResult: result.isDisposable,
            roleResult: result.isRoleBased,
            providerResult: result.providerName,
            smtpCode: result.smtp.code,
            smtpResponse: result.smtp.response,
            smtpLatencyMs: result.smtp.latencyMs,
            finalStatus: result.finalStatus,
            riskScore: result.riskScore,
            confidence: result.confidence,
            reason: result.classificationReason,
            engineVersion: result.engineVersion,
          })
          .where(eq(verificationRuns.id, existingPendingRunId));
      } else {
        await db.insert(verificationRuns).values({
          id: runId,
          emailId: result.normalizedEmail,
          jobId: jobId || null,
          syntaxResult: result.syntax as any,
          dnsResult: result.dns as any,
          mxResult: result.dns.mxRecords as any,
          smtpResult: {
            status: result.smtp.status,
            code: result.smtp.code,
            response: result.smtp.response,
            stage: result.smtp.stage,
          } as any,
          catchAllResult: { isCatchAll: result.isCatchAll } as any,
          disposableResult: result.isDisposable,
          roleResult: result.isRoleBased,
          providerResult: result.providerName,
          smtpCode: result.smtp.code,
          smtpResponse: result.smtp.response,
          smtpLatencyMs: result.smtp.latencyMs,
          finalStatus: result.finalStatus,
          riskScore: result.riskScore,
          confidence: result.confidence,
          reason: result.classificationReason,
          engineVersion: result.engineVersion,
        });
      }

      // Upsert Domain Intelligence
      if (result.domain) {
        await db
          .insert(domains)
          .values({
            id: domainId,
            domain: result.domain,
            normalizedDomain: result.normalizedDomain,
            exists: result.dns.domainExists,
            dnsStatus: result.dns.status,
            mxPresent: result.dns.mxRecords.length > 0,
            mxRecordsJson: result.dns.mxRecords as any,
            primaryMx: result.dns.primaryMx,
            provider: result.providerName,
            isFreeProvider: result.isFreeProvider,
            isDisposable: result.isDisposable,
            isCatchAll: result.isCatchAll,
            catchAllConfidence: result.isCatchAll ? "HIGH" : "LOW",
            lastSmtpCheck: new Date(),
            lastDnsCheck: new Date(),
            supportsStarttls: result.smtp.supportsStarttls ?? false,
            averageSmtpLatency: result.smtp.latencyMs ?? 0,
            verificationCount: 1,
            deliverableCount: result.finalStatus === "DELIVERABLE" ? 1 : 0,
            undeliverableCount: result.finalStatus === "UNDELIVERABLE" ? 1 : 0,
            temporaryCount: result.finalStatus === "TEMPORARY" ? 1 : 0,
            unknownCount: result.finalStatus === "UNKNOWN" ? 1 : 0,
            riskScore: result.riskScore,
            confidence: result.confidence,
          })
          .onConflictDoUpdate({
            target: domains.domain,
            set: {
              exists: result.dns.domainExists,
              dnsStatus: result.dns.status,
              mxPresent: result.dns.mxRecords.length > 0,
              mxRecordsJson: result.dns.mxRecords as any,
              primaryMx: result.dns.primaryMx,
              provider: result.providerName,
              isFreeProvider: result.isFreeProvider,
              isDisposable: result.isDisposable,
              isCatchAll: result.isCatchAll,
              lastSmtpCheck: new Date(),
              lastDnsCheck: new Date(),
              supportsStarttls: result.smtp.supportsStarttls ?? false,
            },
          });
      }

      // Record SMTP Events if any
      if (result.smtp.events && result.smtp.events.length > 0) {
        for (const ev of result.smtp.events) {
          await db.insert(smtpEvents).values({
            id: crypto.randomUUID(),
            emailId: result.normalizedEmail,
            domainId: result.domain,
            mxHost: result.dns.primaryMx,
            port: 25,
            tlsUsed: result.smtp.supportsStarttls ?? false,
            ehloResult: ev.stage === "EHLO" ? ev.response : null,
            mailFromResult: ev.stage === "MAIL_FROM" ? ev.response : null,
            rcptToResult: ev.stage === "RCPT_TO" ? ev.response : null,
            smtpCode: ev.code,
            smtpResponse: ev.response,
            latencyMs: ev.latencyMs,
            retryable: result.smtp.retryable ?? false,
          });
        }
      }
    } catch (err) {
      console.error("[MailGuard] Failed to persist verification record:", err);
    }
  }
}
