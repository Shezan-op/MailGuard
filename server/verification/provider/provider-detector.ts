import fs from "fs";
import path from "path";
import { MxRecord } from "../types";

interface ProviderRule {
  name: string;
  patterns: string[];
}

export class ProviderDetector {
  private static rules: ProviderRule[] = [
    {
      name: "Google Workspace",
      patterns: ["aspmx.l.google.com", "googlemail.com", "google.com"],
    },
    {
      name: "Microsoft 365",
      patterns: ["mail.protection.outlook.com", "outlook.com", "microsoft.com"],
    },
    {
      name: "Yahoo Mail",
      patterns: ["yahoodns.net", "yahoo.com"],
    },
    {
      name: "Zoho Mail",
      patterns: ["zoho.com", "zohomail.com", "zoho.eu", "zoho.in"],
    },
    {
      name: "Proton Mail",
      patterns: ["protonmail.ch", "proton.me"],
    },
    {
      name: "Fastmail",
      patterns: ["messagingengine.com", "fastmail.com"],
    },
    {
      name: "Proofpoint",
      patterns: ["pphosted.com", "proofpoint.com"],
    },
    {
      name: "Mimecast",
      patterns: ["mimecast.com"],
    },
    {
      name: "Barracuda",
      patterns: ["barracudanetworks.com", "barracuda.com"],
    },
    {
      name: "Amazon SES",
      patterns: ["amazonaws.com", "amazon.com"],
    },
    {
      name: "Mailgun",
      patterns: ["mailgun.org", "mailgun.com"],
    },
    {
      name: "SendGrid",
      patterns: ["sendgrid.net"],
    },
    {
      name: "Cloudflare Email Routing",
      patterns: ["cloudflare.net", "mx.cloudflare.net"],
    },
    {
      name: "Apple iCloud",
      patterns: ["mail.me.com", "icloud.com"],
    },
  ];

  static init(): void {
    try {
      const jsonPath = path.join(process.cwd(), "data", "known-providers.json");
      if (fs.existsSync(jsonPath)) {
        const fileRules: ProviderRule[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        this.rules = fileRules;
      }
    } catch {}
  }

  /**
   * Identifies the mail provider based on MX exchange hostnames.
   */
  static identify(mxRecords: MxRecord[]): string {
    if (!mxRecords || mxRecords.length === 0) {
      return "Unknown";
    }

    const exchanges = mxRecords.map((m) => m.exchange.toLowerCase());

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        const lowerPattern = pattern.toLowerCase();
        for (const ex of exchanges) {
          if (ex.includes(lowerPattern)) {
            return rule.name;
          }
        }
      }
    }

    return "Unknown";
  }

  static detect(mxRecords: MxRecord[]): string {
    return this.identify(mxRecords);
  }
}

ProviderDetector.init();
