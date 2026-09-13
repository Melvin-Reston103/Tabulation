namespace TabulationApi.Dtos;

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, string Username, string Role);

public record FactionScoreDto(int FactionId, string FactionName, int Rank, int Points);

public record EventDto(int Id, string Name, string Category, List<FactionScoreDto> Scores);

public record DepartmentDto(int Id, string Code, string Name, List<FactionDto> Factions);

public record FactionDto(int Id, string Name);

public record UpdateScoresRequest(List<FactionRankDto> Ranks);

public record FactionRankDto(int FactionId, int Rank);

public record CreateEventRequest(string Name, string Category);

public record CreateFactionRequest(string Name);

public record GameDto(
    int Id,
    string Title,
    int DepartmentId,
    string DepartmentName,
    List<FactionScoreDto> Scores);

public record CreateGameRequest(string Title, int DepartmentId);

public record CreateGamesBulkRequest(List<CreateGameRequest> Games);
