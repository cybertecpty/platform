# `setup-swa` generator

Wires an app project for Azure Static Web Apps deployment. It adds a `deploy` target that runs the
[`swa-deploy`](../../executors/swa-deploy/README.md) executor after `build`. An existing `deploy`
target that runs `swa-deploy` is replaced, so running the generator again leaves the project
unchanged. A `deploy` target that runs a different executor is yours, so the generator fails
instead of replacing it: rename or remove it first.

It does not create a `staticwebapp.config.json`; that file is framework-specific, so add it
yourself or from a framework generator.

## Usage

```sh
nx g @cybertecpty/azure-plugin:setup-swa {project}
```

## Options

- `project` — the first positional argument. The app project to configure.
- `--outputPath` — the workspace-relative folder the `deploy` target deploys. Omit it and the
  `swa-deploy` executor resolves the `build` target's declared output at deploy time.
- `--skipFormat` — skip formatting files.
