import { signal } from '@angular/core';
const API_BASE = (window as any).__env?.API_BASE || 'http://localhost:4000/api/auth';

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
    const res = await fetch(`${API_BASE}/login`, {
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

    console.log('🔍 RESPONSE STATUS:', res.status);
    console.log('🔍 RESPONSE DATA:', data);

    if (!res.ok) {
      // 🔧 USAR EL MENSAJE ESPECÍFICO DEL BACKEND
      let msg = data?.message || 'Error al iniciar sesión';
      
      // 🔧 AGREGAR EMOJIS SEGÚN EL TIPO DE ERROR
      if (msg.includes('no encontrado')) {
        msg = '❌ ' + msg;
      } else if (msg.includes('contraseña') || msg.includes('incorrecta')) {
        msg = '🔑 ' + msg;
      } else if (msg.includes('desactivada')) {
        msg = '🚫 ' + msg;
      } else if (msg.includes('email') || msg.includes('formato')) {
        msg = '📧 ' + msg;
      } else if (msg.includes('requeridos')) {
        msg = '⚠️ ' + msg;
      } else {
        msg = '❌ ' + msg;
      }
      
      throw new Error(msg);
    }

    // 🔧 AJUSTAR PARA NUEVA ESTRUCTURA {success, data, message}
    const responseData = data?.data || data || {};

    // Validar que tenemos los datos necesarios
    if (!responseData.token || !responseData.id_usuario) {
      throw new Error('❌ Respuesta inválida del servidor');
    }

    // Guardar token JWT en localStorage
    localStorage.setItem('token', responseData.token);

    // Guardar usuario en memoria y localStorage
    const userData = {
      id: responseData.id_usuario, 
      email: responseData.email,
      rol: responseData.rol,
      id_rol: responseData.id_rol
    };
    
    authUser.set(userData);
    localStorage.setItem('user', JSON.stringify(userData));

    return responseData;
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
      const res = await fetch(`${API_BASE}/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        // 🔧 AJUSTAR PARA NUEVA ESTRUCTURA
        const userData = data?.data || data;
        
        if (userData && userData.id) {
          authUser.set(userData);
          return userData;
        } else {
          this.logout();
          return null;
        }
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
      const res = await fetch(`${API_BASE}/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        localStorage.removeItem('token');
        authUser.set(null);
        throw new Error('Failed to validate token');
      }

      const data = await res.json();
      
      // 🔧 AJUSTAR PARA NUEVA ESTRUCTURA
      const userData = data?.data || data;
      
      if (!userData || !userData.id) {
        localStorage.removeItem('token');
        authUser.set(null);
        throw new Error('Invalid response from auth/me');
      }

      // Actualizar con datos completos incluyendo rol
      const finalUserData = {
        id: userData.id, 
        email: userData.email,
        rol: userData.rol,
        id_rol: userData.id_rol
      };
      authUser.set(finalUserData);
      localStorage.setItem('user', JSON.stringify(finalUserData));
      
      return userData;
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