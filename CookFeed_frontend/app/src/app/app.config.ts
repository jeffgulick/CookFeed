import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { callerInterceptor } from './core/caller.interceptor';
import { Session } from './core/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // A new page starts at its top; Back returns to where the reader was.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    // Every request to the API says who is calling (see callerInterceptor).
    provideHttpClient(withInterceptors([callerInterceptor])),
    // The accounts are read before the first page is drawn, so the navigation is right from the start.
    provideAppInitializer(() => inject(Session).load()),
  ],
};
