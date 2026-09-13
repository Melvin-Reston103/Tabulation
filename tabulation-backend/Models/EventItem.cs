namespace TabulationApi.Models;

public class EventItem
{
    public int Id { get; set; }
    public int DepartmentId { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }

    public Department? Department { get; set; }
    public List<Score> Scores { get; set; } = [];
}
