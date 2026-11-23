# angular-utils

Helpers that feature libraries and applications share without depending on application-level
setup. The application-level logger setup lives in `angular-core`.

## Logger

`injectLogger` returns a `Logger` scoped to the class or area that uses it:

```ts
private readonly logger = injectLogger('InvoiceService'); // namespace: billing:invoice-service
```

It takes a string, not `MyClass.name`, because a minified build renames classes. The scope is added
to the application's root namespace and kebab-cased. It throws when no `Logger` is provided, which
means `provideLogger` is missing from the application config.

To instrument a lazy-loaded feature, use Angular's `provideEnvironmentInitializer` in the route's
`providers`. It runs when the route loads, and it can `inject()` a service only that route
provides:

```ts
export const checkoutRoutes: Routes = [
  {
    path: '',
    providers: [
      CheckoutStore,
      provideEnvironmentInitializer(() => {
        const logger = injectLogger('Checkout');
        inject(CheckoutStore).transitions$.subscribe(t => logger.debug('transition', t));
      })
    ],
    children: [
      /* ... */
    ]
  }
];
```

## Provider features

`AngularProviderFeature` is the shape of a `withX()` feature, a `kind` and its `providers`, in the
style of `provideRouter(routes, ...withX())`. `mapFeaturesToProviders` flattens a list of features
into one provider list.

## Running unit tests

Run `nx test angular-utils` to execute the unit tests via [Vitest](https://vitest.dev/).
