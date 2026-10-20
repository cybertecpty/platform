# Merge Conflicts on Shared Files

Read this when `git merge origin/develop` (or a PR's "conflicts" status) stops on a file
that several parallel PRs tend to touch. Sync a pushed branch by **merging** `develop`
into it, never by rebasing and force-pushing (`conventions.md` §2); an unpushed branch
may rebase. List what stopped with `git diff --name-only --diff-filter=U`.

## Which files conflict

Snapshot at `2f8e95a` (2026-10-19), ranked by how many merged PRs touched the file
(`git log --first-parent --name-only origin/develop`, one squash commit per PR):

| #   | File                                     | PRs | Why it collides                                                |
| --- | ---------------------------------------- | --- | -------------------------------------------------------------- |
| 1   | `docs/agents/conventions.md`             | 39  | Long shared doc; Markdown tables are re-padded by Prettier     |
| 2   | `package.json`                           | 26  | Alphabetical dependency lists; neighbours collide              |
| 3   | `pnpm-lock.yaml`                         | 18  | Generated; any two dependency changes touch overlapping blocks |
| 4   | `nx.json`                                | 16  | Plugin and target-default lists                                |
| 5   | `.claude/skills/commit-push-pr/SKILL.md` | 16  | Numbered steps; inserting one renumbers the rest               |
| 6   | `tsconfig.base.json`                     | 13  | One alphabetical `paths` line per library; neighbours collide  |
| 7   | `eslint.config.mjs`                      | 13  | Shared config array                                            |
| 8   | `tools/nx/utils/src/index.ts` (barrels)  | 7   | Barrel: one alphabetical `export *` line per module            |

Evidence that these are real, not just busy: of 98 merged PRs, 14 had `develop` move
under them after their first commit, and replaying each squash diff onto the `develop`
tip at branch time (`git merge-tree --write-tree --merge-base={parent} {base} {squash}`)
conflicted for 2 PRs, in `docs/agents/conventions.md`, `.claude/rules/testing.md` and
`tools/nx/plugin/src/lib/utils/plugin-project.utils.ts`. Squash-merging hides conflicts
that were resolved on the branch, so treat the counts as exposure, not a conflict tally.
Conflicts are rare today and get likelier as more agents run in parallel.

## Resolution recipes

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
