import { authService } from './auth/auth.service';
const API_BASE = (window as any).__env?.API_INSUMOS || 'http://localhost:4000/api/insumos';

function authHeaders(): HeadersInit {
    const token = authService.getToken?.();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export const insumosService = {
    async aux() {
        const res = await fetch(`${API_BASE}/aux`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Catálogo
    async buscarCatalogo(q: string, limit?: number, offset?: number) {
        const url = new URL(`${API_BASE}/catalogo`);
        if (q) url.searchParams.set('q', q);
        if (limit && limit > 0) url.searchParams.set('limit', String(limit));
        if (offset && offset > 0) url.searchParams.set('offset', String(offset));
        const res = await fetch(url);
        if (!res.ok) throw new Error(await res.text());
        return res.json(); // Puede ser array o {rows,total}
    },
    async obtenerCatalogo(item: number) {
        const res = await fetch(`${API_BASE}/catalogo/${encodeURIComponent(String(item))}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    async crearCatalogo(form: FormData) {
        const res = await fetch(`${API_BASE}/catalogo`, {
            method: 'POST',
            headers: { ...authHeaders() }, 
            body: form
        });
        let data: any = null; try { data = await res.json(); } catch { }
        if (!res.ok) throw new Error((data && data.message) || 'Error creando catálogo');
        return data;
    },
    async actualizarCatalogo(itemId: number, body: FormData | any) {
        const init: RequestInit = { method: 'PUT' };
        if (body instanceof FormData) {
            init.headers = { ...authHeaders() };
            init.body = body;
        } else {
            init.headers = { 'Content-Type': 'application/json', ...authHeaders() };
            init.body = JSON.stringify(body);
        }
        const res = await fetch(`${API_BASE}/catalogo/${encodeURIComponent(String(itemId))}`, init);
        let data: any = null; try { data = await res.json(); } catch { }
        if (!res.ok) throw new Error((data && data.message) || 'Error actualizando catálogo');
        return data;
    },

    // Eliminar del catálogo de Insumos (nombre específico)
    async eliminarCatalogoInsumos(item: number | string) {
        const res = await fetch(`${API_BASE}/catalogo/${encodeURIComponent(String(item))}`, {
            method: 'DELETE',
            headers: { ...authHeaders() }
        });
        let data: any = null;
        try {
            data = await res.json();
        } catch {
            // fallback a texto si no es JSON
            try {
                const txt = await res.text();
                data = { message: txt };
            } catch { data = null; }
        }
        if (!res.ok) {
            const msg = (data && data.message) || 'Error eliminando catálogo';
            const err = new Error(msg);
            (err as any).status = res.status;
            throw err;
        }
        return data;
    },

    // Nota: eliminarCatalogo fue eliminado para evitar ambigüedad entre módulos

    getCatalogoImagenUrl(item: number | string) {
        return `${API_BASE}/catalogo/${encodeURIComponent(String(item))}/imagen`;
    },

    // Insumos
    async listarInsumos(q: string, limit?: number) {
        const url = new URL(API_BASE);
        if (q) url.searchParams.set('q', q);
        if (limit && limit > 0) url.searchParams.set('limit', String(limit));
        const res = await fetch(url, { headers: { ...authHeaders() } }); 
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    async obtenerInsumo(item: number) {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(String(item))}`);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },
    async crearInsumo(item: any) {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() }, 
            body: JSON.stringify(item)
        });
        let data: any = null; try { data = await res.json(); } catch { }
        if (!res.ok) throw new Error((data && data.message) || 'Error creando insumo');
        return data;
    },
    async actualizarInsumo(item: number, data: any) {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(String(item))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() }, 
            body: JSON.stringify(data)
        });
        let resData: any = null; try { resData = await res.json(); } catch { }
        if (!res.ok) throw new Error((resData && resData.message) || 'Error actualizando insumo');
        return resData;
    },
    async ajustarExistencias(id: number, opts: { cantidad?: number, delta?: number }) {
        const body: any = {};
        if (typeof opts?.cantidad !== 'undefined') body.cantidad = opts.cantidad;
        if (typeof opts?.delta !== 'undefined') body.delta = opts.delta;
        const res = await fetch(`${API_BASE}/${encodeURIComponent(String(id))}/existencias`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(body)
        });
        let data: any = null; try { data = await res.json(); } catch { }
        if (!res.ok) throw new Error((data && data.message) || 'Error ajustando existencias');
        return data; // { id, cantidad_existente }
    },
    async eliminarInsumo(item: number) {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(String(item))}`, { method: 'DELETE', headers: { ...authHeaders() } });
        let data: any = null; try { data = await res.json(); } catch { }
        if (!res.ok) throw new Error((data && data.message) || 'Error eliminando insumo');
        return data;
    },
};