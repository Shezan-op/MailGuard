import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { VerificationOrchestrator } from "../server/verification/orchestrator";

interface SchoolRow {
  "#": string;
  School: string;
  Email: string;
}

interface EnrichedResult {
  Index: string;
  School: string;
  Email: string;
  Status: string;
  RiskScore: number;
  Confidence: string;
  Reason: string;
  Domain: string;
  DomainExists: boolean;
  MxHost: string;
  SmtpStatus: string;
  SmtpCode: string | number;
  SmtpResponse: string;
  IsCatchAll: boolean;
  IsRoleBased: boolean;
  IsDisposable: boolean;
  TypoDetected: boolean;
  SuggestedEmail: string;
}

async function run() {
  const csvPath = path.resolve(process.cwd(), "School Emails - Sheet1.csv");
  console.log(`Reading CSV from ${csvPath}...`);
  const fileContent = fs.readFileSync(csvPath, "utf-8");

  const parsed = Papa.parse<SchoolRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`Loaded ${parsed.data.length} schools from CSV.`);

  const results: EnrichedResult[] = [];
  const concurrency = 3;
  const queue = [...parsed.data];
  let processed = 0;
  const total = queue.length;

  async function worker(workerId: number) {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item || !item.Email) continue;

      const email = item.Email.trim();
      const school = item.School ? item.School.trim() : "";
      const index = item["#"] ? item["#"].trim() : String(processed + 1);

      try {
        const res = await VerificationOrchestrator.verify(email, {
          persist: false,
          smtpTimeoutMs: 6000,
          dnsTimeoutMs: 4000,
          maxRetries: 1,
        });

        results.push({
          Index: index,
          School: school,
          Email: email,
          Status: res.finalStatus,
          RiskScore: res.riskScore,
          Confidence: res.confidence,
          Reason: res.classificationReason || "",
          Domain: res.domain || "",
          DomainExists: res.dns.domainExists,
          MxHost: res.dns.primaryMx || "",
          SmtpStatus: res.smtp.status,
          SmtpCode: res.smtp.code || "",
          SmtpResponse: res.smtp.response || "",
          IsCatchAll: res.isCatchAll,
          IsRoleBased: res.isRoleBased,
          IsDisposable: res.isDisposable,
          TypoDetected: res.typo.detected,
          SuggestedEmail: res.typo.suggestedEmail || "",
        });

        processed++;
        console.log(
          `[${processed}/${total}] ${email} -> ${res.finalStatus} (Score: ${res.riskScore}, Confidence: ${res.confidence}) - ${res.classificationReason}`
        );
      } catch (err: any) {
        processed++;
        console.error(`[${processed}/${total}] ERROR verifying ${email}: ${err.message}`);
        results.push({
          Index: index,
          School: school,
          Email: email,
          Status: "UNKNOWN",
          RiskScore: 50,
          Confidence: "LOW",
          Reason: `Verification error: ${err.message}`,
          Domain: email.split("@")[1] || "",
          DomainExists: false,
          MxHost: "",
          SmtpStatus: "ERROR",
          SmtpCode: "",
          SmtpResponse: "",
          IsCatchAll: false,
          IsRoleBased: false,
          IsDisposable: false,
          TypoDetected: false,
          SuggestedEmail: "",
        });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  // Sort back by original index
  results.sort((a, b) => parseInt(a.Index, 10) - parseInt(b.Index, 10));

  // Write enriched CSV
  const outCsv = Papa.unparse(results);
  const outPath = path.resolve(process.cwd(), "School_Emails_Verified.csv");
  fs.writeFileSync(outPath, outCsv, "utf-8");
  console.log(`\nSuccessfully exported full results to: ${outPath}`);

  // Summary statistics
  const summary: Record<string, number> = {};
  for (const r of results) {
    summary[r.Status] = (summary[r.Status] || 0) + 1;
  }

  console.log("\n=== VERIFICATION SUMMARY ===");
  console.table(summary);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
