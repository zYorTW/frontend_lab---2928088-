import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
	{ path: '', redirectTo: 'login', pathMatch: 'full' },
	{ path: 'login', loadComponent: () => import('./login/login.component').then(m => m.LoginComponent) },
	{ path: 'register', loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent) },
	{ path: 'forgot', loadComponent: () => import('./forgot/forgot.component').then(m => m.ForgotComponent) },
	{ path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard] },
	{ path: 'solicitudes', loadComponent: () => import('./solicitudes/solicitudes.component').then(m => m.SolicitudesComponent), canActivate: [authGuard] },
	{ path: 'reactivos', loadComponent: () => import('./reactivos/reactivos.component').then(m => m.ReactivosComponent), canActivate: [authGuard] },
	{ path: 'insumos', loadComponent: () => import('./insumos/insumos.component').then(m => m.InsumosComponent), canActivate: [authGuard] },
];

export const appRouterProviders = [
	provideRouter(routes)
];
