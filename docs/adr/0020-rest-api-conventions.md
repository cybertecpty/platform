# 20. REST API conventions for the ASP.NET Core backend

- Status: accepted
- Date: 2026-10-28
- Deciders: djmcgrath
- Implemented by: issue #238; the first endpoint is `GET /collections/{collectionId}` in
  `libs/gaming-collection/api`, hosted by `apps/gamers-source-api`
- Builds on: ADR 0017 (`dotnet-backend`), whose generated TypeScript client makes the API
  contract the frontend's source of truth

## Context and problem statement

ADR 0017 makes the ASP.NET Core API the source of truth for the frontend's contract: a
TypeScript client is generated from its OpenAPI document. Once a client exists, every URL,
property name and error shape is something other code depends on, so changing one is a breaking
change across projects. The first endpoint exists, so this is the cheapest moment to settle the
choices every later endpoint will repeat.

REST is an architectural style, not a specification. No standard says whether a collection is
plural or how errors are shaped, so each choice below is made once and followed everywhere.

## Decision drivers

- **The generated client.** Operation names, property names and enum values become TypeScript
  identifiers, so they must be stable and readable.
- **Consistency over cleverness.** An endpoint written months from now should need no decisions
  about paths, errors or paging.
- **Follow common practice.** Prefer what the Microsoft REST API Guidelines and Google's API
  Improvement Proposals agree on.
- **Cheap to follow in ASP.NET Core.** Prefer what the framework does by default.

## Considered options

| Topic            | Chosen                                                 | Rejected                                                                                            |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Resource names   | Plural nouns: `/collections`, `/collections/{id}`      | Singular. Reads oddly on a list path, and suits only a one-per-parent resource.                     |
| Identity         | Server-generated opaque ids; ownership is a field      | A parent's id as the child's identity. It blocks several children per parent and couples id spaces. |
| Errors           | Problem details, RFC 9457 (`application/problem+json`) | A custom error envelope, which every client would have to learn.                                    |
| Enums in JSON    | Member names (`"Playing"`)                             | Numbers. They change meaning when members are reordered and read badly in the generated client.     |
| Paging           | Offset: `page` (from 1) and `pageSize`                 | Cursor paging for now. Better for huge or changing data, and more than a first list needs.          |
| Hypermedia links | Not used                                               | HATEOAS links in responses. Part of strict REST, but almost no production API or client uses them.  |

## Decision outcome

### Paths and methods

- **Plural, lowercase, kebab-case nouns.** `/collections`, and `/collections/{collectionId}/entries`
  for things that exist only inside another. Nest at most two levels.
- **Ids go in the path; filters go in the query string.** A user's collections are
  `GET /collections?userId={userId}`, not a path.
- **Methods and status codes:** `GET` reads and is safe to repeat. `POST` creates and returns `201`
  with a `Location` header. `PUT` replaces, `PATCH` changes part of a resource, and `DELETE`
  returns `204`. `PUT` and `DELETE` are idempotent. Only `GET` exists today; the rest apply to the
  first endpoint that needs them.
- **Every endpoint has an explicit operation name** in `VerbNoun` form (`GetCollection`,
  `FindCollections`), set with `.WithName(...)`. It becomes the generated client's method name.

### Identity

- **Ids are server-generated GUIDs**, opaque to clients.
- **A resource that belongs to a user carries a `userId` field.** The user's id is not the
  resource's identity, so a user can own several collections and the user model can live in
  another context.

### Requests and responses

- **JSON is camelCase.** Dates are ISO 8601 (`2026-10-28`), and an absent value is `null`.
- **Enums are written as member names** (`"Playing"`), not numbers.
- **Lists are paged from the start**, with one vocabulary for request and response: `page`
  (1-based, default 1) and `pageSize` (default 25, at most 100) in; `items`, `page`, `pageSize`
  and `totalCount` out.
- **Filters combine with AND.** A filter that matches nothing is an empty list, not a `404`.

### Errors

- **Every error is a problem details document**, including a bodiless `404`.
- **Status codes:** `400` for a request the server cannot accept, with an `errors` map keyed by
  parameter for a validation failure, `404` for an unknown resource, and `500` only for a fault.

### Layering

A `type:services` library may not depend on a `type:api` library (ADR 0004's matrix), so a
service cannot return a DTO. **Service libraries return domain types, and the API library maps
them to DTOs.** The API library holds the wire types and routes: a `DTOs` folder for wire types
and an `Endpoints` folder for routes and handlers, under one root namespace for the whole
library. That suits a library with one resource; revisit it when a library has several. ADR
0004's sentence that `type:services` maps a row to a DTO assumed shared zod contracts and no
longer holds for .NET; its 2026-10-28 amendment corrects it.

### Open, each with a trigger for deciding

- **Versioning.** The options are a URL segment (`/v1/...`) and a request header. Decide before
  the first client outside this repository, or before the generated client is first published,
  whichever comes first.
- **Authentication and authorization.** Decide with the first endpoint that must know who is
  calling. Until then, endpoints that take a `userId` serve seed data only; a real endpoint takes
  the user from the token and checks ownership, not from the request.
- **Cursor paging.** Revisit if a list becomes large or changes while it is being read.

### Locked parameters

- **A deviation from these conventions needs a reason in the PR**, and a change to the
  conventions amends this ADR.
- **The API is code-first** (ADR 0017): the C# is authored first and the OpenAPI document is its
  output. These conventions are enforced by review and by the shape of existing endpoints, not
  by a linter.

## Consequences

### Positive

- A new endpoint needs no decisions about naming, errors or paging, and a reviewer has something
  to cite.
- The generated TypeScript client gets stable, readable names and one error shape to handle.
- Someone who knows other REST APIs finds nothing odd.

### Negative / risks

- **Most of this is not implemented yet.** Checked against the running endpoint: it returns
  camelCase JSON, but an unknown id, a malformed id and an unmapped path all return a bodiless
  `404`, not problem details. Paging, problem-details registration and enum serialization arrive
  with the endpoints that need them.
- **Offset paging can skip or repeat items** if the list changes between pages, and gets slower
  on deep pages. Moving to cursor paging later changes the response shape.
- **Nothing enforces the conventions.** A missing operation name or a hand-rolled error passes
  every check. Linting the OpenAPI document could close that, and is not built.
- **String enums can break a client** if a member is renamed. A rename is a breaking change, the
  same as for a property.

## More information

- `.claude/rules/rest-api.md`: the checklist form of these conventions, loaded when editing C#.
- ADR 0017 (`dotnet-backend`): the generated TypeScript client and the code-first contract.
- ADR 0004 (`nx-module-boundaries`), 2026-10-28 amendment: the services-to-API layering.
- Microsoft REST API Guidelines and Google's API Improvement Proposals (AIP-121, AIP-122,
  AIP-158): the guidance these choices follow.
- RFC 9457 (Problem Details for HTTP APIs) and RFC 9110 (HTTP Semantics).
