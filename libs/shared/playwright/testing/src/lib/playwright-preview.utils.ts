import type { PlaywrightTestConfig } from '@playwright/test';

import {
  derivePort,
  MAX_PORT,
  MIN_UNPRIVILEGED_PORT,
  type PortRange
} from './playwright-port.utils';

type Env = Readonly<Record<string, string | undefined>>;

export interface DefinePreviewConfigOptions {
  /**
   * The Nx target the config serves, e.g. `e2e` or `lighthouse`. It salts the derived port so
   * targets that run at the same time get different ports, and names the override variable
   * (`E2E_PORT`, `LIGHTHOUSE_PORT`).
   */
  target: string;
  /** Absolute path of the checkout. Each git worktree gets its own ports. */
  workspaceRoot: string;
  /** Builds the command that serves the app's production build on the given port. */
  previewCommand: (port: number) => string;
  /** Environment to read `BASE_URL` and the port override from; defaults to `process.env`. */
  env?: Env;
}

export interface PreviewConfig {
  /** `BASE_URL` when set, otherwise the local preview server. */
  baseURL: string;
  /** The preview port: the override when set, otherwise the derived one. */
  port: number;
  /** The preview server to start; undefined when `BASE_URL` targets a running site. */
  webServer: Exclude<PlaywrightTestConfig['webServer'], readonly unknown[]>;
}

const PORT_RANGE: PortRange = { base: 4400, span: 500 };
const STARTUP_TIMEOUT_MS = 120_000;

/**
 * Builds the `baseURL` and `webServer` of an `-e2e` project's Playwright config, so every
 * target of every app serves its production build the same way.
 *
 * The port comes from the checkout path and the target, so worktrees and the `e2e` and
 * `lighthouse` targets never share one. `<TARGET>_PORT` pins it to get out of a hash collision.
 * `reuseExistingServer` is off: a server already answering on the port belongs to someone else,
 * and testing it would pass or fail for the wrong tree. Playwright fails loudly instead.
 *
 * Setting `BASE_URL` targets an already-running site and starts no server.
 */
export function definePreviewConfig({
  target,
  workspaceRoot,
  previewCommand,
  env = process.env
}: DefinePreviewConfigOptions): PreviewConfig {
  const port = pinnedPort(target, env) ?? derivePort(`${workspaceRoot}#${target}`, PORT_RANGE);
  const deployedUrl = env['BASE_URL'];

  if (deployedUrl) {
    return { baseURL: deployedUrl, port, webServer: undefined };
  }

  const baseURL = `http://localhost:${port}`;

  return {
    baseURL,
    port,
    webServer: {
      command: previewCommand(port),
      cwd: workspaceRoot,
      url: baseURL,
      reuseExistingServer: false,
      timeout: STARTUP_TIMEOUT_MS
    }
  };
}

function pinnedPort(target: string, env: Env): number | undefined {
  const name = `${target.toUpperCase().replaceAll(/[^A-Z0-9]/g, '_')}_PORT`;
  const value = env[name];

  if (value === undefined) {
    return undefined;
  }

  const port = Number(value);

  if (!/^\d+$/.test(value) || port < MIN_UNPRIVILEGED_PORT || port > MAX_PORT) {
    throw new RangeError(
      `${name} must be a port number between ${MIN_UNPRIVILEGED_PORT} and ${MAX_PORT}, got "${value}"`
    );
  }

  return port;
}
