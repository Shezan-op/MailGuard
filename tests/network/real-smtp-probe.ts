import dns from "dns/promises";
import { SmtpClient } from "../../server/verification/smtp/smtp-client";

async function runRealSmtpTest() {
  console.log("\n=======================================================");
  console.log("MAILGUARD REAL LIVE PUBLIC SMTP PROTOCOL PROBE");
  console.log("=======================================================\n");

  const targetDomain = "gmail.com";
  const targetEmail = "test.nonexistent.probe.12345xyz@gmail.com";

  console.log(`[1] Resolving MX records for ${targetDomain}...`);
  const mxRecords = await dns.resolveMx(targetDomain);
  mxRecords.sort((a, b) => a.priority - b.priority);
  const primaryMx = mxRecords[0].exchange;
  console.log(`    ✓ Primary MX: ${primaryMx} (priority ${mxRecords[0].priority})`);

  console.log(`\n[2] Executing live SMTP probe against ${primaryMx}:25 for ${targetEmail}...`);
  const startTime = Date.now();

  const result = await SmtpClient.probeRecipient(targetEmail, {
    host: primaryMx,
    port: 25,
    heloDomain: "mailguard.local",
    mailFrom: "verify@mailguard.local",
    timeoutMs: 10000,
    enableStarttls: true,
  });

  const duration = Date.now() - startTime;
  console.log(`\n[3] Live SMTP Probe Completed in ${duration}ms:`);
  console.log(`    Status:            ${result.status}`);
  console.log(`    SMTP Code:         ${result.code}`);
  console.log(`    Server Response:   ${result.response}`);
  console.log(`    STARTTLS Used:     ${result.supportsStarttls}`);
  console.log(`    Retryable:         ${result.retryable}`);
  console.log(`    Recorded Events:   ${result.events.length}`);

  console.log("\n[4] SMTP Protocol Transcript:");
  for (const ev of result.events) {
    console.log(`    [${ev.stage.padEnd(10)}] command="${ev.command || "-"}" code=${ev.code || "-"} resp="${ev.response || "-"}" latency=${ev.latencyMs}ms`);
  }

  console.log("\n=======================================================\n");
}

runRealSmtpTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live SMTP probe error:", err);
    process.exit(1);
  });
