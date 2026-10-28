# .NET study guide

Reading material for learning .NET and ASP.NET Core. It is not a rule file and agents do not need
to load it. The examples are generic and are not tied to any particular codebase, so they stay
correct as code changes.

## How entries are written

- **By topic, not by date.** Add to an existing topic before starting a new one.
- **One entry per concept:** what it is in a sentence or two, why it is used, a short generic
  example, then a few "Check yourself" questions. The answers are folded away so you can cover them
  and test recall.
- **Generic examples only.** Use made-up types such as `Order` or `Product`. Do not quote or link to
  a specific project's code, files or decision records.
- **Plain language.** Say which C# version introduced a feature when that helps you date it.
- **Mark anything unverified.** Say so, instead of stating it as fact.

## Types

### `public sealed record`

A data type such as an order summary:

```csharp
public sealed record OrderSummary(Guid Id, string Customer, decimal Total);
```

- **`public`:** visible to other projects. A top-level type with no modifier is `internal`, visible
  only inside its own project.
- **`sealed`:** nothing can inherit from it. A data type gains nothing from subclasses, and the
  analyzer rule CA1852 reports a type that could be sealed.
- **`record`** (C# 9): a class meant for data. The positional form above generates read-only
  (init-only) properties, a constructor, value equality, `ToString` and the `with` expression.

```csharp
var discounted = summary with { Total = 90m }; // a copy with one value changed
```

**Check yourself**

<details>
<summary>What breaks if <code>public</code> is removed?</summary>

Other projects, such as a web project or a test project, could no longer see the type and would
fail to compile.

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

`OrderSummary` above is a DTO if an endpoint returns it and ASP.NET Core serializes it to JSON: it
is then the shape of the HTTP response.

The other side is the **domain type**, which is what the business logic works with, such as an
`Order`. A third shape, an **entity**, describes how data is stored in a database. Larger systems
keep these apart and map between them:

```text
database row  ->  entity  ->  domain type  ->  DTO  ->  JSON over HTTP
```

Keeping them apart means a change to storage does not silently change the API, and a column that
must stay private never reaches a client.

Layering decides who maps. A lower layer must not depend on a higher one, and DTOs belong to the API
layer, so the service layer cannot return DTOs. The service layer returns domain types, and the API
layer maps them to DTOs. A small app may start with fewer than three shapes, for example no entity
while the data is in memory, and add the others when they earn their place.

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

<details>
<summary>Why can a service layer not return DTOs?</summary>

DTOs live in the API layer, and a lower layer must not depend on a higher one. So the service layer
returns domain types and the API layer maps them to DTOs.

</details>

### Primary constructors (C# 12)

A class can list its constructor parameters right after its name:

```csharp
public sealed class OrderService(IOrderRepository orders, TimeProvider clock)
{
  public Order? Find(Guid id) => orders.Get(id);
}
```

The parameters are in scope for the whole class body, and the compiler keeps hold of the ones the
body uses. They are **not** public properties. A record's positional parameters are, which is the
difference between the two syntaxes.

**Check yourself**

<details>
<summary>Is <code>service.orders</code> valid from outside the class above?</summary>

No. A class's primary constructor parameters are not members. They are visible only inside the
class.

</details>

### Nullable reference types (C# 8)

`<Nullable>enable</Nullable>` makes reference types non-null unless marked with `?`:

```csharp
public Order? Find(Guid id) // may return null
```

The compiler warns when a possibly-null value is used without a check, and warnings can be turned
into errors. `is { }` tests "not null" and names the value in one step:

```csharp
return service.Find(id) is { } order ? Results.Ok(order.ToSummary()) : Results.NotFound();
```

**Check yourself**

<details>
<summary>What does <code>is { } order</code> mean?</summary>

"If the value is not null, bind it to <code>order</code> and take the true branch."

</details>

### Collection expressions (C# 12)

Square brackets build a collection, and `..` spreads another one into it:

```csharp
IReadOnlyList<Order> mine = [.. orders.Where(o => o.CustomerId == customerId)];
string[] errors = ["Quantity must be 1 or greater."];
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
public static IServiceCollection AddOrders(this IServiceCollection services)
```

```csharp
builder.Services.AddOrders(); // reads like a method on Services
```

The convention is `Add...` for registering services and `Map...` for registering endpoints.

## ASP.NET Core

### Minimal APIs

An endpoint is a route plus an ordinary method:

```csharp
var group = routes.MapGroup("/orders");
group.MapGet("/{orderId:guid}", GetOrder).WithName("GetOrder");
```

- **`MapGroup`** shares a path prefix. **`:guid`** is a route constraint, so a non-GUID id never
  reaches the handler.
- **Parameters** are bound from the route, the query string or the services container, based on
  their type and name.
- **Return an `IResult`:** `Results.Ok(x)`, `Results.NotFound()`,
  `Results.ValidationProblem(errors)`.
- **`WithName`** sets the operation name in the OpenAPI document, which client generators typically
  use as the method name.

**Gotcha:** a service parameter that is not marked `[FromServices]` can be mistaken for a request
body, if the framework cannot tell it is a registered service when the route is mapped.

**Check yourself**

<details>
<summary>Why is a service parameter marked <code>[FromServices]</code>?</summary>

So ASP.NET Core resolves it from the services container instead of guessing it is a request body.

</details>

### Dependency injection

The app registers services at startup, builds, and the framework hands them to whatever asks:

```csharp
builder.Services.AddSingleton<OrderService>();
```

The lifetime says how long an instance lives:

- **Singleton:** one instance for the whole app. Fits a stateless service.
- **Scoped:** one instance per web request.
- **Transient:** a new instance every time it is asked for.

**Check yourself**

<details>
<summary>Which lifetime would a service holding a per-request database connection use?</summary>

Scoped, so each request gets its own and it is released when the request ends.

</details>

### Errors as problem details

`AddProblemDetails()` and `UseStatusCodePages()` make every error response a standard
`application/problem+json` document (RFC 9457), including a `404` with no body.

### JSON

ASP.NET Core writes camelCase JSON by default. `JsonStringEnumConverter` writes enums as their
names, so `OrderStatus.Shipped` is `"Shipped"` and not `2`.

## Build and tooling

### Projects and SDKs

A `.csproj` describes one project. `Microsoft.NET.Sdk` is the plain SDK and
`Microsoft.NET.Sdk.Web` adds ASP.NET Core. A plain library that still needs ASP.NET types declares:

```xml
<FrameworkReference Include="Microsoft.AspNetCore.App" />
```

A `ProjectReference` makes one project depend on another.

### `Directory.Build.props`

MSBuild automatically imports this file for every project beneath it. It is the place for settings
every project shares, such as the target framework, the analyzer level, warnings as errors and
common test packages. It is why the `.csproj` files in such a solution can be so short.

**Check yourself**

<details>
<summary>Why might a test project's <code>.csproj</code> not list the test framework package?</summary>

A <code>Directory.Build.props</code> above it can add the package to every project that matches a
condition, such as living under a <code>tests/</code> folder.

</details>

### Analyzers

Roslyn analyzers check code against rules while it builds. `CAxxxx` rules are about code quality
and `IDExxxx` rules about style. With warnings as errors, a violation fails the build. Common ones:

- **CA1852:** seal a type that has no subtypes.
- **CA1711:** a type name should not end in a suffix such as `Collection`, which suggests a .NET
  collection type, unless it is one.
- **CA1707:** no underscores in member names. Teams often turn it off for test projects, where
  `Subject_Behaviour` names are common.
- **IDE0040:** accessibility modifiers are required.
- **IDE0011:** an `if` needs braces.

Severity is set per rule in `.editorconfig`, such as `dotnet_diagnostic.CA1707.severity = none`.
`dotnet format --verify-no-changes` checks the style rules without changing files.

## Testing

xUnit runs the tests:

```csharp
[Fact]
public void Find_ReturnsNullForAnUnknownId() =>
  Assert.Null(service.Find(Guid.NewGuid()));

[Theory]
[InlineData(0, 32)]
[InlineData(100, 212)]
public void ConvertsToFahrenheit(int celsius, int fahrenheit) { /* ... */ }
```

- **`[Fact]`** is one test. **`[Theory]`** runs the same test once per `[InlineData]` row.
- **`Assert.Equal(expected, actual)`** takes the expected value first.
- **Coverage:** coverlet measures it. A threshold can fail the test run when coverage is too low.
  A test project can only measure code it references.

**Check yourself**

<details>
<summary>Why put business logic in a library and not in the web project?</summary>

A test project can then reference the library and measure it directly, without referencing the web
host. The same library can also be reused by another host.

</details>
