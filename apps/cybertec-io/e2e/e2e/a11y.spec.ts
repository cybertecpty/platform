import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA gate for the one-screen personal page (PRD sections 2, 11, 15; issue #94).
// axe-core scans the rendered DOM; it catches roughly a third of real accessibility
// problems (contrast, names, landmarks, target size), so this is a floor, not an audit.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
]) {
  test(`has no WCAG 2.2 AA violations on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(violations).toEqual([]);
  });
}
