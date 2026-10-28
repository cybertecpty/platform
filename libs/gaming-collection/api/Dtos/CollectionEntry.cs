namespace GamingCollectionApi;

/// <summary>A game in a collection, with the owner's relationship to it.</summary>
public sealed record CollectionEntry(
  Guid Id,
  Guid CollectionId,
  Game Game,
  EntryStatus Status,
  GameFormat Format,
  DateOnly? AcquiredOn,
  int? Rating);
