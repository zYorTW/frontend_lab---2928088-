import { Injectable, signal } from '@angular/core';
import { authService } from '../auth/auth.service';

const API = (window as any).__env?.API_SOLICITUDES || 'http://localhost:42420/api/solicitudes';

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
    console.log('🔄 LocationsService: Cargando departamentos...');
    try {
      const res = await fetch(API + '/departamentos', {
        headers: this.getAuthHeaders()
      });
      
      console.log('📡 Response status:', res.status);
      
      if (res.status === 401) {
        throw new Error('No autorizado - Token inválido o expirado');
      }
      
      const data = await res.json();
      console.log('📦 Data recibida:', data);
      
      const arr = Array.isArray(data) ? data : (data.rows || data.data || []);
      console.log('✅ Departamentos parseados:', arr.length, arr);
      
      this._departamentos.set(arr);
    } catch (err) {
      console.error('❌ Error cargando departamentos', err);
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
      // If departamentoCodigo provided, merge into existing ciudades list to avoid overwriting
      if (departamentoCodigo) {
        const existing = this._ciudades();
        const map = new Map<string, any>();
        for (const c of existing || []) {
          const key = String(c.codigo || c.id || c.codigo_ciudad || c.id_ciudad || c.code || c.value || '').trim();
          if (key) map.set(key, c);
        }
        for (const c of arr || []) {
          const key = String(c.codigo || c.id || c.codigo_ciudad || c.id_ciudad || c.code || c.value || '').trim();
          if (key && !map.has(key)) map.set(key, c);
        }
        this._ciudades.set(Array.from(map.values()));
      } else {
        this._ciudades.set(arr);
      }
    } catch (err) {
      console.error('Error cargando ciudades', err);
      throw err;
    }
  }
}