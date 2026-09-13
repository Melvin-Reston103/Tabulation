import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'tabulation_token';

/** Attaches the stored JWT, if any, as a Bearer token on outgoing API requests. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
