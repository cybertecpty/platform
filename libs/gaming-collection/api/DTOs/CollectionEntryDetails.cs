using GamingCollectionServices;

namespace GamingCollectionApi;

/// <summary>A game in a collection, with the owner's relationship to it.</summary>
public sealed record CollectionEntryDetails(
  Guid Id,
  Guid CollectionId,
  GameDetails Game,
  EntryStatus Status,
  GameFormat Format,
  DateOnly? AcquiredOn,
  int? Rating);
