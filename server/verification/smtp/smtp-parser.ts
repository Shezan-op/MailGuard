export interface ParsedSmtpResponse {
  code: number;
  message: string;
  isMultiline: boolean;
  isComplete: boolean;
  capabilities: string[];
}

export class SmtpParser {
  /**
   * Parses an SMTP server raw response chunk.
   * Handles single-line (e.g. "220 mx.example.com ESMTP") and
   * multi-line (e.g. "250-mx.example.com\r\n250-STARTTLS\r\n250 OK").
   */
  static parse(raw: string): ParsedSmtpResponse | null {
    if (!raw || typeof raw !== "string") {
      return null;
    }

    // Guard against oversized payload attacks (max 64KB per parse chunk)
    const truncatedRaw = raw.length > 65536 ? raw.substring(0, 65536) : raw;

    // A valid SMTP response line must be terminated by a newline per RFC 5321
    const hasTerminatingNewline = raw.includes("\n");

    const lines = truncatedRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return null;
    }

    let code = 0;
    const messages: string[] = [];
    const capabilities: string[] = [];
    let isComplete = false;
    let isMultiline = lines.length > 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // An SMTP line format: [3 digit code][space or hyphen][optional message]
      const match = line.match(/^(\d{3})([ \-])(.*)$/);
      if (match) {
        code = parseInt(match[1], 10);
        const separator = match[2];
        const text = match[3].trim();

        messages.push(text);

        // Check if capability is advertised in EHLO response
        if (code === 250 && text.length > 0) {
          capabilities.push(text.toUpperCase());
        }

        // Space separator indicates the final line of a response
        if (separator === " ") {
          isComplete = true;
        } else if (separator === "-") {
          isMultiline = true;
          isComplete = false;
        }
      } else {
        // Line without standard code prefix, append to messages
        messages.push(line.trim());
      }
    }

    // Join messages and sanitize
    let fullMessage = messages.join(" ");

    // Enforce max 2,000 characters limit
    if (fullMessage.length > 2000) {
      fullMessage = fullMessage.substring(0, 1985) + "... [truncated]";
    }

    return {
      code,
      message: fullMessage,
      isMultiline,
      isComplete: isComplete && hasTerminatingNewline && code >= 100 && code <= 599,
      capabilities,
    };
  }

  /**
   * Sanitizes SMTP response for safe logging and storage (strips control characters and converts CR/LF to space to prevent log injection)
   */
  static sanitize(text: string): string {
    if (!text) return "";
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/[\r\n]+/g, " ")
      .trim();
  }
}
