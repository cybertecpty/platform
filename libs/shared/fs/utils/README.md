# shared-fs-utils

Filesystem-related utilities shared across `scope:backend` (Node-only) projects.

## Contents

- **`FileArchiver`** — abstract base for building a zip or tar(.gz) archive from a set of
  in-memory/streamed sources, wrapping the `archiver` package. Two concrete strategies:
  - **`FileBufferArchiver`** — resolves with the complete archive as a `Buffer`. Simplest
    to use; memory cost scales with archive size.
  - **`FileStreamArchiver`** — resolves immediately with a `Readable` emitting archive
    bytes as they're produced. Memory use stays bounded regardless of archive size;
    prefer this for large/unbounded sources or when piping straight to another stream
    (an HTTP response, blob storage upload, etc.).

  Both expose `.zip()` / `.tar()` convenience methods with sane, fully-overridable
  compression defaults (max compression; `gzip: true` for tar), plus the lower-level
  `.archive(format, options)` for anything else.

## Tests

`nx test shared-fs-utils` — Jest, exercising the real `archiver` dependency (no mocking)
and verifying output by round-tripping through `adm-zip` / `tar` (dev-only, test-only
dependencies).
