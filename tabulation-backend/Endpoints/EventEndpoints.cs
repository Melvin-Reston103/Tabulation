using Microsoft.EntityFrameworkCore;
using TabulationApi.Data;
using TabulationApi.Dtos;
using TabulationApi.Models;

namespace TabulationApi.Endpoints;

public static class EventEndpoints
{
    public static void MapEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/events").WithTags("Events");

        group.MapGet("/{id:int}", async (int id, TabulationDbContext db) =>
        {
            var eventItem = await db.Events
                .Include(e => e.Scores)
                .ThenInclude(s => s.Faction)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (eventItem is null)
            {
                return Results.NotFound();
            }

            var dto = new EventDto(
                eventItem.Id,
                eventItem.Name,
                eventItem.Category,
                eventItem.Scores.Select(s => new FactionScoreDto(s.FactionId, s.Faction!.Name, s.Rank, s.Points)).ToList());

            return Results.Ok(dto);
        });

        group.MapPut("/{id:int}/scores", async (int id, UpdateScoresRequest request, TabulationDbContext db) =>
        {
            var eventItem = await db.Events
                .Include(e => e.Scores)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (eventItem is null)
            {
                return Results.NotFound();
            }

            foreach (var rankUpdate in request.Ranks)
            {
                var score = eventItem.Scores.FirstOrDefault(s => s.FactionId == rankUpdate.FactionId);
                var points = DbSeeder.PointsForRank(rankUpdate.Rank);

                if (score is null)
                {
                    eventItem.Scores.Add(new Score
                    {
                        EventId = eventItem.Id,
                        FactionId = rankUpdate.FactionId,
                        Rank = rankUpdate.Rank,
                        Points = points,
                    });
                }
                else
                {
                    score.Rank = rankUpdate.Rank;
                    score.Points = points;
                }
            }

            await db.SaveChangesAsync();

            var scores = await db.Scores
                .Where(s => s.EventId == id)
                .Include(s => s.Faction)
                .Select(s => new FactionScoreDto(s.FactionId, s.Faction!.Name, s.Rank, s.Points))
                .ToListAsync();

            return Results.Ok(new EventDto(eventItem.Id, eventItem.Name, eventItem.Category, scores));
        }).RequireAuthorization();
    }
}
