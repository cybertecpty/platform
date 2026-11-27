# logging-testing

Test doubles for `@cybertecpty/logging-utils` (`type:testing`): import from `*.spec.ts` only,
never from production code.

- **`createMockTransport()`** returns a `LogTransport` of `vitest.fn()` spies. Build a real `Logger`
  on it to assert what reaches a transport: namespace, level and arguments.
- **`createMockLogger()`** returns `{ logger, scopedLogger }`, two mock `Logger`s whose methods are
  `vitest.fn()` spies. `extendScope` on either returns `scopedLogger`, so a spec can assert on the
  calls a unit makes after it scopes its logger. Use it when the unit under test is handed a
  `Logger` and the transport is beside the point.

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test logging-testing` to execute the unit tests via [Vitest](https://vitest.dev/).
