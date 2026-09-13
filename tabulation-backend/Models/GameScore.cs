namespace TabulationApi.Models;

public class GameScore
{
    public int Id { get; set; }
    public int GameId { get; set; }
    public int FactionId { get; set; }
    public int Rank { get; set; }
    public int Points { get; set; }

    public Game? Game { get; set; }
    public Faction? Faction { get; set; }
}
