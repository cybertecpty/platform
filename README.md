# platform

The CyberTec platform monorepo — an [Nx](https://nx.dev) workspace.

## Prerequisites

- **Node 24** (the version CI runs).
- **pnpm** — this workspace uses pnpm exclusively. Enable it once with `corepack enable`; the
  pinned version comes from `package.json`'s `packageManager` field. `npm` and `yarn` are
  blocked by a `preinstall` guard.

Install dependencies with `pnpm install`.

## Pre-commit formatting

`pnpm install` sets up a `husky` `pre-commit` hook that runs `lint-staged` — staged
JS/TS files get `eslint --fix` then `nx format:write`, other supported files get
`nx format:write`, and the changes are re-staged so the commit lands clean. It's a
convenience backstop; CI (`nx format:check`, `nx run-many -t lint`) is the real gate.
Bypass it with `git commit --no-verify`. The hook runs through `sh`, which Git for
Windows installs.

## Docs

- `docs/adr/` — architecture decision records.
- `docs/agents/` — how coding agents work in this repo (conventions, principles, issue tracker).
