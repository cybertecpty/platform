namespace GamingCollectionApi;

/// <summary>A user's named collection of games. Owned by the user in <see cref="UserId"/>.</summary>
public sealed record CollectionDetails(Guid Id, Guid UserId, string Name);
