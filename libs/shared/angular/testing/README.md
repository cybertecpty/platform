# angular-testing

Test doubles for the Angular libraries.

## Logger

`provideMockLogger(appCode = 'test')` provides a `Logger` with no transports, so code that calls
`injectLogger` runs in a test without `provideLogger` and logs nothing. Its namespace is the app
code, so `injectLogger('InvoiceService')` gives `test:invoice-service` by default.

```ts
TestBed.configureTestingModule({ providers: [provideMockLogger()] });
```

## Running unit tests

Run `nx test angular-testing` to execute the unit tests via [Vitest](https://vitest.dev/).
