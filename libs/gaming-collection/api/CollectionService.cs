namespace GamingCollectionApi;

public sealed class CollectionService(
  IReadOnlyList<CollectionDetails> collections,
  IReadOnlyList<CollectionEntry> entries)
{
    public CollectionDetails? GetCollection(Guid collectionId) =>
      collections.FirstOrDefault(collection => collection.Id == collectionId);

    public IReadOnlyList<CollectionDetails> FindCollections(Guid userId) =>
      [.. collections.Where(collection => collection.UserId == userId)];

    /// <returns>The matching page, or null when the collection does not exist.</returns>
    public PagedResult<CollectionEntry>? GetEntries(Guid collectionId, CollectionQuery query)
    {
        ArgumentNullException.ThrowIfNull(query);

        if (GetCollection(collectionId) is null)
        {
            return null;
        }

        var matching = entries
          .Where(entry => entry.CollectionId == collectionId)
          .Where(entry => query.Platform is null
            || string.Equals(entry.Game.Platform, query.Platform, StringComparison.OrdinalIgnoreCase))
          .Where(entry => query.Status is null || entry.Status == query.Status)
          .OrderBy(entry => entry.Game.Title, StringComparer.OrdinalIgnoreCase)
          .ToList();

        var items = matching.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToList();

        return new PagedResult<CollectionEntry>(items, query.Page, query.PageSize, matching.Count);
    }
}
