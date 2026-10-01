import crypto from "crypto";

const password = process.argv[2];

if (!password) {
  console.log("\nUsage: npm run auth:hash <your-password>\n");
  console.log("Example: npm run auth:hash MySecretPassword2026!\n");
  process.exit(1);
}

const hash = crypto.createHmac("sha256", "mg_salt_").update(password).digest("hex");

console.log("\n=======================================================");
console.log("MAILGUARD SECURE PASSWORD HASH GENERATOR");
console.log("=======================================================");
console.log(`Password:            ${password}`);
console.log(`ADMIN_PASSWORD_HASH: ${hash}`);
console.log("=======================================================");
console.log("\nAdd this line to your production .env file:");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
