# 21. The `gaming-collection` domain

- Status: accepted
- Date: 2026-10-27
- Deciders: djmcgrath
- Implemented by: issue #229; `libs/gaming-collection/api`
- Builds on: ADR 0004 (`nx-module-boundaries`), which requires a short ADR to introduce each
  `domain:<product>` value, ADR 0017 (`dotnet-backend`) and ADR 0020 (`gamers-source-domain`)

## Context and problem statement

`gamers-source-api` needs its logic outside the app project: a tests project cannot reference an
app (ADR 0004 forbids `type:testing` to `type:app`), and a tests project that measures nothing fails
the 80% coverage gate (ADR 0017, 2026-10-27 amendment). The logic belongs to a capability of the
product, a user's collection of games, not to the app host.

## Decision outcome

**`domain:gaming-collection` is the domain of the capability that tracks which games a user owns,
plays and wants**: collections and the entries in them. `apps/gamers-source-api` composes it.

### What it owns

- `libs/gaming-collection/api`, the collection endpoints and DTOs (`scope:backend`,
  `type:api`), laid out as in ADR 0009. Its tests project is nested in `tests/`.
- Later: its services, persistence and the generated TypeScript client of its endpoints.

### API shape

A collection is a resource with its own id, owned by a user through a `userId` field. The user's id
is not the collection's identity, so a user can have several collections and the user model can
live in another context:

- `GET /collections?userId={userId}` finds a user's collections.
- `GET /collections/{collectionId}` returns one collection.
- `GET /collections/{collectionId}/entries?platform=&status=&page=&pageSize=` returns a page of its
  entries, each pairing a game with the owner's status, format, acquisition date and rating.

The first implementation serves in-memory seed data. Auth, persistence and writes are not decided.

### Constraint rows

Both rows are in `DEP_CONSTRAINTS`. They are combo rows so that a domain's rows never bind an app
(ADR 0020):

| source tags                                   | may depend on                               |
| --------------------------------------------- | ------------------------------------------- |
| `type:api` and `domain:gaming-collection`     | `domain:gaming-collection`, `domain:shared` |
| `type:testing` and `domain:gaming-collection` | `domain:gaming-collection`, `domain:shared` |

### Locked parameters

- **A new lib `type:` in this domain adds its own isolation row**, in the change that adds the
  first lib of that type.
- **The domain does not depend on `domain:gamers-source`.** Only apps compose domains.

## Consequences

- **Positive:** the app host stays thin, the collection logic is testable and measured by coverage,
  and the domain can be reused by another app.
- **Negative / risk:** a `type:api` lib holds its query logic itself until a `type:services` lib
  is worth adding. Moving it later is a refactor inside the domain.
- **Negative / risk:** the same per-`type:` row risk as ADR 0020.

## More information

- ADR 0004, 2026-10-27 amendment: the app exception that lets the host compose this domain.
- ADR 0017, 2026-10-27 amendment: why the host is thin.
