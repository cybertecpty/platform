# SWA deploy executor

Deploy a project's build output to Azure Static Web Apps with `@cybertecpty/azure-plugin:swa-deploy`.

It runs the root devDependency's SWA CLI, non-interactively:

```
swa deploy <outputPath> --env <env> --no-use-keychain
```

## Token

The deployment token comes from the `SWA_CLI_DEPLOYMENT_TOKEN` environment variable and is never passed as an argument. When it is missing or blank, the executor fails before calling `swa`, because the CLI would otherwise fall back to an interactive login that offers to create a new Static Web App.

- **Locally:** put the token in the project's gitignored `.env.deploy` (copy `.env.deploy.example`). Nx loads that file for the `deploy` target only.
- **In CI:** `.github/workflows/deploy-affected.yml` sets it from the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret of the project's GitHub Environment.

## Options

- `outputPath`: folder to deploy, relative to the workspace root (default: the build target's declared output, see below)
- `buildTarget`: target whose declared output is deployed when `outputPath` isn't set (default: `build`)
- `env`: Static Web Apps environment (default: `production`; any other name deploys a preview environment)

## Deploy folder

Without `outputPath`, the executor deploys the folder the build target declares in its `outputs`, resolved the way Nx resolves cache outputs (placeholders such as `{projectRoot}` and `{options.outputPath}` are filled in, using the target's `defaultConfiguration`). The build target must declare exactly one output folder. If it's missing, declares no outputs, declares several, or declares a glob, the deploy fails before calling `swa` and asks for `outputPath`. There is no `dist/` fallback, so a wrong folder is never deployed by guesswork.

`swa deploy --dry-run` is not offered as a check: it exits 0 even when the real deploy would fail.

## Example

```json
{
  "targets": {
    "deploy": {
      "executor": "@cybertecpty/azure-plugin:swa-deploy",
      "dependsOn": ["build"]
    }
  }
}
```
