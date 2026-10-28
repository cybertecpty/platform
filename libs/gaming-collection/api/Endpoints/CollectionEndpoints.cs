using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace GamingCollectionApi;

public static class CollectionEndpoints
{
    public static IEndpointRouteBuilder MapGamingCollectionEndpoints(this IEndpointRouteBuilder routes)
    {
        ArgumentNullException.ThrowIfNull(routes);

        routes.MapGet("/collections/{collectionId:guid}", GetCollection).WithName("GetCollection");

        return routes;
    }

    public static IResult GetCollection(Guid collectionId) =>
      SeedData.Collections.FirstOrDefault(collection => collection.Id == collectionId) is { } found
        ? Results.Ok(found)
        : Results.NotFound();
}
