using Microsoft.EntityFrameworkCore;
using TabulationApi.Data;
using TabulationApi.Dtos;
using TabulationApi.Models;

namespace TabulationApi.Endpoints;

public static class GameEndpoints
{
    public static void MapGameEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/games").WithTags("Games");

        group.MapGet("/", async (TabulationDbContext db) =>
        {
            var games = await db.Games
                .Include(g => g.Department)
                .Include(g => g.Scores)
                .ThenInclude(s => s.Faction)
                .OrderBy(g => g.Id)
                .ToListAsync();

            var dtos = games.Select(ToDto).ToList();
            return Results.Ok(dtos);
        });

        group.MapPost("/", async (CreateGameRequest request, TabulationDbContext db) =>
        {
            var department = await db.Departments.FindAsync(request.DepartmentId);
            if (department is null)
            {
                return Results.BadRequest($"Department {request.DepartmentId} does not exist.");
            }

            var game = new Game { DepartmentId = request.DepartmentId, Title = request.Title };
            db.Games.Add(game);
            await db.SaveChangesAsync();

            var dto = new GameDto(game.Id, game.Title, game.DepartmentId, department.Name, []);
            return Results.Created($"/api/games/{game.Id}", dto);
        }).RequireAuthorization();

        group.MapPost("/bulk", async (CreateGamesBulkRequest request, TabulationDbContext db) =>
        {
            var departmentIds = request.Games.Select(g => g.DepartmentId).Distinct().ToList();
            var departments = await db.Departments
                .Where(d => departmentIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id);

            var missing = departmentIds.Where(id => !departments.ContainsKey(id)).ToList();
            if (missing.Count > 0)
            {
                return Results.BadRequest($"Unknown department id(s): {string.Join(", ", missing)}");
            }

            var games = request.Games
                .Select(g => new Game { DepartmentId = g.DepartmentId, Title = g.Title })
                .ToList();
            db.Games.AddRange(games);
            await db.SaveChangesAsync();

            var dtos = games
                .Select(g => new GameDto(g.Id, g.Title, g.DepartmentId, departments[g.DepartmentId].Name, []))
                .ToList();
            return Results.Ok(dtos);
        }).RequireAuthorization();

        group.MapDelete("/{id:int}", async (int id, TabulationDbContext db) =>
        {
            var game = await db.Games.FindAsync(id);
            if (game is null)
            {
                return Results.NotFound();
            }

            db.Games.Remove(game);
            await db.SaveChangesAsync();

            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPut("/{id:int}/scores", async (int id, UpdateScoresRequest request, TabulationDbContext db) =>
        {
            var game = await db.Games
                .Include(g => g.Department)
                .Include(g => g.Scores)
                .ThenInclude(s => s.Faction)
                .FirstOrDefaultAsync(g => g.Id == id);

            if (game is null)
            {
                return Results.NotFound();
            }

            foreach (var rankUpdate in request.Ranks)
            {
                var score = game.Scores.FirstOrDefault(s => s.FactionId == rankUpdate.FactionId);
                var points = DbSeeder.PointsForRank(rankUpdate.Rank);

                if (score is null)
                {
                    game.Scores.Add(new GameScore
                    {
                        GameId = game.Id,
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

            var scores = await db.GameScores
                .Where(s => s.GameId == id)
                .Include(s => s.Faction)
                .ToListAsync();

            return Results.Ok(new GameDto(
                game.Id,
                game.Title,
                game.DepartmentId,
                game.Department!.Name,
                scores.Select(s => new FactionScoreDto(s.FactionId, s.Faction!.Name, s.Rank, s.Points)).ToList()));
        }).RequireAuthorization();

        group.MapDelete("/{id:int}/scores", async (int id, TabulationDbContext db) =>
        {
            var game = await db.Games.FindAsync(id);
            if (game is null)
            {
                return Results.NotFound();
            }

            var scores = db.GameScores.Where(s => s.GameId == id);
            db.GameScores.RemoveRange(scores);
            await db.SaveChangesAsync();

            return Results.NoContent();
        }).RequireAuthorization();

        group.MapPost("/scores/reset", async (int? departmentId, TabulationDbContext db) =>
        {
            var scoresQuery = departmentId is null
                ? db.GameScores.AsQueryable()
                : db.GameScores.Where(s => s.Game!.DepartmentId == departmentId);

            var scores = await scoresQuery.Include(s => s.Game).ToListAsync();
            db.GameScores.RemoveRange(scores);
            await db.SaveChangesAsync();

            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static GameDto ToDto(Game game) => new(
        game.Id,
        game.Title,
        game.DepartmentId,
        game.Department!.Name,
        game.Scores.Select(s => new FactionScoreDto(s.FactionId, s.Faction!.Name, s.Rank, s.Points)).ToList());
}
