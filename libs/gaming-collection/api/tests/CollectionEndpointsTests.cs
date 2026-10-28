using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace GamingCollectionApi.Tests;

public class CollectionEndpointsTests
{
    [Fact]
    public void GetCollection_ReturnsTheCollectionWithThatId()
    {
        var result = Assert.IsType<Ok<CollectionDetails>>(
          CollectionEndpoints.GetCollection(SeedData.CollectionId));

        Assert.Equal(SeedData.UserId, result.Value?.UserId);
    }

    [Fact]
    public void GetCollection_ReturnsNotFoundForAnUnknownId()
    {
        Assert.IsType<NotFound>(CollectionEndpoints.GetCollection(Guid.NewGuid()));
    }

    [Fact]
    public void MapGamingCollectionEndpoints_MapsTheCollectionRoute()
    {
        var app = WebApplication.CreateBuilder().Build();

        app.MapGamingCollectionEndpoints();

        var routes = ((IEndpointRouteBuilder)app).DataSources
          .SelectMany(source => source.Endpoints)
          .OfType<RouteEndpoint>()
          .Select(endpoint => endpoint.RoutePattern.RawText);

        Assert.Contains("/collections/{collectionId:guid}", routes);
    }

    [Fact]
    public void MapGamingCollectionEndpoints_RejectsNull()
    {
        Assert.Throws<ArgumentNullException>(() => CollectionEndpoints.MapGamingCollectionEndpoints(null!));
    }
}
