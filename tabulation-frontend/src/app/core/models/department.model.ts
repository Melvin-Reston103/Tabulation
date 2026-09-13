export interface Faction {
  id: number;
  name: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  factions: Faction[];
}
