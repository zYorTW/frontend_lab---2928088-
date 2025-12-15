import { Injectable, signal } from '@angular/core';
import { authService } from '../auth/auth.service';

const API = (window as any).__env?.API_SOLICITUDES || 'http://localhost:4000/api/solicitudes';
const API_DETALLE_LISTA = (window as any).__env?.API_SOLICITUDES_DETALLE_LISTA || 
                         'http://localhost:4000/api/solicitudes/detalle/lista';

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private _solicitudes = signal<Array<any>>([]);
  solicitudes = this._solicitudes.asReadonly();

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getToken();
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
      const res = await fetch(API_DETALLE_LISTA, {
        headers: this.getAuthHeaders()
      });
      
      if (res.status === 401) {
        throw new Error('No autorizado - Token inválido o expirado');
      }
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${await res.text()}`);
      }
      
      const data = await res.json();
      const raw = Array.isArray(data) ? data : [];
      
      // Normalizar los datos
      const normalized = raw.map((r: any) => this.normalizeSolicitud(r));
      this._solicitudes.set(normalized);
      
    } catch (err) {
      console.error('Error cargando solicitudes detalladas:', err);
      
      // Fallback al endpoint básico
      try {
        const res2 = await fetch(API, { headers: this.getAuthHeaders() });
        if (res2.ok) {
          const data2 = await res2.json();
          const raw2 = Array.isArray(data2) ? data2 : [];
          const normalized2 = raw2.map((r: any) => this.normalizeSolicitud(r));
          this._solicitudes.set(normalized2);
          return;
        }
      } catch (e2) {
        console.error('Error en fallback loadSolicitudes:', e2);
      }
      
      this._solicitudes.set([]);
      throw err;
    }
  }

  // Normalización corregida
  private normalizeSolicitud(s: any): any {
    if (!s || typeof s !== 'object') return s;
    
    const idRaw = s?.solicitud_id ?? s?.id_solicitud ?? s?.solicitudId ?? s?.id ?? null;
    const id = (idRaw === null || idRaw === undefined) ? null : Number(idRaw);

    const tipo = (s?.tipo_solicitud ?? s?.tipo ?? '').toString();
    const fecha = s?.fecha_solicitud ?? s?.created_at ?? s?.fecha ?? null;

    const nombreSolicitante = s?.nombre_solicitante ?? s?.cliente_nombre ?? s?.nombre_cliente ?? (s?.cliente && (s.cliente.nombre || s.cliente.nombre_completo)) ?? '';
    const nombreMuestra = s?.nombre_muestra ?? s?.muestra_nombre ?? s?.producto_nombre ?? s?.producto?.nombre ?? '';

    // IMPORTANTE: Los campos vienen directamente del JOIN en solicitudesController.js
    // Usamos los nombres exactos que devuelve la consulta SQL
    
    // Procesar valor_cotizacion
    let valor_cotizacion = s?.valor_cotizacion ?? null;
    if (typeof valor_cotizacion === 'string') {
      const cleaned = valor_cotizacion.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      valor_cotizacion = isNaN(parsed) ? null : parsed;
    }

    return {
      ...s,
      solicitud_id: id,
      id_solicitud: id,
      tipo_solicitud: tipo,
      fecha_solicitud: fecha,
      nombre_solicitante: nombreSolicitante,
      nombre_muestra: nombreMuestra,

      // Campos básicos de la solicitud
      lote_producto: s?.lote_producto ?? null,
      fecha_vencimiento_muestra: s?.fecha_vencimiento_muestra ?? null,
      tipo_muestra: s?.tipo_muestra ?? null,
      tipo_empaque: s?.tipo_empaque ?? null,
      analisis_requerido: s?.analisis_requerido ?? null,
      req_analisis: s?.req_analisis === null ? null : (Number(s.req_analisis) === 1 || s.req_analisis === true),
      cant_muestras: s?.cant_muestras ?? null,
      solicitud_recibida: s?.solicitud_recibida ?? null,
      fecha_entrega_muestra: s?.fecha_entrega_muestra ?? null,
      recibe_personal: s?.recibe_personal ?? null,
      cargo_personal: s?.cargo_personal ?? null,
      observaciones: s?.observaciones ?? null,

      // Oferta - nombres exactos del JOIN
      genero_cotizacion: s?.genero_cotizacion === null ? null : (Number(s.genero_cotizacion) === 1 || s.genero_cotizacion === true),
      valor_cotizacion: valor_cotizacion,
      fecha_envio_oferta: s?.fecha_envio_oferta ?? null,
      realizo_seguimiento_oferta: s?.realizo_seguimiento_oferta === null ? null : (Number(s.realizo_seguimiento_oferta) === 1 || s.realizo_seguimiento_oferta === true),
      observacion_oferta: s?.observacion_oferta ?? null,

      // Revisión - nombres exactos del JOIN
      fecha_limite_entrega: s?.fecha_limite_entrega ?? null,
      fecha_envio_resultados: s?.fecha_envio_resultados ?? null,
      servicio_es_viable: s?.servicio_es_viable === null ? null : (Number(s.servicio_es_viable) === 1 || s.servicio_es_viable === true),

      // Encuesta - nombres exactos del JOIN
      fecha_encuesta: s?.fecha_encuesta ?? null,
      comentarios: s?.comentarios ?? null,
      recomendaria_servicio: s?.recomendaria_servicio === null ? null : (Number(s.recomendaria_servicio) === 1 || s.recomendaria_servicio === true),
      cliente_respondio: s?.cliente_respondio === null ? null : (Number(s.cliente_respondio) === 1 || s.cliente_respondio === true),
      solicito_nueva_encuesta: s?.solicito_nueva_encuesta === null ? null : (Number(s.solicito_nueva_encuesta) === 1 || s.solicito_nueva_encuesta === true)
    };
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
    
      const payload = await res.json().catch(() => ({} as any));
      const newId = payload?.solicitud_id ?? payload?.id ?? body?.solicitud_id ?? null;
      // Optimistic item using canonical fields; oferta/revisión/encuesta null
      const optimisticRaw = {
        ...body,
        solicitud_id: newId,
        id_solicitud: newId,
        genero_cotizacion: null,
        valor_cotizacion: null,
        fecha_envio_oferta: null,
        realizo_seguimiento_oferta: null,
        observacion_oferta: null,
        fecha_limite_entrega: null,
        fecha_envio_resultados: null,
        servicio_es_viable: null,
        fecha_encuesta: null,
        comentarios: null,
        recomendaria_servicio: null,
        cliente_respondio: null,
        solicito_nueva_encuesta: null
      };
      const optimistic = this.normalizeSolicitud(optimisticRaw);
      try {
        const current = this._solicitudes();
        // Prepend so it appears at top (sorted DESC by id)
        this._solicitudes.set([optimistic, ...current]);
      } catch {}
      // Refresh in background to reconcile with DB (joined data)
      this.loadSolicitudes().catch(err => console.warn('Refresh after create failed', err));
      return optimistic;
  }

  async upsertOferta(id_solicitud: number, body: any): Promise<void> {
    const url = API + '/oferta/' + id_solicitud;
    const res = await fetch(url, {
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
    
    // Optimistic merge for oferta fields
    try {
      const current = this._solicitudes();
      const next = current.map((s) => {
        const sid = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
        if (sid !== Number(id_solicitud)) return s;
        let valor_cotizacion = body?.valor_cotizacion ?? s?.valor_cotizacion ?? null;
        if (typeof valor_cotizacion === 'string') {
          const cleaned = valor_cotizacion.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
          const parsed = parseFloat(cleaned);
          valor_cotizacion = isNaN(parsed) ? null : parsed;
        }
        const merged = {
          ...s,
          genero_cotizacion: body?.genero_cotizacion ?? s?.genero_cotizacion ?? null,
          valor_cotizacion,
          fecha_envio_oferta: body?.fecha_envio_oferta ?? s?.fecha_envio_oferta ?? null,
          realizo_seguimiento_oferta: body?.realizo_seguimiento_oferta ?? s?.realizo_seguimiento_oferta ?? null,
          observacion_oferta: body?.observacion_oferta ?? s?.observacion_oferta ?? null
        };
        return this.normalizeSolicitud(merged);
      });
      this._solicitudes.set(next);
    } catch {}
    // Refresh in background
    this.loadSolicitudes().catch(err => console.warn('Refresh after upsertOferta failed', err));
  }

  async upsertRevision(id_solicitud: number, body: any): Promise<void> {
    const url = API + '/revision/' + id_solicitud;
    const res = await fetch(url, {
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
    // Optimistic merge into the existing item so UI updates instantly
    try {
      const current = this._solicitudes();
      const next = current.map((s) => {
        const sid = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
        if (sid !== Number(id_solicitud)) return s;
        const merged = {
          ...s,
          fecha_limite_entrega: body?.fecha_limite_entrega ?? s?.fecha_limite_entrega ?? null,
          fecha_envio_resultados: body?.fecha_envio_resultados ?? s?.fecha_envio_resultados ?? null,
          servicio_es_viable: body?.servicio_es_viable ?? s?.servicio_es_viable ?? null
        };
        return this.normalizeSolicitud(merged);
      });
      this._solicitudes.set(next);
    } catch {}
    // Refresh in background to reconcile with DB (joined data)
    this.loadSolicitudes().catch(err => console.warn('Refresh after upsertRevision failed', err));
  }

  async upsertSeguimientoEncuesta(id_solicitud: number, body: any): Promise<void> {
    const url = API + '/seguimiento-encuesta/' + id_solicitud;
    const res = await fetch(url, {
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
    
    // Optimistic merge for encuesta fields
    try {
      const current = this._solicitudes();
      const next = current.map((s) => {
        const sid = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
        if (sid !== Number(id_solicitud)) return s;
        const merged = {
          ...s,
          fecha_encuesta: body?.fecha_encuesta ?? s?.fecha_encuesta ?? null,
          comentarios: body?.comentarios ?? s?.comentarios ?? null,
          recomendaria_servicio: body?.recomendaria_servicio ?? s?.recomendaria_servicio ?? null,
          cliente_respondio: body?.cliente_respondio ?? s?.cliente_respondio ?? null,
          solicito_nueva_encuesta: body?.solicito_nueva_encuesta ?? s?.solicito_nueva_encuesta ?? null
        };
        return this.normalizeSolicitud(merged);
      });
      this._solicitudes.set(next);
    } catch {}
    // Refresh in background
    this.loadSolicitudes().catch(err => console.warn('Refresh after upsertSeguimientoEncuesta failed', err));
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
    
    await this.loadSolicitudes();
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
    
    await this.loadSolicitudes();
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
    
    await this.loadSolicitudes();
  }
}