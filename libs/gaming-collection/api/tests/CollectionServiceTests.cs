namespace GamingCollectionApi.Tests;

public class CollectionServiceTests
{
    private static readonly CollectionService Service =
      new(SeedData.Collections, SeedData.Entries);

    [Fact]
    public void GetCollection_ReturnsTheCollectionWithThatId()
    {
        Assert.Equal(SeedData.UserId, Service.GetCollection(SeedData.CollectionId)?.UserId);
    }

    [Fact]
    public void GetCollection_ReturnsNullForAnUnknownId()
    {
        Assert.Null(Service.GetCollection(Guid.NewGuid()));
    }

    [Fact]
    public void FindCollections_ReturnsOnlyThatUsersCollections()
    {
        Assert.Single(Service.FindCollections(SeedData.UserId));
        Assert.Empty(Service.FindCollections(Guid.NewGuid()));
    }

    [Fact]
    public void GetEntries_ReturnsNullForAnUnknownCollection()
    {
        Assert.Null(Service.GetEntries(Guid.NewGuid(), new CollectionQuery()));
    }

    [Fact]
    public void GetEntries_OrdersByTitleAndCountsEveryMatch()
    {
        var page = Service.GetEntries(SeedData.CollectionId, new CollectionQuery());

        Assert.NotNull(page);
        Assert.Equal(4, page.TotalCount);
        Assert.Equal(
          ["Elden Ring", "Hades", "Hollow Knight", "Metroid Dread"],
          page.Items.Select(entry => entry.Game.Title));
    }

    [Fact]
    public void GetEntries_FiltersByPlatformIgnoringCase()
    {
        var page = Service.GetEntries(SeedData.CollectionId, new CollectionQuery(Platform: "ps5"));

        Assert.Equal("Elden Ring", Assert.Single(page!.Items).Game.Title);
    }

    [Fact]
    public void GetEntries_FiltersByStatus()
    {
        var page = Service.GetEntries(
          SeedData.CollectionId,
          new CollectionQuery(Status: EntryStatus.Wishlist));

        Assert.Equal("Metroid Dread", Assert.Single(page!.Items).Game.Title);
    }

    [Fact]
    public void GetEntries_PagesTheMatches()
    {
        var page = Service.GetEntries(SeedData.CollectionId, new CollectionQuery(Page: 2, PageSize: 3));

        Assert.Equal("Metroid Dread", Assert.Single(page!.Items).Game.Title);
        Assert.Equal(4, page.TotalCount);
        Assert.Equal(2, page.PageNumber);
    }

    [Fact]
    public void GetEntries_RejectsANullQuery()
    {
        Assert.Throws<ArgumentNullException>(() => Service.GetEntries(SeedData.CollectionId, null!));
    }
}
