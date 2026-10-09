import { expect, test } from '@playwright/test';

// The header (apps/cybertec-io/src/components/Header.astro) swaps between an inline nav
// (lg+) and a <details> disclosure (below lg), with a script that closes it after a nav
// link is tapped. These smokes lock that responsive behaviour against the shipped build.

test.describe('header navigation', () => {
  test('mobile: the disclosure menu opens and closes after a link tap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const disclosure = page.locator('header details');
    const menuLink = disclosure.getByRole('link', { name: 'Stack' });

    // Below lg the disclosure is the nav entry point and it starts closed.
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toHaveJSProperty('open', false);
    await expect(menuLink).toBeHidden();

    // Tapping the hamburger opens it.
    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveJSProperty('open', true);
    await expect(menuLink).toBeVisible();

    // Tapping a nav link closes it (the header's own script).
    await menuLink.click();
    await expect(disclosure).toHaveJSProperty('open', false);
    await expect(menuLink).toBeHidden();
  });

  test('desktop: inline nav is shown and the disclosure is hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page.locator('header details')).toBeHidden();
    // The first Primary navigation is the inline lg+ one.
    const inlineNav = page.locator('header').getByRole('navigation', { name: 'Primary' }).first();
    await expect(inlineNav.getByRole('link', { name: 'Stack' })).toBeVisible();
  });
});
