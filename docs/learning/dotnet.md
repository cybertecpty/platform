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

## Language basics

### Namespaces and `using`

A **namespace** groups related types and keeps their names from clashing. A **`using` directive**
imports a namespace so you can write the short name instead of the full one:

```csharp
using System.Text.Json;

namespace Shop.Orders; // file-scoped (C# 10): applies to every type in the file

public sealed class OrderPrinter
{
  public string Print(Order order) => JsonSerializer.Serialize(order); // not System.Text.Json.JsonSerializer
}
```

A project can also turn on **implicit usings**, which adds a standard set of `using` directives to
every file automatically. That is why `Guid` or `List<T>` work with no `using` line.

**Check yourself**

<details>
<summary>Why can a file use <code>Guid</code> with no <code>using System;</code>?</summary>

The project has implicit usings enabled, which adds <code>using System;</code> and a few others to
every file in the project.

</details>

### Static classes

A `static` class cannot be instantiated or inherited and can hold only static members. It is the
usual home for helper methods, constants and extension methods:

```csharp
public static class PriceMath
{
  public static decimal WithTax(decimal price, decimal rate) => price * (1 + rate);
}
```

```csharp
var gross = PriceMath.WithTax(10m, 0.2m); // called on the class, not on an object
```

**Check yourself**

<details>
<summary>Why must a class that holds extension methods be <code>static</code>?</summary>

Extension methods must be static members of a static, non-generic, top-level class. The language
requires it.

</details>

### Expression-bodied members

When a method, property or other member is a single expression, `=>` replaces the braces and the
`return`:

```csharp
public int Double(int x) { return x * 2; }
public int Double(int x) => x * 2; // the same method
```

It is a shorthand for readability. The compiler produces the same code.

**Check yourself**

<details>
<summary>What does <code>=></code> mean in <code>public int Double(int x) => x * 2;</code>?</summary>

It marks an expression-bodied member: the method body is the single expression after the arrow, and
its value is returned.

</details>

### Lambdas and LINQ

A **lambda** is a short anonymous function: `x => x.Id == id` reads "given `x`, return whether its
`Id` equals `id`". **LINQ** is a set of methods that take lambdas to query a sequence:

```csharp
var firstMatch = orders.FirstOrDefault(o => o.Id == id);   // one item, or the default
var big = orders.Where(o => o.Total > 100).OrderBy(o => o.Total).ToList();
var names = orders.Select(o => o.Customer);                // transform each item
```

- **`FirstOrDefault`** returns the first match, or the type's default if there is none. That is
  `null` for a class or record, but `0` for an `int` and an empty `Guid` for a `Guid`, so a "not
  found" check on a value type needs more care.
- **Deferred execution:** `Where`, `Select` and `OrderBy` build a query and do not run it. It runs
  when you enumerate it, for example with `ToList()` or a `foreach`.

**Check yourself**

<details>
<summary>What does <code>FirstOrDefault</code> return when nothing matches a list of records?</summary>

<code>null</code>, because the default for a reference type (a record is one) is null.

</details>

<details>
<summary>When does <code>orders.Where(o => o.Total &gt; 100)</code> actually run?</summary>

Not where it is written. It runs when the result is enumerated, such as by <code>ToList()</code>,
<code>foreach</code> or <code>Count()</code>.

</details>

### The conditional operator

`condition ? a : b` evaluates to `a` if the condition is true and `b` if not. It is an expression, so
it can be returned directly:

```csharp
return order is { } found ? Results.Ok(found) : Results.NotFound();
```

The two branches can have different types as long as both convert to the type the result is used
as. Here each branch is a different result type, and the method's return type, `IResult`, is what
both convert to.

**Check yourself**

<details>
<summary>Why can the two branches above return different result types?</summary>

Each one converts to the method's return type, <code>IResult</code>. Since C# 9 the conditional
operator can use that target type.

</details>

### Method groups

Writing a method's name with no parentheses refers to the method itself, not a call to it. The
compiler turns it into a delegate (a typed reference to a method):

```csharp
app.MapGet("/orders/{id:guid}", GetOrder); // GetOrder is passed, not called
```

`GetOrder()` would call it, and `GetOrder` hands it over so the framework can call it later, once
per request.

**Check yourself**

<details>
<summary>What is the difference between <code>GetOrder</code> and <code>GetOrder()</code>?</summary>

<code>GetOrder</code> is the method itself (a method group, converted to a delegate).
<code>GetOrder()</code> calls it now and gives its return value.

</details>

### Guard clauses

A **guard clause** checks an argument at the top of a method and throws straight away if it is
invalid:

```csharp
public void Add(Order order)
{
  ArgumentNullException.ThrowIfNull(order);
  ArgumentOutOfRangeException.ThrowIfLessThan(order.Quantity, 1);
  // ...
}
```

Nullable annotations only produce compiler warnings. They do not stop a `null` arriving at run time
from code that has them switched off, or from reflection. A guard clause fails early with a clear
message, instead of a `NullReferenceException` several calls later.

**Check yourself**

<details>
<summary>If nullable reference types are on, why still call <code>ThrowIfNull</code>?</summary>

Nullable annotations are compile-time warnings only. A caller can still pass <code>null</code> at
run time, and the guard turns that into an immediate, clear error.

</details>

### XML documentation comments

A comment that starts with `///` and uses tags is a **documentation comment**. Editors show it in
tooltips, and tools can build documentation from it:

```csharp
/// <summary>The products on sale until there is a database.</summary>
/// <param name="id">The product's id.</param>
/// <returns>The product, or null if there is none.</returns>
public Product? Find(Guid id) => products.FirstOrDefault(p => p.Id == id);
```

Use `<see cref="Name"/>` to link to another member. An ordinary `//` comment is just text and has no
structure the tools understand.

**Check yourself**

<details>
<summary>What is the difference between <code>///</code> and <code>//</code>?</summary>

<code>///</code> starts an XML documentation comment with tags that editors and doc tools read.
<code>//</code> is a plain comment with no structure.

</details>

### `const` and `static readonly`

Both hold a value that does not change, in different ways:

```csharp
public static class Defaults
{
  public const int PageSize = 25;                                         // fixed at compile time
  public static readonly Guid AdminId = new("3f2504e0-4f89-11d3-9a0c-0305e82c3301"); // set once at run time
}
```

- **`const`** must be a compile-time constant: numbers, `bool`, `char`, `string`, enums or `null`.
  The compiler copies the value into the code that uses it.
- **`readonly`** means a field can be assigned only where it is declared or in a constructor. Add
  `static` and there is one copy for the whole type, set once when the type is first used.
- A `Guid` is made by running a constructor, so it cannot be a `const`. It has to be
  `static readonly`.

**Check yourself**

<details>
<summary>Why can a <code>Guid</code> not be declared <code>const</code>?</summary>

A <code>const</code> must be a compile-time constant, and creating a <code>Guid</code> means running
a constructor at run time. A <code>static readonly</code> field is set once at run time.

</details>

### Fields and properties

A **field** is a plain variable on a type. A **property** looks like a field to the caller but is
backed by accessors (`get`, and optionally `set` or `init`):

```csharp
public sealed class Basket
{
  private readonly List<Product> items = [];        // field: internal detail
  public int Count => items.Count;                  // property: computed on every read
  public string Owner { get; init; } = "";          // auto-property: set only when created
  public IReadOnlyList<Product> Items { get; } = []; // get-only auto-property with an initializer
}
```

- An **auto-property** `{ get; }` makes the compiler write the hidden field and the getter. With
  no `set`, it can only be assigned at declaration or in a constructor.
- Properties are the norm for public data, because their implementation can change later without
  changing how callers use them.

**Check yourself**

<details>
<summary>What does <code>{ get; }</code> with no <code>set</code> allow?</summary>

The value can only be assigned where the property is declared, or in a constructor. After that it is
read-only.

</details>

### `IReadOnlyList<T>`

An interface that gives a count and index access, and no `Add` or `Remove`. Typing a property or
parameter as `IReadOnlyList<Product>` tells callers they may read the list but not change it through
that type:

```csharp
public IReadOnlyList<Product> Products { get; } = [new("Widget", 9.99m)];
```

It limits what callers can do through that type. It does not by itself guarantee the data
underneath is frozen, since something else may still hold a mutable reference to it.

**Check yourself**

<details>
<summary>What can a caller not do with an <code>IReadOnlyList&lt;T&gt;</code>?</summary>

Add or remove items through it. It exposes only a count, an indexer and enumeration.

</details>

### Target-typed `new(...)` (C# 9)

When the compiler already knows the type from context, you can leave the type name out of `new`:

```csharp
Product widget = new("Widget", 9.99m);            // the declared type says it is a Product
IReadOnlyList<Product> products = [new("Widget", 9.99m), new("Gadget", 4.50m)];
                                                   // the list's item type says each is a Product
```

It is shorthand, and the compiler infers the same type you would have written.

**Check yourself**

<details>
<summary>How does the compiler know what <code>new("Widget", 9.99m)</code> creates?</summary>

From context: the declared variable type, or the item type of the collection it is placed in.

</details>

### Constructing a `Guid`

A `Guid` is a 128-bit identifier. You can create a fresh one, or parse a fixed one from text:

```csharp
var fresh = Guid.NewGuid();                                    // different every time
var fixedId = new Guid("3f2504e0-4f89-11d3-9a0c-0305e82c3301"); // always the same value
```

A fixed id is useful for sample data, tests and URLs, because it stays the same across restarts. A
fresh id changes every run.

**Check yourself**

<details>
<summary>When would you choose a fixed <code>Guid</code> over <code>Guid.NewGuid()</code>?</summary>

When something must refer to it repeatedly, such as a test, a URL or sample data that should look the
same after every restart.

</details>

### Static initialization order

Static field and property initializers in a type run in the order they appear in the file, when the
type is first used. A later initializer can use an earlier one, not the other way round:

```csharp
public static class Seed
{
  public static readonly Guid OwnerId = new("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
  public static IReadOnlyList<Cart> Carts { get; } = [new(OwnerId, "Main")]; // OwnerId is already set
}
```

If `Carts` (a record with an owner id and a name) were written above `OwnerId`, it would be built while `OwnerId` still held its default
value, with no compiler error.

**Check yourself**

<details>
<summary>What goes wrong if a static initializer uses a field declared <em>below</em> it?</summary>

The field has not been initialized yet, so the initializer sees its default value (an empty
<code>Guid</code>, <code>0</code> or <code>null</code>), and the compiler does not warn about it.

</details>

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

### Routes, constraints and parameter binding

A **route template** such as `/orders/{orderId}` has a **route parameter** in braces. A
**constraint** after a colon limits what it matches, and a request that does not match the route
never reaches the handler, so the framework answers `404`:

```csharp
app.MapGet("/orders/{orderId:guid}", GetOrder);       // /orders/abc  -> 404
app.MapGet("/orders/{orderId:int:min(1)}", GetByNumber);
```

**Parameter binding** fills the handler's parameters for you:

- A parameter whose name is in the route template comes from the route, parsed to its type.
- Another simple-typed parameter (`string`, `int`, an enum) comes from the query string.
- A type registered as a service comes from the services container.
- A complex type, on a method that accepts a body, comes from the request body.

Attributes such as `[FromRoute]`, `[FromQuery]`, `[FromBody]` and `[FromServices]` make the source
explicit when you do not want the framework to infer it.

**Check yourself**

<details>
<summary>What happens to a request for <code>/orders/abc</code> if the route is <code>{orderId:guid}</code>?</summary>

The route does not match, so the handler never runs and the response is <code>404</code>.

</details>

<details>
<summary>Where does an <code>int page</code> parameter come from if the route has no <code>{page}</code>?</summary>

The query string, as in <code>?page=2</code>.

</details>

### Results and `IResult`

A handler returns an `IResult`, which describes an HTTP response and writes it when the framework
runs it:

```csharp
Results.Ok(order);          // 200 with the object serialized as JSON
Results.NotFound();         // 404 with no body
Results.ValidationProblem(errors); // 400 with a problem details body
```

`Results.Ok(x)` is declared to return `IResult`, but the object behind it is the concrete type
`Ok<T>`. `TypedResults.Ok(x)` returns that concrete type directly, which is easier to assert on in a
test and gives the OpenAPI document more detail.

**Check yourself**

<details>
<summary>What does <code>Results.NotFound()</code> send?</summary>

A <code>404</code> response with no body.

</details>

### Builders and chaining

Routes are added to an `IEndpointRouteBuilder`, the thing the app (`WebApplication`) implements. A
`Map...` call returns a builder for the route it just added, so settings can be chained on it, and a
method that returns the builder it was given lets its own callers chain too:

```csharp
public static IEndpointRouteBuilder MapOrders(this IEndpointRouteBuilder routes)
{
  routes.MapGet("/orders/{id:guid}", GetOrder).WithName("GetOrder");
  return routes; // so app.MapOrders().MapProducts() works
}
```

**Check yourself**

<details>
<summary>Why does <code>MapOrders</code> return <code>routes</code>?</summary>

So the caller can chain further calls on it, the same way ASP.NET Core's own <code>Map...</code>
methods allow.

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
