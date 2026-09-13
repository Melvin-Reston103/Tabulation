namespace TabulationApi.Models;

public class Department
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }

    public List<Faction> Factions { get; set; } = [];
    public List<EventItem> Events { get; set; } = [];
}
