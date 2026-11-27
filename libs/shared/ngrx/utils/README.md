# ngrx-utils

NgRx signal store utilities.

## `withStateLogger`

Logs every state change of a signal store at `debug`, through a `Logger` scoped to the store name.

```ts
const CartStore = signalStore(
  { providedIn: 'root' },
  withStateLogger('Cart'),
  withState({ items: [] as string[] })
);
```

Output is off by default. Switch it on with `DEBUG=cart:*` in Node, or `localStorage.debug = 'cart:*'`
in the browser (see `@cybertecpty/logging-utils`).

State is logged as-is, with no redaction. Do not use `withStateLogger` on a store that holds secrets
or personal data if a transport that leaves the device is in use.

## Running unit tests

Run `nx test ngrx-utils` to execute the unit tests.
