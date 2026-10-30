import { definePreviewConfig, type DefinePreviewConfigOptions } from './playwright-preview.utils';

describe('definePreviewConfig', () => {
  const createOptionsFixture = (
    overrides: Partial<DefinePreviewConfigOptions> = {}
  ): DefinePreviewConfigOptions => ({
    target: 'e2e',
    workspaceRoot: '/work/platform',
    previewCommand: port => `serve --port ${port}`,
    env: {},
    ...overrides
  });

  describe('port', () => {
    it('is stable for the same root and target', () => {
      expect(definePreviewConfig(createOptionsFixture()).port).toBe(
        definePreviewConfig(createOptionsFixture()).port
      );
    });

    it('differs between targets of one checkout', () => {
      const ports = ['e2e', 'lighthouse', 'smoke'].map(
        target => definePreviewConfig(createOptionsFixture({ target })).port
      );

      expect(new Set(ports).size).toBe(ports.length);
    });

    it('differs between checkouts', () => {
      const first = definePreviewConfig(
        createOptionsFixture({ workspaceRoot: '/work/tree-a' })
      ).port;
      const second = definePreviewConfig(
        createOptionsFixture({ workspaceRoot: '/work/tree-b' })
      ).port;

      expect(first).not.toBe(second);
    });

    it('stays inside the default 4400-4899 range', () => {
      for (let index = 0; index < 100; index++) {
        const { port } = definePreviewConfig(
          createOptionsFixture({ workspaceRoot: `/work/tree-${index}` })
        );

        expect(port).toBeGreaterThanOrEqual(4400);
        expect(port).toBeLessThan(4900);
      }
    });
  });

  describe('<TARGET>_PORT override', () => {
    it('pins the port of the matching target', () => {
      expect(definePreviewConfig(createOptionsFixture({ env: { E2E_PORT: '5173' } })).port).toBe(
        5173
      );
      expect(
        definePreviewConfig(
          createOptionsFixture({ target: 'lighthouse', env: { LIGHTHOUSE_PORT: '5174' } })
        ).port
      ).toBe(5174);
    });

    it('ignores the override of another target', () => {
      const pinned = definePreviewConfig(
        createOptionsFixture({ env: { LIGHTHOUSE_PORT: '5174' } })
      ).port;

      expect(pinned).toBe(definePreviewConfig(createOptionsFixture()).port);
    });

    it('turns a non-alphanumeric target into a valid variable name', () => {
      const { port } = definePreviewConfig(
        createOptionsFixture({
          target: 'visual-regression',
          env: { VISUAL_REGRESSION_PORT: '5175' }
        })
      );

      expect(port).toBe(5175);
    });

    it.each(['1024', '65535'])('accepts the boundary %s', value => {
      expect(definePreviewConfig(createOptionsFixture({ env: { E2E_PORT: value } })).port).toBe(
        Number(value)
      );
    });

    it.each(['1023', '65536', '0', '-4400', '44.5', '0x1130', '4400abc', 'abc', ''])(
      'rejects "%s"',
      value => {
        expect(() =>
          definePreviewConfig(createOptionsFixture({ env: { E2E_PORT: value } }))
        ).toThrow(/E2E_PORT must be a port number between 1024 and 65535/);
      }
    );
  });

  describe('server', () => {
    it('serves the app on the port and never reuses a running server', () => {
      const { baseURL, port, webServer } = definePreviewConfig(createOptionsFixture());

      expect(baseURL).toBe(`http://localhost:${port}`);
      expect(webServer).toEqual({
        command: `serve --port ${port}`,
        cwd: '/work/platform',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000
      });
    });

    it('passes the pinned port to the preview command', () => {
      const { webServer } = definePreviewConfig(
        createOptionsFixture({ env: { E2E_PORT: '5173' } })
      );

      expect(webServer).toMatchObject({ command: 'serve --port 5173' });
    });
  });

  describe('BASE_URL', () => {
    it('targets that URL and starts no server', () => {
      const { baseURL, webServer } = definePreviewConfig(
        createOptionsFixture({ env: { BASE_URL: 'https://example.test' } })
      );

      expect(baseURL).toBe('https://example.test');
      expect(webServer).toBeUndefined();
    });

    it('treats an empty BASE_URL as unset', () => {
      const { baseURL, port, webServer } = definePreviewConfig(
        createOptionsFixture({ env: { BASE_URL: '' } })
      );

      expect(baseURL).toBe(`http://localhost:${port}`);
      expect(webServer).toBeDefined();
    });
  });
});
