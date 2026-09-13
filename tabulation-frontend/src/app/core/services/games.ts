import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateGameRequest, Game, UpdateGameScoresRequest } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class Games {
  private readonly http = inject(HttpClient);

  list(): Observable<Game[]> {
    return this.http.get<Game[]>(`${environment.apiUrl}/games`);
  }

  create(request: CreateGameRequest): Observable<Game> {
    return this.http.post<Game>(`${environment.apiUrl}/games`, request);
  }

  createBulk(games: CreateGameRequest[]): Observable<Game[]> {
    return this.http.post<Game[]>(`${environment.apiUrl}/games/bulk`, { games });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/games/${id}`);
  }

  updateScores(gameId: number, request: UpdateGameScoresRequest): Observable<Game> {
    return this.http.put<Game>(`${environment.apiUrl}/games/${gameId}/scores`, request);
  }

  clearScores(gameId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/games/${gameId}/scores`);
  }

  /** Re-zeroes every game's score, optionally scoped to a single department. */
  resetScores(departmentId?: number): Observable<void> {
    const url =
      departmentId === undefined
        ? `${environment.apiUrl}/games/scores/reset`
        : `${environment.apiUrl}/games/scores/reset?departmentId=${departmentId}`;
    return this.http.post<void>(url, null);
  }
}
