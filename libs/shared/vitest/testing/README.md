# vitest-testing

Vitest helpers that work in any environment (`type:testing`, `platform:shared`, ADR 0004 2026-10-17
amendment): import from `*.spec.ts` only, never from production code. Frontend, backend and
tools specs can all use them.

Keep this lib to plain JavaScript and Vitest's own mock shapes. A helper that needs Nx devkit types
belongs in `nx-testing`; one that needs Angular or Node APIs belongs in a `platform:frontend` or
`platform:backend` testing lib. Lint checks imports only, so also keep out Node globals such as
`process` or `Buffer`.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test vitest-testing` to execute the unit tests via [Vitest](https://vitest.dev).
