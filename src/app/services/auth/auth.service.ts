import { signal } from '@angular/core';
// API root (e.g., http://localhost:4000/api or Vercel/ngrok value)
const API_ROOT = (window as any).__env?.API_BASE || 'http://localhost:4000/api';
// Auth base ensures correct /api/auth path
const API_AUTH = `${API_ROOT}/auth`;

export const authUser = signal<{ 
  id: number; 
  email: string; 
  rol: string;
  id_rol: number;
} | null>(null);

// Mantener authInitializing del repositorio para compatibilidad UI
export const authInitializing = signal(false);

export const authService = {
  async login(email: string, contrasena: string) {
    const res = await fetch(`${API_AUTH}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, contrasena })
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      let msg = (data && data.message) || 'Error al iniciar sesión';
      throw new Error(msg);
    }

    const dataJson = data || {};

    // Guardar token JWT en localStorage
    if (dataJson.token) {
      localStorage.setItem('token', dataJson.token);
    }

    // Guardar usuario en memoria y localStorage
    const userData = {
      id: dataJson.id_usuario, 
      email: dataJson.email,
      rol: dataJson.rol,
      id_rol: dataJson.id_rol
    };
    
    authUser.set(userData);
    localStorage.setItem('user', JSON.stringify(userData));

    return dataJson;
  },

  // TU sistema - Verificar autenticación al cargar la app
  async checkAuth() {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token || !storedUser) {
      this.logout();
      return null;
    }

    try {
      const res = await fetch(`${API_AUTH}/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const user = await res.json();
        authUser.set(user);
        return user;
      } else {
        this.logout();
        return null;
      }
    } catch (error) {
      this.logout();
      return null;
    }
  },

  // whoami - función del repositorio (para compatibilidad)
  async whoami() {
    authInitializing.set(true);
    const token = this.getToken();
    
    if (!token) {
      authInitializing.set(false);
      throw new Error('No token');
    }

    try {
      const res = await fetch(`${API_AUTH}/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        localStorage.removeItem('token');
        authUser.set(null);
        throw new Error('Failed to validate token');
      }

      const data = await res.json();
      if (!data || !data.id) {
        localStorage.removeItem('token');
        authUser.set(null);
        throw new Error('Invalid response from auth/me');
      }

      // Actualizar con datos completos incluyendo rol
      const userData = {
        id: data.id, 
        email: data.email,
        rol: data.rol,
        id_rol: data.id_rol
      };
      authUser.set(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      return data;
    } catch (error) {
      this.logout();
      throw error;
    } finally {
      authInitializing.set(false);
    }
  },

  // Verificar permisos según rol
  hasRole(allowedRoles: string[]): boolean {
    const user = authUser();
    return user ? allowedRoles.includes(user.rol) : false;
  },

  // Métodos específicos por rol
  isSuperadmin(): boolean {
    return this.hasRole(['Superadmin']);
  },

  isAdmin(): boolean {
    return this.hasRole(['Administrador', 'Superadmin']);
  },

  isAuxiliar(): boolean {
    return this.hasRole(['Auxiliar', 'Administrador', 'Superadmin']);
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authUser.set(null);
    authInitializing.set(false);
  },

  getToken() {
    return localStorage.getItem('token');
  }
};