import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ChatComponent } from './pages/chat/chat.component';
import { FixedIncomeComponent } from './pages/fixed-income/fixed-income.component';
import { LoginComponent } from './pages/login/login.component';
import { OverviewComponent } from './pages/overview/overview.component';
import { PortfolioComponent } from './pages/portfolio/portfolio.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/overview' },
  { path: 'login', component: LoginComponent },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: OverviewComponent },
      { path: 'portfolio', component: PortfolioComponent },
      { path: 'fixed-income', component: FixedIncomeComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: 'app/overview' },
];
