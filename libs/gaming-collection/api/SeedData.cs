namespace GamingCollectionApi;

/// <summary>The in-memory data the API serves until it has a database.</summary>
public static class SeedData
{
    public static readonly Guid UserId = new("0b6a1f3e-52c4-4d8e-9a53-7c1d2f0e4a10");

    public static readonly Guid CollectionId = new("5d1e8a42-3b7f-4c09-8e26-a9f4b1c7d300");

    public static IReadOnlyList<CollectionDetails> Collections { get; } =
    [
      new(CollectionId, UserId, "My games")
    ];

    public static IReadOnlyList<CollectionEntry> Entries { get; } =
    [
      Entry("Hades", "Switch", 2020, EntryStatus.Completed, GameFormat.Digital, 10),
    Entry("Hollow Knight", "Switch", 2017, EntryStatus.Playing, GameFormat.Digital, 9),
    Entry("Elden Ring", "PS5", 2022, EntryStatus.Backlog, GameFormat.Physical, null),
    Entry("Metroid Dread", "Switch", 2021, EntryStatus.Wishlist, GameFormat.Physical, null)
    ];

    private static CollectionEntry Entry(
      string title,
      string platform,
      int releaseYear,
      EntryStatus status,
      GameFormat format,
      int? rating) =>
      new(
        Guid.NewGuid(),
        CollectionId,
        new Game(Guid.NewGuid(), title, platform, releaseYear),
        status,
        format,
        AcquiredOn: null,
        rating);
}
