import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AdminComponent } from './pages/admin/admin.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { AnalysisComponent } from './pages/analysis/analysis.component';
import { BankingComponent } from './pages/banking/banking.component';
import { FinanceComponent } from './pages/finance/finance.component';
import { WhatIfComponent } from './pages/whatif/whatif.component';
import { BusinessComponent } from './pages/business/business.component';
import { ChatComponent } from './pages/chat/chat.component';
import { FixedIncomeComponent } from './pages/fixed-income/fixed-income.component';
import { InsightsComponent } from './pages/insights/insights.component';
import { DiscoveryComponent } from './pages/discovery/discovery.component';
import { LearningComponent } from './pages/learning/learning.component';
import { LoginComponent } from './pages/login/login.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { SecurityComponent } from './pages/security/security.component';
import { MemoriesComponent } from './pages/memories/memories.component';
import { NotesComponent } from './pages/notes/notes.component';
import { OpportunitiesComponent } from './pages/opportunities/opportunities.component';
import { PaperComponent } from './pages/paper/paper.component';
import { TeachComponent } from './pages/teach/teach.component';
import { OverviewComponent } from './pages/overview/overview.component';
import { PortfolioComponent } from './pages/portfolio/portfolio.component';
import { PromptsComponent } from './pages/prompts/prompts.component';
import { SeerComponent } from './pages/seer/seer.component';
import { TrackingComponent } from './pages/tracking/tracking.component';
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
      { path: 'opportunities', component: OpportunitiesComponent },
      { path: 'business', component: BusinessComponent },
      { path: 'portfolio', component: PortfolioComponent },
      { path: 'tracking', component: TrackingComponent },
      { path: 'seer', component: SeerComponent },
      { path: 'learning', component: LearningComponent },
      { path: 'paper', component: PaperComponent },
      { path: 'teach', component: TeachComponent },
      { path: 'discovery', component: DiscoveryComponent },
      { path: 'banking', component: BankingComponent },
      { path: 'finance', component: FinanceComponent },
      { path: 'whatif', component: WhatIfComponent },
      { path: 'analysis', component: AnalysisComponent },
      { path: 'fixed-income', component: FixedIncomeComponent },
      { path: 'alerts', component: AlertsComponent },
      { path: 'admin', component: AdminComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'notes', component: NotesComponent },
      { path: 'memories', component: MemoriesComponent },
      { path: 'security', component: SecurityComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'prompts', component: PromptsComponent },
    ],
  },
  { path: '**', redirectTo: 'app/overview' },
];
