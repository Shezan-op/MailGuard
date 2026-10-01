import fs from "fs";
import path from "path";

export class FreeProviderService {
  private static freeSet = new Set<string>([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "yahoo.fr",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "zoho.com",
    "mail.com",
    "gmx.com",
    "gmx.net",
    "yandex.com",
    "fastmail.com",
  ]);

  static init(): void {
    try {
      const jsonPath = path.join(process.cwd(), "data", "free-providers.json");
      if (fs.existsSync(jsonPath)) {
        const list: string[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        list.forEach((d) => this.freeSet.add(d.toLowerCase().trim()));
      }
    } catch {}
  }

  static isFreeProvider(domain: string): boolean {
    if (!domain) return false;
    return this.freeSet.has(domain.toLowerCase().trim());
  }

  static getAllFreeProviders(): string[] {
    return Array.from(this.freeSet).sort();
  }
}

FreeProviderService.init();
