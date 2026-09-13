import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Department, Faction } from '../../core/models/department.model';
import { Game } from '../../core/models/game.model';
import { Departments } from '../../core/services/departments';
import { Games as GamesApi } from '../../core/services/games';

interface TallyCell {
  points: number;
  isWinner: boolean;
}

interface TallyRow {
  gameId: number;
  title: string;
  cells: TallyCell[];
}

@Component({
  selector: 'app-reports',
  imports: [RouterLink, DatePipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly departmentsApi = inject(Departments);
  private readonly gamesApi = inject(GamesApi);

  protected readonly mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

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
  protected readonly generatedAt = signal(new Date());

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
      return {
        gameId: game.id,
        title: game.title,
        cells: points.map((value) => ({
          points: value,
          isWinner: value > 0 && value === highest,
        })),
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

  constructor() {
    this.loadDepartments();
    this.loadGames();
  }

  protected selectDepartment(id: number): void {
    this.selectedDepartmentId.set(id);
  }

  protected printReport(): void {
    window.print();
  }

  /** Exports the currently displayed final tally as a CSV file. */
  protected exportCsv(): void {
    const department = this.selectedDepartment();
    if (!department) {
      return;
    }
    const header = ['Event / Category', ...this.factions().map((faction) => faction.name)];
    const rows = this.tallyRows().map((row) => [row.title, ...row.cells.map((cell) => cell.points)]);
    const totalRow = ['Grand Total', ...this.grandTotals().map((cell) => cell.points)];
    const csv = [header, ...rows, totalRow]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${department.code}-final-tally.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private loadDepartments(): void {
    this.departmentsApi.list().subscribe({
      next: (departments) => {
        this.departments.set(departments);
        if (departments.length > 0) {
          this.selectedDepartmentId.set(departments[0].id);
        }
      },
      error: () => this.departments.set([]),
    });
  }

  private loadGames(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.gamesApi.list().subscribe({
      next: (games) => {
        this.games.set(games);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load reports. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
