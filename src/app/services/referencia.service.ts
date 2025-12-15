import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReferenciaService {
  private API_REFERENCIA = (window as any).__env?.API_REFERENCIA || 'http://localhost:4000/api/referencia';

  constructor(private http: HttpClient) {}

  // Material Referencia
  async listarMateriales() {
    return firstValueFrom(this.http.get<any[]>(`${this.API_REFERENCIA}/material`));
  }

  async crearMaterial(data: any) {
    return firstValueFrom(this.http.post(`${this.API_REFERENCIA}/material`, data));
  }

  async actualizarMaterial(codigo_id: number, data: any) {
    return firstValueFrom(this.http.put(`${this.API_REFERENCIA}/material/${codigo_id}`, data));
  }

  async eliminarMaterial(codigo_id: number) {
    return firstValueFrom(this.http.delete(`${this.API_REFERENCIA}/material/${codigo_id}`));
  }

  // Historial Referencia
  async listarHistorialPorMaterial(codigo_material: number) {
    return firstValueFrom(this.http.get<any[]>(`${this.API_REFERENCIA}/historial/${codigo_material}`));
  }

  async crearHistorial(data: any) {
    return firstValueFrom(this.http.post(`${this.API_REFERENCIA}/historial`, data));
  }

  async actualizarHistorial(codigo_material: number, consecutivo: number, data: any) {
    return firstValueFrom(this.http.put(`${this.API_REFERENCIA}/historial/${codigo_material}/${consecutivo}`, data));
  }

  async obtenerNextHistorial(codigo_material: number) {
    return firstValueFrom(this.http.get<any>(`${this.API_REFERENCIA}/historial/next/${codigo_material}`));
  }

  // Intervalo Referencia
  async listarIntervaloPorMaterial(codigo_material: number) {
    return firstValueFrom(this.http.get<any[]>(`${this.API_REFERENCIA}/intervalo/${codigo_material}`));
  }

  async crearIntervalo(data: any) {
    return firstValueFrom(this.http.post(`${this.API_REFERENCIA}/intervalo`, data));
  }

  async actualizarIntervalo(codigo_material: number, consecutivo: number, data: any) {
    return firstValueFrom(this.http.put(`${this.API_REFERENCIA}/intervalo/${codigo_material}/${consecutivo}`, data));
  }

  async obtenerNextIntervalo(codigo_material: number) {
    return firstValueFrom(this.http.get<any>(`${this.API_REFERENCIA}/intervalo/next/${codigo_material}`));
  }

  // PDFs (si aplica)
  async listarPdfsPorMaterial(codigo_material: string) {
    return firstValueFrom(this.http.get<any[]>(`${this.API_REFERENCIA}/pdf/${codigo_material}`));
  }

  async subirPdfMaterial(codigo_material: string, categoria: string, file: File) {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('categoria', categoria);
    formData.append('codigo_material', codigo_material);
    
    return firstValueFrom(this.http.post(`${this.API_REFERENCIA}/pdf/upload`, formData));
  }

  async eliminarPdf(id: number) {
    return firstValueFrom(this.http.delete(`${this.API_REFERENCIA}/pdf/${id}`));
  }
}