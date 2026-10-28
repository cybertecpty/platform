namespace GamingCollectionServices;

/// <summary>Filters and paging for the entries of one collection. Paging starts at page 1.</summary>
public sealed record EntryQuery(
  string? Platform = null,
  EntryStatus? Status = null,
  int Page = 1,
  int PageSize = EntryQuery.DefaultPageSize)
{
    public const int DefaultPageSize = 25;

    public const int MaxPageSize = 100;
}
