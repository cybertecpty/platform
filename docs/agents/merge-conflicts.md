# Merge Conflicts on Shared Files

Read this when `git merge origin/develop` (or a PR's "conflicts" status) stops on a file
that several parallel PRs tend to touch. Sync a pushed branch by **merging** `develop`
into it, never by rebasing and force-pushing (`conventions.md` §2); an unpushed branch
may rebase. List what stopped with `git diff --name-only --diff-filter=U`.

## Resolution recipes

The files most often touched by parallel PRs (as of 2026-10-19): `docs/agents/conventions.md`,
`package.json`, `pnpm-lock.yaml`, `nx.json`, `.claude/skills/commit-push-pr/SKILL.md`,
`tsconfig.base.json`, `eslint.config.mjs`, and barrel `src/index.ts` files. Conflicts are
rare today (2 of 98 merged PRs would have conflicted) but get likelier as more agents run in
parallel.

Resolve, then confirm no markers remain (`git grep -n '^<<<<<<<'`) before committing.

- **`package.json` and `pnpm-lock.yaml`** — resolve `package.json` first: keep both sides'
  lines, keep the list alphabetical, keep the JSON valid. Then run `pnpm install`; pnpm
  rewrites a conflicted `pnpm-lock.yaml` itself (verified with pnpm 10.34.5), so never
  hand-edit the lockfile. Stage both files. If the lockfile is still wrong,
  `git checkout origin/develop -- pnpm-lock.yaml` and run `pnpm install` again.
- **Barrel `src/index.ts`** — keep every `export` line from both sides, sorted as the
  file already is. A conflict here is two PRs adding adjacent lines, never a real
  disagreement. Run `typecheck` for the project afterwards to catch a duplicate or
  dropped export.
- **`tsconfig.base.json` `paths`** — keep both entries, alphabetical by alias. The last
  entry has no trailing comma, so re-check commas when both sides appended at the end.
- **`nx.json`, `eslint.config.mjs`** — keep both additions; if both edited one entry,
  re-read the whole block rather than picking a side.
- **`docs/agents/conventions.md` and other Markdown tables** — Prettier re-pads a whole
  table when its widest cell changes, so one new row can rewrite every line. Take
  `develop`'s version of the table, re-apply your row, then run
  `pnpm exec prettier --write {file}`.
- **`.claude/skills/*/SKILL.md` numbered steps** — keep both sides' steps, renumber, and
  fix any "step N" cross-references in the file.

## Reducing collisions

- Append new rows and bullets at a distinct spot rather than the end of a list every PR
  extends; prefer adding a section over editing a shared table's widest column.
- Don't renumber steps or reflow a file you only need to add one line to.
- Merge `develop` into your branch before opening the PR when the files above overlap
  with another open PR.
