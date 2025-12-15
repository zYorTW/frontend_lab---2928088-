import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { insumosService } from '../../services/insumos.service';
import { reactivosService } from '../../services/reactivos.service';
import { authService } from '../../services/auth/auth.service';

const API_SOLICITUDES = (window as any).__env?.API_SOLICITUDES || 'http://localhost:42420/api/solicitudes';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  imports: [CommonModule, RouterModule]
})
export class DashboardComponent implements OnInit {
  // Estado de carga
  cargando = signal(true);
  proximosVencerExpanded = false;
  vencidosExpanded = false;
  
  // Métricas principales - SIN equipos ni materiales volumétricos
  metricas = signal({
    totalInsumos: 0,
    totalReactivos: 0,
    totalSolicitudes: 0,
    totalClientes: 0,
    totalPapeleria: 0
  });

  // Datos para gráficos
  insumosData = signal<any[]>([]);
  reactivosData = signal<any[]>([]);
  solicitudesData = signal<any[]>([]);
  clientesData = signal<any[]>([]);

  // Reactivos próximos a vencer
  reactivosProximosVencer = signal<any[]>([]);
  // Reactivos vencidos
  reactivosVencidos = signal<any[]>([]);

  // Detectar si el usuario es auxiliar
  get esAuxiliar() {
    const user = (window as any).authUser?.() || null;
    return user && user.rol === 'Auxiliar';
  }

  constructor() {}

  async ngOnInit() {
    await this.cargarDashboard();
    this.cargando.set(false);
  }

  async cargarDashboard() {
    try {
      // Cargar datos en paralelo - OPTIMIZADO
      await Promise.all([
        this.cargarInsumos(),
        this.cargarReactivos(),
        this.cargarSolicitudes(),
        this.cargarClientes(),
        this.cargarPapeleria() // Nueva función específica para papelería
      ]);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
    }
  }

  async cargarPapeleria() {
    try {
      // Aquí puedes implementar la carga de datos de papelería
      // Por ahora, establecemos un valor por defecto o podrías hacer una llamada API
      this.metricas.update(m => ({ 
        ...m, 
        totalPapeleria: 0 // Valor temporal, puedes cambiarlo por una llamada real
      }));
    } catch (error) {
      console.error('Error cargando papelería:', error);
      this.metricas.update(m => ({ ...m, totalPapeleria: 0 }));
    }
  }

  async cargarInsumos() {
    try {
      const insumos = await insumosService.listarInsumos('', 1000);
      this.insumosData.set(insumos);
      this.metricas.update(m => ({ ...m, totalInsumos: insumos.length }));
    } catch (error) {
      console.error('Error cargando insumos:', error);
    }
  }

  async cargarReactivos() {
    try {
      const resp = await reactivosService.listarReactivos('', 1000);
      const reactivos = Array.isArray(resp) ? resp : (resp?.rows || []);
      const total = Array.isArray(resp) ? resp.length : (resp?.total ?? reactivos.length);
      this.reactivosData.set(reactivos);
      this.metricas.update(m => ({ ...m, totalReactivos: total }));
      
      // Calcular reactivos próximos a vencer (30 días)
      const hoy = new Date();
      const limite = new Date();
      limite.setDate(hoy.getDate() + 30);
      
      const proximos = reactivos.filter((reactivo: any) => {
        if (!reactivo.fecha_vencimiento) return false;
        const fechaVenc = new Date(reactivo.fecha_vencimiento);
        return fechaVenc <= limite && fechaVenc >= hoy;
      });
      
      this.reactivosProximosVencer.set(proximos);

      // Vencidos: fecha_vencimiento estrictamente menor a hoy
      const vencidos = reactivos.filter((reactivo: any) => {
        if (!reactivo.fecha_vencimiento) return false;
        const fechaVenc = new Date(reactivo.fecha_vencimiento);
        return fechaVenc < hoy;
      });
      this.reactivosVencidos.set(vencidos);
    } catch (error) {
      console.error('Error cargando reactivos:', error);
    }
  }

  async cargarSolicitudes() {
    try {
      const token = authService.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(API_SOLICITUDES, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const solicitudes = await res.json();
      this.solicitudesData.set(solicitudes);
      this.metricas.update(m => ({ ...m, totalSolicitudes: solicitudes.length }));
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      this.solicitudesData.set([]); // ← SETEAR ARRAY VACÍO EN CASO DE ERROR
    }
  }

  async cargarClientes() {
    try {
      const token = authService.getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(API_SOLICITUDES + '/clientes', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const clientes = await res.json();
      this.clientesData.set(clientes);
      this.metricas.update(m => ({ ...m, totalClientes: clientes.length }));
    } catch (error) {
      console.error('Error cargando clientes:', error);
      this.clientesData.set([]); // ← SETEAR ARRAY VACÍO EN CASO DE ERROR
    }
  }

  // Métodos para cálculos
  contarSolicitudesViable(): number {
    return this.solicitudesData().filter(s => s.servicio_viable).length;
  }

  contarSolicitudesConOferta(): number {
    return this.solicitudesData().filter(s => s.genero_cotizacion).length;
  }

  contarSolicitudesConResultados(): number {
    return this.solicitudesData().filter((s: any) => s.numero_informe_resultados).length;
  }

  contarClientesPorTipo(tipo: string): number {
    return this.clientesData().filter(c => c.tipo_usuario === tipo).length;
  }

  formatearNumero(num: number): string {
    return num.toLocaleString('es-CO');
  }

    // Métodos para alternar expansión
  toggleProximosVencer() {
    this.proximosVencerExpanded = !this.proximosVencerExpanded;
  }

  toggleVencidos() {
    this.vencidosExpanded = !this.vencidosExpanded;
  }
}