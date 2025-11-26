import { Injectable, signal } from '@angular/core';
import { authService } from '../auth/auth.service'; // Importar tu authService existente

const API = (window as any).__env?.API_BASE || 'http://localhost:4000/api/solicitudes';

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private _solicitudes = signal<Array<any>>([]);
  solicitudes = this._solicitudes.asReadonly();

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getToken(); // Usar tu authService existente
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async loadSolicitudes(): Promise<void> {
    try {
      const res = await fetch(API, {
        headers: this.getAuthHeaders()
      });
      
      if (res.status === 401) {
        throw new Error('No autorizado - Token inválido o expirado');
      }
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${await res.text()}`);
      }
      
      const data = await res.json();
      const solicitudes = Array.isArray(data) ? data : [];
      this._solicitudes.set(solicitudes);
    } catch (err) {
      console.error('loadSolicitudes', err);
      this._solicitudes.set([]);
      throw err;
    }
  }

  async createSolicitud(body: any): Promise<void> {
    const res = await fetch(API, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    });
    
    if (res.status === 401) {
      throw new Error('No autorizado - Token inválido o expirado');
    }
    
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  async updateSolicitud(id: any, body: any): Promise<void> {
    const res = await fetch(API + '/' + id, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    });
    
    if (res.status === 401) {
      throw new Error('No autorizado - Token inválido o expirado');
    }
    
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  async deleteSolicitud(id: number): Promise<void> {
    const res = await fetch(API + '/' + id, { 
      method: 'DELETE', 
      headers: this.getAuthHeaders()
    });
    
    if (res.status === 401) {
      throw new Error('No autorizado - Token inválido o expirado');
    }
    
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  async createEncuesta(body: any): Promise<void> {
    const res = await fetch(API + '/encuestas', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    });
    
    if (res.status === 401) {
      throw new Error('No autorizado - Token inválido o expirado');
    }
    
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }
}