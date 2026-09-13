namespace TabulationApi.Models;

public class Game
{
    public int Id { get; set; }
    public int DepartmentId { get; set; }
    public required string Title { get; set; }

    public Department? Department { get; set; }
    public List<GameScore> Scores { get; set; } = [];
}
