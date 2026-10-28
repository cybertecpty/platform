namespace GamingCollectionServices;

public sealed class CollectionService(
  IReadOnlyList<Collection> collections,
  IReadOnlyList<CollectionEntry> entries)
{
    public Collection? GetCollection(Guid collectionId) =>
      collections.FirstOrDefault(collection => collection.Id == collectionId);

    public IReadOnlyList<Collection> FindCollections(Guid userId) =>
      [.. collections.Where(collection => collection.UserId == userId)];

    /// <returns>The matching page, or null when the collection does not exist.</returns>
    public EntriesPage? GetEntries(Guid collectionId, EntryQuery query)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentOutOfRangeException.ThrowIfLessThan(query.Page, 1);
        ArgumentOutOfRangeException.ThrowIfLessThan(query.PageSize, 1);

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

        return new EntriesPage(items, matching.Count);
    }
}
