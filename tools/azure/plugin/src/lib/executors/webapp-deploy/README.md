# `webapp-deploy` executor

Deploy a build artifact to an Azure Web App.

Run it as `@cybertecpty/azure-plugin:webapp-deploy`.

It runs the Azure CLI from the workspace root:

```
az webapp deploy --subscription {subscription} --resource-group {resourceGroup} --name {name} --src-path {srcPath}
```

## Sign-in

The executor never logs in. Before calling `az` it checks that the CLI can get an access token. It fails with a message if it can't, or if `az` isn't on your PATH.

- **Locally:** run `az login` once.
- **In CI:** add an `azure/login` step before the deploy.

## Options

- `name`: name of the Azure Web App
- `resourceGroup`: name of the resource group that contains the Web App
- `srcPath`: artifact to deploy, relative to the workspace root
- `subscription`: name or ID of the subscription that contains the Web App. It's required so a deploy can't silently land in the CLI's default subscription.

## Example

```json
{
  "targets": {
    "deploy": {
      "executor": "@cybertecpty/azure-plugin:webapp-deploy",
      "dependsOn": ["build"],
      "options": {
        "name": "my-web-app",
        "resourceGroup": "my-resource-group",
        "srcPath": "dist/apps/my-app/app.zip",
        "subscription": "00000000-0000-0000-0000-000000000000"
      }
    }
  }
}
```
