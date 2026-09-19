# `file-archive` generator

Walks a source directory and writes every file under it into a single `.zip` or `.tar` archive,
built on `FileBufferArchiver` from [`@cybertecpty/fs-utils`](../../../../../../libs/shared/fs/utils).

## What it does

- Recursively collects every file under `source`, regardless of `.gitignore` status — this also
  works against untracked build output (e.g. `dist/`).
- Preserves `source`'s internal directory structure as the archive's entry names.
- Defaults the archive to `<source>/<basename(source)>.<format>`; `destination` and `filename`
  override either half of that path independently.
- Excludes the archive's own resolved output path from the walk, so re-running the generator
  (especially with `--overwrite`) never embeds a previous run's archive inside the new one.
- Warns and no-ops, rather than erroring, when `source` contains no files, or when the resolved
  archive path already exists and `--overwrite` was not passed.
- Supports `format: 'tar'`, always writing an uncompressed tar (`gzip: false`) — `FileArchiver`
  gzips by default, but this generator's `.tar` extension should always match plain tar bytes.
- No `formatFiles` call — the output is a binary archive, not source text.

Returns the workspace-relative archive path, whether or not it was written this run, so a caller
composing this generator programmatically can always locate the output.

## Usage

```bash
pnpm nx g node-plugin:file-archive <source> [destination] [options]
```

## Options

| Option        | Type    | Required | Default                       | Notes                                                    |
| ------------- | ------- | -------- | ----------------------------- | -------------------------------------------------------- |
| `source`      | string  | yes      | —                             | Positional 0. Directory to archive.                      |
| `destination` | string  | no       | `source`                      | Positional 1. Directory the archive is written into.     |
| `filename`    | string  | no       | `<basename(source)>.<format>` | Archive filename, written under `destination`.           |
| `format`      | string  | no       | `'zip'`                       | `'zip' \| 'tar'`. `'tar'` is always uncompressed.        |
| `overwrite`   | boolean | no       | `false`                       | Replace an existing archive at the resolved output path. |

## Examples

```bash
# dist/web/web.zip, from every file under dist/web
pnpm nx g node-plugin:file-archive dist/web

# an uncompressed tar with an explicit name, written elsewhere
pnpm nx g node-plugin:file-archive dist/web dist/archives --filename=web-build.tar --format=tar

# regenerate an archive that already exists
pnpm nx g node-plugin:file-archive dist/web --overwrite
```
