export interface FactionScore {
  factionId: number;
  factionName: string;
  rank: number;
  points: number;
}

export interface Game {
  id: number;
  title: string;
  departmentId: number;
  departmentName: string;
  scores: FactionScore[];
}

export interface CreateGameRequest {
  title: string;
  departmentId: number;
}

export interface FactionRank {
  factionId: number;
  rank: number;
}

export interface UpdateGameScoresRequest {
  ranks: FactionRank[];
}
