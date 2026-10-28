# .NET study guide

Reading material for learning .NET and ASP.NET Core while the backend is built. It is not a rule
file and agents do not need to load it. The examples come from this repo's .NET projects, so the
code is the source of truth if they ever disagree. Until PR #234 merges, the examples refer to the
projects and the ADR 0020 and rest-api rule files it adds.

## How entries are written

- **By topic, not by date.** Add to an existing topic before starting a new one.
- **One entry per concept:** what it is in a sentence or two, why it is used here, a short
  example, then a few "Check yourself" questions. The answers are folded away so you can cover
  them and test recall.
- **Plain language.** Say which C# version introduced a feature when that helps you date it.
- **Mark anything unverified.** Say so, instead of stating it as fact.

## Types

### `public sealed record`

A data type such as `CollectionDetails`:

```csharp
public sealed record CollectionDetails(Guid Id, Guid UserId, string Name);
```

- **`public`:** visible to other projects. A top-level type with no modifier is `internal`, visible
  only inside its own project.
- **`sealed`:** nothing can inherit from it. A data type gains nothing from subclasses, and the
  analyzer rule CA1852 reports a type that could be sealed.
- **`record`** (C# 9): a class meant for data. The positional form above generates read-only
  (init-only) properties, a constructor, value equality, `ToString` and the `with` expression.

```csharp
var renamed = details with { Name = "Retro" }; // a copy with one value changed
```

**Check yourself**

<details>
<summary>What breaks if <code>public</code> is removed?</summary>

The tests and the app live in other projects, so they could no longer see the type and would fail
to compile.

</details>

<details>
<summary>When are two records equal?</summary>

When all their values are equal (value equality). Two instances of an ordinary class are equal only
if they are the same object, unless the class overrides equality.

</details>

### DTOs and entities

A **DTO** (Data Transfer Object) is a plain data carrier that crosses a boundary. It has no
behaviour of its own. It is a **role**, not a C# feature: a DTO can be a record, a class or a
struct, and records are the usual choice because they are short and read-only.

`CollectionDetails` is a DTO. The endpoint returns it and ASP.NET Core serializes it to JSON, so it
is the shape of the HTTP response.

The other side is the **domain type**, which is what the business logic works with. In our code
that is `Collection`, in the services library. A third shape, an **entity**, describes how data is
stored in a database. Larger systems keep these apart and map between them:

```text
database row  ->  entity  ->  domain type  ->  DTO  ->  JSON over HTTP
```

Keeping them apart means a change to storage does not silently change the API, and a column that
must stay private never reaches a client.

Today we have two of the three. The services library returns the domain type `Collection`, and the
API library maps it to the DTO `CollectionDetails` (see `DtoMapping`). The services library cannot
return DTOs, because a services library may not depend on an API library. There is no entity yet,
because the data is in-memory seed data. When persistence arrives, it adds a stored shape in an
`infra` library behind the services.

The tags follow this: `type:api` holds DTOs and maps domain types to them, `type:services` holds
domain types and logic, and `type:infra` holds the stored shape.

**Check yourself**

<details>
<summary>Is "DTO" a C# keyword or a role?</summary>

A role. The C# keyword is <code>record</code> (or <code>class</code>). A DTO is any type used only
to carry data across a boundary.

</details>

<details>
<summary>Why not return the stored entity straight from an endpoint?</summary>

It ties the API to the database shape, so a storage change becomes a breaking API change, and it
can expose fields that should stay private. A separate DTO makes the API shape a deliberate choice.

</details>

### Primary constructors (C# 12)

A class can list its constructor parameters right after its name:

```csharp
public sealed class CollectionService(
  IReadOnlyList<Collection> collections,
  IReadOnlyList<CollectionEntry> entries)
```

The parameters are in scope for the whole class body, and the compiler keeps hold of the ones the
body uses. They are **not** public properties. A record's positional parameters are, which is the
difference between the two syntaxes.

**Check yourself**

<details>
<summary>Is <code>service.collections</code> valid from outside the class above?</summary>

No. A class's primary constructor parameters are not members. They are visible only inside the
class.

</details>

### Nullable reference types (C# 8)

`<Nullable>enable</Nullable>` makes reference types non-null unless marked with `?`:

```csharp
public sealed record Game(Guid Id, string Title, string Platform, int ReleaseYear);
public Collection? GetCollection(Guid collectionId) // may return null
```

The compiler warns when a possibly-null value is used without a check, and warnings are errors in
this repo. `is { }` tests "not null" and names the value in one step:

```csharp
return service.GetCollection(id) is { } collection
  ? Results.Ok(collection.ToDetails())
  : Results.NotFound();
```

**Check yourself**

<details>
<summary>What does <code>is { } collection</code> mean?</summary>

"If the value is not null, bind it to <code>collection</code> and take the true branch."

</details>

### Collection expressions (C# 12)

Square brackets build a collection, and `..` spreads another one into it:

```csharp
IReadOnlyList<Collection> mine = [.. collections.Where(c => c.UserId == userId)];
string[] errors = ["Page must be 1 or greater."];
```

The type comes from where the value is used, so the same syntax makes an array, a list or an
`IReadOnlyList<T>`.

**Check yourself**

<details>
<summary>What does <code>..</code> do inside the brackets?</summary>

It spreads the items of another sequence into the new collection, such as the result of a query.

</details>

### Extension methods

A static method whose first parameter has `this` can be called as if it belonged to that type:

```csharp
public static IServiceCollection AddGamingCollection(this IServiceCollection services)
```

```csharp
builder.Services.AddGamingCollection(); // reads like a method on Services
```

The convention is `Add...` for registering services and `Map...` for registering endpoints.

## ASP.NET Core

### Minimal APIs

An endpoint is a route plus an ordinary method:

```csharp
var group = routes.MapGroup("/collections");
group.MapGet("/{collectionId:guid}", GetCollection).WithName("GetCollection");
```

- **`MapGroup`** shares a path prefix. **`:guid`** is a route constraint, so a non-GUID id never
  reaches the handler.
- **Parameters** are bound from the route, the query string or the services container, based on
  their type and name.
- **Return an `IResult`:** `Results.Ok(x)`, `Results.NotFound()`, `Results.ValidationProblem(errors)`.
- **`WithName`** sets the operation name in the OpenAPI document, which the generated TypeScript
  client typically uses as its method name.

**Gotcha:** a service parameter that is not marked `[FromServices]` can be mistaken for a request
body when the route is mapped before the service is registered. That failed one of our tests.

**Check yourself**

<details>
<summary>Why is a service parameter marked <code>[FromServices]</code>?</summary>

So ASP.NET Core resolves it from the services container instead of guessing it is a request body.

</details>

### Dependency injection

The app registers services at startup, builds, and the framework hands them to whatever asks:

```csharp
builder.Services.AddSingleton(new CollectionService(SeedData.Collections, SeedData.Entries));
```

The lifetime says how long an instance lives:

- **Singleton:** one instance for the whole app. Fits `CollectionService`, which is stateless and
  reads fixed data.
- **Scoped:** one instance per web request.
- **Transient:** a new instance every time it is asked for.

**Check yourself**

<details>
<summary>Which lifetime would a service holding a per-request database connection use?</summary>

Scoped, so each request gets its own and it is released when the request ends.

</details>

### Errors as problem details

`AddProblemDetails()` and `UseStatusCodePages()` make every error response a standard
`application/problem+json` document (RFC 9457), including a `404` with no body. The conventions are
in ADR 0020 and `.claude/rules/rest-api.md`.

### JSON

ASP.NET Core writes camelCase JSON by default. `JsonStringEnumConverter` writes enums as their
names, so `EntryStatus.Playing` is `"Playing"` and not `2`.

## Build and tooling

### Projects and SDKs

A `.csproj` describes one project. `Microsoft.NET.Sdk` is the plain SDK and
`Microsoft.NET.Sdk.Web` adds ASP.NET Core. The collection lib is a plain library that still needs
ASP.NET types, so it declares:

```xml
<FrameworkReference Include="Microsoft.AspNetCore.App" />
```

A `ProjectReference` makes one project depend on another, and Nx turns it into an edge in the
project graph.

### `Directory.Build.props`

MSBuild automatically imports this file for every project beneath it. Ours sets the target
framework, the analyzer level, warnings as errors, and the test packages for any project under a
`tests/` folder. It is why the `.csproj` files here are so short.

**Check yourself**

<details>
<summary>Why does <code>GamingCollectionApi.Tests.csproj</code> not list xunit?</summary>

<code>Directory.Build.props</code> adds the test packages to every project under a
<code>tests/</code> folder.

</details>

### Analyzers

Roslyn analyzers check code against rules while it builds. `CAxxxx` rules are about code quality
and `IDExxxx` rules about style. With warnings as errors, a violation fails the build. We have met:

- **CA1852:** seal a type that has no subtypes.
- **CA1711:** a type name should not end in `Collection`, so the DTO is `CollectionDetails`. The
  domain type is called `Collection` anyway, with a suppression that says why, because that is
  its name in the domain.
- **CA1707:** no underscores in member names. It is off under `tests/`, where `Subject_Behaviour`
  names are the convention.
- **IDE0040:** accessibility modifiers are required.
- **IDE0011:** an `if` needs braces.

Severity is set per rule in `.editorconfig`, such as `dotnet_diagnostic.CA1707.severity = none`.
`dotnet format --verify-no-changes` checks the style rules without changing files.

## Testing

xUnit runs the tests:

```csharp
[Fact]
public void GetCollection_ReturnsNullForAnUnknownId() =>
  Assert.Null(Service.GetCollection(Guid.NewGuid()));

[Theory]
[InlineData(0, 32)]
[InlineData(100, 211)]
public void ConvertsToFahrenheit(int celsius, int fahrenheit) { /* ... */ }
```

- **`[Fact]`** is one test. **`[Theory]`** runs the same test once per `[InlineData]` row.
- **`Assert.Equal(expected, actual)`** takes the expected value first.
- **Coverage:** coverlet measures it, and an 80% line-coverage floor fails the test run when the
  `CI` environment variable is set. A test project can only measure code it references, which is
  why the logic lives in a library and not in the app.

**Check yourself**

<details>
<summary>Why can the tests project not just reference the app?</summary>

ADR 0004 forbids a <code>type:testing</code> project depending on a <code>type:app</code> project,
and the boundary check fails the build if it does. So the logic sits in a library that the app and
the tests both reference.

</details>
