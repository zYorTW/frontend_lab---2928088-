// src/app/services/reportes.service.ts
import { authService } from './auth/auth.service';

const API_BASE = (window as any).__env?.API_REPORTES || 'http://localhost:4000/api/reportes';

function authHeaders(): HeadersInit {
    const token = authService.getToken?.();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export interface ReporteInventario {
  tipo_producto: string;
  id_producto: string;
  nombre: string;
  cantidad: number;
  presentacion: string;
  marca: string;
  referencia: string;
  fecha_adquisicion: string;
  ubicacion: string;
  fecha_vencimiento: string;
}

export interface ReporteMovimiento {
  id_movimiento: number;
  producto_tipo: string;
  producto_referencia: string;
  usuario_id: number;
  fecha: string;
  tipo_movimiento: string;
}

export interface ReporteVencimiento {
  id_producto: string;
  codigo: string;
  nombre: string;
  marca: string;
  referencia: string;
  presentacion: number;
  presentacion_cant: number;
  cantidad_total: number;
  fecha_adquisicion: string;
  fecha_vencimiento: string;
  dias_restantes: number;
}

export const reportesService = {
  // Reporte de Inventario
  async getInventario() {
    const res = await fetch(`${API_BASE}/inventario`, {
      headers: { ...authHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ReporteInventario[]>;
  },

  // Reporte de Entradas
  async getEntradas(fecha_desde?: string, fecha_hasta?: string) {
    const url = new URL(`${API_BASE}/entradas`);
    if (fecha_desde) url.searchParams.set('fecha_desde', fecha_desde);
    if (fecha_hasta) url.searchParams.set('fecha_hasta', fecha_hasta);
    
    const res = await fetch(url, {
      headers: { ...authHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ReporteMovimiento[]>;
  },

  // Reporte de Salidas
  async getSalidas(fecha_desde?: string, fecha_hasta?: string) {
    const url = new URL(`${API_BASE}/salidas`);
    if (fecha_desde) url.searchParams.set('fecha_desde', fecha_desde);
    if (fecha_hasta) url.searchParams.set('fecha_hasta', fecha_hasta);
    
    const res = await fetch(url, {
      headers: { ...authHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ReporteMovimiento[]>;
  },

  // Reporte de Vencimientos
  async getVencimientos(dias: number = 30) {
    const url = new URL(`${API_BASE}/vencimientos`);
    url.searchParams.set('dias', dias.toString());
    
    const res = await fetch(url, {
      headers: { ...authHeaders() }
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ReporteVencimiento[]>;
  }
};