# 23. App-owned libraries — `--app` places a lib under its app and tags it `app:<name>`

- Status: proposed
- Date: 2026-11-28
- Deciders: djmcgrath
- Implemented by: issue #405: an `app` option in `projectDirFromOpts` and `projectTagsFromOptions`
  and `assertOwningApp` (`tools/nx/utils`), the `--app` option of `ng-lib` (`tools/angular/plugin`)
  and `ts-lib` (`tools/js/plugin`), and the app-owned import blocks in `eslint.config.mjs`
  (`appOwnedLibAliases`, `appOwnedImportBlocks`)
- Amends: ADR 0004, ADR 0009 and ADR 0010; each carries a 2026-11-28 amendment pointing here

## Context and problem statement

Every lib lives under `libs/` (ADR 0009) and every app is a flat `apps/<name>` (ADR 0010). That
fits a lib that more than one project uses. It fits badly a lib that exists for one app: a
`type:core` lib holding the app's providers, or a `type:feature` lib that only that app routes to.
Such a lib sits in `libs/` looking reusable, nothing stops another project importing it, and
deleting or moving the app leaves its libs behind with no sign they were its own.

`apps/<app>/e2e` already shows the pattern: a project nested in the app folder it belongs to
(ADR 0010, 2026-10-09 amendment). This ADR extends it to libs, and adds a tag so the ownership is
visible to the module-boundary rules and not only to the folder.

## Decision drivers

- **Ownership is visible in the path.** A reader of `apps/<app>/...` sees what belongs to the app.
- **One derivation.** The directory below the app is the directory a lib already has, so a lib
  moves between `libs/` and an app by changing one prefix.
- **No `--directory` escape hatch.** ADR 0009 refuses a raw directory so that location and tags
  agree; `--app` must not reopen that.
- **Don't disturb the domain axis.** ADR 0004's 2026-10-27 amendment says a domain should not mix
  apps and libs, because rows only restrict and a lib isolation row would bind the apps.
- **Fail loudly.** A bad `--app` writes nothing.

## Considered options

1. **Tag only: keep app libs in `libs/`, add `app:<name>`.** Rejected: the path says nothing about
   ownership, and deleting an app leaves its libs.
2. **Nest the lib under its app and tag it `app:<name>`.** **(chosen)**
3. **Use `domain:<app>` instead of a new axis.** Rejected: `domain:` names a product area, and an
   app is a composition root across domains (ADR 0004, 2026-10-27 amendment). Tagging an app's libs
   with the app's domain would also mix apps and libs in one domain, which that amendment warns
   against.
4. **A `--directory` passthrough.** Rejected for the reason in ADR 0009.

## Decision outcome

Chosen option: **2**.

### Locked parameters

- **`--app` is optional.** Without it, nothing changes.
- **Directory:** `apps/<app>/<domain>[/<subdomain>...]/[<group>/]<type>`, the ADR 0009 path with
  `libs` replaced by `apps/<app>`. `projectDirFromOpts` derives it.
- **Tag:** the lib carries `app:<app>` in addition to its `platform:`, `type:` and `domain:` tags.
  The tag value is the app's project name.
- **Name, import path and tsconfig alias are unchanged.** They derive from `domain`, `group` and
  `type` as before, and `--name` still overrides the name only. Two apps that each want a lib of the
  same domain and type give them different `--group` values; Nx's duplicate-name check is the backstop.
- **`--domain` stays required and names a real domain.** It is not defaulted from the app. An app's
  own `domain:` tag names where the app sits, and app libs are not placed there (see the drivers).
- **Validation, before anything is written:**
  - `<app>` must be an existing project tagged `type:app`.
  - `--app` is rejected with `platform: tools`, with `domain: shared` (a shared lib belongs to no
    one app) and with `type: app`.
  - The lib's `platform` must equal the app's, or be `shared`.
  - `--domain` may not be `e2e`, which would put the lib inside the app's e2e project.
- **Ownership rule:** a lib under `apps/<app>/` may be imported only by code under `apps/<app>/`:
  the app itself and its other libs. Code anywhere else, including another app's libs, may not.
- **Enforcement is by location, with an ESLint ban, not an Nx row.** `@nx/enforce-module-boundaries`
  selects rows by the _source_ project's tags and has no negation (ADR 0004, "How the rule reads
  these"), so it cannot say "only app X may import `app:X` libs". `eslint.config.mjs` reads the
  `paths` of `tsconfig.base.json`, takes the aliases that point under `apps/<app>/`
  (`appOwnedLibAliases`), and bans them with `no-restricted-imports` in every file outside that
  app. The check runs on the importing project, so `nx affected -t lint` runs it when an importer
  changes, which a check on the owned lib would not. It reads the path, not the `app:` tag, so a
  hand-edited tag cannot weaken it. With no app-owned lib there is no block.
- **Moving a lib** between `libs/` and an app uses `nx g @nx/workspace:move`
  (`docs/agents/conventions.md` §11), then a hand edit of its tags in `project.json` to add or drop
  `app:<app>` (and, going to `libs/`, to pick the domain): the move generator does not change tags.
  The import ban follows the move on its own, because it reads the alias's new path.

## Consequences

### Positive

- An app's own libs sit under it, and removing the app removes them in one place.
- A reader can tell an app-private lib from a shared one by path and by tag.
- `apps/<app>/*` stays outside the `apps/*` release glob, as `apps/<app>/e2e` already does.

### Negative / risks

- **A tag now follows from the path for app libs.** ADR 0010 says an app's tags never derive from
  its path. That still holds for the app. The lib's `app:` tag is derived from its placement, the
  way ADR 0009 derives the rest.
- **The ownership ban matches import aliases, not paths.** A deep or relative import of an owned
  lib's file is already refused by `@nx/enforce-module-boundaries`, so the alias is the one way in.
  The ban covers `import type` as well. It does not see `vi.mock` or `require` of an alias; those
  stay for review.
- **An app tagged `domain:shared` cannot use an app-owned lib of a product domain.** `cybertec-io`
  is tagged that way, and its row allows only `domain:shared` (ADR 0004, 2026-10-27 amendment), so
  it may not import a `domain:billing` lib until the app takes a domain whose row allows
  `domain:*`. Checked by generating a lib in `cybertec-io` and importing it from the app.
- **Nested projects meet app-level globs.** Checked on `cybertec-io` (Astro) with a nested Angular
  lib and a nested TypeScript lib: the app's `lint`, `typecheck`, `test` and `build` pass and do not
  pick up the nested sources. The .NET plugin's `create-nodes` glob matches project files
  (`**/*.csproj`), which a TypeScript lib has none of. A different app framework needs the same check.
- **Promoting an app lib to shared is a move plus a tag change**, with an import rewrite.
- **Cross-app name collisions fall to the `--group` value**, chosen by the caller.

## More information

- ADR 0004 — tags, the constraint matrix, and why a domain should not mix apps and libs.
- ADR 0009 — the lib layout and derivation this ADR reuses below the app folder.
- ADR 0010 — the flat `apps/<name>` layout and the nested `e2e` precedent.
