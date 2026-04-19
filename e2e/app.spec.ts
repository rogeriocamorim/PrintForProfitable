import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001/api';

// Unique E2E test user
const E2E_EMAIL = `e2e-${Date.now()}@playwright.test`;
const E2E_PASSWORD = 'E2eTest123!';
const E2E_NAME = 'E2E Test User';

let authToken: string;

// Helper: login via API and set localStorage token, then navigate
async function loginAndGo(page: Page, path: string) {
  if (!authToken) {
    const res = await page.request.post(`${API}/auth/login`, {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    const body = await res.json();
    authToken = body.token;
  }

  // Add init script to set token before any JS runs
  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, authToken);

  await page.goto(`${BASE}${path}`);
  // Wait for the page content to load (not redirected to login)
  await page.waitForURL(`**${path}`, { timeout: 10000 });
}

test.describe.serial('E2E: Full User Flow', () => {
  // ─── Registration ──────────────────────────────────────────
  test('register a new user', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.locator('text=Create your account')).toBeVisible();

    await page.fill('#full-name', E2E_NAME);
    await page.fill('#email', E2E_EMAIL);
    await page.fill('#password', E2E_PASSWORD);

    await page.click('button[type="submit"]');

    // Should redirect to setup wizard
    await page.waitForURL(/\/(setup|dashboard)/, { timeout: 10000 });
    const url = page.url();
    expect(url).toMatch(/\/(setup|dashboard)/);
  });

  // ─── Login ─────────────────────────────────────────────────
  test('login with created user', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.fill('#email', E2E_EMAIL);
    await page.fill('#password', E2E_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(setup|dashboard)/, { timeout: 10000 });
  });

  // ─── Dashboard navigation ─────────────────────────────────
  test('dashboard loads with sidebar and brand', async ({ page }) => {
    await loginAndGo(page, '/dashboard');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('navigate to all dashboard pages', async ({ page }) => {
    const pages = [
      { path: '/dashboard/models', heading: '3D Models' },
      { path: '/dashboard/printers', heading: 'Printers' },
      { path: '/dashboard/filaments', heading: 'Filaments' },
      { path: '/dashboard/marketplaces', heading: 'Marketplaces' },
      { path: '/dashboard/shipping', heading: 'Shipping' },
      { path: '/dashboard/settings', heading: 'Farm Settings' },
      { path: '/dashboard/analytics', heading: 'Product Analytics' },
      { path: '/dashboard/orders', heading: 'Orders' },
      { path: '/dashboard/queue', heading: 'Print Queue' },
      { path: '/dashboard/users', heading: 'Users' },
      { path: '/dashboard/supplies', heading: 'Supplies' },
      { path: '/dashboard/integrations', heading: 'Integrations' },
    ];

    for (const p of pages) {
      await loginAndGo(page, p.path);
      await expect(page.locator('main h1')).toContainText(p.heading, { timeout: 5000 });
    }
  });

  // ─── Printers CRUD ─────────────────────────────────────────
  test('create a printer via modal', async ({ page }) => {
    await loginAndGo(page, '/dashboard/printers');

    // Click "Add Printer" button
    await page.click('button:has-text("Add Printer")');

    // Wait for modal and fill form
    await expect(page.locator('h2:has-text("Add Printer")')).toBeVisible({ timeout: 5000 });
    await page.fill('#brand', 'Bambu Lab');
    await page.fill('#model', 'X1 Carbon');
    await page.fill('#power-consumption', '220');

    // Submit
    await page.click('button[type="submit"]:has-text("Add")');

    // Verify it appears in the table
    await expect(page.locator('text=Bambu Lab')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=X1 Carbon')).toBeVisible();
  });

  // ─── Farm Settings ─────────────────────────────────────────
  test('farm settings form is populated and editable', async ({ page }) => {
    await loginAndGo(page, '/dashboard/settings');

    await expect(page.locator('h1:has-text("Farm Settings")')).toBeVisible({ timeout: 5000 });

    // Farm name input should have a value
    const farmNameInput = page.locator('#farm-name');
    await expect(farmNameInput).toBeVisible();
    const value = await farmNameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);

    // Electricity rate should NOT show long floating point
    const elecInput = page.locator('#electricity-rate');
    const elecValue = await elecInput.inputValue();
    // Should be 6 characters or fewer (e.g., "0.15" not "0.15000000596046448")
    expect(elecValue.length).toBeLessThanOrEqual(6);
  });

  // ─── Placeholder pages show "Coming Soon" ──────────────────
  test('placeholder pages show Coming Soon', async ({ page }) => {
    const placeholders = [
      '/dashboard/analytics',
      '/dashboard/orders',
      '/dashboard/queue',
      '/dashboard/supplies',
      '/dashboard/integrations',
    ];

    for (const path of placeholders) {
      await loginAndGo(page, path);
      await expect(page.locator('text=Coming Soon')).toBeVisible({ timeout: 5000 });
    }
  });

  // ─── Auth guard ────────────────────────────────────────────
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
