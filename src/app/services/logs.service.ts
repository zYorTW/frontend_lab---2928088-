import { authService } from './auth/auth.service';

const API_BASE = (window as any).__env?.API_LOGS || 'http://localhost:4000/api/logs';

function authHeaders(): HeadersInit {
    const token = authService.getToken?.();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export const logsService = {
    // Obtener logs de acciones - CORREGIDO: usuario_id como number | undefined
    async getLogsAcciones(filtros?: {
        page?: number;
        limit?: number;
        modulo?: string;
        accion?: string;
        usuario_id?: number;
        fecha_desde?: string;
        fecha_hasta?: string;
    }) {
        const url = new URL(`${API_BASE}/acciones`);
        if (filtros) {
            Object.entries(filtros).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, String(value));
                }
            });
        }
        const res = await fetch(url.toString(), { headers: authHeaders() });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Obtener movimientos de inventario
    async getMovimientosInventario(filtros?: {
        page?: number;
        limit?: number;
        producto_tipo?: string;
        tipo_movimiento?: string;
        fecha_desde?: string;
        fecha_hasta?: string;
    }) {
        const url = new URL(`${API_BASE}/movimientos-inventario`);
        if (filtros) {
            Object.entries(filtros).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, String(value));
                }
            });
        }
        const res = await fetch(url.toString(), { headers: authHeaders() });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Obtener estadísticas
    async getEstadisticas() {
        const res = await fetch(`${API_BASE}/estadisticas`, { headers: authHeaders() });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
};