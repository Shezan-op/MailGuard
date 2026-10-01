import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const srcStatic = path.join(projectRoot, ".next", "static");
const destStatic = path.join(projectRoot, ".next", "standalone", ".next", "static");
const srcPublic = path.join(projectRoot, "public");
const destPublic = path.join(projectRoot, ".next", "standalone", "public");

try {
  if (fs.existsSync(srcStatic)) {
    fs.mkdirSync(path.dirname(destStatic), { recursive: true });
    fs.cpSync(srcStatic, destStatic, { recursive: true });
    console.log("[MailGuard Build] Copied .next/static to .next/standalone/.next/static");
  }

  if (fs.existsSync(srcPublic)) {
    fs.mkdirSync(destPublic, { recursive: true });
    fs.cpSync(srcPublic, destPublic, { recursive: true });
    console.log("[MailGuard Build] Copied public/ to .next/standalone/public");
  }
} catch (err) {
  console.error("[MailGuard Build] Failed to copy standalone assets:", err);
  process.exit(1);
}
