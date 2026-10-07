# 9. Lib physical layout — domain-first folders, subdomains, and derived names

- Status: proposed
- Date: 2026-09-04
- Deciders: djmcgrath
- Implemented by (planned): path/name/tag derivation and validation functions in
  `nx-utils` (`tools/nx/utils`), imported directly by whichever plugin's generator(s)
  need to scaffold a project under this layout; a `workspaceDomains` map in `nx.json`;
  `depConstraints` additions in `eslint.config.mjs` (extends ADR 0004) — see the
  2026-09-15 amendment

## Context and problem statement

ADR 0004 defined the three-axis tag system (`scope:`, `type:`, `domain:`) and the
dependency-constraint matrix, but deliberately left physical layout and project naming
out of scope — at the time, "no product domains exist yet." This workspace is about to
host genuinely unrelated products (for example, a game-collecting app and an ecommerce
app), and every new lib now needs an answer to two mechanical questions before it can be
scaffolded: where does its source live, and what is it called. Answered ad hoc per lib,
these drift immediately — inconsistent nesting, inconsistent naming, no single
derivation a generator or a human can rely on, and no path from a project's tags back to
where it should sit.

`tools/` already has a working, simpler convention (`tools/<group>/<type>`, name
`<group>-<type>`, e.g. `tools/git/utils` → `git-utils`) that predates this ADR. It is
explicitly out of scope here — tools projects don't carry a `domain:` tag and aren't
expected to need one.

## Decision drivers

- One deterministic layout: given a project's tags (or a folder path), there is exactly
  one place it lives and one name it has.
- A domain's whole vertical slice (frontend, backend, and shared parts) should stay
  colocated — not fragmented across a top-level `scope:` split.
- Singleton libs (a domain's one `api`, one `infra`, one `models` lib) shouldn't need an
  invented, meaningless group segment.
- Product domains that need internal sub-areas (e.g. `billing/checkout` vs
  `billing/invoices`) should be able to express that without paying for full
  peer-to-peer isolation on every sub-area.
- Tags must be derivable from the path without parsing an ambiguous flat string — domain
  names, subdomain names, and lib names are all themselves multi-word/kebab.
- Don't disturb the working `tools/` convention.

## Considered options

1. `libs/<domain>/<type>/<group>` — type as the second segment, group last.
2. `libs/<domain>/<scope>/<type>-<group>` — scope as an explicit folder tier.
3. `libs/<domain>[/<subdomain>...]/[<group>/]<type>` — domain path (with optional
   subdomains) first, optional group, type last. **(chosen)**
4. No convention — decide per lib.
5. Same as 3, but always derive `<group>` from `<domain>[/<subdomain>...]` + `<type>` —
   no explicit `<group>` segment at all.

Option 1 groups by architectural layer instead of by product area, which was the whole
point of a domain-first layout; a domain's related libs (`feature`, `data-access`,
`api`, `services` for one area) end up scattered across type folders. Option 2 forces
every domain's tree to fork into `frontend/` / `backend/` / `iso/` subtrees, which
fragments a domain's vertical slice the same way and adds a folder tier that's largely
redundant for the eleven `type:` values `scope:` already pins. Option 4 is the status
quo ADR 0004 already flagged as a risk (mis-tagging, inconsistent nesting). Option 5 was
tempting — one less concept — but `type:feature`, `type:ui`, `type:data-access`,
`type:api`, and `type:services` are typically **many-per-domain**, not one; banning
`<group>` would force a subdomain (and a `workspaceDomains` entry) for every such lib
just to disambiguate it from its siblings, turning "subdomain" from an occasional
business boundary into a mandatory per-lib label and diluting what the `domain:` axis
means.

## Decision outcome

Chosen option: **3**.

### Physical layout

```
libs/<domain>[/<subdomain>...]/[<group>/]<type>
```

- **`<domain>`** — a top-level product/area (`game-collector`, `billing`, `shared`).
  Required.
- **`<subdomain>`** — zero or more additional path segments under the domain
  (`billing/checkout`). Optional. `/` is the only hierarchy separator — `-` is reserved
  for joining words within one segment (`game-collector`, `collection-browser`), so a
  `--domain` value like `billing/checkout` is unambiguous to parse, while
  `game-collector-checkout` would not be.
- **`<group>`** — an optional label for a lib within its (sub)domain
  (`collection-browser`, `orchestration`). A group is **cosmetic only** — unlike a
  subdomain, it carries no tag and no enforcement. Set with `--group`; distinct from
  `--name` (below).
- **`<type>`** — always the last segment, one of ADR 0004's closed `type:` values.

Examples:

```
libs/shared/design-system/ui                       domain=shared                          group=design-system        type=ui          → design-system-ui [^1]
libs/game-collector/api                             domain=game-collector                  (no group)                 type=api         → game-collector-api
libs/game-collector/collection-browser/feature      domain=game-collector                  group=collection-browser   type=feature     → game-collector-collection-browser-feature
libs/billing/checkout/data-access                   domain=billing  subdomain=checkout     (no group)                 type=data-access → billing-checkout-data-access
libs/billing/checkout/orchestration/services        domain=billing  subdomain=checkout     group=orchestration        type=services    → billing-checkout-orchestration-services
libs/billing/invoices/api                           domain=billing  subdomain=invoices     (no group)                 type=api         → billing-invoices-api
```

[^1]:
    The `shared` domain drops from the _name_ here, though not from the directory —
    see the 2026-09-19 amendment below.

### Group derivation vs. `--name`

`<group>` stays, but it is **expected, not merely optional** — whether to supply it
depends on how many libs of that type a domain will genuinely have, not on convenience:

| typically **one** per domain — `<group>` omittable | typically **several** per domain — `<group>` expected                 |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `infra`, `models`, `core` (one per app)            | `feature`, `ui`, `data-access`, `api`, `services`, `utils`, `testing` |

For the right-hand column, supply `--group` on the very first lib. Treating omission as
the default for these types just defers the rename to whenever the second lib of that
type shows up — which, for `feature` in particular, is expected from the start.

`--group` and `--name` are two separate flags answering two different questions, and are
never resolved from the same input:

- **`--group`** feeds the derivation formula. Given, it's a path segment (`<group>/<type>`)
  composed into the project name (`<domain>[-<subdomain>]-<group>-<type>`); omitted, the
  path and name collapse to `<domain>[-<subdomain>...]-<type>`.
- **`--name`** is Nx's own literal-override flag, passed straight through to the
  underlying `@nx/*:library` generator unchanged. Given, it replaces the _derived name
  outright_ — `--group` and the formula are bypassed entirely for naming purposes — but
  it does **not** change _where the lib lives_: the directory still follows
  `--domain`/`--subdomain`/`--group`/`--type` exactly as it would without `--name`. Use
  it to register a lib under an arbitrary name (e.g. preserving an existing project's
  name while relocating it into this convention) without otherwise touching placement.
- **The wrapper generator exposes no `--directory` passthrough.** Unlike `--name`,
  directory placement isn't cosmetic — it's what the domain registry parses to derive
  `scope:`/`type:`/`domain:` tags in the first place (see "Domain registry"). A raw
  directory override would let a lib's physical location diverge from what its
  `--domain`/`--subdomain`/`--group`/`--type` inputs say, breaking the ADR's core
  guarantee that location determines tags — exactly the mis-tagging risk this ADR and
  ADR 0004 exist to close. A lib that genuinely can't be expressed by the grammar is
  opting out of this convention, not using an escape hatch within it: create it with the
  underlying `@nx/angular:library` / `@nx/js:library` / `@nx/nest:library` generator
  directly and set its tags by hand, bypassing the wrapper entirely.
- Nx's own duplicate-project-name check is the backstop either way — a collision fails
  generation rather than silently overwriting.
- `<group>` carries no tag and no enforcement — that is what separates it from a
  subdomain (below). Don't reach for it as a substitute for genuine isolation; a grouped
  lib that needs to be walled off from its siblings should be a subdomain instead.
- **Migration cost, reduced but not eliminated:** a domain-singleton lib created without
  a group still has to be renamed if a second lib of that type shows up later. Use
  `nx g @nx/workspace:move` (`docs/agents/conventions.md` §11) rather than `git mv`.

### Scope on the polymorphic types

`type:utils`, `type:testing`, and `type:types` are the three `type:` values where
`scope:` isn't implied by the type (see the ADR 0004 amendment below) — a `utils` lib
can be `scope:frontend`, `scope:backend`, or `scope:shared`, and nothing else about the
type says which. Considered encoding a scope hint into `<group>` (a `frontend-` /
`backend-` prefix) so it would be visible from the path. Rejected:
`@nx/enforce-module-boundaries` already enforces the real constraint off the `scope:`
tag, independent of what a lib is named — a mis-scoped import fails `nx lint` regardless
of naming. A naming convention would only have bought path-level readability, at the
cost of a second name/tag invariant to keep in sync (a generator special case, plus a CI
conformance check to catch a hand-edited `project.json`). Not worth it: `scope:` for
these three types lives in the tag alone, exactly like the other eleven types. Check it
with `nx show project <project-name>` or the Nx graph when it isn't obvious from context.

### Subdomains: tag semantics

A subdomain **is** part of the `domain:` axis, not cosmetic grouping — that distinction
is what separates it from `<group>`. It gets a compound, flattened tag:
`domain:<domain>-<subdomain>` (e.g. `domain:billing-checkout`).

This extends ADR 0004's constraint matrix with one **family-scoped, glob-matched** row
per top-level domain that has subdomains, instead of one row per subdomain:

```js
{
  sourceTag: 'domain:billing*',
  onlyDependOnLibsWithTags: ['domain:billing*', 'domain:shared']
}
```

This isolates the `billing` family from every other domain, but **does not** isolate
`billing-checkout` from `billing-invoices` — siblings and the parent domain may freely
depend on each other. That is a deliberate, looser default: a subdomain is an
organizational split within one team's area, not a hard product boundary. A subdomain
that later needs peer isolation gets its own explicit constraint row, or graduates to a
top-level domain.

### Domain registry

`nx.json` gains a `workspaceDomains` map — the machine-readable companion to ADR 0004's
"each domain is added by its own ADR":

```jsonc
"workspaceDomains": {
  "shared": {},
  "game-collector": {},
  "billing": { "subdomains": ["checkout", "invoices"] }
}
```

The wrapper generator (and any other tooling that needs to go from a path to
`scope:`/`type:`/`domain:` tags) parses right-to-left: the last segment is always
`type` (closed set), and the longest registered domain/subdomain prefix is matched
against this map — whatever's left between the domain path and the type is `<group>`.
Without the registry, a path like `libs/game-collector/collection-browser/feature` is
ambiguous purely from string shape (is `collection-browser` a subdomain or a group?).

### `tools/`: same grammar, no domain axis

`tools/[<group>/]<type>` is the same grammar as `libs/` with the domain/subdomain axis
removed — not a separate convention: `tools/git/utils` → `git-utils`,
`tools/nx/plugin` → `nx-plugin`. The same `<group>` guidance applies (omittable for a
genuine type-singleton, expected once a second lib of that type exists) — in practice
every current tools project already supplies one, since without a domain segment a bare
`tools/<type>` folder has nothing to anchor it. Tools projects carry `scope:tools`, not
a `domain:` tag, so they need no `workspaceDomains` entry.

### Amendment to ADR 0004

- Drops the "isomorphic" claim from `type:utils`'s description. Framework-bound
  (`scope:frontend` / `scope:backend`) util libs are legitimate — an Angular-only
  `takeUntilDestroyed` wrapper or a Nest-only `ExecutionContext` helper is still
  `type:utils`, just not `scope:shared`. `type:utils` spans all three scopes, the same
  as `type:testing`.
- Adds compound subdomain tags (`domain:<domain>-<subdomain>`) and family-scoped glob
  constraint rows as a supported shape of the `domain:` axis, alongside the existing
  flat `domain:<product>` form.

## Consequences

### Positive

- One deterministic layout and naming rule; a lib's location fully determines its
  `domain:`/`type:` tags (and, for the eleven non-polymorphic `type:` values, its
  `scope:` too).
- Singleton domain libs need no invented group (`billing-checkout-api`, not
  `billing-checkout-core-api`).
- A domain's whole vertical slice stays colocated under one folder.
- Subdomains give a team a lighter, family-scoped isolation option without paying for
  full peer-to-peer domain constraints on every sub-area.
- `workspaceDomains` gives generators — and future audit tooling — one source of truth
  instead of inferring convention from existing folders.

### Negative / risks

- Adding a `<group>` to a lib that started without one is a rename + import-specifier
  churn (mitigated by `nx g @nx/workspace:move`, but still a diff).
- Subdomain isolation is family-scoped, not sibling-scoped, by default —
  `billing-checkout` and `billing-invoices` can import each other freely. A team that
  wants sibling isolation must add an explicit row per subdomain (verbose) or graduate
  the subdomain to a full top-level domain.
- `scope:` has no representation in the path for the three scope-polymorphic types
  (`type:utils`, `type:testing`, `type:types`) — a frontend-only
  `libs/shared/rxjs/utils`-style lib is distinguishable only by its tag, not its
  location. **Accepted deliberately** (see "Scope on the polymorphic types" above) —
  `@nx/enforce-module-boundaries` enforces off the tag regardless, so this is a
  readability trade-off, not a gap in the boundary.
- `workspaceDomains` is a second place — besides the ADR trail and the tags themselves —
  that must stay in sync with reality; nothing enforces that yet beyond the generator
  reading it.
- Adds a wrapper generator that must track `@nx/angular:library` / `@nx/js:library` /
  `@nx/nest:library` as those evolve.

## More information

- ADR 0004 (`nx-module-boundaries`) — the tag system and constraint matrix this ADR
  extends.
- ADR 0005 (`application-frameworks`) — Angular / NestJS, the frameworks whose libs this
  layout organizes.
- `docs/agents/conventions.md` §11 — `nx g @nx/workspace:move` for relocating a project.

## Amendment (2026-09-15): derivation logic lives in `nx-utils`, consumed directly by each plugin's own generators

- Status: accepted
- Deciders: djmcgrath
- Implemented by (planned): path/name derivation, the `workspaceDomains` parse, and tag
  computation as exported functions in `tools/nx/utils`, imported directly by whichever
  plugin project's generator needs to scaffold a project under this layout

As originally written, this ADR's "Implemented by" line described a single workspace
generator — living in `nx-plugin` — that both derives the ADR 0009 layout (path, name,
tags) from `--domain`/`--subdomain`/`--group`/`--type` (or the reverse, from a path) and
performs the scaffolding by dispatching to `@nx/angular:library` / `@nx/js:library` /
`@nx/nest:library`. This amendment removes that single generator: there is no
ADR-0009-owned wrapper, and no requirement that library scaffolding be funneled through
`nx-plugin` specifically.

### Decision

- **Derivation and validation are pure functions in `nx-utils`.** Given
  `--domain`/`--subdomain`/`--group`/`--type`, compute the project path, derived name,
  and `scope:`/`type:`/`domain:` tags; given a path, parse it against `workspaceDomains`
  (right-to-left: `type` last, longest registered domain/subdomain prefix, remainder is
  `group`) into the same. No Nx `Tree` access, no calls to other generators — plain
  functions, testable the same way as `release-pr.utils` and `git-utils` already are in
  this workspace.
- **No single wrapper generator.** Any generator, in any `type:plugin` project —
  `nx-plugin`, `release-plugin`, `node-plugin`, or a future plugin scaffolded via
  `nx-gen` — that needs to create a project under the ADR 0009 layout imports these
  functions directly from `nx-utils`, and is itself responsible for delegating to
  whichever underlying `@nx/*:library` generator it needs and writing the computed tags
  into the generated `project.json`. This ADR does not require a central lib-creation
  entry point that every such generator must go through.
- **No change to ADR 0004 module boundaries.** `type:plugin` is already permitted to
  depend on `type:utils` (`eslint.config.mjs`), so any plugin's generator importing from
  `nx-utils` needs no new `depConstraints` row, regardless of which plugin it lives in.

### Rationale

- Matches the pure/impure split this workspace already committed to elsewhere
  (`release-pr.utils`, `git-utils`), and keeps that split generic — `nx-utils` is a
  shared, framework-agnostic convention library, not something scoped to one plugin's
  generator.
- Avoids inventing a mandatory choke point. Nothing about the ADR 0009 layout rule
  requires that every library be created through one entry point; plugins already
  scaffold their own purpose-built generators (via `nx-gen`), and each is free to
  consume `nx-utils` for layout/tag correctness independently.
- Closes part of a gap this ADR already flagged under "Negative / risks": nothing
  enforces `workspaceDomains`/tag consistency "beyond the generator reading it." Pure,
  exported functions in `nx-utils` remain reusable by other tooling — a CI conformance
  check (in the shape of `audit-drift`), a lint rule, or a future audit script — to
  validate that an existing project's path matches its tags, independent of which (if
  any) generator created it.
- Easier to reach the ADR 0007 80%-coverage floor: pure derivation/parsing logic is
  cheap to hit full branch coverage on in isolation, versus asserting it jointly with a
  specific generator's `Tree` side effects.

### Consequences

- No new dependency edge beyond generator → `nx-utils`, already allowed by existing
  `depConstraints`.
- Removes the implicit assumption that `nx-plugin` is "the" home for ADR 0009
  enforcement — it is one of potentially several plugins whose generators may consume
  `nx-utils`, not a required intermediary.
- Each generator that consumes `nx-utils` narrows its own tests to option-parsing and
  delegation (mocking/spying the underlying `@nx/*:library` generator and the `nx-utils`
  calls), while the derivation/validation logic gets one shared, focused spec file in
  `nx-utils` rather than being re-tested per generator.
- Which plugin(s) actually build a library-scaffolding generator first is left open —
  this ADR no longer prescribes it, only the shared derivation logic those generators
  must use.

## Amendment (2026-09-19): the `shared` domain drops from the name once a group is present

- Status: accepted
- Deciders: djmcgrath
- Implemented by: `projectNameFromOpts` in `tools/nx/utils/src/lib/nx-projects.utils.ts`

`shared-fs-utils` (the first grouped `shared`-domain library scaffolded since this ADR
landed) read as noisier than it needed to: `shared` stacked in front of an
already-specific group (`fs`) added a word without adding information — nothing in this
workspace is ambiguous about whether `fs-utils` is shared, since `scope:`/`domain:` tags
carry that, not the name. Domains with real product identity (`billing`, `game-collector`)
don't have this problem — the domain name itself is the information a reader needs
(`game-collector-collection-browser-feature`).

### Decision

- **`projectNameFromOpts` drops the `domain` segment from the derived name when, and
  only when, `domain` is the literal string `shared` **and** a `group` is also
  provided.** `libs/shared/fs/utils` → `fs-utils`, not `shared-fs-utils`.
- **A group-less `shared` project is unaffected.** `libs/shared/utils` and
  `libs/shared/types` keep their names (`shared-utils`, `shared-types`) exactly as
  before — the domain-singleton case has nothing to disambiguate, so `shared` still
  carries information there.
- **Directory placement does not change.** `projectDirFromOpts` still places a grouped
  `shared`-domain project under `libs/shared/<group>/<type>`, and its `domain:shared` tag
  is unaffected — both are derived from the path, not the name, per the 2026-09-15
  amendment above. This is the same kind of location/name divergence the base ADR
  already allows via `--name`, just automatic for this one domain instead of requiring
  an explicit override every time.
- **Narrow and literal on purpose.** This does not extend to a future `shared`
  subdomain (`domain:shared-<subdomain>` would still keep `shared` in the name) or to
  any other domain that might feel similarly generic — either would need its own
  decision, not an inferred generalization of this one.

### Rationale

- The whole point of a `<group>` is to be specific enough to stand on its own next to
  a `<type>` (`fs-utils`, `design-system-ui`) — for every other domain, prefixing it
  with the domain name adds real information (which product area). For `shared`
  specifically, "shared" is closer to `scope:`/`type:`'s job than `domain:`'s: it says
  "not product-specific," not "which thing." A reader scanning project names benefits
  more from `fs-utils` reading like a self-contained utility than from a domain label
  that's true of every sibling in `libs/shared/`.
- Keeping this exception literal to the domain string `shared` (not "any single-word
  domain," not "any domain the deciders find generic") avoids turning a specific,
  reviewable call into an ambiguous general rule a future generator author would have
  to interpret.

### Consequences

- **Positive:** shorter, less redundant names for the case this workspace already has
  the most of — cross-cutting, grouped `shared` utilities are exactly the `type:utils`/
  `type:testing` "many-per-domain" case ADR 0009 already expects `group` to be supplied
  for from the first library.
- **Negative / risk:** a grouped `shared` project's name no longer matches its directory
  path segment-for-segment, which `projectDirFromOpts`'s docstring used to guarantee
  ("the same options yield a directory and a name that agree") — now stated as the one
  documented exception instead. A human skimming just the project name (not the `nx
show project` output or the folder) could momentarily read `fs-utils` as a top-level
  `libs/fs-utils`-style project rather than `libs/shared/fs/utils`.
- **Negative / risk:** widens the name-collision surface described in the base ADR's
  "Nx's own duplicate-project-name check is the backstop" note — a grouped `shared`
  project's name (`<group>-<type>`) can now collide with a hypothetical future product
  domain's _ungrouped_ singleton of the same type (e.g. a domain literally named `fs`
  with an ungrouped `type:utils` lib would also want `fs-utils`). Caught at generation
  time by Nx's duplicate-name check, not silently — but it is a new way for `nx g
ts-lib`/equivalent to fail that didn't previously exist.
- No change to tag derivation, `workspaceDomains` parsing, or any `depConstraints` row —
  this amendment touches naming only.
