using System.Text.Json.Serialization;
using GamingCollectionServices;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace GamingCollectionApi;

public static class CollectionEndpoints
{
    public static IServiceCollection AddGamingCollection(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        // Enums travel as their names, so the contract does not depend on the order of the members.
        services.ConfigureHttpJsonOptions(options =>
          options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        return services.AddSingleton(new CollectionService(SeedData.Collections, SeedData.Entries));
    }

    public static IEndpointRouteBuilder MapGamingCollectionEndpoints(this IEndpointRouteBuilder routes)
    {
        ArgumentNullException.ThrowIfNull(routes);

        var group = routes.MapGroup("/collections");

        group.MapGet("/", FindCollections).WithName("FindCollections");
        group.MapGet("/{collectionId:guid}", GetCollection).WithName("GetCollection");
        group.MapGet("/{collectionId:guid}/entries", GetEntries).WithName("GetCollectionEntries");

        return routes;
    }

    public static IResult FindCollections(Guid userId, [FromServices] CollectionService service)
    {
        ArgumentNullException.ThrowIfNull(service);

        IReadOnlyList<CollectionDetails> collections =
          [.. service.FindCollections(userId).Select(collection => collection.ToDetails())];

        return Results.Ok(collections);
    }

    public static IResult GetCollection(Guid collectionId, [FromServices] CollectionService service)
    {
        ArgumentNullException.ThrowIfNull(service);

        return service.GetCollection(collectionId) is { } collection
          ? Results.Ok(collection.ToDetails())
          : Results.NotFound();
    }

    public static IResult GetEntries(
      Guid collectionId,
      [FromServices] CollectionService service,
      string? platform = null,
      EntryStatus? status = null,
      int page = 1,
      int pageSize = CollectionQuery.DefaultPageSize)
    {
        ArgumentNullException.ThrowIfNull(service);

        var query = new CollectionQuery(platform, status, page, pageSize);
        var errors = query.Validate();

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors.ToDictionary(pair => pair.Key, pair => pair.Value));
        }

        if (service.GetEntries(collectionId, query.ToEntryQuery()) is not { } result)
        {
            return Results.NotFound();
        }

        IReadOnlyList<CollectionEntryDetails> items = [.. result.Items.Select(entry => entry.ToDetails())];

        return Results.Ok(new PagedResult<CollectionEntryDetails>(items, page, pageSize, result.TotalCount));
    }
}
