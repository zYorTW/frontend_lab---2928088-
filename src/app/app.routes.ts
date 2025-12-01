import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './guards/auth.guard';
import { InsumosComponent } from './pages/insumos/insumos.component';
import { PapeleriaComponent } from './pages/papeleria/papeleria.component';
// Equipos will be lazy-loaded like other sections

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  
  // Rutas protegidas
  { 
    path: 'dashboard', 
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador', 'Auxiliar'] } 
  },
  { 
    path: 'solicitudes', 
    loadComponent: () => import('./pages/solicitudes/solicitudes.component').then(m => m.SolicitudesComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador', 'Auxiliar'] } 
  },
  { 
    path: 'reactivos', 
    loadComponent: () => import('./pages/reactivos/reactivos.component').then(m => m.ReactivosComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador', 'Auxiliar'] } 
  },
  { 
    path: 'insumos', 
    component: InsumosComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador', 'Auxiliar'] } 
  },
  { 
    path: 'papeleria', 
    component: PapeleriaComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador', 'Auxiliar'] } 
  },
  { 
    path: 'usuarios', 
    loadComponent: () => import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Superadmin'] }
  },
  { 
    path: 'auditoria', 
    loadComponent: () => import('./pages/logs/logs.component').then(m => m.LogsComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador'] }
  },
  { 
    path: 'reportes', 
    loadComponent: () => import('./pages/reportes/reportes.component').then(m => m.ReportesComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador'] } 
  },
  { 
    path: 'equipos', 
    loadComponent: () => import('./pages/equipos/equipos.component').then(m => m.EquiposComponent), 
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrador','Auxiliar'] } 
  }
];