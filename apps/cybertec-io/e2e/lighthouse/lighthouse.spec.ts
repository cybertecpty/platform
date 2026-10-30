import { defineLighthouseTests } from '@cybertecpty/playwright-testing';

// Lighthouse gate (ADR 0016), shared across web apps through `@cybertecpty/playwright-testing`.
defineLighthouseTests({ paths: ['/'] });
