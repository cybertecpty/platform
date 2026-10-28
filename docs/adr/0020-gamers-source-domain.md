# 20. The `gamers-source` product domain

- Status: accepted
- Date: 2026-10-27
- Deciders: djmcgrath
- Implemented by: issue #229; `apps/gamers-source-api`
- Builds on: ADR 0004 (`nx-module-boundaries`), which requires a short ADR to introduce each
  `domain:<product>` value, and ADR 0017 (`dotnet-backend`)

## Context and problem statement

ADR 0004 says every `domain:<product>` value, what it owns and its constraint rows are recorded
by an ADR of their own. The first .NET project, `gamers-source-api`, needs one: `domain:shared` is
for code with no product, and this code belongs to a product.

## Decision outcome

**`domain:gamers-source` is the domain of the Gamer's Source product's own applications**: its
ASP.NET Core API host and the Angular frontend that will consume it. The product's capabilities
live in domains of their own, such as `domain:gaming-collection` (ADR 0021), and the apps compose
them.

### What it owns

- `apps/gamers-source-api`, the ASP.NET Core API host (`scope:backend`, `type:app`).
- The Angular `gamers-source` frontend app, when it exists.
- The generated TypeScript client lib, once the API emits an OpenAPI document (ADR 0017).

### Constraint rows

One row, in `DEP_CONSTRAINTS` (`nx-dep-constraints.const.mts`):

| source tags                           | may depend on                               |
| ------------------------------------- | ------------------------------------------- |
| `type:app` and `domain:gamers-source` | `domain:*` (ADR 0004, 2026-10-27 amendment) |

It is a combo row, not a plain `domain:gamers-source` row. Nx applies every row that matches a
project and rows only restrict, so a plain row would bind the app as well as any lib of the
domain.

### Locked parameters

- **A lib in this domain adds its own isolation row** (`domain:gamers-source` plus the lib's
  `type:`, allowing `domain:gamers-source` and `domain:shared`), in the change that adds the first
  lib of that type. No lib exists yet, so there is no such row.
- **`domain:shared` never depends on `domain:gamers-source`.** The `domain:shared` row is
  unchanged.
- **The app row is narrowed when a second product arrives**, to the domains of the app's own
  product plus `domain:shared`.

## Consequences

- **Positive:** the API host and its future frontend can compose the libs of every domain they
  need, while libs stay isolated.
- **Negative / risk:** the isolation rows are per `type:`, so a new lib type that forgets its row is
  unrestricted on the `domain:` axis. Review catches it; nothing enforces it.
- **Negative / risk:** `domain:*` lets the app depend on a domain that is not its own. With one
  product in the repo that is harmless; the narrowing above is the follow-up.

## More information

- ADR 0004, 2026-10-27 amendment: why an app is exempt from domain isolation.
- ADR 0021 (`gaming-collection-domain`): the first domain the app composes.
- ADR 0009 (`lib-directory-layout`) and ADR 0010 (`app-directory-layout`): where the projects live.
