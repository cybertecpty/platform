# github-utils

Workspace tooling for GitHub operations driven through the `gh` CLI
(`scope:tools`, not application code). Consumed by the release plugin to open and
update the release pull request.

## Contents

- **`runGh`** (`src/lib/github-cli.utils.ts`) — thin wrapper around the `gh` CLI.
  Uses `execFile` (no shell) so arguments such as a PR title are never
  shell-interpreted, and rejects with `gh`'s stderr on a non-zero exit.
- **`createPullRequest` / `updatePullRequest` / `findOpenPullRequest`**
  (`src/lib/pull-request.utils.ts`) — open, edit, and look up a pull request for
  a `head → base` branch pair. Bodies are passed via a throwaway `--body-file`
  so long changelog bodies cannot hit OS command-line length limits.

## Tests

`nx test github-utils` — Jest via `ts-jest`. `runGh` and the `gh` calls are
exercised against a mocked `child_process` / `runGh`; no real `gh` invocation.
