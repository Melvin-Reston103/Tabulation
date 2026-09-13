using Microsoft.EntityFrameworkCore;
using TabulationApi.Data;
using TabulationApi.Dtos;
using TabulationApi.Models;

namespace TabulationApi.Endpoints;

public static class DepartmentEndpoints
{
    public static void MapDepartmentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/departments").WithTags("Departments");

        group.MapGet("/", async (TabulationDbContext db) =>
        {
            var departments = await db.Departments
                .Include(d => d.Factions)
                .Select(d => new DepartmentDto(d.Id, d.Code, d.Name, d.Factions.Select(f => new FactionDto(f.Id, f.Name)).ToList()))
                .ToListAsync();

            return Results.Ok(departments);
        });

        group.MapGet("/{code}", async (string code, TabulationDbContext db) =>
        {
            var department = await db.Departments
                .Include(d => d.Factions)
                .FirstOrDefaultAsync(d => d.Code == code);

            if (department is null)
            {
                return Results.NotFound();
            }

            var dto = new DepartmentDto(
                department.Id,
                department.Code,
                department.Name,
                department.Factions.Select(f => new FactionDto(f.Id, f.Name)).ToList());

            return Results.Ok(dto);
        });

        group.MapGet("/{code}/events", async (string code, TabulationDbContext db) =>
        {
            var department = await db.Departments.FirstOrDefaultAsync(d => d.Code == code);
            if (department is null)
            {
                return Results.NotFound();
            }

            var events = await db.Events
                .Where(e => e.DepartmentId == department.Id)
                .Include(e => e.Scores)
                .ThenInclude(s => s.Faction)
                .Select(e => new EventDto(
                    e.Id,
                    e.Name,
                    e.Category,
                    e.Scores.Select(s => new FactionScoreDto(s.FactionId, s.Faction!.Name, s.Rank, s.Points)).ToList()))
                .ToListAsync();

            return Results.Ok(events);
        });

        group.MapPost("/{code}/events", async (string code, CreateEventRequest request, TabulationDbContext db) =>
        {
            var department = await db.Departments.FirstOrDefaultAsync(d => d.Code == code);
            if (department is null)
            {
                return Results.NotFound();
            }

            var eventItem = new EventItem
            {
                DepartmentId = department.Id,
                Name = request.Name,
                Category = request.Category,
            };
            db.Events.Add(eventItem);
            await db.SaveChangesAsync();

            return Results.Created($"/api/events/{eventItem.Id}", new EventDto(eventItem.Id, eventItem.Name, eventItem.Category, []));
        }).RequireAuthorization();

        group.MapPost("/{code}/factions", async (string code, CreateFactionRequest request, TabulationDbContext db) =>
        {
            var department = await db.Departments.FirstOrDefaultAsync(d => d.Code == code);
            if (department is null)
            {
                return Results.NotFound();
            }

            var faction = new Faction { DepartmentId = department.Id, Name = request.Name };
            db.Factions.Add(faction);
            await db.SaveChangesAsync();

            return Results.Created($"/api/factions/{faction.Id}", new FactionDto(faction.Id, faction.Name));
        }).RequireAuthorization();
    }
}
