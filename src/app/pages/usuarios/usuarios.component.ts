import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { authService, authUser } from '../../services/auth/auth.service';
import { SnackbarService } from '../../shared/snackbar.service';
import { usuariosService } from '../../services/usuarios.service'

@Component({
  standalone: true,
  selector: 'app-usuarios',
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class UsuariosComponent implements OnInit {
  // Estado de carga
  cargando: boolean = false;

  // Formulario crear usuario
  email: string = '';
  contrasena: string = '';
  rol_id: any = '';
  mensaje: string = '';

  // Roles disponibles
  roles: Array<any> = [];

  // Lista de usuarios
  usuarios: Array<any> = [];
  usuariosFiltrados: Array<any> = [];

  // Signals para lista (imitando enfoque usado en Reactivos)
  usuariosSig = signal<Array<any>>([]);
  usuariosFiltradosSig = signal<Array<any>>([]);

  // Getters to expose signals to templates (matching pattern used in Reactivos)
  get usuariosCount() { return this.usuariosSig().length; }
  get usuariosList() { return this.usuariosSig(); }
  get usuariosFiltradosList() { return this.usuariosFiltradosSig(); }

  // Filtros
  emailQ: string = '';
  rolQ: any = '';
  estadoQ: string = '';

  constructor(public snack: SnackbarService) {}

  ngOnInit() {
    this.loadRoles();
    this.loadUsuarios();
  }

  // ========== CARGAR DATOS ==========

  async loadRoles() {
    try {
      this.roles = await usuariosService.listarRoles();
    } catch (err) {
      console.error('Error cargando roles:', err);
    }
  }

  async loadUsuarios() {
    this.cargando = true;
    try {
      const rows = await usuariosService.listarUsuarios();
      this.usuarios = rows || [];
      // actualizar signals para que la plantilla pueda reaccionar inmediatamente
      this.usuariosSig.set(this.usuarios);
      // asegurar que la lista filtrada también se inicializa inmediatamente
      this.usuariosFiltrados = this.usuarios.slice();
      this.usuariosFiltradosSig.set(this.usuariosFiltrados);
      this.aplicarFiltros();
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      this.snack.error('Error cargando usuarios');
    } finally {
      this.cargando = false;
    }
  }

  // ========== CREAR USUARIO ==========

  async crearUsuario(e: Event) {
    e.preventDefault();
    this.mensaje = '';

    // Validaciones
    if (!this.email.trim() || !this.contrasena.trim() || !this.rol_id) {
      this.snack.warn('Todos los campos son requeridos');
      return;
    }

    if (this.contrasena.length < 6) {
      this.snack.warn('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!this.validarEmail(this.email)) {
      this.snack.warn('Email no válido');
      return;
    }

    try {
      await usuariosService.crearUsuario({
        email: this.email.trim(),
        contrasena: this.contrasena,
        rol_id: parseInt(this.rol_id)
      });
      this.snack.success('Usuario creado correctamente');
      this.resetForm();
      await this.loadUsuarios();
    } catch (err: any) {
      this.snack.error(err?.message || 'Error creando usuario');
    }
  }

  // ========== CAMBIAR ESTADO ==========

  async cambiarEstado(usuario: any, nuevoEstado: 'ACTIVO' | 'INACTIVO') {
    const accion = nuevoEstado === 'ACTIVO' ? 'activar' : 'desactivar';
    if (!confirm(`¿Está seguro de ${accion} a ${usuario.email}?`)) return;

    try {
      await usuariosService.cambiarEstado(usuario.id_usuario, nuevoEstado);
      this.snack.success(`Usuario ${accion === 'activar' ? 'activado' : 'desactivado'} correctamente`);
      await this.loadUsuarios();
    } catch (err: any) {
      this.snack.error(err?.message || `Error al ${accion} usuario`);
    }
  }

  // ========== ELIMINAR USUARIO ==========

  async eliminarUsuario(id: number) {
    if (!confirm('¿Está seguro de eliminar este usuario?\n\nEsta acción no se puede deshacer.')) {
      return;
    }

    try {
      await usuariosService.eliminarUsuario(id);
      this.snack.success('Usuario eliminado correctamente');
      await this.loadUsuarios();
    } catch (err: any) {
      this.snack.error(err?.message || 'Error eliminando usuario');
    }
  }

  // ========== FILTROS ==========

  filtrarUsuarios() {
    this.aplicarFiltros();
  }

  private aplicarFiltros() {
    const emailQ = this.normalizarTexto(this.emailQ);
    const rolQ = this.rolQ ? parseInt(this.rolQ) : null;
    const estadoQ = this.estadoQ.toUpperCase().trim();

    if (!emailQ && !rolQ && !estadoQ) {
      this.usuariosFiltrados = [...this.usuarios];
      this.usuariosFiltradosSig.set(this.usuariosFiltrados);
      return;
    }

    this.usuariosFiltrados = this.usuarios.filter(u => {
      const emailMatch = !emailQ || this.normalizarTexto(u.email).includes(emailQ);
      const rolMatch = !rolQ || u.rol_id === rolQ;
      const estadoMatch = !estadoQ || u.estado === estadoQ;
      return emailMatch && rolMatch && estadoMatch;
    });
    // actualizar signal con los resultados filtrados
    this.usuariosFiltradosSig.set(this.usuariosFiltrados);
  }

  resetFiltros() {
    this.emailQ = '';
    this.rolQ = '';
    this.estadoQ = '';
    this.aplicarFiltros();
  }

  // ========== UTILIDADES ==========

  resetForm() {
    this.email = '';
    this.contrasena = '';
    this.rol_id = '';
    this.mensaje = '';
  }

  normalizarTexto(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  validarEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  contarPorEstado(estado: string): number {
    return this.usuarios.filter(u => u.estado === estado).length;
  }

  logout() {
    if (confirm('¿Cerrar sesión?')) {
      authService.logout();
    }
  }

   // Función para verificar permisos de cambiar rol
  canChangeRole(): boolean {
    const user = authUser();
    return user?.rol === 'Superadmin';
  }

  // Función para cambiar el rol
  async cambiarRol(usuario: any, nuevoRolId: number) {
    const rolSeleccionado = this.roles.find(r => r.id_rol === nuevoRolId);
    const nombreRol = rolSeleccionado ? rolSeleccionado.nombre : 'Desconocido';

    if (!confirm(`¿Está seguro de cambiar el rol de ${usuario.email} a ${nombreRol}?`)) {
      await this.loadUsuarios();
      return;
    }

    try {
      await usuariosService.cambiarRol(usuario.id_usuario, nuevoRolId);
      this.snack.success('Rol actualizado correctamente');
      await this.loadUsuarios();
    } catch (err: any) {
      this.snack.error(err?.message || 'Error cambiando rol');
      await this.loadUsuarios();
    }
  }
}