import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Department } from '../models/department.model';

@Injectable({ providedIn: 'root' })
export class Departments {
  private readonly http = inject(HttpClient);

  list(): Observable<Department[]> {
    return this.http.get<Department[]>(`${environment.apiUrl}/departments`);
  }

  getByCode(code: string): Observable<Department> {
    return this.http.get<Department>(`${environment.apiUrl}/departments/${code}`);
  }
}
