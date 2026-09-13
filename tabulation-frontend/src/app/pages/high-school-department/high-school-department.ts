import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Department, Faction } from '../../core/models/department.model';
import { FactionScore, Game } from '../../core/models/game.model';
import { Departments } from '../../core/services/departments';
import { Games as GamesApi } from '../../core/services/games';

const DEPARTMENT_CODE = 'high-school';

type FactionScoreEntry = FactionScore;

const FACTION_VISUALS: { dot: string; icon: string }[] = [
  { dot: 'bg-[#ef4444]', icon: 'workspace_premium' },
  { dot: 'bg-[#3B82F6]', icon: 'trending_up' },
  { dot: 'bg-[#10b981]', icon: 'trending_flat' },
];

// 0 = Forfeit (0 pts), 1 = 1st Place (20 pts), 2 = 2nd Place (15 pts), 3 = 3rd Place (10 pts)
function pointsForRank(rank: number): number {
  switch (rank) {
    case 1:
      return 20;
    case 2:
      return 15;
    case 3:
      return 10;
    default:
      return 0;
  }
}

function ordinal(rank: number): string {
  switch (rank) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    default:
      return `${rank}th`;
  }
}

@Component({
  selector: 'app-high-school-department',
  imports: [RouterLink],
  templateUrl: './high-school-department.html',
  styleUrl: './high-school-department.scss',
})
export class HighSchoolDepartment {
  private readonly gamesApi = inject(GamesApi);
  private readonly departmentsApi = inject(Departments);

  protected readonly department = signal<Department | null>(null);
  protected readonly factions = computed<Faction[]>(() => this.department()?.factions ?? []);
  // Rank 0 (Forfeit) is always available alongside 1st..Nth place.
  protected readonly rankOptions = computed(() => [
    ...Array.from({ length: this.factions().length }, (_, i) => i + 1),
    0,
  ]);

  protected readonly games = signal<Game[]>([]);
  protected readonly isLoadingGames = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly searchQuery = signal('');
  protected readonly filteredGames = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return !query
      ? this.games()
      : this.games().filter((game) => game.title.toLowerCase().includes(query));
  });

  protected readonly pageSize = 10;
  protected readonly currentPage = signal(1);
  protected readonly totalEntries = computed(() => this.filteredGames().length);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredGames().length / this.pageSize)),
  );
  protected readonly paginatedGames = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredGames().slice(start, start + this.pageSize);
  });
  protected readonly rangeStart = computed(() =>
    this.filteredGames().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1,
  );
  protected readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredGames().length),
  );

  /** Ranks assigned per game, keyed by game id, kept in sync with the persisted scores from the backend. */
  protected readonly gameScores = computed<Map<number, FactionScoreEntry[]>>(() => {
    const map = new Map<number, FactionScoreEntry[]>();
    for (const game of this.games()) {
      if (game.scores.length > 0) {
        map.set(game.id, game.scores);
      }
    }
    return map;
  });

  protected readonly isSavingScore = signal(false);
  protected readonly saveScoreError = signal<string | null>(null);
  protected readonly isResettingAll = signal(false);

  protected readonly factionTotals = computed(() => {
    const totals = this.factions().map((faction, index) => {
      const entries = this.games().map(
        (game) =>
          this.gameScores()
            .get(game.id)
            ?.find((score) => score.factionId === faction.id) ?? null,
      );
      return {
        faction,
        visual: FACTION_VISUALS[index % FACTION_VISUALS.length],
        total: entries.reduce((sum, entry) => sum + (entry?.points ?? 0), 0),
        eventsWon: entries.filter((entry) => entry?.rank === 1).length,
      };
    });

    const leaderTotal = Math.max(0, ...totals.map((item) => item.total));
    return totals.map((item) => ({
      ...item,
      totalEvents: this.games().length,
      isLeading: item.total > 0 && item.total === leaderTotal,
      diff: Math.abs(item.total - leaderTotal),
    }));
  });

  protected readonly isUpdateScoreModalOpen = signal(false);
  protected readonly selectedGame = signal<Game | null>(null);
  protected readonly factionRanks = signal<FactionScoreEntry[]>([]);

  constructor() {
    this.loadDepartmentAndGames();
    // Reset back to the first page whenever the search query changes.
    effect(() => {
      this.searchQuery();
      this.currentPage.set(1);
    });
  }

  protected goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  protected goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  private loadDepartmentAndGames(): void {
    this.isLoadingGames.set(true);
    this.loadError.set(null);
    this.departmentsApi.getByCode(DEPARTMENT_CODE).subscribe({
      next: (department) => {
        this.department.set(department);
        this.loadGames(department.id);
      },
      error: () => {
        this.loadError.set('Failed to load department details. Please try again.');
        this.isLoadingGames.set(false);
      },
    });
  }

  private loadGames(departmentId: number): void {
    this.gamesApi.list().subscribe({
      next: (games) => {
        this.games.set(games.filter((game) => game.departmentId === departmentId));
        this.isLoadingGames.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load games. Please try again.');
        this.isLoadingGames.set(false);
      },
    });
  }

  protected scoreFor(gameId: number, factionId: number): FactionScoreEntry | null {
    return this.gameScores().get(gameId)?.find((score) => score.factionId === factionId) ?? null;
  }

  protected resetScore(game: Game): void {
    if (!this.gameScores().has(game.id)) {
      return;
    }
    if (!window.confirm(`Reset the score for "${game.title}" back to zero?`)) {
      return;
    }
    this.gamesApi.clearScores(game.id).subscribe({
      next: () => {
        this.games.update((games) =>
          games.map((g) => (g.id === game.id ? { ...g, scores: [] } : g)),
        );
      },
      error: () => {
        this.loadError.set('Failed to reset the score. Please try again.');
      },
    });
  }

  /** Re-zeroes every High School game's score in a single click. */
  protected resetAllScores(): void {
    const department = this.department();
    if (!department || this.isResettingAll()) {
      return;
    }
    if (!window.confirm('Re-zero ALL scores for the High School Department? This cannot be undone.')) {
      return;
    }
    this.isResettingAll.set(true);
    this.gamesApi.resetScores(department.id).subscribe({
      next: () => {
        this.games.update((games) => games.map((g) => ({ ...g, scores: [] })));
        this.isResettingAll.set(false);
      },
      error: () => {
        this.loadError.set('Failed to re-zero scores. Please try again.');
        this.isResettingAll.set(false);
      },
    });
  }

  protected openUpdateScoreModal(game: Game): void {
    this.selectedGame.set(game);
    this.saveScoreError.set(null);
    const existing = this.gameScores().get(game.id);
    this.factionRanks.set(
      existing
        ? existing.map((score) => ({ ...score }))
        : this.factions().map((faction, i) => ({
            factionId: faction.id,
            factionName: faction.name,
            rank: i + 1,
            points: pointsForRank(i + 1),
          })),
    );
    this.isUpdateScoreModalOpen.set(true);
  }

  protected closeUpdateScoreModal(): void {
    this.isUpdateScoreModalOpen.set(false);
    this.selectedGame.set(null);
    this.saveScoreError.set(null);
  }

  protected updateFactionRank(index: number, rank: number): void {
    this.factionRanks.update((factions) =>
      factions.map((faction, i) =>
        i === index ? { ...faction, rank, points: pointsForRank(rank) } : faction,
      ),
    );
  }

  protected saveUpdateScore(): void {
    const game = this.selectedGame();
    if (!game || this.isSavingScore()) {
      return;
    }
    this.isSavingScore.set(true);
    this.saveScoreError.set(null);
    const ranks = this.factionRanks().map((entry) => ({
      factionId: entry.factionId,
      rank: entry.rank,
    }));
    this.gamesApi.updateScores(game.id, { ranks }).subscribe({
      next: (updatedGame) => {
        this.games.update((games) =>
          games.map((g) => (g.id === game.id ? updatedGame : g)),
        );
        this.isSavingScore.set(false);
        this.closeUpdateScoreModal();
      },
      error: () => {
        this.saveScoreError.set('Failed to save the score. Please try again.');
        this.isSavingScore.set(false);
      },
    });
  }

  protected rankLabel(rank: number): string {
    return rank === 0 ? 'Forfeit - 0 pts' : `${ordinal(rank)} Place - ${pointsForRank(rank)} pts`;
  }

  protected rankBadgeLabel(rank: number): string {
    return rank === 0 ? 'F' : `${rank}`;
  }

  protected rankBadgeClasses(rank: number): string {
    switch (rank) {
      case 0:
        return 'bg-[#F1F5F9] text-[#64748B]';
      case 1:
        return 'bg-error-container text-error';
      case 2:
        return 'bg-[#DBEAFE] text-[#1E40AF]';
      default:
        return 'bg-[#DCFCE7] text-[#166534]';
    }
  }
}
