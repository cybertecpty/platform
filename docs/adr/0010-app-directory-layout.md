# 10. App physical layout — flat directory, explicit tags, exclusive naming

- Status: proposed
- Date: 2026-09-04
- Deciders: djmcgrath
- Implemented by (planned): the same wrapper generator planned in ADR 0009; the
  `type === 'app'` naming special case in `projectNameFromOpts`
  (`tools/nx/utils/src/lib/nx-projects.ts`) already implements the naming half of this
  ADR — directory placement and tag assignment do not yet have an implementation.

## Context and problem statement

ADR 0009 decided the physical layout and derived-naming formula for libs (and, by the
same grammar, `tools/`) — but scoped itself explicitly to those two, leaving `type:app`
(ADR 0004) unaddressed. Apps still need an answer to the same two mechanical questions
0009 asked for libs: where does an app's source live, and what is it called.

Naming turned out not to fit 0009's formula at all: an app doesn't have a `<type>`
segment worth deriving from (`type` is always `app`) or a natural `<group>` sibling to
disambiguate — it needs a name people recognize for branding, deployment, and app-store
purposes (`game-collector`, `game-collector-admin`), chosen outright rather than
composed. `projectNameFromOpts` already special-cases this: for `type: 'app'`, `name` is
required and returned exclusively, with `domain`/`group` ignored for naming purposes.
This ADR is the formal record of that decision and the two 0009 left open — directory
placement and how `domain:`/`scope:`/`type:` get assigned.

## Decision drivers

- Don't re-derive the name. The naming half is already decided and shipped
  (`projectNameFromOpts`'s `app` branch) — this ADR must not reopen it.
- An app's name is already independent of `domain`/`group` — deriving its _tags_ from a
  domain-shaped directory while its _name_ ignores that same directory would be an
  asymmetric model: part of the app's identity path-derived, part not, with no way to
  tell which from looking at the generator call.
- 0009's path-determines-tags guarantee exists to keep a lib's location and its tags from
  drifting apart. That guarantee only pays for itself when the path is _also_ the source
  of the name (so there's exactly one thing to keep in sync). Apps don't meet that
  precondition — the name is already an independent input — so reusing the same
  derive-from-path mechanism buys nothing here.
- Keep app scaffolding trivial: no registry lookup should be required to place a project
  whose name is already fully specified by the caller.
- `group` never carried a tag even for libs (ADR 0009: "cosmetic only"); for apps, which
  have no path segment for it to occupy either, it has nothing left to do at all.

## Considered options

1. **Flat `apps/<name>`; `domain`/`scope`/`type` passed as explicit tag values, not
   derived from the path.** **(chosen)**
2. Domain-nested `apps/<domain>/<name>`, but tags still set explicitly from flags
   (independent of placement) — colocates an app with its domain's libs, but duplicates
   the domain in two places (folder + flag) with nothing enforcing they agree, and buys
   none of 0009's derivation benefit since the tag isn't actually read from the path.
3. `apps/<domain>[/<subdomain>...]/<name>` with path-derived tags, reusing 0009's
   `workspaceDomains` registry and right-to-left parsing exactly as libs do. Rejected —
   this is the option originally drafted for this ADR; it recreates 0009's location↔tag
   coupling for a project type whose name deliberately never had that coupling, which is
   the asymmetry called out above.
4. No convention — decide per app. Rejected for the same reason 0009 rejected it for
   libs: it's the status-quo drift this whole effort exists to close.

## Decision outcome

Chosen option: **1**.

### Physical layout

```
apps/<name>
```

Flat — no domain or subdomain segment. `<name>` is exactly the value passed via `--name`
(the same value `projectNameFromOpts` already returns verbatim for `type: 'app'`).

Examples:

```
apps/game-collector             name=game-collector
apps/game-collector-admin       name=game-collector-admin
apps/checkout-api               name=checkout-api
```

### `domain:`/`scope:`/`type:` are explicit generator inputs, never derived from path

Unlike libs, an app's directory carries no information the generator parses back into
tags. `--domain`, `--scope`, and `--type` are passed directly to the generator and
stamped onto the project as `domain:<value>`, `scope:<value>`, `type:app` — useful for
`@nx/enforce-module-boundaries` (ADR 0004) exactly as they are for a lib, just supplied
outright instead of inferred. The generator may still validate `--domain` against
`workspaceDomains` (catching a typo'd domain the same way a lib's path-parse would), but
that's a validation nicety, not a derivation — the value still comes from the flag, not
from where the project lands on disk.

### `--group` has no effect for app projects

`--group` is accepted as part of `NxProjectOptions` generally (it's meaningful for libs
and `tools/`), but for `type: 'app'` it is ignored outright — it feeds neither the name
(already true; `projectNameFromOpts`'s app branch never reads it) nor a tag (it never
carried one) nor, under this decision, a directory segment. Passing `--group` to an app
generation call is a no-op.

### `type:e2e` follows its paired app

An e2e project sits beside the app it tests, in the same flat `apps/` directory, named
`<app-name>-e2e`:

```
apps/game-collector-e2e         (pairs with apps/game-collector)
```

Implementing this in `projectNameFromOpts` is follow-up work — `NxProjectType` and
`NX_PROJECT_TYPES` don't yet include `'e2e'`; this ADR fixes the placement/naming
_decision_, not the code.

## Consequences

### Positive

- No new registry-parsing mechanism for apps — the generator only has to accept flags and
  write tags, matching the naming behavior that's already shipped.
- One consistent story for an app's whole identity: name, domain, scope, and type are all
  explicit inputs, none of them inferred from where the folder happens to sit.
- Formally records the naming rule already shipped in `projectNameFromOpts`, closing the
  gap flagged in review (the code had no ADR backing it).
- `type:e2e` placement is decided in the same pass instead of left as an open question.

### Negative / risks

- No location-based safety net for apps: an app can be generated with `--domain billing`
  and nothing about `apps/checkout-api` on disk will ever confirm or contradict that,
  unlike a lib where a mis-tag and a mis-placement are the same mistake. A hand-edited
  `project.json` tag drifts from reality with nothing to catch it beyond the same
  `workspaceDomains` validation 0009 relies on for libs.
- A domain that ships both a frontend and a backend app (e.g. a web app and its API, both
  conceptually "game-collector") will collide on `<name>` in the flat `apps/` folder
  unless the caller chooses distinguishing names (`game-collector-web` /
  `game-collector-api`) — nothing in the layout disambiguates this automatically, since
  naming is exclusively the caller's choice. Nx's own duplicate-project-name check is the
  backstop, same as 0009.
- `type:e2e` naming/placement is decided here but not yet implemented — `NxProjectType`
  needs an `'e2e'` member and `projectNameFromOpts` needs an app-pairing branch before the
  wrapper generator can scaffold e2e projects.

## More information

- ADR 0009 (`lib-directory-layout`) — the lib/tools layout and domain registry this ADR
  deliberately does _not_ reuse for apps, and why.
- ADR 0004 (`nx-module-boundaries`) — `type:app`, `type:e2e`, and the `scope:`/`domain:`
  tags apps carry.
- ADR 0005 (`application-frameworks`) — Angular / NestJS, the two stacks `type:app`
  covers.
- `tools/nx/utils/src/lib/nx-projects.ts` — `projectNameFromOpts`'s `type === 'app'`
  branch, the already-shipped implementation of this ADR's naming decision.
