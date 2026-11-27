# 21. One `Logger` in `@cybertecpty/logging-utils`, over `debug`, for runtime logging

- Status: accepted
- Date: 2026-11-22
- Deciders: djmcgrath
- Implemented by: `Logger`, `ConsoleTransport` and `NoopTransport` in `libs/shared/logging/utils`
  (project `logging-utils`), exported from `@cybertecpty/logging-utils`

## Context and problem statement

The workspace has no logging convention for code that runs in an application or a library at
runtime. The only logger in use is `logger` from `@nx/devkit`, which the generators and executors use
to write task output through Nx. It prints to a terminal under Nx, so it is no use in a browser, and
it makes every library that logs depend on Nx.

Left alone, each project reaches for `console.*` directly. That gives no namespaces, so output from
one library cannot be told from another's, and no way to switch output on for one area without
changing code. A `console` call written for debugging also tends to stay in the code.

The Angular applications and the Astro sites run in the browser, and the .NET backend has its own
logging (ADR 0017), so this decision covers TypeScript code only.

## Decision drivers

- **Works in the browser and in Node** with one API, because shared libraries run in both.
- **Narrative output off by default and switchable without a code change**, per namespace and per
  level. `debug` and `info` are narrative; `warn` and `error` are not, and hiding one is a silent
  failure.
- **Level filtering in the browser console.** Messages should reach `console.debug`, `console.info`,
  `console.warn` and `console.error`, so the developer tools' own level filter works.
- **No Nx dependency** in a library that only logs.
- **A seam for other destinations.** Something other than the console, such as an error reporter,
  should be addable without touching call sites.
- **Small.** Nothing here needs more than namespaces, four levels and a destination.

## Considered options

1. **A thin `Logger` over `debug`, with a transport seam.** **(chosen)**
2. **`console.*` directly.** Rejected: no namespaces and no way to turn output on for one area
   without editing code, which is the problem above.
3. **`@nx/devkit`'s `logger`.** Rejected: it is Nx's task-output logger, not a runtime one, and it
   would put Nx into the dependencies of every library that logs.
4. **A full logging library** such as `pino` or `winston`. Rejected for now: they bring levels,
   formatting and destinations this workspace does not need yet, and several are built for Node.
   Revisit it if structured output or log shipping is required, and put the new library behind a
   `LogTransport` rather than replacing `Logger`.

Where the chosen option lives was a second choice:

- **In `@cybertecpty/utils`.** Rejected: its single barrel would make `debug` and `lodash-es`
  dependencies of every project that imports anything from it, and the logger is expected to reach
  the frontend as a transitive dependency, where bundle size matters (ADR 0003).
- **As a secondary entry point of `utils`.** Rejected: entry points are an ng-packagr feature, and a
  second path alias would only change the import path. The project graph, module boundaries,
  `@nx/dependency-checks` and affected detection all work per project, so `utils` would still carry
  the dependencies.

## Decision outcome

Chosen option: **1 — a thin `Logger` over `debug`, with a transport seam**, in its own shared
library, `libs/shared/logging/utils` (`logging-utils`, `type:utils`, which ADR 0004 lets every other
type depend on, `type:ui` included). The library is not buildable: consumers compile its source.

### Locked parameters

- **Runtime logging in application and library code goes through `Logger`.** Direct `console.*`
  calls are not used for diagnostics. Nx generators and executors keep `logger` from `@nx/devkit`,
  which is task output for Nx.
- **A logger is created once per area with a namespace, and narrowed with `extendScope`.**
  `extendScope('Invoice')` appends the kebab-cased suffix with `:`, giving `billing:invoice`.
- **The levels are `debug`, `info`, `warn` and `error`.** A `Logger` created with a narrower list
  drops calls at the other levels, and `extendScope` keeps that list.
- **`ConsoleTransport` names each `debug` namespace `<namespace>:<level>`.** `debug` and `info` are
  switched on with `DEBUG` in Node and `localStorage.debug` in the browser, using `debug`'s patterns
  (`DEBUG=billing:*`, `DEBUG=billing:invoice:info`), or in code with `enableAll()` on the transport.
- **`warn` and `error` are always on by default.** `ConsoleTransport` takes `alwaysEnabled`, which
  defaults to `['warn', 'error']`; an empty array makes every level opt-in, and a longer list widens
  the default. `info` stays opt-in: shared libraries log it freely, so on by default it would put
  every library's progress messages in every application's console, and narrowing a default that
  call sites have come to rely on is harder than widening one. A Node application whose normal
  output is `info` passes `['info', 'warn', 'error']`.
- **`ConsoleTransport` writes each level to its matching `console` method**, looked up on every call
  so a patched console is honoured.
- **`LogTransport` is the extension point.** `NoopTransport` discards everything, for tests and for
  turning logging off. A new destination implements `LogTransport`.
- **`debug` is a runtime dependency of `@cybertecpty/logging-utils` only**, declared in the root
  `package.json`. `@cybertecpty/utils` does not depend on it.

## Consequences

### Positive

- One API for every TypeScript project, with namespaces that name the area a message came from.
- `debug` and `info` output costs nothing to leave in the code and nothing to see until it is
  switched on, while a warning or error is never hidden by a forgotten setting.
- The browser console's level filter works, because each level reaches its own `console` method.
- A new destination, or a different logging library, is a `LogTransport` and changes no call site.

### Negative / risks

- **`DEBUG` cannot turn `warn` and `error` off.** They are forced on, and the override wins over
  `debug`'s patterns. A test that logs a warning prints it unless it uses `NoopTransport` or
  `alwaysEnabled: []`.
- **A scope named like a level** (`info`) gives a namespace that a `DEBUG` pattern for that level
  also matches.
- **`Logger` does not expose `enableAll`**, so code that wants to switch logging on in code has to
  hold the transport. `Logger.isEnabled(level)` lets a caller guard an expensive argument.
- **The logger holds state, which the `type:utils` row once ruled out.** `ConsoleTransport` keeps a
  map of its `debug` instances. ADR 0004's 2026-11-22 amendment changes the row to "no framework or
  module-level state", so an instance holding its own state is allowed. A new tag was not an option,
  because `type:ui` may depend only on `type:utils` among the runtime types.
- **`debug` ships to the browser** for any project that logs, and only for those.
- **There is no redaction.** A message goes to the transport as written, so nothing stops a secret
  or personal data reaching a log.

### Unverified

- **No project uses the logger yet.** The first Angular application or Astro site to use it will
  show whether `debug` bundles cleanly there and whether `localStorage.debug` behaves as described.
- **Server-side rendering and the Node side of a shared library** have not been exercised.
- **No transport other than the console exists.** The seam is untested against a real second
  destination.

## More information

- ADR 0004 (`nx-module-boundaries`) — why a `type:utils` library can be depended on from anywhere.
- ADR 0017 (`dotnet-backend`) — the backend, which logs through .NET's own mechanisms.
- `libs/shared/logging/utils/README.md` — how to create a logger and switch output on.
- [`debug`](https://www.npmjs.com/package/debug).

## Amendment (2026-11-27): logger features from other libs, and NgRx Signals logging

- Status: accepted
- Deciders: djmcg
- Implemented by: issue #398 (`withStateLogger` in `ngrx-utils`, `withEventsLogging` in `ngrx-core`)

`provideLogger` in `@cybertecpty/angular-core` takes features that change how the root `Logger`
behaves (`withLoggerTransports`, `withRouterEventsLogging`). A feature in another lib, such as
`withEventsLogging` in `ngrx-core`, has to plug into it too.

### Considered options

1. **`provideLogger` takes any `AngularProviderFeature`.** **(chosen)** The `features` parameter
   is the generic provider-feature type from `angular-utils`, so a feature from any lib that can
   inject the root `Logger` is accepted.
2. **A shared `LoggerFeature<K>` type with a marker, in `angular-utils`.** Rejected for now: the
   type is generic over its kind, so no lib needs to know the others' features. A bare
   `LoggerFeature<string>` is structurally identical to `AngularProviderFeature<string>` and checks
   nothing unless it carries a marker, which each feature then has to declare.
3. **A union of every logger feature, as `LoggerFeatures` was.** Rejected: `angular-core` cannot
   name a feature in `ngrx-core` without a dependency cycle.

### Consequences

- **`provideLogger` no longer rejects an unrelated provider feature at compile time.** Revisit
  option 2 if a wrongly passed feature causes a bug.
- **`LoggerFeatures` is no longer exported**, and `withTransports` is now `withLoggerTransports`.
- **`withStateLogger` and `withEventsLogging` log state and event payloads as-is**, so the
  no-redaction risk above applies to them. Redaction is tracked in #399.
