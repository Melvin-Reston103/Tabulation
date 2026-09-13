import { DatePipe } from '@angular/common';
import { DestroyRef, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

import { Department, Faction } from '../../core/models/department.model';
import { Game } from '../../core/models/game.model';
import { Departments } from '../../core/services/departments';
import { Games as GamesApi } from '../../core/services/games';

/** How often the public scoreboard silently re-fetches scores, in milliseconds. */
const REFRESH_INTERVAL_MS = 20_000;

interface TallyCell {
  points: number;
  isWinner: boolean;
}

interface TallyRow {
  gameId: number;
  title: string;
  cells: TallyCell[];
  winnerName: string | null;
}

interface FactionAccent {
  icon: string;
  text: string;
  chip: string;
  bar: string;
}

interface RankMeta {
  label: string;
  badge: string;
  icon: string;
}

/** Medal styling for the top three standings; factions beyond 3rd share a neutral style. */
const RANK_META: readonly RankMeta[] = [
  { label: '1st', badge: 'bg-gold-500 text-maroon-900', icon: 'workspace_premium' },
  { label: '2nd', badge: 'bg-[#d9d9e0] text-maroon-900', icon: 'military_tech' },
  { label: '3rd', badge: 'bg-[#cd8a4f] text-on-primary', icon: 'military_tech' },
];
const DEFAULT_RANK_META: RankMeta = { label: '', badge: 'bg-surface-variant text-on-surface-variant', icon: '' };

@Component({
  selector: 'app-viewing',
  imports: [DatePipe],
  templateUrl: './viewing.html',
  styleUrl: './viewing.scss',
})
export class Viewing {
  private readonly departmentsApi = inject(Departments);
  private readonly gamesApi = inject(GamesApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Cycled per faction column so the scoreboard reads consistently regardless of faction count, in the school's Gold & Maroon palette. */
  private readonly factionAccents: readonly FactionAccent[] = [
    { icon: 'shield', text: 'text-maroon-700', chip: 'bg-maroon-100', bar: 'bg-maroon-600' },
    { icon: 'stars', text: 'text-[#8a6a10]', chip: 'bg-gold-100', bar: 'bg-gold-500' },
    { icon: 'workspace_premium', text: 'text-[#8a4a1e]', chip: 'bg-[#f3e2cf]', bar: 'bg-[#c9782f]' },
    { icon: 'local_fire_department', text: 'text-[#8f1d2c]', chip: 'bg-[#f8dde0]', bar: 'bg-[#b5303f]' },
  ];

  protected readonly departments = signal<Department[]>([]);
  protected readonly selectedDepartmentId = signal<number | null>(null);
  protected readonly selectedDepartment = computed(
    () =>
      this.departments().find((department) => department.id === this.selectedDepartmentId()) ??
      null,
  );
  protected readonly factions = computed<Faction[]>(
    () => this.selectedDepartment()?.factions ?? [],
  );

  protected readonly games = signal<Game[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly lastUpdated = signal(new Date());

  /** Finalized games for the selected department, used to build the score tally. */
  private readonly departmentGames = computed(() => {
    const department = this.selectedDepartment();
    if (!department) {
      return [];
    }
    return this.games().filter(
      (game) => game.departmentId === department.id && game.scores.length > 0,
    );
  });

  protected readonly tallyRows = computed<TallyRow[]>(() => {
    const factions = this.factions();
    return this.departmentGames().map((game) => {
      const points = factions.map(
        (faction) => game.scores.find((score) => score.factionId === faction.id)?.points ?? 0,
      );
      const highest = Math.max(0, ...points);
      const winnerIndex = points.findIndex((value) => value > 0 && value === highest);
      return {
        gameId: game.id,
        title: game.title,
        cells: points.map((value) => ({
          points: value,
          isWinner: value > 0 && value === highest,
        })),
        winnerName: winnerIndex >= 0 ? factions[winnerIndex].name : null,
      };
    });
  });

  protected readonly grandTotals = computed<TallyCell[]>(() => {
    const totals = this.factions().map((faction) =>
      this.departmentGames().reduce(
        (sum, game) =>
          sum + (game.scores.find((score) => score.factionId === faction.id)?.points ?? 0),
        0,
      ),
    );
    const highest = Math.max(0, ...totals);
    return totals.map((points) => ({ points, isWinner: points > 0 && points === highest }));
  });

  protected readonly maxGrandTotal = computed(() =>
    Math.max(1, ...this.grandTotals().map((total) => total.points)),
  );

  /** 1-based standing per faction (descending by points, ties share a rank), used for medal badges. */
  protected readonly factionRanks = computed<number[]>(() => {
    const points = this.grandTotals().map((total) => total.points);
    return points.map((value) => 1 + points.filter((other) => other > value).length);
  });


  constructor() {
    this.loadDepartments();
    this.loadGames();
    interval(REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadGames());
  }

  protected selectDepartment(id: number): void {
    this.selectedDepartmentId.set(id);
  }

  protected factionAccent(index: number): FactionAccent {
    return this.factionAccents[index % this.factionAccents.length];
  }

  protected standingWidth(points: number): number {
    return (points / this.maxGrandTotal()) * 100;
  }

  protected rankMeta(rank: number): RankMeta {
    return RANK_META[rank - 1] ?? DEFAULT_RANK_META;
  }

  /** Downloads the currently displayed department tally as a CSV file. */
  protected exportCsv(): void {
    const department = this.selectedDepartment();
    if (!department) {
      return;
    }
    const factionNames = this.factions().map((faction) => faction.name);
    const header = ['Event', 'Winner', ...factionNames];
    const rows = this.tallyRows().map((row) => [
      row.title,
      row.winnerName ?? '',
      ...row.cells.map((cell) => String(cell.points)),
    ]);
    const totalsRow = ['Grand Total', '', ...this.grandTotals().map((total) => String(total.points))];
    const csv = [header, ...rows, totalsRow]
      .map((line) => line.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${department.name.toLowerCase().replace(/\s+/g, '-')}-scoreboard.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private loadDepartments(): void {
    this.departmentsApi.list().subscribe({
      next: (departments) => {
        this.departments.set(departments);
        if (departments.length > 0 && this.selectedDepartmentId() === null) {
          this.selectedDepartmentId.set(departments[0].id);
        }
      },
      error: () => this.departments.set([]),
    });
  }

  private loadGames(): void {
    const isFirstLoad = this.games().length === 0;
    if (isFirstLoad) {
      this.isLoading.set(true);
    }
    this.loadError.set(null);
    this.gamesApi.list().subscribe({
      next: (games) => {
        this.games.set(games);
        this.lastUpdated.set(new Date());
        this.isLoading.set(false);
      },
      error: () => {
        if (isFirstLoad) {
          this.loadError.set('Failed to load scores. Please try again.');
        }
        this.isLoading.set(false);
      },
    });
  }
}
