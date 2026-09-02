# 5. Application frameworks — Angular (frontend) and NestJS (backend)

- Status: accepted
- Date: 2026-09-02
- Deciders: djmcgrath
- Implemented by: `pnpm exec nx add @nx/angular` / `@nx/nest`; the TypeScript-layout
  conversion in the same change; this ADR

## Context and problem statement

ADRs 0003 (`frontend-bundle-hygiene`) and 0004 (`nx-module-boundaries`) both assume a
concrete application stack — "Angular browser applications alongside NestJS services" — and
each defers the actual commitment to "a separate, pending ADR". The `type:` tag catalog in
ADR 0004 (`type:core` / `type:feature` for Angular, `type:api` / `type:services` for Nest)
is built directly around that pairing. This ADR is that commitment.

Nothing about the frameworks has been installed yet. The workspace also has no application
code — `packages/` holds only `.gitkeep` — so this is the cheapest point to lock the stack
and to fix any workspace configuration the stack requires.

### The TypeScript-layout conflict

The workspace was scaffolded with Nx's current default: the **"Workspaces + TypeScript
project references"** setup (`pnpm-workspace.yaml` package globs, `tsconfig.base.json` with
`composite: true` + `customConditions`, a solution-style root `tsconfig.json`, and the
`@nx/js/typescript` inference plugin).

Angular does not support TypeScript project references — the Angular compiler and
`ng-packagr` both reject a `composite` setup (angular/angular#37276). `nx add @nx/angular`
fails outright against this workspace:

> The "@nx/angular" plugin doesn't support the existing TypeScript setup.

Nx's own guidance is that Angular-inclusive monorepos stay on the older **path-alias**
setup (`tsconfig.base.json` `compilerOptions.paths`, no project references), and its
`angular-monorepo` preset generates exactly that. `@nx/nest` works with either setup;
only Angular forces the choice.

This layout was never itself recorded in an ADR — it came from the scaffold default, not a
decision. ADR 0001 (pnpm) is unaffected: package manager, `node-linker=isolated`, the
`only-allow pnpm` guard, and `pnpm exec nx` all stay exactly as they are. Only the
TypeScript project model changes.

## Decision drivers

- ADRs 0003 and 0004 are already written around Angular + NestJS; leaving the stack
  formally undecided keeps two accepted ADRs resting on an assumption.
- The frontend and backend should share one language and one wire-contract representation
  (the `type:models` zod libs in ADR 0004).
- Framework tooling should be first-class in Nx — plugin-managed generators, executors,
  inference, and migrations — not hand-wired.
- The TypeScript layout has to support the frontend framework. A setup Angular cannot use
  is not a viable option regardless of its other merits.
- Fix foundational configuration while the workspace is empty, not after projects depend
  on it.

## Considered options

### Frontend framework

1. **Angular.**
2. **React** (with a meta-framework or a hand-assembled stack).
3. **Vue / Svelte / SolidJS.**

### Backend framework

1. **NestJS.**
2. **Fastify / Express directly.**
3. **A different opinionated framework** (AdonisJS, tRPC-first, etc.).

### TypeScript layout (given Angular)

A. **Convert to the path-alias setup now** — while the workspace is empty.
B. **Keep project references, force Angular** with `NX_IGNORE_UNSUPPORTED_TS_SETUP=true`.
C. **Split the setup** — project references for backend libs, path-alias for frontend.

## Decision outcome

**Frontend: Angular. Backend: NestJS. TypeScript layout: path-alias (option A).**

### Frontend — Angular

- Angular is a batteries-included framework: router, forms, HTTP, DI, and a build system
  in one versioned unit with a single upgrade path (`ng update` / `nx migrate`), rather
  than a set of independently-versioned libraries to keep in sync (option 2).
- Its dependency-injection model is the same mental model as NestJS on the backend — one
  DI story across the stack.
- `@nx/angular` is one of the most mature Nx plugins; the `type:core` / `type:feature` /
  `type:ui` / `type:data-access` split in ADR 0004 maps directly onto Angular's
  library-type conventions.
- Cost: Angular cannot use TypeScript project references (see layout decision below), and
  its bundle-size defaults need active management — ADR 0003 already put the zod/lodash
  guardrails in place for this reason.

### Backend — NestJS

- NestJS gives the backend the same architectural vocabulary the tag matrix already uses:
  modules, controllers (`type:api`), injectable providers (`type:services`), and a DI
  container. Options 2 and 3 would leave `type:api` / `type:services` as a convention with
  no framework behind it.
- First-class Nx support via `@nx/nest` (built on `@nx/node`).
- Same DI model as the Angular frontend.

### TypeScript layout — path-alias (option A)

- Option B (`NX_IGNORE_UNSUPPORTED_TS_SETUP`) is an escape hatch, not a supported
  configuration. Angular buildable/publishable libraries (`ng-packagr`) and parts of the
  Angular compiler genuinely do not work with `composite`; the flag suppresses the check,
  not the underlying incompatibility. Breakage would surface later, under load, on an
  Angular upgrade.
- Option C (split setup) doubles the mental model, breaks cross-cutting `nx` graph and
  typecheck behaviour, and still can't share a `type:models` lib between a project-
  references backend and a path-alias frontend cleanly.
- Option A is Nx's recommended layout for this stack and the only one Angular fully
  supports. Done now, against an empty `packages/`, it touches only configuration files
  and no code.

### Locked parameters

- **Frontend framework: Angular. Backend framework: NestJS.** Adding a third application
  stack (a CLI, a worker runtime, a second frontend framework) requires a new ADR and,
  per ADR 0004, new `type:` tag values.
- **Framework tooling is the Nx plugins** — `@nx/angular` and `@nx/nest`, pinned to the
  workspace Nx version (currently `23.1.1`, matched exactly, consistent with the other
  `@nx/*` packages). Adding Angular or Nest capability goes through the plugin
  (`nx g @nx/angular:*` / `@nx/nest:*`, `nx add`), not hand-installed `@angular/*` /
  `@nestjs/*` packages.
- **Framework major versions track what the pinned plugin supports**, not "latest":
  - **Angular 22** — the current major; `@nx/angular@23.1.1` supports Angular 20–22.
  - **NestJS 11** — `@nx/nest@23.1.1` scaffolds Nest 11 (`@nestjs/schematics@^11`;
    `@nx/node` peer range `>=10 <12`). NestJS 12 is released but out of the plugin's
    range; the workspace moves to Nest 12 when a `@nx/*` release supports it, via
    `nx migrate`.
  - Framework upgrades run through `nx migrate` on the plugin, not ad-hoc `package.json`
    edits.
- **TypeScript layout: path-alias.** `tsconfig.base.json` carries `compilerOptions.paths`
  (populated per-project by generators); no `composite`, no `customConditions`, no
  `emitDeclarationOnly`. There is no `@nx/js/typescript` plugin in `nx.json`. Returning to
  project references requires reopening this ADR (and would re-break Angular).
- **`pnpm-workspace.yaml` stays.** `packages/*` remains the project root glob. Path-alias
  Nx libraries carry no own `package.json`, so the glob matches nothing today; the file is
  retained because worktrees under `.claude/worktrees/` resolve their pnpm workspace root
  by walking up, and removing it made the worktree bleed into the parent clone's install.
- **ADR 0001 is untouched.** pnpm, `pnpm@10.34.5`, `node-linker=isolated`,
  `public-hoist-pattern[]`-not-`hoisted`, `only-allow pnpm`, `pnpm exec nx` — all
  unchanged. This ADR changes the TypeScript project model only.
- **ADR 0004's tag catalog is unaffected.** `@nx/enforce-module-boundaries` reads project
  tags identically under both TypeScript layouts; the matrix ships as-is.

## Consequences

### Positive

- ADRs 0003 and 0004 no longer rest on a pending decision — the stack they describe is
  installed.
- One language, one DI model, one wire-contract representation across frontend and
  backend.
- Framework capability, upgrades, and code generation are plugin-managed
  (`nx g`, `nx migrate`).
- The workspace configuration now matches what the frontend framework supports; a future
  `nx add @nx/angular:application` will succeed instead of erroring.
- The layout conversion landed against zero application code — the cheapest it will ever
  be.

### Negative / risks

- **Path-alias is a one-way move in Nx's tooling.** Nx provides a generator to migrate
  _to_ project references, not back. Reversing this decision is a manual conversion.
- **No project-references build speedup.** The path-alias setup rebuilds/type-checks more
  broadly than an incremental `composite` graph would. Acceptable at current scale; Nx
  task caching and affected-detection are the mitigation.
- **NestJS sits one major behind latest** (11 vs 12) until the Nx plugins catch up. Newer
  Nest features are unavailable in the meantime.
- **Angular bundle discipline is now load-bearing.** ADR 0003's guardrails matter more
  with a real Angular app in the tree; they remain inert until a frontend project has a
  `lint` target in CI.
- The `type:` catalog in ADR 0004 is now committed to this exact pairing — a third stack
  is a two-ADR change (this one + 0004).
- `tsconfig.base.json` now sets `experimentalDecorators` / `emitDecoratorMetadata`
  workspace-wide (both frameworks need them), and `lib` includes `dom` — a Node-only lib
  that wants to exclude `dom` overrides `lib` in its own tsconfig.

## More information

- `tsconfig.base.json`, `nx.json` — the path-alias configuration (this change).
- `package.json` — `@nx/angular`, `@nx/nest` (+ `@nx/node`, `@nx/rspack`, `@nx/webpack`,
  `@nestjs/schematics`, `@angular-devkit/core` pulled in by the two `init` generators).
- ADR 0003 (`frontend-bundle-hygiene`) and ADR 0004 (`nx-module-boundaries`) — the
  "pending frameworks ADR" they each reference is this one.
- ADR 0001 (`replace-npm-with-pnpm`) — unchanged by this decision; noted here to record
  that the pnpm setup was reviewed and deliberately left alone.
- Nx docs: "A New Nx Experience for TypeScript Monorepos" (why Angular monorepos stay on
  the path-alias setup), the `@nx/angular` and `@nx/nest` plugin overviews, and
  `nx migrate`.
- angular/angular#37276 — Angular + TypeScript project references incompatibility.
- nrwl/nx#29940, #30540 — `@nx/angular` generators reject the project-references setup.
