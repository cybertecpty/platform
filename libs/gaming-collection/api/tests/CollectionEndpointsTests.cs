using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace GamingCollectionApi.Tests;

public class CollectionEndpointsTests
{
    private static readonly CollectionService Service =
      new(SeedData.Collections, SeedData.Entries);

    [Fact]
    public void AddGamingCollection_RegistersTheService()
    {
        using var provider = new ServiceCollection().AddGamingCollection().BuildServiceProvider();

        Assert.NotNull(provider.GetService<CollectionService>());
    }

    [Fact]
    public void AddGamingCollection_WritesEnumsAsNames()
    {
        using var provider = new ServiceCollection().AddGamingCollection().BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<JsonOptions>>().Value.SerializerOptions;

        Assert.Equal("\"Playing\"", JsonSerializer.Serialize(EntryStatus.Playing, options));
    }

    [Fact]
    public void MapGamingCollectionEndpoints_MapsTheThreeRoutes()
    {
        var app = WebApplication.CreateBuilder().Build();

        app.MapGamingCollectionEndpoints();

        var routes = ((IEndpointRouteBuilder)app).DataSources
          .SelectMany(source => source.Endpoints)
          .OfType<RouteEndpoint>()
          .Select(endpoint => endpoint.RoutePattern.RawText)
          .ToList();

        Assert.Contains("/collections/", routes);
        Assert.Contains("/collections/{collectionId:guid}", routes);
        Assert.Contains("/collections/{collectionId:guid}/entries", routes);
    }

    [Fact]
    public void FindCollections_ReturnsOk()
    {
        Assert.IsType<Ok<IReadOnlyList<CollectionDetails>>>(
          CollectionEndpoints.FindCollections(SeedData.UserId, Service));
    }

    [Fact]
    public void GetCollection_ReturnsOkForAKnownId()
    {
        Assert.IsType<Ok<CollectionDetails>>(
          CollectionEndpoints.GetCollection(SeedData.CollectionId, Service));
    }

    [Fact]
    public void GetCollection_ReturnsNotFoundForAnUnknownId()
    {
        Assert.IsType<NotFound>(CollectionEndpoints.GetCollection(Guid.NewGuid(), Service));
    }

    [Fact]
    public void GetEntries_ReturnsAPage()
    {
        Assert.IsType<Ok<Page<CollectionEntry>>>(
          CollectionEndpoints.GetEntries(SeedData.CollectionId, Service));
    }

    [Fact]
    public void GetEntries_ReturnsNotFoundForAnUnknownCollection()
    {
        Assert.IsType<NotFound>(CollectionEndpoints.GetEntries(Guid.NewGuid(), Service));
    }

    [Fact]
    public void GetEntries_ReturnsAValidationProblemForBadPaging()
    {
        Assert.IsType<ProblemHttpResult>(
          CollectionEndpoints.GetEntries(SeedData.CollectionId, Service, page: 0));
    }
}
