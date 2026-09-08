# `release-manifest` generator

Writes a `release-manifest.json` for a single project so release metadata can be published
alongside the built output.

## What it does

- Resolves the target project from the workspace configuration (errors if it does not exist).
- Validates `version` as a semantic version and `releaseDate` as a parseable date **before** writing
  anything.
- Writes a `release-manifest.json` containing `author` (optional), `project`, `releaseCommit`,
  `releaseDate`, and `version`, with the keys in alphabetical order.
- Writes the file at the project root. `--dirPath` moves it elsewhere within the project (a `..`
  segment is rejected).
- Defaults `author` to `<git user name> (<git user email>)`, dropping the email when it is not
  configured. The whole key is omitted when no name can be resolved and `--author` is not given.
- Normalizes `releaseDate` to an ISO 8601 UTC string. Defaults to the current time.
- Overwrites an existing `release-manifest.json` without prompting.
- Formats generated files unless `--skipFormat` is passed.

It does **not** touch the project's configuration. Copying the manifest into the build output is
left to each project — e.g. by adding it to the build target's `assets`.

## Usage

```bash
pnpm nx g @cybertecpty/release-plugin:release-manifest <project> <version> --releaseCommit <commit> [options]
```

`version` is positional — `nx` reserves `--version` as a named flag, so it cannot be passed that way.

## Output

```json
{
  "author": "Jane Doe (jane@example.com)",
  "project": "shared-types",
  "releaseCommit": "abc123def4",
  "releaseDate": "2026-04-22T15:30:00.000Z",
  "version": "1.2.3"
}
```

`author` is `<git user name> (<git user email>)` (email dropped when unset); it is absent when no
name resolves.

## Options

| Option          | Type    | Required | Default      | Notes                                                                    |
| --------------- | ------- | -------- | ------------ | ------------------------------------------------------------------------ |
| `project`       | string  | yes      | —            | Positional 0. Workspace project name to generate the manifest for.       |
| `version`       | string  | yes      | —            | Positional 1. Semantic version, stored verbatim as `version`.            |
| `releaseCommit` | string  | yes      | —            | The commit being released. Stored verbatim; a short hash is recommended. |
| `releaseDate`   | string  | no       | current time | Any value `Date` can parse. Normalized to ISO 8601 UTC.                  |
| `author`        | string  | no       | see above    | Release author.                                                          |
| `dirPath`       | string  | no       | project root | Output directory, relative to the project root.                          |
| `skipFormat`    | boolean | no       | `false`      | Skip formatting generated files.                                         |

## Examples

```bash
# libs/shared/types/release-manifest.json, current git author and timestamp
pnpm nx g @cybertecpty/release-plugin:release-manifest shared-types 1.4.0 --releaseCommit abc123def4

# an explicit author and release date
pnpm nx g @cybertecpty/release-plugin:release-manifest shared-types 2.0.0 \
  --releaseCommit abc123def4 --author "Release Bot (bot@cybertecpty.com)" \
  --releaseDate 2026-04-22T15:30:00.000Z

# place the manifest under a subdirectory of the project
pnpm nx g @cybertecpty/release-plugin:release-manifest web 1.4.0 \
  --releaseCommit abc123def4 --dirPath public
```
