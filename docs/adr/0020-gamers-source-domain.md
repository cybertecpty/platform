# 20. The `gamers-source` product domain

- Status: accepted
- Date: 2026-10-27
- Deciders: djmcgrath
- Implemented by: issue #229; `apps/gamers-source-api` and `libs/gamers-source/services`
- Builds on: ADR 0004 (`nx-module-boundaries`), which requires a short ADR to introduce each
  `domain:<product>` value, and ADR 0017 (`dotnet-backend`)

## Context and problem statement

ADR 0004 says every `domain:<product>` value, what it owns and its constraint rows are recorded
by an ADR of their own. The first .NET project, `gamers-source-api`, needs one: `domain:shared` is
for code with no product, and this code belongs to a product.

## Decision outcome

**`domain:gamers-source` is the domain of the Gamer's Source product**: its ASP.NET Core API, the
Angular frontend that will consume it, and their libs.

### What it owns

- `apps/gamers-source-api`, the ASP.NET Core API (`scope:backend`, `type:app`).
- `libs/gamers-source/<type>` libs of the backend and, later, of the frontend, laid out as in ADR 0009.
- The generated TypeScript client lib, once the API emits an OpenAPI document (ADR 0017).

### Constraint rows

The rows are in `DEP_CONSTRAINTS` (`nx-dep-constraints.const.mts`). Nx applies every row that
matches a project and rows only restrict, so a plain `domain:gamers-source` row would bind the app
as well as the libs. The rows are combo rows for that reason.

| source tags                                | may depend on                               |
| ------------------------------------------ | ------------------------------------------- |
| `type:app` and `domain:gamers-source`      | `domain:*` (ADR 0004, 2026-10-27 amendment) |
| `type:services` and `domain:gamers-source` | `domain:gamers-source`, `domain:shared`     |
| `type:testing` and `domain:gamers-source`  | `domain:gamers-source`, `domain:shared`     |

### Locked parameters

- **A new lib `type:` in this domain adds its own isolation row** (the second row, for that
  `type:`), in the change that adds the first lib of that type. Until a row exists the lib is
  limited only by the `scope:` and `type:` rows.
- **`domain:shared` never depends on `domain:gamers-source`.** The `domain:shared` row is
  unchanged.
- **The app row is narrowed when a second product arrives**, to the domains of the app's own
  product plus `domain:shared`.

## Consequences

- **Positive:** the API and its future frontend can compose the libs of every domain they need,
  while libs stay isolated.
- **Negative / risk:** the isolation rows are per `type:`, so a new lib type that forgets its row is
  unrestricted on the `domain:` axis. Review catches it; nothing enforces it.
- **Negative / risk:** `domain:*` lets the app depend on a domain that is not its own. With one
  product in the repo that is harmless; the narrowing above is the follow-up.

## More information

- ADR 0004, 2026-10-27 amendment: why an app is exempt from domain isolation.
- ADR 0009 (`lib-directory-layout`) and ADR 0010 (`app-directory-layout`): where the projects live.
