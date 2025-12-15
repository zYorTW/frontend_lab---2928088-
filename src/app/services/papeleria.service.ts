import { Injectable } from '@angular/core';
import { authService } from './auth/auth.service';

// Interfaces para tipado
export interface CatalogoItem {
  item: number;
  nombre: string;
  descripcion?: string;
  imagen?: string;
}

export interface PapeleriaItem {
  id: number;
  item_catalogo: number;
  nombre: string;
  cantidad_adquirida: number;
  cantidad_existente: number;
  presentacion?: string;
  marca?: string;
  descripcion?: string;
  fecha_adquisicion?: string;
  ubicacion?: string;
  observaciones?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BuscarCatalogoResponse {
  rows: CatalogoItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListarPapeleriaResponse {
  rows: PapeleriaItem[];
  total: number;
  limit?: number;
}

export interface AjustarExistenciasPayload {
  cantidad?: number;
  delta?: number;
}

export interface ErrorResponse {
  message: string;
  status?: number;
  code?: string;
}

// Clase de error personalizada
export class PapeleriaError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'PapeleriaError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class PapeleriaService {
  private readonly API_BASE = (window as any).__env?.API_PAPELERIA || 'http://localhost:4000/api/papeleria';

  // ===== OPERACIONES DE CATÁLOGO =====

  /**
   * Buscar items en el catálogo
   */
  async buscarCatalogo(
    query: string = '',
    limit?: number,
    offset?: number
  ): Promise<BuscarCatalogoResponse | CatalogoItem[]> {
    const url = new URL(`${this.API_BASE}/catalogo`);
    
    if (query) url.searchParams.set('q', query.trim());
    if (limit && limit > 0) url.searchParams.set('limit', String(limit));
    if (offset && offset >= 0) url.searchParams.set('offset', String(offset));
    
    const response = await this.fetchWithTimeout(url.toString());
    return this.handleResponse<BuscarCatalogoResponse | CatalogoItem[]>(response);
  }

  /**
   * Obtener un item específico del catálogo
   */
  async obtenerCatalogo(item: number): Promise<CatalogoItem> {
    const encodedItem = encodeURIComponent(String(item));
    const response = await this.fetchWithTimeout(`${this.API_BASE}/catalogo/${encodedItem}`);
    return this.handleResponse<CatalogoItem>(response);
  }

  /**
   * Crear un nuevo item en el catálogo
   */
  async crearCatalogo(formData: FormData): Promise<CatalogoItem> {
    const response = await this.fetchWithTimeout(`${this.API_BASE}/catalogo`, {
      method: 'POST',
      headers: this.getAuthHeadersFormData(),
      body: formData
    });
    
    return this.handleResponse<CatalogoItem>(response);
  }

  /**
   * Eliminar un item del catálogo
   */
  async eliminarCatalogoPapeleria(item: number | string): Promise<{ message: string }> {
    const encodedItem = encodeURIComponent(String(item));
    const response = await this.fetchWithTimeout(`${this.API_BASE}/catalogo/${encodedItem}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    
    return this.handleResponse<{ message: string }>(response);
  }

  /**
   * Obtener URL de imagen del catálogo
   */
  getCatalogoImagenUrl(item: number | string): string {
    const encodedItem = encodeURIComponent(String(item));
    return `${this.API_BASE}/catalogo/${encodedItem}/imagen`;
  }

  // ===== OPERACIONES DE INVENTARIO =====

  /**
   * Listar items de papelería
   */
  async listar(
    query: string = '',
    limit?: number
  ): Promise<ListarPapeleriaResponse | PapeleriaItem[]> {
    const url = new URL(this.API_BASE);
    
    if (query) url.searchParams.set('q', query.trim());
    if (limit && limit > 0) url.searchParams.set('limit', String(limit));
    
    const response = await this.fetchWithTimeout(url.toString());
    return this.handleResponse<ListarPapeleriaResponse | PapeleriaItem[]>(response);
  }

  /**
   * Obtener un item específico de papelería
   */
  async obtener(id: number): Promise<PapeleriaItem> {
    const encodedId = encodeURIComponent(String(id));
    const response = await this.fetchWithTimeout(`${this.API_BASE}/${encodedId}`);
    return this.handleResponse<PapeleriaItem>(response);
  }

  /**
   * Crear un nuevo registro de papelería
   */
  async crear(body: any): Promise<PapeleriaItem> {
    const response = await this.fetchWithTimeout(this.API_BASE, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    });
    
    return this.handleResponse<PapeleriaItem>(response);
  }

  /**
   * Actualizar un registro de papelería
   */
  async actualizar(id: number, body: any): Promise<PapeleriaItem> {
    const encodedId = encodeURIComponent(String(id));
    const response = await this.fetchWithTimeout(`${this.API_BASE}/${encodedId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    });
    
    return this.handleResponse<PapeleriaItem>(response);
  }

  /**
   * Ajustar existencias de un item
   */
  async ajustarExistencias(
    id: number, 
    options: AjustarExistenciasPayload
  ): Promise<PapeleriaItem> {
    const encodedId = encodeURIComponent(String(id));
    const payload: any = {};
    
    if (typeof options.cantidad !== 'undefined') {
      payload.cantidad = options.cantidad;
    }
    if (typeof options.delta !== 'undefined') {
      payload.delta = options.delta;
    }
    
    const response = await this.fetchWithTimeout(`${this.API_BASE}/${encodedId}/existencias`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    
    return this.handleResponse<PapeleriaItem>(response);
  }

  /**
   * Eliminar un registro de papelería
   */
  async eliminar(id: number): Promise<{ message: string }> {
    const encodedId = encodeURIComponent(String(id));
    const response = await this.fetchWithTimeout(`${this.API_BASE}/${encodedId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    
    return this.handleResponse<{ message: string }>(response);
  }

  // ===== MÉTODOS UTILITARIOS =====

  /**
   * Verificar conexión con el servicio
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.fetchWithTimeout(`${this.API_BASE}/health`, {}, 5000);
      return this.handleResponse<{ status: string; timestamp: string }>(response);
    } catch (error) {
      throw new PapeleriaError('Service unavailable');
    }
  }

  /**
   * Buscar con filtros avanzados
   */
  async buscarAvanzado(filters: {
    query?: string;
    item_catalogo?: number;
    presentacion?: string;
    marca?: string;
    ubicacion?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListarPapeleriaResponse> {
    const url = new URL(`${this.API_BASE}/buscar`);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    
    const response = await this.fetchWithTimeout(url.toString());
    return this.handleResponse<ListarPapeleriaResponse>(response);
  }

  // ===== MÉTODOS PRIVADOS DE UTILIDAD =====

  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private getAuthHeadersFormData(): HeadersInit {
    const token = authService.getToken?.();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: ErrorResponse;
      
      try {
        errorData = await response.json();
      } catch {
        try {
          const text = await response.text();
          errorData = { message: text || 'Error desconocido' };
        } catch {
          errorData = { message: `Error ${response.status}: ${response.statusText}` };
        }
      }
      
      throw new PapeleriaError(
        errorData.message,
        response.status,
        errorData.code
      );
    }
    
    try {
      return await response.json();
    } catch (error) {
      throw new PapeleriaError('Error parsing response');
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 10000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PapeleriaError('Request timeout');
      }
      throw error;
    }
  }
}