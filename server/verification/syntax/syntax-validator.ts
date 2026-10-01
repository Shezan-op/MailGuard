import { SyntaxResult } from "../types";

export class SyntaxValidator {
  /**
   * Validates an email address against RFC 5321 and RFC 5322 standards.
   * Does NOT use an overly simplistic or fragile mega-regex.
   */
  static validate(email: string): SyntaxResult {
    if (!email || typeof email !== "string") {
      return {
        status: "FAIL",
        reason: "Email is empty or not a string",
      };
    }

    const trimmed = email.trim();

    if (trimmed.length === 0) {
      return {
        status: "FAIL",
        reason: "Email is empty",
      };
    }

    // RFC 5321: Maximum length of an email address is 254 characters
    if (trimmed.length > 254) {
      return {
        status: "FAIL",
        reason: "Email exceeds maximum length of 254 characters (RFC 5321)",
      };
    }

    // Check for illegal whitespace or control characters
    if (/[\x00-\x1F\x7F]/.test(trimmed)) {
      return {
        status: "FAIL",
        reason: "Email contains illegal control characters",
      };
    }

    if (/\s/.test(trimmed)) {
      return {
        status: "FAIL",
        reason: "Email contains whitespace",
      };
    }

    // Locate the @ symbol. Handle quoted local parts if present.
    const lastAtIndex = trimmed.lastIndexOf("@");
    if (lastAtIndex === -1) {
      return {
        status: "FAIL",
        reason: "Missing '@' separator",
      };
    }

    if (trimmed.indexOf("@") !== lastAtIndex && !trimmed.startsWith('"')) {
      return {
        status: "FAIL",
        reason: "Multiple '@' separators found",
      };
    }

    const localPart = trimmed.slice(0, lastAtIndex);
    const domainPart = trimmed.slice(lastAtIndex + 1);

    if (localPart.length === 0) {
      return {
        status: "FAIL",
        reason: "Local part (before '@') is empty",
      };
    }

    if (domainPart.length === 0) {
      return {
        status: "FAIL",
        reason: "Domain part (after '@') is empty",
      };
    }

    // RFC 5321: Local part must not exceed 64 characters
    if (localPart.length > 64) {
      return {
        status: "FAIL",
        reason: "Local part exceeds maximum length of 64 characters",
      };
    }

    // RFC 1035 / 5321: Domain must not exceed 253 characters
    if (domainPart.length > 253) {
      return {
        status: "FAIL",
        reason: "Domain exceeds maximum length of 253 characters",
      };
    }

    // Validate Local Part
    const isQuoted = localPart.startsWith('"') && localPart.endsWith('"');
    if (!isQuoted) {
      // Cannot start or end with a period
      if (localPart.startsWith(".") || localPart.endsWith(".")) {
        return {
          status: "FAIL",
          reason: "Local part cannot start or end with a period",
        };
      }

      // Cannot contain consecutive periods
      if (localPart.includes("..")) {
        return {
          status: "FAIL",
          reason: "Local part cannot contain consecutive periods",
        };
      }

      // Legal characters: letters, digits, and !#$%&'*+-/=?^_`{|}~
      // Allow Unicode characters for internationalized emails (RFC 6531)
      const legalLocalRegex = /^[a-zA-Z0-9!#$%&'*+\-/=?^_`{|}~.\u0080-\uFFFF]+$/;
      if (!legalLocalRegex.test(localPart)) {
        return {
          status: "FAIL",
          reason: "Local part contains invalid characters",
        };
      }
    } else {
      // Quoted string rules
      const inner = localPart.slice(1, -1);
      if (inner.includes('"') && !inner.includes('\\"')) {
        return {
          status: "FAIL",
          reason: "Quoted local part has unescaped quotes",
        };
      }
    }

    // Validate Domain Part
    const normalizedDomain = domainPart.toLowerCase();

    // Domain cannot start or end with a period
    if (normalizedDomain.startsWith(".") || normalizedDomain.endsWith(".")) {
      return {
        status: "FAIL",
        reason: "Domain cannot start or end with a period",
      };
    }

    // Domain cannot contain consecutive periods
    if (normalizedDomain.includes("..")) {
      return {
        status: "FAIL",
        reason: "Domain cannot contain consecutive periods",
      };
    }

    // Check labels
    const labels = normalizedDomain.split(".");
    if (labels.length < 2) {
      return {
        status: "FAIL",
        reason: "Domain must contain at least one top-level domain label (e.g. .com)",
      };
    }

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label.length === 0) {
        return {
          status: "FAIL",
          reason: "Domain contains an empty label",
        };
      }
      if (label.length > 63) {
        return {
          status: "FAIL",
          reason: `Domain label '${label}' exceeds maximum length of 63 characters`,
        };
      }
      if (label.startsWith("-") || label.endsWith("-")) {
        return {
          status: "FAIL",
          reason: `Domain label '${label}' cannot start or end with a hyphen`,
        };
      }
      // Label must contain only alphanumeric, hyphens, or unicode IDN
      const legalLabelRegex = /^[a-zA-Z0-9\-\u0080-\uFFFF]+$/;
      if (!legalLabelRegex.test(label)) {
        return {
          status: "FAIL",
          reason: `Domain label '${label}' contains invalid characters`,
        };
      }
    }

    // Top-Level Domain (TLD) check
    const tld = labels[labels.length - 1];
    // TLDs cannot be all-numeric (RFC 1123 / 3696)
    if (/^\d+$/.test(tld)) {
      return {
        status: "FAIL",
        reason: "Top-level domain cannot be entirely numeric",
      };
    }

    if (tld.length < 2) {
      return {
        status: "FAIL",
        reason: "Top-level domain must be at least 2 characters long",
      };
    }

    const normalizedEmail = `${localPart}@${normalizedDomain}`;

    return {
      status: "PASS",
      normalizedEmail,
      localPart,
      domain: normalizedDomain,
    };
  }
}
