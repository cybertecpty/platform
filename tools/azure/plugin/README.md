# azure-plugin

This library was generated with [Nx](https://nx.dev).

## Generators

- [`setup-swa`](src/lib/generators/setup-swa/README.md): add a `deploy` target that runs `swa-deploy` after `build` to an app project.

## Executors

- [`swa-deploy`](src/lib/executors/swa-deploy/README.md): deploy a project's build output to Azure Static Web Apps.
- [`webapp-deploy`](src/lib/executors/webapp-deploy/README.md): deploy a build artifact to an Azure Web App.

## Sign-in

Executors that call the Azure CLI never log in. They check that the CLI has a usable session and fail early with guidance when it doesn't, so an interactive prompt can't hang CI and a login secret never reaches a logged command line. Sign in outside the executor: `az login` locally, or an `azure/login` step in CI.

A new executor that shells out to `az` should call `assertAzLoggedIn()` from `src/lib/utils/az-cli-auth.utils.ts` and pass an explicit `--subscription`, so a deploy never lands in whichever subscription is the CLI default.

## Building

Run `nx build azure-plugin` to build the library.

## Running unit tests

Run `nx test azure-plugin` to execute the unit tests via [Vitest](https://vitest.dev).
