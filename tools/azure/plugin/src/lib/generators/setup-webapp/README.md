# `setup-webapp` generator

Wires an app project for Azure Web Apps deployment. It adds two targets:

- `package` runs the [`file-archive`](../../../../../../node/plugin/src/lib/executors/file-archive/README.md)
  executor from `@cybertecpty/node-plugin` after `build`. It zips the build target's declared
  output into `srcPath`, and declares that file as its `outputs` so Nx can cache it.
- `deploy` runs the [`webapp-deploy`](../../executors/webapp-deploy/README.md) executor after
  `package`, uploading `srcPath` to the Web App.

Running the generator again replaces its own `package` and `deploy` targets, so the project is
left unchanged. A `package` or `deploy` target that runs a different executor is yours, so the
generator fails instead of replacing it: rename or remove it first.

## What it does not do

- It does not create the Web App, the resource group or the subscription's access. Provision those
  separately.
- It does not log in. `deploy` needs an existing `az login` session locally, or an `azure/login`
  step in CI.
- It does not set how the app starts. The zip is only what `build` produced, so an app that needs a
  `package.json` with a start script, or a particular startup command, needs it in the build
  output or on the Web App itself (for example `az webapp config set --startup-file`).
- It does not decide what the zip contains beyond the `build` target's output. `package` fails when
  `build` declares no output folder, several folders or a glob; set `source` on the `package`
  target to name the folder yourself.

`@cybertecpty/node-plugin` must be installed in the workspace, since the `package` target refers to
its executor.

## Usage

```sh
nx g @cybertecpty/azure-plugin:setup-webapp {project} --resourceGroup={resourceGroup} --subscription={subscription}
```

## Options

- `project`: the first positional argument. The app project to configure.
- `--resourceGroup`: the resource group that contains the Web App. Required.
- `--subscription`: the name or ID of the subscription that contains the Web App. Required, so a
  deploy never lands in the CLI's default subscription.
- `--name`: the name of the Web App. Defaults to the project name.
- `--srcPath`: the workspace-relative path of the zip that `package` writes and `deploy` uploads.
  Defaults to `deploy/{project}.zip`. Backslashes are converted to forward slashes.
- `--skipFormat`: skip formatting files.
