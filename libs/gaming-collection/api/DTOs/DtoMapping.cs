using GamingCollectionServices;

namespace GamingCollectionApi;

/// <summary>Maps the domain types of the services library to the DTOs that cross the wire.</summary>
public static class DtoMapping
{
    public static CollectionDetails ToDetails(this Collection collection)
    {
        ArgumentNullException.ThrowIfNull(collection);

        return new CollectionDetails(collection.Id, collection.UserId, collection.Name);
    }

    public static CollectionEntryDetails ToDetails(this CollectionEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);

        return new CollectionEntryDetails(
          entry.Id,
          entry.CollectionId,
          new GameDetails(entry.Game.Id, entry.Game.Title, entry.Game.Platform, entry.Game.ReleaseYear),
          entry.Status,
          entry.Format,
          entry.AcquiredOn,
          entry.Rating);
    }

    public static EntryQuery ToEntryQuery(this CollectionQuery query)
    {
        ArgumentNullException.ThrowIfNull(query);

        return new EntryQuery(query.Platform, query.Status, query.Page, query.PageSize);
    }
}
