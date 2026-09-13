import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginResponse } from '../models/auth.model';

const TOKEN_KEY = 'tabulation_token';
const USERNAME_KEY = 'tabulation_username';
const ROLE_KEY = 'tabulation_role';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly username = signal<string | null>(localStorage.getItem(USERNAME_KEY));
  readonly role = signal<string | null>(localStorage.getItem(ROLE_KEY));

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(tap((response) => this.setSession(response)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(ROLE_KEY);
    this.token.set(null);
    this.username.set(null);
    this.role.set(null);
  }

  /** Maps a backend role to the route the user should land on after login. */
  homeRouteForRole(role: string): string {
    switch (role) {
      case 'Admin':
        return '/admin-dashboard';
      default:
        return '/login';
    }
  }

  private setSession(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USERNAME_KEY, response.username);
    localStorage.setItem(ROLE_KEY, response.role);
    this.token.set(response.token);
    this.username.set(response.username);
    this.role.set(response.role);
  }
}
