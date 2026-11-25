# logging-testing

Test doubles for `@cybertecpty/logging-utils` (`type:testing`): import from `*.spec.ts` only,
never from production code. `createMockTransport()` returns a `LogTransport` of `vitest.fn()`
spies.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test logging-testing` to execute the unit tests via [Vitest](https://vitest.dev/).
