import fs from "fs";
import path from "path";

export class RoleAddressService {
  private static prefixSet = new Set<string>([
    "admin",
    "administrator",
    "billing",
    "careers",
    "contact",
    "contact-us",
    "contactus",
    "customer-care",
    "customercare",
    "customerservice",
    "customer-service",
    "finance",
    "hello",
    "help",
    "helpdesk",
    "hr",
    "humanresources",
    "info",
    "information",
    "inquiries",
    "inquiry",
    "jobs",
    "legal",
    "marketing",
    "media",
    "news",
    "office",
    "operations",
    "orders",
    "press",
    "privacy",
    "reception",
    "sales",
    "security",
    "service",
    "services",
    "support",
    "team",
    "tech",
    "webmaster",
    "postmaster",
    "hostmaster",
    "abuse",
    "noc",
    "root",
    "sysadmin",
  ]);

  static init(): void {
    try {
      const jsonPath = path.join(process.cwd(), "data", "role-prefixes.json");
      if (fs.existsSync(jsonPath)) {
        const list: string[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        list.forEach((p) => this.prefixSet.add(p.toLowerCase().trim()));
      }
    } catch {}
  }

  /**
   * Checks if a local part is a role-based/generic function address rather than an individual.
   * Handles sub-tagging (e.g. sales+newsletter or support.tier1).
   */
  static isRoleAddress(localPart: string): boolean {
    if (!localPart) return false;

    // Normalize lowercase and strip sub-addressing (+tag or -tag)
    let cleaned = localPart.toLowerCase().trim();
    const plusIndex = cleaned.indexOf("+");
    if (plusIndex !== -1) {
      cleaned = cleaned.substring(0, plusIndex);
    }

    // Direct match
    if (this.prefixSet.has(cleaned)) {
      return true;
    }

    // Split on dot or hyphen (e.g., support-team, info.uk)
    const segments = cleaned.split(/[\.\-_]/);
    if (segments.length > 0 && this.prefixSet.has(segments[0])) {
      return true;
    }

    return false;
  }

  static addPrefix(prefix: string): void {
    this.prefixSet.add(prefix.toLowerCase().trim());
  }

  static removePrefix(prefix: string): void {
    this.prefixSet.delete(prefix.toLowerCase().trim());
  }

  static getAllPrefixes(): string[] {
    return Array.from(this.prefixSet).sort();
  }
}

// Pre-initialize on module load
RoleAddressService.init();
