# 22. REST API conventions for the ASP.NET Core backend

- Status: accepted
- Date: 2026-10-28
- Deciders: djmcgrath
- Implemented by: issue #229; `libs/gaming-collection/api` and `apps/gamers-source-api`
- Builds on: ADR 0017 (`dotnet-backend`), whose generated TypeScript client makes the API
  contract the frontend's source of truth, and ADR 0021 (`gaming-collection-domain`), the first
  API that follows these conventions

## Context and problem statement

ADR 0017 makes the ASP.NET Core API the source of truth for the frontend's contract: a
TypeScript client is generated from its OpenAPI document. Once a client exists, every URL, property
name and error shape is something other code depends on, so changing one is a breaking change
across projects. The first endpoints (ADR 0021) are the cheapest moment to settle the choices that
every later endpoint will repeat.

REST is an architectural style, not a specification. There is no standard that says whether a
collection is plural or how errors are shaped, so the choices below follow the widely used
guidance, chosen once, so that every endpoint looks the same.

## Decision drivers

- **The generated client.** Operation names, property names and enum values become TypeScript
  identifiers, so they must be stable and readable.
- **Consistency over cleverness.** An endpoint written months from now should need no decisions
  about paths, errors or paging.
- **Follow common practice.** Prefer what the Microsoft REST API Guidelines and Google's API
  Improvement Proposals agree on, so a new reader is not surprised.
- **Cheap to follow in ASP.NET Core.** Prefer what the framework does by default.

## Considered options

| Topic            | Chosen                                                 | Rejected                                                                                             |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Resource names   | Plural nouns: `/collections`, `/collections/{id}`      | Singular. Reads oddly on a list path, and is only the usual choice for a one-per-parent resource.    |
| Identity         | Server-generated opaque ids; ownership is a field      | A parent's id as the child's identity. It blocks several children per parent and ties ids together.  |
| Errors           | Problem details, RFC 9457 (`application/problem+json`) | A custom error envelope, which every client would have to learn.                                     |
| Enums in JSON    | Member names (`"Playing"`)                             | Numbers. They change meaning when members are reordered and read badly in the generated client.      |
| Paging           | Offset: `page` (from 1) and `pageSize`                 | Cursor paging. Better for huge or changing data, and more to build than a collection list needs now. |
| Versioning       | Not decided yet (see below)                            | Picking a scheme with no client to version.                                                          |
| Hypermedia links | Not used                                               | HATEOAS links in responses. Part of strict REST, but almost no production API or client uses them.   |

## Decision outcome

### Paths and methods

- **Plural, lowercase, kebab-case nouns.** `/collections`, and `/collections/{collectionId}/entries`
  for things that exist only inside another. Nest at most two levels.
- **Path parameters are ids.** A filter is a query parameter, so a user's collections are
  `GET /collections?userId={userId}`, not a path.
- **Methods and status codes:** `GET` reads and is safe to repeat, `POST` creates and returns `201`
  with a `Location` header, `PUT` replaces, `PATCH` changes part of a resource, and `DELETE` returns
  `204`. `PUT` and `DELETE` are idempotent. Only `GET` exists today, and the rest apply to the
  first endpoint that needs them.
- **Every endpoint has an explicit operation name** in `VerbNoun` form (`GetCollection`,
  `FindCollections`). It becomes the generated client's method name.

### Identity

- **Ids are server-generated GUIDs** and opaque to clients.
- **A resource that belongs to a user carries a `userId` field.** The user's id is not the
  resource's identity, so a user can own several collections and the user model can live in another
  context.

### Requests and responses

- **JSON is camelCase.** Dates are ISO 8601 (`2026-10-28`), and an absent value is `null`.
- **Enums are member names as declared.** A query parameter must match the declared name exactly
  (`status=Playing`; `playing` is a `400`), and so is an unknown value.
- **Lists are paged from the start.** A list endpoint takes `page` (1-based, default 1) and
  `pageSize` (default 25, at most 100) and returns `items`, `page`, `pageSize` and `totalCount`.
  The request and response use the same names for the same thing.
- **Filters are query parameters** and combine with AND. A filter that matches nothing is an empty
  list, not a `404`.

### Errors

- **Every error is a problem details document.** The host registers problem details and status
  code pages, so even a bodiless `404` is `application/problem+json`.
- **Status codes:** `400` for a request the server cannot accept, including a validation failure
  (with an `errors` map keyed by parameter), `404` for an unknown resource, and `500` only for a
  fault. `401` and `403` are decided with authentication.

### Not decided

- **Versioning.** Nothing consumes the API yet. The options are a URL segment (`/v1/...`) and a
  request header. Decide before the first client outside this repository, or before the generated
  client is first published, whichever comes first.
- **Authentication and authorization.** Until they exist, endpoints that take a `userId` are
  seed-data only. A real endpoint takes the user from the token and checks ownership, not from the
  request.
- **Cursor paging.** Revisit if a list becomes large or changes while it is being read.

### Locked parameters

- **A deviation from these conventions needs a reason in the PR**, and a change to the conventions
  themselves amends this ADR.
- **The API is code-first** (ADR 0017): the C# is authored first and the OpenAPI document is its
  output. These conventions are enforced by review and by the shape of the existing endpoints, not
  by a linter.

## Consequences

### Positive

- A new endpoint needs no decisions about naming, errors or paging, and a reviewer has something
  to cite.
- The generated TypeScript client gets stable, readable names, and one error shape to handle.
- The conventions follow common practice, so someone who knows other REST APIs finds nothing odd.

### Negative / risks

- **Offset paging can skip or repeat items** if the list changes between pages, and gets slower on
  deep pages. Cursor paging is the fix, and moving to it later would change the response shape.
- **No versioning decision yet.** The longer it is deferred, the more a change to it costs. The
  trigger above is the guard.
- **Nothing enforces the conventions.** A missing operation name or a hand-rolled error would pass
  every check. OpenAPI-document linting could close that, and is not built.
- **String enums can break a client** if a member is renamed. Renames are breaking changes, the
  same as for a property.

## More information

- ADR 0017 (`dotnet-backend`): the generated TypeScript client and the code-first contract.
- ADR 0021 (`gaming-collection-domain`): the first API written to these conventions.
- Microsoft REST API Guidelines and Google's API Improvement Proposals (AIP-121, AIP-122, AIP-158):
  the guidance these choices follow.
- RFC 9457 (Problem Details for HTTP APIs) and RFC 9110 (HTTP Semantics, for methods and status
  codes).
