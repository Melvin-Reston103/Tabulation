import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Department, Faction } from '../../core/models/department.model';
import { Game } from '../../core/models/game.model';
import { Departments } from '../../core/services/departments';
import { Games as GamesApi } from '../../core/services/games';

const DEPARTMENT_CODE = 'college';

type FactionRank = 1 | 2;

interface GameScore {
  business: number;
  education: number;
}

interface FactionStat {
  faction: Faction | null;
  totalScore: number;
  eventsWon: number;
  totalEvents: number;
  rank: FactionRank;
  isLeading: boolean;
  diff: number;
}

interface CardVisual {
  accentBg: string;
  iconWrap: string;
  iconColor: string;
  icon: string;
  fallbackName: string;
}

const CARD_VISUALS: CardVisual[] = [
  {
    accentBg: 'bg-yellow-100/30',
    iconWrap: 'bg-yellow-50 border-yellow-200',
    iconColor: 'text-yellow-600',
    icon: 'workspace_premium',
    fallbackName: 'LUMINARY ACHARYA',
  },
  {
    accentBg: 'bg-slate-100/50',
    iconWrap: 'bg-slate-50 border-slate-200',
    iconColor: 'text-slate-500',
    icon: 'shield',
    fallbackName: 'DUCES MERCATURAE',
  },
];

@Component({
  selector: 'app-college-department',
  imports: [RouterLink],
  templateUrl: './college-department.html',
  styleUrl: './college-department.scss',
})
export class CollegeDepartment {
  private readonly gamesApi = inject(GamesApi);
  private readonly departmentsApi = inject(Departments);

  protected readonly department = signal<Department | null>(null);
  protected readonly businessFaction = computed(() => this.department()?.factions[0] ?? null);
  protected readonly educationFaction = computed(() => this.department()?.factions[1] ?? null);

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

  /** Scores assigned per game, keyed by game id, kept in sync with the persisted scores from the backend. */
  protected readonly gameScores = computed<Map<number, GameScore>>(() => {
    const map = new Map<number, GameScore>();
    const businessId = this.businessFaction()?.id;
    const educationId = this.educationFaction()?.id;
    for (const game of this.games()) {
      if (game.scores.length === 0) {
        continue;
      }
      const business = game.scores.find((score) => score.factionId === businessId)?.points ?? 0;
      const education = game.scores.find((score) => score.factionId === educationId)?.points ?? 0;
      map.set(game.id, { business, education });
    }
    return map;
  });
  protected readonly currentScore = computed<GameScore | null>(() => {
    const game = this.selectedGame();
    return game ? (this.gameScores().get(game.id) ?? null) : null;
  });

  protected readonly isSavingScore = signal(false);
  protected readonly saveScoreError = signal<string | null>(null);
  protected readonly isResettingAll = signal(false);

  protected readonly cardVisuals = CARD_VISUALS;

  /** Overview cards derived from saved scores, kept in sync with the events table. */
  protected readonly factionStats = computed<FactionStat[]>(() => {
    const scores = Array.from(this.gameScores().values());
    const totalEvents = this.games().length;

    const businessScore = scores.reduce((sum, score) => sum + score.business, 0);
    const businessWins = scores.filter((score) => score.business > score.education).length;
    const educationScore = scores.reduce((sum, score) => sum + score.education, 0);
    const educationWins = scores.filter((score) => score.education > score.business).length;

    const diff = Math.abs(businessScore - educationScore);
    const businessLeading = businessScore > educationScore;
    const educationLeading = educationScore > businessScore;

    return [
      {
        faction: this.businessFaction(),
        totalScore: businessScore,
        eventsWon: businessWins,
        totalEvents,
        rank: businessScore >= educationScore ? 1 : 2,
        isLeading: businessLeading,
        diff,
      },
      {
        faction: this.educationFaction(),
        totalScore: educationScore,
        eventsWon: educationWins,
        totalEvents,
        rank: educationScore > businessScore ? 1 : 2,
        isLeading: educationLeading,
        diff,
      },
    ];
  });

  protected readonly isUpdateScoreModalOpen = signal(false);
  protected readonly selectedGame = signal<Game | null>(null);
  protected readonly businessRank = signal<FactionRank | null>(null);
  protected readonly educationRank = signal<FactionRank | null>(null);
  protected readonly canSave = computed(() => this.businessRank() !== null && this.educationRank() !== null);

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

  protected scoreFor(gameId: number): GameScore | null {
    return this.gameScores().get(gameId) ?? null;
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

  /** Re-zeroes every College game's score in a single click. */
  protected resetAllScores(): void {
    const department = this.department();
    if (!department || this.isResettingAll()) {
      return;
    }
    if (!window.confirm('Re-zero ALL scores for the College Department? This cannot be undone.')) {
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
    const businessId = this.businessFaction()?.id;
    const educationId = this.educationFaction()?.id;
    const businessScore = game.scores.find((score) => score.factionId === businessId);
    const educationScore = game.scores.find((score) => score.factionId === educationId);
    this.businessRank.set(businessScore ? (businessScore.rank === 1 ? 1 : 2) : 1);
    this.educationRank.set(educationScore ? (educationScore.rank === 1 ? 1 : 2) : 2);
    this.isUpdateScoreModalOpen.set(true);
  }

  protected closeUpdateScoreModal(): void {
    this.isUpdateScoreModalOpen.set(false);
    this.selectedGame.set(null);
    this.businessRank.set(null);
    this.educationRank.set(null);
    this.saveScoreError.set(null);
  }

  // Ranks are mutually exclusive: assigning one faction a rank flips the other to the remaining rank.
  protected setBusinessRank(rank: FactionRank): void {
    this.businessRank.set(rank);
    this.educationRank.set(rank === 1 ? 2 : 1);
  }

  protected setEducationRank(rank: FactionRank): void {
    this.educationRank.set(rank);
    this.businessRank.set(rank === 1 ? 2 : 1);
  }

  protected saveScore(): void {
    const game = this.selectedGame();
    const businessId = this.businessFaction()?.id;
    const educationId = this.educationFaction()?.id;
    if (!game || !this.canSave() || businessId === undefined || educationId === undefined) {
      return;
    }
    if (this.isSavingScore()) {
      return;
    }

    this.isSavingScore.set(true);
    this.saveScoreError.set(null);
    const ranks = [
      { factionId: businessId, rank: this.businessRank()! },
      { factionId: educationId, rank: this.educationRank()! },
    ];
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
}
