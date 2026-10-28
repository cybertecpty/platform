---
paths:
  - '{apps,libs}/**/*.cs'
---

# REST API conventions

The checklist for ASP.NET Core endpoints. The reasons, the rejected options and what is still
undecided are in ADR 0020; this file is only what to do. Loads when working on C# under `apps/`
or `libs/`.

## Layout of an API library

- `DTOs/` holds what crosses the wire: request and response DTOs, the enums they use, and the paging
  envelope. `Endpoints/` holds the route mapping, the handlers and the `Add...` / `Map...`
  extension methods. Anything else, such as services or seed data, stays in the library root.
- Keep one namespace for the whole library, the root one. The folders are for finding files, not
  for sub-namespaces.
- This suits a library with one resource. When a library has several, prefer one folder per
  resource that holds its DTOs and endpoints together, and revisit this layout.

## Paths and methods

- Paths are plural, lowercase, kebab-case nouns: `/collections`, `/collections/{collectionId}/entries`.
  Nest at most two levels.
- Ids go in the path. Filters go in the query string, so a user's collections are
  `GET /collections?userId={userId}`.
- `GET` reads. `POST` creates and returns `201` with a `Location` header. `PUT` replaces and
  `PATCH` changes part of a resource. `DELETE` returns `204`. `PUT` and `DELETE` are idempotent.
- Give every endpoint an explicit `VerbNoun` name (`.WithName("GetCollection")`). It becomes the
  generated TypeScript client's method name.

## Identity

- Ids are server-generated GUIDs, opaque to clients.
- A resource that belongs to a user carries a `userId` field. The user's id is not the resource's
  id.

## Requests and responses

- JSON is camelCase. Dates are ISO 8601. An absent value is `null`.
- Enums are written as their member names. A query parameter must match the declared name exactly,
  and an unknown value is a `400`.
- A list endpoint is paged from the start. It takes `page` (1-based, default 1) and `pageSize`
  (default 25, at most 100) and returns `items`, `page`, `pageSize` and `totalCount`.
- Filters combine with AND. A filter that matches nothing is an empty list, not a `404`.
- Mark a handler's service parameter `[FromServices]`. Without it, minimal APIs infer the service
  as a request body when it is not registered at the time the route is mapped.

## Errors

- Every error is a problem details document (`application/problem+json`). Do not hand-roll an
  error body. The host registers problem details and status code pages, which also covers a
  bodiless `404`.
- `400` for a request the server cannot accept, with an `errors` map keyed by parameter for a
  validation failure. `404` for an unknown resource. `500` only for a fault.

## Not decided

Versioning, authentication and authorization, and cursor paging are open in ADR 0020. Do not pick
one in passing: raise it, or amend the ADR.

A deviation from this file needs a reason in the PR. A change to the conventions amends ADR 0020.
