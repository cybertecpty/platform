# 1. Replace npm with pnpm

- Status: accepted
- Date: 2026-08-31 (proposed), 2026-09-01 (accepted)
- Deciders: djmcgrath
- Implemented by: #12 (core cutover), #13 (docs sweep), #14 (skill-mirror sweep)

## Context and problem statement

The `platform` Nx monorepo currently uses npm: `package.json` declares
`workspaces: ["packages/*"]`, a `package-lock.json` is committed, and CI runs `npm ci`.

The npm setup has drifted and is under-specified:

- `package-lock.json` has a stale root `name` (`@org/source`, vs `@cybertecpty/platform` in
  `package.json`) — the lockfile is not being maintained deliberately.
- There is no `packageManager` field, no `.nvmrc` / `.node-version`, and no `.npmrc`, so the
  package-manager version is whatever a given machine or CI runner happens to have.
- npm's flat, hoisted `node_modules` silently tolerates phantom dependencies, which will get
  harder to reason about as `packages/*` fills in.
- Repo docs and agent skills already reference pnpm in places (`link-workspace-packages`,
  `nx-plugins`, `nx-import`), so tooling guidance is inconsistent about which package manager
  this repo uses.

We want to standardise on one package manager, pin its version, and make installs reproducible
before the workspace grows.

## Decision drivers

- Reproducible, verifiable installs (frozen lockfile in CI).
- Strict dependency resolution — surface phantom/peer-dependency problems early.
- Deterministic package-manager version across dev machines and CI / Nx Cloud agents.
- Faster CI install via a content-addressable store.
- Keep Nx task running, caching, Nx Cloud distribution, and the release/publish flow unchanged.

## Considered options

1. **Stay on npm**, but fix it properly (pin via `packageManager`, add `.npmrc`, regenerate the
   lockfile).
2. **Switch to pnpm.**
3. **Switch to Yarn (Berry).**

## Decision outcome

Chosen option: **2 — switch to pnpm.**

- npm-fixed-properly (option 1) removes the version-pinning gap but keeps the hoisted layout and
  gives us nothing on install speed or strictness; the drift we are seeing is a symptom of npm
  being the path of least resistance rather than a deliberate choice.
- Yarn Berry (option 3) is a larger conceptual shift (PnP or its own node-linker, plugin model)
  for no advantage over pnpm in an Nx workspace, and Nx's first-class support is strongest for
  npm/pnpm/yarn-classic.
- pnpm gives us a strict isolated `node_modules`, a fast global store, `--frozen-lockfile`
  enforcement, and Corepack + Nx `manage-package-manager-versions` for a pinned version, while
  Nx treats pnpm as a first-class package manager.

### Locked parameters

- **Version:** pin `pnpm@10.34.5` exactly via the `packageManager` field (latest 10.x at
  decision time; bump to newest 10.x during implementation). Corepack + `.npmrc`
  `manage-package-manager-versions=true` enforce it.
- **`node-linker=isolated`** — pnpm's strict default. Breakage in tools that assume hoisting is
  fixed with targeted `public-hoist-pattern[]` entries (`@nx/*`, `@swc/*`, `*eslint*`), not by
  switching to `node-linker=hoisted`. Escalating to `hoisted` requires reopening this ADR.
- **`pnpm exec nx`** is the canonical way to invoke Nx everywhere — CI, docs, agent skills. No
  bare `npx nx`, no `pnpm nx`.
- **`only-allow pnpm`** guard as a `preinstall` script — an accidental `npm` / `yarn install`
  fails before it can write a competing lockfile.

## Consequences

### Positive

- One package manager, one lockfile, one pinned version.
- CI installs are reproducible (`--frozen-lockfile`) and faster (`cache: 'pnpm'` + store).
- Phantom-dependency bugs fail loudly at development time instead of leaking into published
  packages.

### Negative / risks

- Isolated `node_modules` can break tools that assume hoisting; mitigated with
  `public-hoist-pattern[]` and validated by a full `lint test build typecheck e2e` run.
- Every contributor must run `corepack enable` once; called out in `README.md`.
- Nx Cloud distributed agents must have pnpm available (covered by the `packageManager` field +
  `manage-package-manager-versions`; explicit agent setup step if not).
- One-time doc/skill sweep, including the Nx agent-skill mirrors under `.github/skills/`,
  `.agents/`, `.opencode/` and `.cursor/` (#14).

## More information

- Implementation is split across issues #12 (core cutover — this PR), #13 (human-facing docs
  sweep) and #14 (Nx agent-skill mirror sweep).
- Known Windows-local quirk found during the cutover: with pnpm supplied by the Corepack
  `.ps1` shim, the Nx **Cloud** post-run step can crash in teardown (`EISDIR ... lstat 'C:'`)
  and force a non-zero exit even though every task succeeded. Linux CI is unaffected. Local
  workaround: `NX_NO_CLOUD=true` for offline runs, or run tasks via WSL.
- `docs/agents/domain.md` — ADR location and numbering convention.
