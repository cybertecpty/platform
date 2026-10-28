namespace GamingCollectionApi;

/// <summary>Filters and paging for the entries of one collection. Paging starts at page 1.</summary>
public sealed record CollectionQuery(
  string? Platform = null,
  EntryStatus? Status = null,
  int Page = 1,
  int PageSize = CollectionQuery.DefaultPageSize)
{
    public const int DefaultPageSize = 25;

    public const int MaxPageSize = 100;

    /// <summary>The problems with the paging values, keyed by parameter name. Empty when valid.</summary>
    public IReadOnlyDictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();

        if (Page < 1)
        {
            errors["page"] = ["Page must be 1 or greater."];
        }

        if (PageSize is < 1 or > MaxPageSize)
        {
            errors["pageSize"] = [$"Page size must be between 1 and {MaxPageSize}."];
        }

        return errors;
    }
}
