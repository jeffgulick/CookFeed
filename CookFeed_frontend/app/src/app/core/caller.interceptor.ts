import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Session } from './session';

/**
 * Tells the API who is calling. Every request to /api made while an account is signed in carries its id in the
 * X-User-Id header, which is how the API knows the caller until login exists; a guest's requests carry none.
 * Requests to anywhere else are left alone.
 */
export const callerInterceptor: HttpInterceptorFn = (request, next) => {
  const user = inject(Session).user();
  if (user === null || !request.url.startsWith('/api/')) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { 'X-User-Id': String(user.id) } }));
};
