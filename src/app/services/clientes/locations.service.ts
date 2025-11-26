import { Injectable, signal } from '@angular/core';
import { authService } from '../auth/auth.service'; // Importar tu authService existente

const API = (window as any).__env?.API_BASE || 'http://localhost:4000/api/solicitudes';

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private _departamentos = signal<Array<any>>([]);
  private _ciudades = signal<Array<any>>([]);
  
  departamentos = this._departamentos.asReadonly();
  ciudades = this._ciudades.asReadonly();

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getToken(); // Usar tu authService existente
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async loadDepartamentos(): Promise<void> {
    try {
      const res = await fetch(API + '/departamentos', {
        headers: this.getAuthHeaders()
      });
      
      if (res.status === 401) {
        throw new Error('No autorizado - Token inválido o expirado');
      }
      
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.rows || data.data || []);
      this._departamentos.set(arr);
    } catch (err) {
      console.error('Error cargando departamentos', err);
      throw err;
    }
  }

  async loadCiudades(departamentoCodigo?: string): Promise<void> {
    try {
      let url = API + '/ciudades';
      if (departamentoCodigo) {
        url += `?departamento=${encodeURIComponent(departamentoCodigo)}`;
      }
      
      const res = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      
      if (res.status === 401) {
        throw new Error('No autorizado - Token inválido o expirado');
      }
      
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.rows || data.data || []);
      this._ciudades.set(arr);
    } catch (err) {
      console.error('Error cargando ciudades', err);
      throw err;
    }
  }
}