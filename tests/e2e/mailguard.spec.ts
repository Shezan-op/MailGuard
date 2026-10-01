import { test, expect } from "@playwright/test";

test.describe.serial("MailGuard E2E Operations Flow", () => {
  test("1. Unauthenticated access guard redirects to /login", async ({ page }) => {
    // Attempt to visit protected dashboard directly
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);

    // Verify login page elements
    await expect(page.locator("h1:has-text('MAILGUARD')")).toBeVisible();
    await expect(page.locator("text=Private Verification & Deliverability Intelligence")).toBeVisible();
    await expect(page.locator('button:has-text("Access Console")')).toBeVisible();
  });

  test("2. Rejection of invalid administrator credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Should display invalid credentials alert
    await expect(page.locator("text=Invalid administrator credentials")).toBeVisible();
  });

  test("3. Successful authentication and dashboard metrics", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');

    // Should redirect to /dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("text=Deliverability Intelligence Overview")).toBeVisible();
    await expect(page.locator("text=Total Emails")).toBeVisible();
    await expect(page.getByText("Deliverable", { exact: true })).toBeVisible();
  });

  test("4. Single Email Verification with Live Pipeline", async ({ page }) => {
    // Authenticate
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // Navigate to single verify
    await page.goto("/verify");
    await expect(page.locator("text=Single Address Verification")).toBeVisible();

    // 1. Verify invalid syntax
    await page.fill('input[placeholder*="name@company.com"]', "plain-string-no-at-sign");
    await page.click('button:has-text("Verify Email")');

    await expect(page.locator("text=UNDELIVERABLE")).toBeVisible();
    await expect(page.locator("text=Missing '@' separator")).toBeVisible();

    // 2. Verify disposable domain
    await page.fill('input[placeholder*="name@company.com"]', "burner@mailinator.com");
    await page.click('button:has-text("Verify Email")');

    await expect(page.locator("text=DISPOSABLE")).toBeVisible();
    await expect(page.locator("text=Technical Evidence Checks")).toBeVisible();
    await expect(page.getByText("Deterministic Risk", { exact: true })).toBeVisible();
  });

  test("5. Bulk Email Job Creation & Monitoring", async ({ page }) => {
    // Authenticate
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: "Bulk Verification Jobs" })).toBeVisible();

    // Switch to paste tab
    await page.click('button:has-text("PASTE ADDRESSES")');

    // Create a batch via paste
    const list = "test-e2e-1@example.com\ntest-e2e-2@mailinator.com\nsupport@acmecorp.test";
    await page.locator("textarea").fill(list);
    await page.fill('input[placeholder*="September Leads"]', "Playwright Automated Test Batch");
    await page.click('button:has-text("Create & Start Verification Job")');

    // Should show the new job in the list
    await expect(page.locator("text=Playwright Automated Test Batch").first()).toBeVisible();
  });

  test("6. Results Ledger & Filters", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto("/results");
    await expect(page.getByRole("heading", { name: "Verification Results Intelligence" })).toBeVisible();
    await expect(page.locator('input[placeholder*="Search by email address or domain"]')).toBeVisible();
    await expect(page.locator('button:has-text("Export Filtered CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("Export Clean List")')).toBeVisible();
  });

  test("7. Domain Intelligence Registry", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto("/domains");
    await expect(page.getByRole("heading", { name: "Domain Deliverability Intelligence" })).toBeVisible();
  });

  test("8. Suppression List Management (Add & View)", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto("/suppressions");
    await expect(page.getByRole("heading", { name: "Suppression Management" })).toBeVisible();

    // Add suppression
    await page.click('button:has-text("Add Suppression")');
    await page.fill('input[placeholder*="user@example.com"]', "bounced-subscriber-99@example.com");
    await page.fill('input[placeholder*="User requested removal"]', "Permanent 550 Mailbox Not Found");
    await page.click('button:has-text("Save Entry")');

    // Verify item renders in list
    await expect(page.locator("text=bounced-subscriber-99@example.com").first()).toBeVisible();
  });

  test("9. Settings & Tuning Inspection", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Engine Configuration & Identity" })).toBeVisible();
    await expect(page.locator("text=SMTP Protocol Identity")).toBeVisible();
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible();
  });

  test("10. System Health & Network Diagnostics", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@mailguard.local");
    await page.fill('input[type="password"]', "MailguardDev2026!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    await page.goto("/system");
    await expect(page.getByRole("heading", { name: "System Infrastructure & Diagnostics" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Outbound SMTP Port 25 Diagnostic" })).toBeVisible();
    await expect(page.locator('button:has-text("Run Diagnostic")')).toBeVisible();
  });
});
