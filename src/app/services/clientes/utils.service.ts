import { Injectable, inject } from '@angular/core';
import { authUser } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class UtilsService {
  
  canDelete(): boolean {
    const user = authUser();
    return user?.rol === 'Administrador' || user?.rol === 'Superadmin';
  }

  getDeleteErrorMessage(): string {
    const user = authUser();
    if (!user) return 'No tienes sesión activa';
    
    switch(user.rol) {
      case 'Auxiliar':
        return 'Los auxiliares no pueden eliminar registros';
      case 'Instructor':
        return 'Los instructores no tienen permisos para eliminar';
      default:
        return 'No tienes permisos para eliminar registros';
    }
  }

  getOperationErrorMessage(operation: string): string {
    const user = authUser();
    if (!user) return `No puedes ${operation} - Sesión expirada`;
    
    const role = user.rol;
    const operationMap: {[key: string]: string} = {
      'crear': 'crear',
      'editar': 'editar', 
      'eliminar': 'eliminar',
      'ver': 'ver',
      'exportar': 'exportar'
    };
    
    const op = operationMap[operation] || operation;
    
    if (role === 'Superadmin') return '';
    if (role === 'Administrador') return '';
    
    switch(role) {
      case 'Auxiliar':
        return `Los auxiliares solo pueden ${op} registros asignados`;
      case 'Instructor':
        return `Los instructores tienen permisos limitados para ${op}`;
      default:
        return `Tu rol (${role}) no tiene permisos para ${op}`;
    }
  }

  async copyToClipboard(value: string | null): Promise<boolean> {
    if (!value || value === '-') return false;
    try {
      await navigator.clipboard.writeText(value.toString());
      return true;
    } catch (err) {
      console.error('No se pudo copiar:', err);
      return false;
    }
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    } catch (e) {
      return dateStr;
    }
  }

  formatValue(val: any): string {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) return this.formatDate(val);
      return val;
    }
    return val.toString();
  }

  formatCurrency(val: any): string {
    if (val === null || val === undefined || val === '') return '-';
    try {
      let num: number;
      if (typeof val === 'number') num = val;
      else {
        const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
        num = parseFloat(cleaned);
      }
      if (isNaN(num)) return String(val);
      // Use 'es-CO' locale to get '.' as thousands separator and ',' as decimals
      const formatted = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(num);
      return '$ ' + formatted;
    } catch (e) {
      return String(val);
    }
  }
}