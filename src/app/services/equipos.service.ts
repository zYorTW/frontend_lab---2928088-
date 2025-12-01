import { signal } from '@angular/core';

const API = (window as any).__env?.API_EQUIPOS || 'http://localhost:4000/api/equipos';

export const equiposService = {
  // Registrar un nuevo equipo
  async crearEquipo(payload: any) {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al registrar equipo');
    }
    return await res.json();
  },

  // Registrar historial de equipo
  async crearHistorial(payload: any) {
    const API_HISTORIAL = (window as any).__env?.API_HISTORIAL_HV || 'http://localhost:4000/api/equipos/historial';
    const res = await fetch(API_HISTORIAL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al registrar historial');
    }
    return await res.json();
  },

  // Registrar intervalo de equipo
  async crearIntervalo(payload: any) {
    const API_INTERVALO = (window as any).__env?.API_INTERVALO_HV || 'http://localhost:4000/api/equipos/intervalo';
    const res = await fetch(API_INTERVALO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al registrar intervalo');
    }
    return await res.json();
  },

  // Registrar ficha técnica
  async crearFichaTecnica(payload: any) {
    const API_FICHA_TECNICA = (window as any).__env?.API_FICHA_TECNICA || 'http://localhost:4000/api/equipos/ficha-tecnica';
    const res = await fetch(API_FICHA_TECNICA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al registrar ficha técnica');
    }
    return await res.json();
  },

  // Listar equipos registrados
  async listarEquipos() {
    const res = await fetch(API, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      }
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al obtener equipos');
    }
    return await res.json();
  },

  // Obtener equipo completo por código - MÉTODO CORREGIDO
  async obtenerEquipoCompleto(codigo: string) {
    const res = await fetch(`${API}/completo/${codigo}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      }
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al obtener equipo');
    }
    return await res.json();
  },

  // ✅ NUEVO: Obtener fichas técnicas
  async listarFichasTecnicas() {
    const res = await fetch(`${API}/fichas-tecnicas`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
      }
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || 'Error al obtener fichas técnicas');
    }
    return await res.json();
  },

// Obtener el siguiente consecutivo para historial_hv por equipo específico
async obtenerSiguienteConsecutivoHistorialPorEquipo(equipoId: string) {
  const API_MAX_CONSECUTIVO = `http://localhost:4000/api/equipos/historial/max-consecutivo/${equipoId}`;
  const res = await fetch(API_MAX_CONSECUTIVO, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
    }
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Error al obtener consecutivo historial por equipo');
  }
  const data = await res.json();
  return (data.maxConsecutivo || 0) + 1;
},

// Obtener el siguiente consecutivo para intervalo_hv por equipo específico
async obtenerSiguienteConsecutivoIntervaloPorEquipo(equipoId: string) {
  const API_MAX_CONSECUTIVO = `http://localhost:4000/api/equipos/intervalo/max-consecutivo/${equipoId}`;
  const res = await fetch(API_MAX_CONSECUTIVO, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
    }
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Error al obtener consecutivo intervalo por equipo');
  }
  const data = await res.json();
  return (data.maxConsecutivo || 0) + 1;
}
};