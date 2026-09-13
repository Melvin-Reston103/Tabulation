using Microsoft.EntityFrameworkCore;
using TabulationApi.Models;

namespace TabulationApi.Data;

public class TabulationDbContext(DbContextOptions<TabulationDbContext> options) : DbContext(options)
{
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Faction> Factions => Set<Faction>();
    public DbSet<EventItem> Events => Set<EventItem>();
    public DbSet<Score> Scores => Set<Score>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<GameScore> GameScores => Set<GameScore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Department>().HasIndex(d => d.Code).IsUnique();
        modelBuilder.Entity<AppUser>().HasIndex(u => u.Username).IsUnique();

        modelBuilder.Entity<Faction>()
            .HasOne(f => f.Department)
            .WithMany(d => d.Factions)
            .HasForeignKey(f => f.DepartmentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EventItem>()
            .HasOne(e => e.Department)
            .WithMany(d => d.Events)
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Score>()
            .HasOne(s => s.Event)
            .WithMany(e => e.Scores)
            .HasForeignKey(s => s.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Score>()
            .HasOne(s => s.Faction)
            .WithMany(f => f.Scores)
            .HasForeignKey(s => s.FactionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Score>()
            .HasIndex(s => new { s.EventId, s.FactionId })
            .IsUnique();

        modelBuilder.Entity<Game>()
            .HasOne(g => g.Department)
            .WithMany()
            .HasForeignKey(g => g.DepartmentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GameScore>()
            .HasOne(s => s.Game)
            .WithMany(g => g.Scores)
            .HasForeignKey(s => s.GameId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GameScore>()
            .HasOne(s => s.Faction)
            .WithMany()
            .HasForeignKey(s => s.FactionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GameScore>()
            .HasIndex(s => new { s.GameId, s.FactionId })
            .IsUnique();
    }
}
