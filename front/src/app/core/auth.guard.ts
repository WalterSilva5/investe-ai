import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  // Espera descobrir o modo do ambiente: aberto entra direto, sem login.
  await auth.ready;
  if (auth.openMode() || auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};
