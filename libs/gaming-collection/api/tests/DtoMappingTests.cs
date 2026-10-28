using GamingCollectionServices;

namespace GamingCollectionApi.Tests;

public class DtoMappingTests
{
    [Fact]
    public void ToDetails_CopiesACollection()
    {
        var details = SeedData.Collections[0].ToDetails();

        Assert.Equal(SeedData.CollectionId, details.Id);
        Assert.Equal(SeedData.UserId, details.UserId);
        Assert.Equal("My games", details.Name);
    }

    [Fact]
    public void ToDetails_CopiesAnEntryAndItsGame()
    {
        var entry = SeedData.Entries[0];

        var details = entry.ToDetails();

        Assert.Equal(entry.Id, details.Id);
        Assert.Equal(entry.CollectionId, details.CollectionId);
        Assert.Equal(entry.Game.Title, details.Game.Title);
        Assert.Equal(entry.Game.Platform, details.Game.Platform);
        Assert.Equal(entry.Status, details.Status);
        Assert.Equal(entry.Rating, details.Rating);
    }

    [Fact]
    public void ToEntryQuery_CopiesFiltersAndPaging()
    {
        var query = new CollectionQuery("Switch", EntryStatus.Playing, Page: 2, PageSize: 10).ToEntryQuery();

        Assert.Equal(new EntryQuery("Switch", EntryStatus.Playing, 2, 10), query);
    }

    [Fact]
    public void Mapping_RejectsNull()
    {
        Assert.Throws<ArgumentNullException>(() => DtoMapping.ToDetails((Collection)null!));
        Assert.Throws<ArgumentNullException>(() => DtoMapping.ToDetails((CollectionEntry)null!));
        Assert.Throws<ArgumentNullException>(() => DtoMapping.ToEntryQuery(null!));
    }
}
