import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VolumetricosService {
  private API_URL = (window as any).__env?.API_VOLUMETRICOS || 'http://localhost:4000/api/volumetricos';

  constructor() {}

  // Métodos para material_volumetrico
  async listarMateriales(): Promise<any[]> {
    const response = await fetch(`${this.API_URL}/materiales`);
    if (!response.ok) throw new Error('Error al listar materiales');
    return response.json();
  }

  async crearMaterial(payload: any): Promise<any> {
    const response = await fetch(`${this.API_URL}/materiales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Error al crear material');
    return response.json();
  }

  async actualizarMaterial(codigo: number, payload: any): Promise<any> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Error al actualizar material');
    return response.json();
  }

  async eliminarMaterial(codigo: number): Promise<void> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar material');
  }

  // Métodos para historial_volumetrico
  async listarHistorialPorMaterial(codigo: number): Promise<any[]> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}/historial`);
    if (!response.ok) throw new Error('Error al listar historial');
    return response.json();
  }

  async crearHistorial(payload: any): Promise<any> {
    const response = await fetch(`${this.API_URL}/historial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Error al crear historial');
    return response.json();
  }

  async obtenerNextHistorial(codigo: number): Promise<{ next: number }> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}/historial/next`);
    if (!response.ok) throw new Error('Error al obtener siguiente consecutivo');
    return response.json();
  }

  async actualizarHistorial(codigo_material: number, consecutivo: number, payload: any): Promise<any> {
    const response = await fetch(`${this.API_URL}/historial/${codigo_material}/${consecutivo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Error al actualizar historial');
    return response.json();
  }

  // Métodos para intervalo_volumetrico
  async listarIntervaloPorMaterial(codigo: number): Promise<any[]> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}/intervalo`);
    if (!response.ok) throw new Error('Error al listar intervalo');
    return response.json();
  }

  async crearIntervalo(payload: any): Promise<any> {
    const response = await fetch(`${this.API_URL}/intervalo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Error al crear intervalo');
    return response.json();
  }

  async obtenerNextIntervalo(codigo: number): Promise<{ next: number }> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}/intervalo/next`);
    if (!response.ok) throw new Error('Error al obtener siguiente consecutivo');
    return response.json();
  }

  async actualizarIntervalo(codigo_material: number, consecutivo: number, payload: any): Promise<any> {
    const response = await fetch(`${this.API_URL}/intervalo/${codigo_material}/${consecutivo}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Error al actualizar intervalo');
    return response.json();
  }

  // Métodos para PDFs (si es necesario)
  async listarPdfsPorMaterial(codigo: string): Promise<any[]> {
    const response = await fetch(`${this.API_URL}/materiales/${codigo}/pdfs`);
    if (!response.ok) return [];
    return response.json();
  }

  async subirPdfMaterial(codigo: string, categoria: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('categoria', categoria);

    const response = await fetch(`${this.API_URL}/materiales/${codigo}/pdfs`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Error al subir PDF');
    return response.json();
  }

  async eliminarPdf(id: number): Promise<void> {
    const response = await fetch(`${this.API_URL}/pdfs/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar PDF');
  }
}