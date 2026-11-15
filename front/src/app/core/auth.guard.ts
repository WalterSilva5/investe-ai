import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Modo local: entra direto, sem login.
  if (auth.localMode() || auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
