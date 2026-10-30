import AxeBuilder from '@axe-core/playwright';
import { expect as playwrightExpect, test as playwrightTest, type Page } from '@playwright/test';

import { defineAxeTests } from './playwright-axe.utils';

jest.mock('@playwright/test', () => ({ expect: jest.fn(), test: jest.fn() }));
jest.mock('@axe-core/playwright', () => ({ __esModule: true, default: jest.fn() }));

type TestBody = (fixtures: { page: Page }) => Promise<void>;

const mockTest = jest.mocked(playwrightTest);
const mockExpect = jest.mocked(playwrightExpect);
const mockAxeBuilder = jest.mocked(AxeBuilder);
const mockToEqual = jest.fn();
const mockWithTags = jest.fn();
const mockAnalyze = jest.fn();
const mockPage = { goto: jest.fn(), setViewportSize: jest.fn() };

const registeredTitles = (): string[] => mockTest.mock.calls.map(([title]) => title);

/** Run the body of the registered test at `index` against the mock page. */
const runRegisteredTest = (index: number): Promise<void> =>
  (mockTest.mock.calls[index]?.[1] as unknown as TestBody)({ page: mockPage as unknown as Page });

beforeEach(() => {
  jest.clearAllMocks();
  mockExpect.mockReturnValue({ toEqual: mockToEqual } as never);
  mockWithTags.mockReturnValue({ analyze: mockAnalyze });
  mockAnalyze.mockResolvedValue({ violations: [] });
  mockAxeBuilder.mockImplementation(() => ({ withTags: mockWithTags }) as never);
});

describe('defineAxeTests', () => {
  it('registers one test per path and viewport, naming the route', () => {
    defineAxeTests({ paths: ['/', { path: '/about' }] });

    expect(registeredTitles()).toEqual([
      '/ has no axe violations on desktop',
      '/ has no axe violations on mobile',
      '/about has no axe violations on desktop',
      '/about has no axe violations on mobile'
    ]);
  });

  it('scans the route at the viewport with the WCAG 2.2 AA tags', async () => {
    defineAxeTests({ paths: ['/about'] });

    await runRegisteredTest(1);

    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 390, height: 844 });
    expect(mockPage.goto).toHaveBeenCalledWith('/about');
    expect(mockAxeBuilder).toHaveBeenCalledWith({ page: mockPage });
    expect(mockWithTags).toHaveBeenCalledWith([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa'
    ]);
    expect(mockToEqual).toHaveBeenCalledWith([]);
  });

  it('uses the given viewports and tags', async () => {
    defineAxeTests({
      paths: ['/'],
      viewports: [{ name: 'tablet', width: 768, height: 1024 }],
      tags: ['wcag2a']
    });

    await runRegisteredTest(0);

    expect(registeredTitles()).toEqual(['/ has no axe violations on tablet']);
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 768, height: 1024 });
    expect(mockWithTags).toHaveBeenCalledWith(['wcag2a']);
  });

  it('runs the path setup after loading the page and before the scan', async () => {
    const setup = jest.fn().mockResolvedValue(undefined);
    defineAxeTests({ paths: [{ path: '/', setup }] });

    await runRegisteredTest(0);

    expect(setup).toHaveBeenCalledWith(mockPage);
    const [gotoOrder] = mockPage.goto.mock.invocationCallOrder;
    const [setupOrder] = setup.mock.invocationCallOrder;
    const [analyzeOrder] = mockAnalyze.mock.invocationCallOrder;
    expect(gotoOrder).toBeLessThan(setupOrder ?? 0);
    expect(setupOrder).toBeLessThan(analyzeOrder ?? 0);
  });

  it('asserts on the violations axe reports', async () => {
    const violations = [{ id: 'color-contrast' }];
    mockAnalyze.mockResolvedValue({ violations });
    defineAxeTests({ paths: ['/'] });

    await runRegisteredTest(0);

    expect(mockExpect).toHaveBeenCalledWith(violations);
  });
});
