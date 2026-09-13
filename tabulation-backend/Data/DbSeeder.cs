using Microsoft.EntityFrameworkCore;

namespace TabulationApi.Data;

public static class DbSeeder
{
    private static readonly Dictionary<int, int> RankPoints = new()
    {
        [1] = 20,
        [2] = 15,
        [3] = 10,
        [4] = 5,
    };

    public static int PointsForRank(int rank) => RankPoints.GetValueOrDefault(rank, 0);

    public static async Task SeedAsync(TabulationDbContext db)
    {
        Models.Department college;
        Models.Department highSchool;

        if (!await db.Departments.AnyAsync())
        {
            college = new Models.Department { Code = "college", Name = "College Department" };
            highSchool = new Models.Department { Code = "high-school", Name = "High School Department" };
            db.Departments.AddRange(college, highSchool);
            await db.SaveChangesAsync();

            var business = new Models.Faction { DepartmentId = college.Id, Name = "LUMINARY ACHARYA" };
            var education = new Models.Faction { DepartmentId = college.Id, Name = "DUCES MERCATURAE" };
            db.Factions.AddRange(business, education);

            var redGryffins = new Models.Faction { DepartmentId = highSchool.Id, Name = "Gray Wolves" };
            var blueEagles = new Models.Faction { DepartmentId = highSchool.Id, Name = "Blue Bobcat" };
            var greenSerpents = new Models.Faction { DepartmentId = highSchool.Id, Name = "Golden Falcon" };
            db.Factions.AddRange(redGryffins, blueEagles, greenSerpents);
            await db.SaveChangesAsync();

            var collegeEvents = new List<Models.EventItem>
            {
                new() { DepartmentId = college.Id, Name = "Engineering Challenge", Category = "Academic Category" },
                new() { DepartmentId = college.Id, Name = "Debate Cup", Category = "Literary Category" },
                new() { DepartmentId = college.Id, Name = "Lawn Tennis (Men)", Category = "Sports Category" },
                new() { DepartmentId = college.Id, Name = "Lawn Tennis (Women)", Category = "Sports Category" },
            };
            db.Events.AddRange(collegeEvents);
            await db.SaveChangesAsync();

            foreach (var collegeEvent in collegeEvents)
            {
                db.Scores.Add(new Models.Score { EventId = collegeEvent.Id, FactionId = business.Id, Rank = 1, Points = PointsForRank(1) });
                db.Scores.Add(new Models.Score { EventId = collegeEvent.Id, FactionId = education.Id, Rank = 2, Points = PointsForRank(2) });
            }
        }
        else
        {
            college = await db.Departments.FirstAsync(d => d.Code == "college");
            highSchool = await db.Departments.FirstAsync(d => d.Code == "high-school");
        }

        if (!await db.Games.AnyAsync())
        {
            db.Games.AddRange(
                new Models.Game { DepartmentId = highSchool.Id, Title = "Basketball (Boys)" },
                new Models.Game { DepartmentId = college.Id, Title = "Quiz Bee" },
                new Models.Game { DepartmentId = highSchool.Id, Title = "Cheerdance" },
                new Models.Game { DepartmentId = college.Id, Title = "Volleyball (Girls)" });
        }

        if (!await db.Users.AnyAsync())
        {
            db.Users.Add(new Models.AppUser
            {
                Username = "admin",
                PasswordHash = new Microsoft.AspNetCore.Identity.PasswordHasher<Models.AppUser>().HashPassword(null!, "admin123"),
                Role = "Admin",
            });
        }

        await db.SaveChangesAsync();
    }
}
