import { Injectable, signal } from '@angular/core';
import { authService } from '../auth/auth.service';

const API = (window as any).__env?.API_SOLICITUDES || 'http://localhost:4000/api/solicitudes';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private _clientes = signal<Array<any>>([]);
  clientes = this._clientes.asReadonly();

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

  async loadClientes(): Promise<void> {
    try {
      const res = await fetch(API + '/clientes', {
        headers: this.getAuthHeaders()
      });
      
      if (res.status === 401) {
        throw new Error('No autorizado - Token inválido o expirado');
      }
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${await res.text()}`);
      }
      
      const data = await res.json();
      const clientesBasicos = Array.isArray(data) ? data : [];
      
      const clientesCompletos = [];
      for (const cliente of clientesBasicos) {
        try {
          const resCompleto = await fetch(API + '/clientes/' + cliente.id_cliente, {
            headers: this.getAuthHeaders()
          });
          if (resCompleto.ok) {
            const clienteCompleto = await resCompleto.json();
            clientesCompletos.push(clienteCompleto);
          } else {
            clientesCompletos.push(cliente);
          }
        } catch (err) {
          console.warn('Error obteniendo datos completos del cliente', cliente.id_cliente, err);
          clientesCompletos.push(cliente);
        }
      }
      
      this._clientes.set(clientesCompletos);
    } catch (err) {
      console.error('loadClientes', err);
      this._clientes.set([]);
      throw err;
    }
  }

  async createCliente(payload: any): Promise<void> {
    const res = await fetch(API + '/clientes', { 
      method: 'POST', 
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload) 
    });
    
    if (res.status === 401) {
      throw new Error('No autorizado - Token inválido o expirado');
    }
    
    if (!res.ok) {
      throw new Error(await res.text());
    }
    
    // Recargar la lista de clientes automáticamente
    await this.loadClientes();
  }

  async deleteCliente(id: number): Promise<void> {
    const res = await fetch(API + '/clientes/' + id, { 
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    
    if (res.status === 401) {
      throw new Error('No autorizado - Token inválido o expirado');
    }
    
    if (!res.ok) {
      throw new Error(await res.text());
    }
    
    // Recargar la lista de clientes automáticamente
    await this.loadClientes();
  }

  async updateCliente(id: number, body: any): Promise<void> {
    const res = await fetch(API + '/clientes/' + id, {
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

    await this.loadClientes();
  }
}