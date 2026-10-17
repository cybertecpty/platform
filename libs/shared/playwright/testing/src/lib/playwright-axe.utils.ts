import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// WCAG 2.2 AA gate for a web app's production build (ADR 0016). axe-core scans the rendered
// DOM; it catches roughly a third of real accessibility problems (contrast, names,
// landmarks, target size), so this is a floor, not an audit.

export interface AxeViewport {
  /** Shown in the test title, e.g. `mobile`. */
  name: string;
  width: number;
  height: number;
}

export interface AxePathOptions {
  /** Route to scan, resolved against Playwright's `baseURL` (e.g. `/about`). */
  path: string;
  /**
   * Runs after the page loads and before the scan, to check an interaction state (open a
   * menu, submit an empty form).
   */
  setup?: (page: Page) => Promise<void>;
}

export interface DefineAxeTestsOptions {
  /** Routes to scan. Required, so each app says which routes it covers. */
  paths: readonly (string | AxePathOptions)[];
  /** Viewports to scan each path at; defaults to `AXE_VIEWPORTS`. */
  viewports?: readonly AxeViewport[];
  /** axe rule tags; defaults to `WCAG_22_AA_TAGS`. */
  tags?: readonly string[];
}

/** WCAG 2.2 level AA (ADR 0016). Dropping a tag needs an ADR amendment. */
export const WCAG_22_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

/** The desktop and mobile viewports ADR 0016 scans at. */
export const AXE_VIEWPORTS: readonly AxeViewport[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];

/**
 * Register one axe test per path × viewport, so a failing report names the route.
 *
 * Call it at the top level of a Playwright spec file (the `-e2e` project's
 * `e2e/a11y.spec.ts`): it calls Playwright's `test()`, which only works while Playwright is
 * collecting that file's tests.
 */
export function defineAxeTests({
  paths,
  viewports = AXE_VIEWPORTS,
  tags = WCAG_22_AA_TAGS
}: DefineAxeTestsOptions): void {
  for (const entry of paths) {
    const { path, setup } = typeof entry === 'string' ? { path: entry, setup: undefined } : entry;

    for (const { name, width, height } of viewports) {
      test(`${path} has no axe violations on ${name}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(path);
        await setup?.(page);

        const { violations } = await new AxeBuilder({ page }).withTags([...tags]).analyze();

        expect(violations).toEqual([]);
      });
    }
  }
}
