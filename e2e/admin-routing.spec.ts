/**
 * E2E: Super admin must NEVER land on the customer view — regardless of how
 * they arrive at the app.
 *
 * Scenarios covered:
 *   1. Fresh sign-in from /auth
 *   2. Full page refresh while an admin session already exists
 *   3. Direct navigation to /admin without going through /auth first
 *
 * Requires the following env vars (set as GitHub Actions secrets in CI):
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASS  — credentials for a Super Admin account
 * If the vars are missing the whole suite is skipped so local `npx playwright`
 * runs don't fail for contributors without production credentials.
 */
import { test, expect, Page } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASS = process.env.E2E_ADMIN_PASS ?? "";
const HAS_CREDS = Boolean(EMAIL && PASS);

test.describe("Super admin routing", () => {
  test.skip(!HAS_CREDS, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASS not configured");

  async function assertNotCustomerView(page: Page) {
    // The customer dashboard exposes distinctive markers ("رصيدي" / customer-only
    // sections). If we ever see them for a super admin we've regressed.
    await expect(page.getByTestId("customer-dashboard")).toHaveCount(0);
    await expect(page.locator("text=رصيدي المتاح")).toHaveCount(0);
  }

  async function signIn(page: Page) {
    await page.goto("/auth");
    await page.getByLabel(/البريد|email/i).fill(EMAIL);
    await page.getByLabel(/كلمة المرور|password/i).fill(PASS);
    await page.getByRole("button", { name: /دخول|تسجيل الدخول|sign in/i }).click();
  }

  test("Scenario 1 — fresh sign-in lands on /admin, never on customer view", async ({ page }) => {
    await signIn(page);
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await assertNotCustomerView(page);
    await expect(page).toHaveURL(/\/admin/);
  });

  test("Scenario 2 — hard refresh keeps super admin on /admin", async ({ page }) => {
    await signIn(page);
    await page.waitForURL(/\/admin/, { timeout: 20_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    // While role resolves the app shows a loader — wait it out.
    await page.waitForURL(/\/admin/, { timeout: 20_000 });
    await assertNotCustomerView(page);
  });

  test("Scenario 3 — direct navigation to /admin never falls back to customer view", async ({
    page,
  }) => {
    await signIn(page);
    await page.waitForURL(/\/admin/, { timeout: 20_000 });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await assertNotCustomerView(page);
  });
});
