import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AdminComponent } from './pages/admin/admin.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { AnalysisComponent } from './pages/analysis/analysis.component';
import { ChatComponent } from './pages/chat/chat.component';
import { FixedIncomeComponent } from './pages/fixed-income/fixed-income.component';
import { InsightsComponent } from './pages/insights/insights.component';
import { LoginComponent } from './pages/login/login.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { SecurityComponent } from './pages/security/security.component';
import { MemoriesComponent } from './pages/memories/memories.component';
import { NotesComponent } from './pages/notes/notes.component';
import { OverviewComponent } from './pages/overview/overview.component';
import { PortfolioComponent } from './pages/portfolio/portfolio.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/overview' },
  { path: 'login', component: LoginComponent },
  { path: 'forgot', component: ForgotPasswordComponent },
  { path: 'reset', component: ForgotPasswordComponent },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: OverviewComponent },
      { path: 'insights', component: InsightsComponent },
      { path: 'portfolio', component: PortfolioComponent },
      { path: 'analysis', component: AnalysisComponent },
      { path: 'fixed-income', component: FixedIncomeComponent },
      { path: 'alerts', component: AlertsComponent },
      { path: 'admin', component: AdminComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'notes', component: NotesComponent },
      { path: 'memories', component: MemoriesComponent },
      { path: 'security', component: SecurityComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
  { path: '**', redirectTo: 'app/overview' },
];
