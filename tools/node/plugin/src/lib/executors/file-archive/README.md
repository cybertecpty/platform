# `file-archive` executor

Archive a folder, or a target's resolved build output, into a `.zip` or `.tar` written next to it.
Run it as `@cybertecpty/node-plugin:file-archive`.

Unlike the [`file-archive` generator](../../generators/file-archive/README.md), which works on a
`Tree` and writes into the workspace, this reads the real file system, so it can run as a cached
target with `outputs` after `build`.

## Options

- `source`: folder to archive, relative to the workspace root
- `buildTarget`: target whose declared output is archived when `source` is omitted (default: `build`)
- `format`: `zip` or `tar` (default: `zip`; `tar` is uncompressed)
- `destination`: folder the archive is written into (default: the folder that contains the source)
- `filename`: archive filename (default: `<basename(source)>.<format>`)

## Which folder is archived

`source` takes precedence: when it is set, `buildTarget` is ignored. Without `source`, the executor
archives the folder the build target declares in its `outputs`, resolved the way Nx resolves cache
outputs. The target must declare exactly one output folder; otherwise the executor logs the error
with a hint to set `source` and fails. A missing or empty folder also fails.

## Where the archive goes

The archive defaults to a sibling of the folder, `<source>.<format>`, never inside it, so it can't
include itself. This differs from the generator, which defaults to `<source>/<basename>.<format>`.
An existing archive at the output path is replaced. Entry names are paths relative to the folder,
forward-slashed.

## Example

```json
{
  "targets": {
    "package": {
      "executor": "@cybertecpty/node-plugin:file-archive",
      "dependsOn": ["build"],
      "outputs": ["{workspaceRoot}/dist/{projectRoot}.zip"]
    }
  }
}
```
