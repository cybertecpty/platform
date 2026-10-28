namespace GamingCollectionServices;

/// <summary>One page of matching entries, and how many entries matched in all.</summary>
public sealed record EntriesPage(IReadOnlyList<CollectionEntry> Items, int TotalCount);
