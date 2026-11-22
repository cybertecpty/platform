# logging-utils

`Logger` writes namespaced messages at `debug`, `info`, `warn` and `error` through one or more
`LogTransport`s. `ConsoleTransport` uses the [`debug`](https://www.npmjs.com/package/debug)
package and writes to the matching `console` method, so the browser console can filter by level.
`NoopTransport` discards everything.

```ts
const logger = new Logger('billing', [new ConsoleTransport()]);
const invoiceLogger = logger.extendScope('Invoice'); // namespace: billing:invoice

invoiceLogger.info('created', invoiceId);
```

Arguments are evaluated before the call, so guard expensive ones with `isEnabled`:

```ts
if (invoiceLogger.isEnabled('debug')) {
  invoiceLogger.debug('state', JSON.stringify(state));
}
```

`warn` and `error` are always logged. `debug` and `info` are off until enabled. Each level is its
own `debug` namespace, `<namespace>:<level>`:

- Node: set `DEBUG`, for example `DEBUG=billing:*` or `DEBUG=billing:invoice:info`.
- Browser: set `localStorage.debug` to the same pattern and reload.
- In code: call `enableAll()` on the transport.

Change which levels are always logged with `alwaysEnabled`: `new ConsoleTransport({ alwaysEnabled: [] })`
makes every level opt-in, and `['info', 'warn', 'error']` suits a Node application whose normal
output is `info`.

A `Logger` created with a narrower `levels` list drops calls at the other levels, and
`extendScope` keeps that list. A scope named like a level (`info`) produces a namespace that a
`DEBUG` pattern for that level also matches, so avoid it.

## Running unit tests

Run `nx test logging-utils` to execute the unit tests via [Vitest](https://vitest.dev/).
