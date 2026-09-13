import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Department } from '../../core/models/department.model';
import { CreateGameRequest, Game } from '../../core/models/game.model';
import { Departments } from '../../core/services/departments';
import { Games as GamesApi } from '../../core/services/games';

const ALL_DEPARTMENTS = 'All Departments';

@Component({
  selector: 'app-games',
  imports: [RouterLink],
  templateUrl: './games.html',
  styleUrl: './games.scss',
})
export class Games {
  private readonly gamesApi = inject(GamesApi);
  private readonly departmentsApi = inject(Departments);

  protected readonly departments = signal<Department[]>([]);
  protected readonly departmentFilterOptions = computed(() => [
    ALL_DEPARTMENTS,
    ...this.departments().map((department) => department.name),
  ]);
  protected readonly selectedDepartment = signal(ALL_DEPARTMENTS);

  protected readonly games = signal<Game[]>([]);
  protected readonly isLoadingGames = signal(false);
  protected readonly loadGamesError = signal<string | null>(null);

  protected readonly totalEntries = computed(() => this.games().length);

  protected readonly openMenuId = signal<number | null>(null);
  protected readonly menuPosition = signal<{ top: number; left: number } | null>(null);
  protected readonly activeMenuGame = computed(
    () => this.games().find((game) => game.id === this.openMenuId()) ?? null,
  );

  protected readonly searchQuery = signal('');
  protected readonly filteredGames = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const department = this.selectedDepartment();
    return this.games().filter((game) => {
      const matchesDepartment = department === ALL_DEPARTMENTS || game.departmentName === department;
      const matchesQuery = !query || game.title.toLowerCase().includes(query);
      return matchesDepartment && matchesQuery;
    });
  });

  protected readonly pageSize = 10;
  protected readonly currentPage = signal(1);
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

  protected readonly isBulkUploadModalOpen = signal(false);
  protected readonly isDraggingFile = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly isBulkUploading = signal(false);
  protected readonly bulkUploadError = signal<string | null>(null);

  protected readonly isAddGameModalOpen = signal(false);
  protected readonly newGameTitle = signal('');
  protected readonly newGameDepartmentId = signal<number | null>(null);
  protected readonly isSavingNewGame = signal(false);
  protected readonly addGameError = signal<string | null>(null);
  protected readonly canSubmitNewGame = computed(
    () => this.newGameTitle().trim().length > 0 && this.newGameDepartmentId() !== null,
  );

  constructor() {
    this.loadDepartments();
    this.loadGames();
    // Reset back to the first page whenever the search or department filter changes.
    effect(() => {
      this.searchQuery();
      this.selectedDepartment();
      this.currentPage.set(1);
    });
  }

  protected goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  protected goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  private loadDepartments(): void {
    this.departmentsApi.list().subscribe({
      next: (departments) => this.departments.set(departments),
      error: () => this.departments.set([]),
    });
  }

  private loadGames(): void {
    this.isLoadingGames.set(true);
    this.loadGamesError.set(null);
    this.gamesApi.list().subscribe({
      next: (games) => {
        this.games.set(games);
        this.isLoadingGames.set(false);
      },
      error: () => {
        this.loadGamesError.set('Failed to load games. Please try again.');
        this.isLoadingGames.set(false);
      },
    });
  }

  protected toggleActionMenu(game: Game, event: MouseEvent): void {
    if (this.openMenuId() === game.id) {
      this.closeActionMenu();
      return;
    }
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 144;
    this.menuPosition.set({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
    this.openMenuId.set(game.id);
  }

  protected closeActionMenu(): void {
    this.openMenuId.set(null);
    this.menuPosition.set(null);
  }

  protected updateGame(game: Game): void {
    this.closeActionMenu();
  }

  protected deleteGame(game: Game): void {
    this.closeActionMenu();
    this.gamesApi.delete(game.id).subscribe({
      next: () => this.games.update((list) => list.filter((item) => item.id !== game.id)),
      error: () => this.loadGamesError.set('Failed to delete the game. Please try again.'),
    });
  }

  protected openBulkUploadModal(): void {
    this.selectedFile.set(null);
    this.isDraggingFile.set(false);
    this.bulkUploadError.set(null);
    this.isBulkUploadModalOpen.set(true);
  }

  protected closeBulkUploadModal(): void {
    this.isBulkUploadModalOpen.set(false);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
  }

  protected onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingFile.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.selectedFile.set(file);
    }
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file) {
      this.selectedFile.set(file);
    }
  }

  protected confirmBulkUpload(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    this.bulkUploadError.set(null);
    this.isBulkUploading.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const requests = this.parseBulkGamesCsv(text);
      if (requests.length === 0) {
        this.isBulkUploading.set(false);
        this.bulkUploadError.set('No valid rows found. Expected columns: Game Title, Department.');
        return;
      }

      this.gamesApi.createBulk(requests).subscribe({
        next: (created) => {
          this.games.update((list) => [...list, ...created]);
          this.isBulkUploading.set(false);
          this.closeBulkUploadModal();
        },
        error: () => {
          this.isBulkUploading.set(false);
          this.bulkUploadError.set('Failed to upload games. Please try again.');
        },
      });
    };
    reader.onerror = () => {
      this.isBulkUploading.set(false);
      this.bulkUploadError.set('Could not read the selected file.');
    };
    reader.readAsText(file);
  }

  /** Parses "Game Title,Department" rows, skipping a header row and unmatched departments. */
  private parseBulkGamesCsv(text: string): CreateGameRequest[] {
    const departmentIdsByName = new Map(
      this.departments().map((department) => [department.name.trim().toLowerCase(), department.id]),
    );

    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [titleRaw, departmentRaw] = line.split(',');
        return { title: titleRaw?.trim() ?? '', department: departmentRaw?.trim() ?? '' };
      })
      .filter(({ title, department }) => {
        const isHeaderRow = title.toLowerCase() === 'game title' || title.toLowerCase() === 'title';
        return title.length > 0 && department.length > 0 && !isHeaderRow;
      })
      .flatMap(({ title, department }) => {
        const departmentId = departmentIdsByName.get(department.toLowerCase());
        return departmentId ? [{ title, departmentId }] : [];
      });
  }

  protected formatFileSize(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  protected openAddGameModal(): void {
    this.newGameTitle.set('');
    this.newGameDepartmentId.set(null);
    this.addGameError.set(null);
    this.isAddGameModalOpen.set(true);
  }

  protected closeAddGameModal(): void {
    this.isAddGameModalOpen.set(false);
  }

  protected submitAddGame(): void {
    const departmentId = this.newGameDepartmentId();
    if (!this.canSubmitNewGame() || departmentId === null) {
      return;
    }

    this.isSavingNewGame.set(true);
    this.addGameError.set(null);
    this.gamesApi.create({ title: this.newGameTitle().trim(), departmentId }).subscribe({
      next: (game) => {
        this.games.update((list) => [...list, game]);
        this.isSavingNewGame.set(false);
        this.closeAddGameModal();
      },
      error: () => {
        this.isSavingNewGame.set(false);
        this.addGameError.set('Failed to save the game. Please try again.');
      },
    });
  }
}
