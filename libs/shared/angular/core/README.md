# angular-core

Application-level Angular setup, provided once in the application config.

## Logger

Add `provideLogger` with an app code, which becomes the root namespace (lower-cased), followed by
any features:

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideLogger('billing', withRouterEventsLogging())]
};
```

Inject a scoped logger with `injectLogger` from `angular-utils`.

By default the logger writes to a `ConsoleTransport`, with every level enabled in dev mode. In
production only `warn` and `error` are logged until enabled through `localStorage.debug`; see
`logging-utils` for the pattern.

### Features

| Feature                     | Effect                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `withTransports(...)`       | Replaces the default console transport with the ones given.        |
| `withRouterEventsLogging()` | Logs router navigation events under the `router-navigation` scope. |

- **`withTransports` replaces the default.** Pass a `ConsoleTransport` as well to keep console
  output. A transport you supply is not enabled for you in dev mode, so call `enableAll()` on it
  if you want that. Providing the feature twice keeps the last one.
- **`withRouterEventsLogging`** logs start and end at `info`, a cancelled navigation at `warn`, a
  failed one at `error` and a skipped one at `debug`. URLs are logged as navigated, query string
  and fragment included, so a transport that leaves the device must strip sensitive parameters
  itself.

## Running unit tests

Run `nx test angular-core` to execute the unit tests via [Vitest](https://vitest.dev/).
