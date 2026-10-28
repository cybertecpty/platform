---
paths:
  - '{apps,libs}/**/*.cs'
---

# REST API conventions

What to do when writing ASP.NET Core endpoints. The reasons, the rejected options and the open
questions are in ADR 0020. Loads when editing C# under `apps/` or `libs/`.

## Layout

- Services return domain types; the API library maps them to DTOs. A services library never
  depends on an API library.
- `DTOs/` holds wire types, `Endpoints/` holds routes and handlers. One root namespace per library.

## Paths and methods

- Plural, lowercase, kebab-case nouns, nested at most two levels: `/collections/{collectionId}/entries`.
- Ids in the path, filters in the query string: `GET /collections?userId={userId}`.
- `GET` reads. `POST` creates and returns `201` with `Location`. `PUT` replaces, `PATCH` changes
  part, `DELETE` returns `204`.
- Name every endpoint `VerbNoun` with `.WithName("GetCollection")`.

## Identity and payloads

- Ids are server-generated GUIDs. A user-owned resource carries a `userId` field.
- JSON is camelCase, dates are ISO 8601, absent is `null`, enums are member names.
- Lists are paged: `page` (from 1, default 1) and `pageSize` (default 25, max 100) in;
  `items`, `page`, `pageSize`, `totalCount` out. No match is an empty list, not a `404`.

## Errors

- Return problem details (`application/problem+json`), never a hand-rolled body.
- `400` bad request (validation: an `errors` map keyed by parameter), `404` unknown resource,
  `500` only for a fault.

## Open

Versioning, authentication and authorization, and cursor paging are undecided. Do not pick one
in passing: raise it or amend ADR 0020. A deviation needs a reason in the PR.
