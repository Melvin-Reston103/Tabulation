namespace TabulationApi.Models;

public class Score
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int FactionId { get; set; }
    public int Rank { get; set; }
    public int Points { get; set; }

    public EventItem? Event { get; set; }
    public Faction? Faction { get; set; }
}
