using System.Diagnostics.CodeAnalysis;

namespace GamingCollectionServices;

/// <summary>A user's named set of games. Owned by the user in <see cref="UserId"/>.</summary>
[SuppressMessage(
  "Naming",
  "CA1711:Identifiers should not have incorrect suffix",
  Justification = "A collection in this domain is a user's set of games, not a .NET collection type.")]
public sealed record Collection(Guid Id, Guid UserId, string Name);
