using GamingCollectionServices;
namespace GamingCollectionApi.Tests;

public class CollectionQueryTests
{
    [Fact]
    public void Validate_AcceptsTheDefaults()
    {
        Assert.Empty(new CollectionQuery().Validate());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_RejectsAPageBelowOne(int page)
    {
        Assert.Contains("page", new CollectionQuery(Page: page).Validate().Keys);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(CollectionQuery.MaxPageSize + 1)]
    public void Validate_RejectsAPageSizeOutOfRange(int pageSize)
    {
        Assert.Contains("pageSize", new CollectionQuery(PageSize: pageSize).Validate().Keys);
    }
}
