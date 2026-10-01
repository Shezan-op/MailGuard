import dns from "dns/promises";
import net from "net";

async function runDiagnostic() {
  console.log("\n=======================================================");
  console.log("MAILGUARD REAL NETWORK & OUTBOUND SMTP DIAGNOSTIC");
  console.log("=======================================================\n");

  // 1. DNS Resolution Test
  console.log("[1] Testing Public DNS Resolution...");
  let mxHost = "";
  try {
    const aRecords = await dns.resolve4("google.com");
    console.log(`    ✓ DNS A Resolution OK: google.com -> ${aRecords.join(", ")}`);

    const mxRecords = await dns.resolveMx("google.com");
    mxRecords.sort((a, b) => a.priority - b.priority);
    mxHost = mxRecords[0].exchange;
    console.log(`    ✓ DNS MX Resolution OK: google.com MX -> ${mxHost} (priority ${mxRecords[0].priority})`);
  } catch (err: any) {
    console.error(`    ✗ DNS Resolution Failed: ${err.message}`);
  }

  // 2. Outbound TCP Port 25 Connection Test
  console.log("\n[2] Testing Outbound TCP Port 25 to MX Host (" + mxHost + ":25)...");
  if (!mxHost) {
    console.log("    ✗ Cannot test TCP 25 without MX host.");
    return;
  }

  const startTime = Date.now();
  const socket = new net.Socket();
  socket.setTimeout(6000);

  const connectResult = await new Promise<{ connected: boolean; greeting?: string; error?: string }>((resolve) => {
    socket.connect(25, mxHost, () => {
      console.log(`    ✓ TCP Socket Connected to ${mxHost}:25 in ${Date.now() - startTime}ms`);
    });

    socket.on("data", (data) => {
      const greeting = data.toString("utf-8").trim();
      resolve({ connected: true, greeting });
      socket.destroy();
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ connected: false, error: "Connection timed out (Port 25 blocked by ISP/host firewall)" });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ connected: false, error: err.message });
    });
  });

  if (connectResult.connected) {
    console.log(`    ✓ Received SMTP Greeting Banner: "${connectResult.greeting}"`);
    console.log(`\n>>> RESULT: OUTBOUND SMTP PORT 25 IS AVAILABLE <<<`);
  } else {
    console.log(`    ✗ Connection Result: ${connectResult.error}`);
    console.log(`\n>>> RESULT: OUTBOUND SMTP PORT 25 IS BLOCKED <<<`);
    console.log(`    Notice: Outbound TCP port 25 is restricted by the current hosting environment or ISP.`);
    console.log(`    Live SMTP testing in this local environment will be recorded as BLOCKED.`);
  }
  console.log("\n=======================================================\n");
}

runDiagnostic();
