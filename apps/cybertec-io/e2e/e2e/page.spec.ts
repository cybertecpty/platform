import { expect, test } from '@playwright/test';

// Smoke for the one-screen personal page (apps/cybertec-io/src/pages/index.astro).

test('renders the intro, current project and contact links', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CyberTec');
  await expect(page.getByRole('heading', { level: 1, name: 'Daniel McGrath' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "What I'm working on" })).toBeVisible();
  await expect(page.getByRole('link', { name: /^GitHub/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^LinkedIn/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'contact@cybertec.io' })).toBeVisible();
});

test('fits one screen on mobile without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflows).toBe(false);
});
