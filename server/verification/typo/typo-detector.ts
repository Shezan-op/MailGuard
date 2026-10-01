import { TypoResult } from "../types";

export class TypoDetector {
  private static popularDomains = [
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "zoho.com",
    "mail.com",
    "yandex.com",
    "fastmail.com",
  ];

  // Common direct misspellings map for instant accurate detection
  private static directMap: Record<string, string> = {
    "gmial.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmaik.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gmail.con": "gmail.com",
    "gmail.cm": "gmail.com",
    "gmail.cpm": "gmail.com",
    "gmeil.com": "gmail.com",
    "outlok.com": "outlook.com",
    "outlook.co": "outlook.com",
    "outloo.com": "outlook.com",
    "outllok.com": "outlook.com",
    "hotmial.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hotmil.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotmali.com": "hotmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yaho.co": "yahoo.com",
    "yahoo.con": "yahoo.com",
    "icoud.com": "icloud.com",
    "iclud.com": "icloud.com",
    "protn.me": "proton.me",
    "protonmial.com": "protonmail.com",
    "prtonmail.com": "protonmail.com",
  };

  /**
   * Calculates the Levenshtein distance between two strings.
   */
  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Checks if an email's domain is likely a typo of a popular email provider.
   */
  static check(email: string, localPart: string, domain: string): TypoResult {
    const normalizedDomain = domain.toLowerCase().trim();

    // If it's already an exact match to a popular domain, no typo
    if (this.popularDomains.includes(normalizedDomain)) {
      return {
        detected: false,
        originalDomain: normalizedDomain,
      };
    }

    // Check direct dictionary mapping first
    if (this.directMap[normalizedDomain]) {
      const suggestedDomain = this.directMap[normalizedDomain];
      return {
        detected: true,
        originalDomain: normalizedDomain,
        suggestedDomain,
        suggestedEmail: `${localPart}@${suggestedDomain}`,
      };
    }

    // Levenshtein distance calculation for popular domains
    for (const popDomain of this.popularDomains) {
      const distance = this.levenshtein(normalizedDomain, popDomain);
      // If edit distance is 1 or 2 (and domain length is at least 6), it's very likely a typo
      if (distance === 1 || (distance === 2 && normalizedDomain.length >= 7)) {
        return {
          detected: true,
          originalDomain: normalizedDomain,
          suggestedDomain: popDomain,
          suggestedEmail: `${localPart}@${popDomain}`,
        };
      }
    }

    return {
      detected: false,
      originalDomain: normalizedDomain,
    };
  }
}
