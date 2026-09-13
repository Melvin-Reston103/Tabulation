import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: 'high-school-department',
    loadComponent: () =>
      import('./pages/high-school-department/high-school-department').then((m) => m.HighSchoolDepartment),
  },
  {
    path: 'college-department',
    loadComponent: () => import('./pages/college-department/college-department').then((m) => m.CollegeDepartment),
  },
  {
    path: 'games',
    loadComponent: () => import('./pages/games/games').then((m) => m.Games),
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/reports').then((m) => m.Reports),
  },
  {
    path: 'viewing',
    loadComponent: () => import('./pages/viewing/viewing').then((m) => m.Viewing),
  },
];
