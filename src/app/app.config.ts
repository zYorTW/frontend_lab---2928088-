import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authService } from './services/auth/auth.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    // Ensure auth is validated before the app boots so header/nav visibility
    // is correct after a full page reload.
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        return () => authService.whoami().catch(() => undefined);
      },
      multi: true,
    }
  ]
};
