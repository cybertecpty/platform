namespace GamingCollectionApi;

/// <summary>The fixed data the endpoint serves until there is a database.</summary>
public static class SeedData
{
    public static readonly Guid UserId = new("0b6a1f3e-52c4-4d8e-9a53-7c1d2f0e4a10");

    public static readonly Guid CollectionId = new("5d1e8a42-3b7f-4c09-8e26-a9f4b1c7d300");

    public static IReadOnlyList<CollectionDetails> Collections { get; } =
    [
      new(CollectionId, UserId, "My games")
    ];
}
