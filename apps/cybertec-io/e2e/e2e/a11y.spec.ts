import { defineAxeTests } from '@cybertecpty/playwright-testing';

// WCAG 2.2 AA gate (ADR 0016), shared across web apps through `@cybertecpty/playwright-testing`.
defineAxeTests({ paths: ['/'] });
