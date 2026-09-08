# `release-manifest` generator

Writes a `release-manifest.json` for a single project so release metadata ships with the built
output.

## What it does

- Resolves the target project from the workspace configuration (errors if it does not exist).
- Validates `version` as a semantic version and `releaseDate` as a parseable date **before** writing
  anything.
- Writes a `release-manifest.json` containing `author` (optional), `project`, `releaseCommit`,
  `releaseDate`, and `version`, with the keys in alphabetical order.
- Defaults the output location to the project root for libraries and to `<project-root>/public` for
  applications.
- Defaults `author` to the local git user name for applications, and `<git user name> (<git user
email>)` for libraries. The email is dropped when it is not configured; the whole key is omitted
  when no name can be resolved and `--author` is not given.
- Normalizes `releaseDate` to an ISO 8601 UTC string. Defaults to the current time.
- Wires the manifest into the project's `build` target so it is copied to the build output:
  appends the file to `build.options.assets` unless an existing entry already covers it. An Angular
  application whose builder already copies `public/` is left untouched; a project with no `build`
  target gets a warning (the file is still written).
- Overwrites an existing `release-manifest.json` without prompting.
- Formats generated files unless `--skipFormat` is passed.

## Usage

```bash
pnpm nx g @cybertecpty/release-plugin:release-manifest <project> <version> --releaseCommit <commit> [options]
```

`version` is positional — `nx` reserves `--version` as a named flag, so it cannot be passed that way.

## Output

For applications, written to `public/release-manifest.json`:

```json
{
  "author": "Jane Doe",
  "project": "web",
  "releaseCommit": "abc123def4",
  "releaseDate": "2026-04-22T15:30:00.000Z",
  "version": "1.2.3"
}
```

For libraries, written to `release-manifest.json` at the project root:

```json
{
  "author": "Jane Doe (jane@example.com)",
  "project": "shared-types",
  "releaseCommit": "abc123def4",
  "releaseDate": "2026-04-22T15:30:00.000Z",
  "version": "1.2.3"
}
```

## Options

| Option          | Type    | Required | Default                                  | Notes                                                                    |
| --------------- | ------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `project`       | string  | yes      | —                                        | Positional 0. Workspace project name to generate the manifest for.       |
| `version`       | string  | yes      | —                                        | Positional 1. Semantic version, stored verbatim as `version`.            |
| `releaseCommit` | string  | yes      | —                                        | The commit being released. Stored verbatim; a short hash is recommended. |
| `releaseDate`   | string  | no       | current time                             | Any value `Date` can parse. Normalized to ISO 8601 UTC.                  |
| `author`        | string  | no       | see above                                | Release author.                                                          |
| `dirPath`       | string  | no       | `public` for apps, project root for libs | Output directory, relative to the **project root**.                      |
| `skipFormat`    | boolean | no       | `false`                                  | Skip formatting generated files.                                         |

## Examples

```bash
# apps/web/public/release-manifest.json, current git author and timestamp
pnpm nx g @cybertecpty/release-plugin:release-manifest web 1.4.0 --releaseCommit abc123def4

# a library manifest with an explicit author and release date
pnpm nx g @cybertecpty/release-plugin:release-manifest shared-types 2.0.0 \
  --releaseCommit abc123def4 --author "Release Bot (bot@cybertecpty.com)" \
  --releaseDate 2026-04-22T15:30:00.000Z

# override the output directory (relative to the project root)
pnpm nx g @cybertecpty/release-plugin:release-manifest web 1.4.0 \
  --releaseCommit abc123def4 --dirPath dist/release-metadata
```
