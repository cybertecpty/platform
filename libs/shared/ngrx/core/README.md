# ngrx-core

Application-level NgRx Signals features.

## `withEventsLogging`

Logs every event dispatched through `@ngrx/signals/events` at `info`, under the `store-events`
scope, with the event type and payload. It is a provider feature, so pass it to `provideLogger`:

```ts
provideLogger('app', withEventsLogging());
```

It needs the root `Logger` that `provideLogger` supplies, and it stops logging when the injector is
destroyed. Output is off by default; switch it on with `DEBUG=app:store-events:*` (see
`@cybertecpty/logging-utils`).

Payloads are logged as-is, with no redaction. Do not use it with a transport that leaves the device
if an event can carry secrets or personal data.

## Running unit tests

Run `nx test ngrx-core` to execute the unit tests.
