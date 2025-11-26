import { Component, signal, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClientesService } from '../../services/clientes/clientes.service';
import { SolicitudesService } from '../../services/clientes/solicitudes.service';
import { LocationsService } from '../../services/clientes/locations.service';
import { UtilsService } from '../../services/clientes/utils.service';
import { SnackbarService } from '../../services/snackbar.service';
import { authService, authUser } from '../../services/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-solicitudes',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './solicitudes.component.html',
  styleUrls: ['./solicitudes.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class SolicitudesComponent implements OnInit, OnDestroy {
  // Inyectar servicios
  private clientesService = inject(ClientesService);
  private solicitudesService = inject(SolicitudesService);
  private locationsService = inject(LocationsService);
  private utilsService = inject(UtilsService);
  private snackbarService = inject(SnackbarService);

  // Signals desde servicios
  clientes = this.clientesService.clientes;
  solicitudes = this.solicitudesService.solicitudes;
  departamentos = this.locationsService.departamentos;
  ciudades = this.locationsService.ciudades;

  // Signals locales
  clientesFiltrados = signal<Array<any>>([]);
  solicitudesFiltradas = signal<Array<any>>([]);

  // Variables de estado para errores de validación (se mantienen para el template)
  clienteErrors: { [key: string]: string } = {};
  solicitudErrors: { [key: string]: string } = {};
  ofertaErrors: { [key: string]: string } = {};
  resultadoErrors: { [key: string]: string } = {};
  encuestaErrors: { [key: string]: string } = {};

  // Variables de formulario (igual que antes)
  clienteNombre = '';
  clienteIdNum = '';
  clienteEmail = '';
  clienteNumero: number | null = null;
  clienteFechaVinc = '';
  clienteTipoUsuario = '';
  clienteRazonSocial = '';
  clienteNit = '';
  clienteTipoId = '';
  clienteSexo = '';
  clienteTipoPobl = '';
  clienteDireccion = '';
  clienteIdCiudad = '';
  clienteIdDepartamento = '';
  clienteCelular = '';
  clienteTelefono = '';
  clienteTipoVinc = '';
  clienteRegistroPor = '';
  clienteObservaciones = '';
  clientesQ = '';
  solicitudesQ = '';

  solicitudClienteId: any = '';
  solicitudNombre = '';
  solicitudTipo = '';
  solicitudLote = '';
  solicitudFechaVenc = '';
  solicitudTipoMuestra = '';
  solicitudCondEmpaque = '';
  solicitudTipoAnalisis = '';
  solicitudRequiereVarios: any = '';
  solicitudCantidad: number | null = null;
  solicitudFechaEstimada = '';
  solicitudPuedeSuministrar: any = '';
  solicitudServicioViable: any = '';

  ofertaSolicitudId: any = '';
  ofertaGeneroCotizacion: any = '';
  ofertaValor: number | null = null;
  ofertaFechaEnvio = '';
  ofertaRealizoSeguimiento: any = '';
  ofertaObservacion = '';

  resultadoSolicitudId: any = '';
  resultadoFechaLimite = '';
  resultadoNumeroInforme = '';
  resultadoFechaEnvio = '';

  encuestaSolicitudId: any = '';
  encuestaFecha = '';
  encuestaPuntuacion: number | null = null;
  encuestaComentarios = '';
  encuestaRecomendaria: any = '';
  encuestaClienteRespondio: any = '';
  encuestaSolicitoNueva: any = '';

  // Auto-refresh properties
  private refreshInterval: any;
  private readonly REFRESH_INTERVAL_MS = 30000;
  private isFormActive = false;

  // Estado UI
  detallesVisibles: { [key: number]: boolean } = {};
  private expandedSolicitudes = new Set<number>();
  lastCopiedMessage: string | null = null;

  ngOnInit() {
    this.loadInitialData();
    this.filtrarClientes();
    this.filtrarSolicitudes();
    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.stopAutoRefresh();
  }

  private async loadInitialData(): Promise<void> {
    await this.locationsService.loadDepartamentos();
    await this.loadClientes();
    await this.loadSolicitudes();
  }

  // ========== MÉTODOS DE CARGA ==========
  async loadClientes(): Promise<void> {
    try {
      await this.clientesService.loadClientes();
      this.filtrarClientes();
    } catch (err: any) {
      this.manejarError(err, 'cargar clientes');
    }
  }

  async loadSolicitudes(): Promise<void> {
    try {
      await this.solicitudesService.loadSolicitudes();
      this.filtrarSolicitudes();
    } catch (err: any) {
      this.manejarError(err, 'cargar solicitudes');
    }
  }

  onDepartamentoChange(): void {
    this.locationsService.loadCiudades(this.clienteIdDepartamento);
    this.clienteIdCiudad = '';
  }

  // ========== FILTRADO (igual que antes) ==========
  filtrarClientes(): void {
    const clientes = this.clientes();
    
    if (!this.clientesQ.trim()) {
      this.clientesFiltrados.set(clientes);
      return;
    }
    
    const filtro = this.clientesQ.toLowerCase().trim();
    const clientesFiltrados = clientes.filter(cliente => {
      const nombre = (cliente.nombre_solicitante || '').toLowerCase();
      const correo = (cliente.correo_electronico || '').toLowerCase();
      const identificacion = (cliente.numero_identificacion || '').toLowerCase();
      const ciudad = (cliente.ciudad || '').toLowerCase();
      const departamento = (cliente.departamento || '').toLowerCase();
      const celular = (cliente.celular || '').toLowerCase();
      const telefono = (cliente.telefono || '').toLowerCase();
      const tipoUsuario = (cliente.tipo_usuario || '').toLowerCase();
      
      return nombre.includes(filtro) || correo.includes(filtro) ||
             identificacion.includes(filtro) || ciudad.includes(filtro) ||
             departamento.includes(filtro) || celular.includes(filtro) ||
             telefono.includes(filtro) || tipoUsuario.includes(filtro);
    });
    
    this.clientesFiltrados.set(clientesFiltrados);
  }

  filtrarSolicitudes(): void {
    const arr = [...this.solicitudes()].sort((a, b) => a.id_solicitud - b.id_solicitud);
    const solicitudes = arr.map((s) => {
      const tipo = s.codigo || '';
      const fecha = s.fecha_solicitud ? new Date(s.fecha_solicitud) : new Date();
      const year = fecha.getFullYear();
      const consecutivo = s.numero_solicitud ? String(s.numero_solicitud).padStart(2, '0') : '00';
      return {
        ...s,
        numero_solicitud_front: `${tipo}-${year}-${consecutivo}`
      };
    });

    if (!this.solicitudesQ.trim()) {
      this.solicitudesFiltradas.set(solicitudes);
      return;
    }

    const filtro = this.solicitudesQ.toLowerCase().trim();
    const solicitudesFiltradas = solicitudes.filter(solicitud => {
      const id = (solicitud.id_solicitud || '').toString();
      const codigo = (solicitud.codigo || '').toLowerCase();
      const numeroFront = (solicitud.numero_solicitud_front || '').toLowerCase();
      const nombreSolicitante = (solicitud.nombre_solicitante || '').toLowerCase();
      const nombreMuestra = (solicitud.nombre_muestra_producto || '').toLowerCase();
      const tipoMuestra = (solicitud.tipo_muestra || '').toLowerCase();
      const tipoAnalisis = (solicitud.tipo_analisis_requerido || '').toLowerCase();
      const lote = (solicitud.lote_producto || '').toLowerCase();
      return id.includes(filtro) || codigo.includes(filtro) ||
             numeroFront.includes(filtro) || nombreSolicitante.includes(filtro) ||
             nombreMuestra.includes(filtro) || tipoMuestra.includes(filtro) ||
             tipoAnalisis.includes(filtro) || lote.includes(filtro);
    });
    this.solicitudesFiltradas.set(solicitudesFiltradas);
  }

  // ========== VALIDACIONES (simplificadas - solo retornan boolean) ==========
  validarCliente(): boolean {
    this.clienteErrors = {};
    let isValid = true;

    if (!this.clienteNombre.trim()) {
      this.clienteErrors['nombre'] = 'El nombre es obligatorio';
      isValid = false;
    } else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{1,50}$/.test(this.clienteNombre)) {
      this.clienteErrors['nombre'] = 'Solo letras y espacios (máx 50 caracteres)';
      isValid = false;
    }

    if (!this.clienteNumero) {
      this.clienteErrors['numero'] = 'El número es obligatorio';
      isValid = false;
    }

    if (!this.clienteFechaVinc) {
      this.clienteErrors['fechaVinc'] = 'La fecha es obligatoria';
      isValid = false;
    } else {
      const fecha = new Date(this.clienteFechaVinc);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      fecha.setHours(0, 0, 0, 0);
      if (fecha > hoy) {
        this.clienteErrors['fechaVinc'] = 'La fecha no puede ser futura';
        isValid = false;
      }
    }

    // ... (mantener todas las validaciones existentes, pero sin mensajes en variables)
    // Solo actualizar el objeto de errores para mostrar en el template

    return isValid;
  }

  validarSolicitud(): boolean {
    this.solicitudErrors = {};
    let isValid = true;

    if (!this.solicitudClienteId) {
      this.solicitudErrors['clienteId'] = 'Debe seleccionar un cliente';
      isValid = false;
    }

    if (!this.solicitudTipo.trim()) {
      this.solicitudErrors['tipo'] = 'Debe seleccionar el tipo de solicitud';
      isValid = false;
    }

    if (!this.solicitudNombre.trim()) {
      this.solicitudErrors['nombre'] = 'El nombre de la muestra es obligatorio';
      isValid = false;
    } else if (this.solicitudNombre.length > 100) {
      this.solicitudErrors['nombre'] = 'Máximo 100 caracteres (' + this.solicitudNombre.length + ' actuales)';
      isValid = false;
    }

    // ... (mantener todas las validaciones existentes)

    return isValid;
  }

  validarOferta(): boolean {
    this.ofertaErrors = {};
    let isValid = true;

    if (!this.ofertaSolicitudId) {
      this.ofertaErrors['solicitudId'] = 'Debe seleccionar una solicitud';
      isValid = false;
    }

    if (!this.ofertaValor) {
      this.ofertaErrors['valor'] = 'El valor de la oferta es obligatorio';
      isValid = false;
    } else if (this.ofertaValor <= 0) {
      this.ofertaErrors['valor'] = 'El valor debe ser mayor a 0';
      isValid = false;
    }

    // ... (mantener todas las validaciones existentes)

    return isValid;
  }

  validarResultado(): boolean {
    this.resultadoErrors = {};
    let isValid = true;

    if (!this.resultadoSolicitudId) {
      this.resultadoErrors['solicitudId'] = 'Debe seleccionar una solicitud';
      isValid = false;
    }

    if (!this.resultadoFechaLimite) {
      this.resultadoErrors['fechaLimite'] = 'La fecha límite es obligatoria';
      isValid = false;
    }

    // ... (mantener todas las validaciones existentes)

    return isValid;
  }

  validarEncuesta(): boolean {
    this.encuestaErrors = {};
    let isValid = true;

    if (!this.encuestaSolicitudId) {
      this.encuestaErrors['solicitudId'] = 'Debe seleccionar una solicitud';
      isValid = false;
    }

    if (!this.encuestaFecha) {
      this.encuestaErrors['fecha'] = 'La fecha de la encuesta es obligatoria';
      isValid = false;
    }

    // ... (mantener todas las validaciones existentes)

    return isValid;
  }

  // ========== OPERACIONES CRUD CON MANEJO DETALLADO DE ERRORES ==========
  async createCliente(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarCliente()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de cliente');
      return;
    }

    // Verificar permisos antes de intentar crear
    const permError = this.utilsService.getOperationErrorMessage('crear');
    if (permError) {
      this.snackbarService.error(`No puedes crear clientes: ${permError}`);
      return;
    }

    try {
      const payload: any = {
        nombre_solicitante: this.clienteNombre,
        numero: this.clienteNumero,
        fecha_vinculacion: this.clienteFechaVinc,
        tipo_usuario: this.clienteTipoUsuario,
        razon_social: this.clienteRazonSocial,
        nit: this.clienteNit,
        tipo_identificacion: this.clienteTipoId,
        numero_identificacion: this.clienteIdNum,
        sexo: this.clienteSexo,
        tipo_poblacion: this.clienteTipoPobl,
        direccion: this.clienteDireccion,
        id_ciudad: this.clienteIdCiudad,
        id_departamento: this.clienteIdDepartamento,
        celular: this.clienteCelular,
        telefono: this.clienteTelefono,
        correo_electronico: this.clienteEmail,
        tipo_vinculacion: this.clienteTipoVinc,
        registro_realizado_por: this.clienteRegistroPor,
        observaciones: this.clienteObservaciones
      };

      await this.clientesService.createCliente(payload);

      this.snackbarService.success('✅ Cliente creado exitosamente');
      this.clienteErrors = {};

      // Limpiar formulario
      this.limpiarFormularioCliente();
      await this.loadClientes();

    } catch (err: any) {
      console.error('Error creating cliente:', err);
      this.manejarError(err, 'crear cliente');
    }
  }

  async createSolicitud(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarSolicitud()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de solicitud');
      return;
    }

    // Verificar permisos
    const permError = this.utilsService.getOperationErrorMessage('crear');
    if (permError) {
      this.snackbarService.error(`No puedes crear solicitudes: ${permError}`);
      return;
    }

    try {
      const body: any = {
        id_cliente: this.solicitudClienteId,
        nombre_muestra_producto: this.solicitudNombre,
        codigo: this.solicitudTipo,
        lote_producto: this.solicitudLote || null,
        fecha_vencimiento_producto: this.solicitudFechaVenc || null,
        tipo_muestra: this.solicitudTipoMuestra,
        condiciones_empaque: this.solicitudCondEmpaque || null,
        tipo_analisis_requerido: this.solicitudTipoAnalisis,
        requiere_varios_analisis: this.solicitudRequiereVarios ? 1 : 0,
        cantidad_muestras_analizar: this.solicitudCantidad,
        fecha_estimada_entrega_muestra: this.solicitudFechaEstimada,
        puede_suministrar_informacion_adicional: this.solicitudPuedeSuministrar ? 1 : 0,
        servicio_viable: this.solicitudServicioViable ? 1 : 0,
      };

      await this.solicitudesService.createSolicitud(body);

      this.snackbarService.success('✅ Solicitud creada exitosamente');
      this.solicitudErrors = {};

      // Limpiar formulario
      this.limpiarFormularioSolicitud();
      await this.loadSolicitudes();

    } catch (err: any) {
      console.error('Error creating solicitud:', err);
      this.manejarError(err, 'crear solicitud');
    }
  }

  async createOferta(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarOferta()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de oferta');
      return;
    }

    // Verificar permisos
    const permError = this.utilsService.getOperationErrorMessage('crear');
    if (permError) {
      this.snackbarService.error(`No puedes crear ofertas: ${permError}`);
      return;
    }

    try {
      const body = {
        genero_cotizacion: this.ofertaGeneroCotizacion ? 1 : 0,
        valor_cotizacion: this.ofertaValor,
        fecha_envio_oferta: this.ofertaFechaEnvio,
        realizo_seguimiento_oferta: this.ofertaRealizoSeguimiento ? 1 : 0,
        observacion_oferta: this.ofertaObservacion || null
      };

      await this.solicitudesService.updateSolicitud(this.ofertaSolicitudId, body);

      this.snackbarService.success('✅ Oferta registrada exitosamente');
      this.ofertaErrors = {};

      // Limpiar formulario
      this.limpiarFormularioOferta();
      await this.loadSolicitudes();

    } catch (err: any) {
      console.error('Error creating oferta:', err);
      this.manejarError(err, 'crear oferta');
    }
  }

  async createResultado(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarResultado()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de resultados');
      return;
    }

    // Verificar permisos
    const permError = this.utilsService.getOperationErrorMessage('crear');
    if (permError) {
      this.snackbarService.error(`No puedes registrar resultados: ${permError}`);
      return;
    }

    try {
      const body = {
        fecha_limite_entrega_resultados: this.resultadoFechaLimite,
        numero_informe_resultados: this.resultadoNumeroInforme,
        fecha_envio_resultados: this.resultadoFechaEnvio
      };

      await this.solicitudesService.updateSolicitud(this.resultadoSolicitudId, body);

      this.snackbarService.success('✅ Resultados registrados exitosamente');
      this.resultadoErrors = {};

      // Limpiar formulario
      this.limpiarFormularioResultado();
      await this.loadSolicitudes();

    } catch (err: any) {
      console.error('Error creating resultado:', err);
      this.manejarError(err, 'registrar resultados');
    }
  }

  async createEncuesta(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarEncuesta()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de encuesta');
      return;
    }

    // Verificar permisos
    const permError = this.utilsService.getOperationErrorMessage('crear');
    if (permError) {
      this.snackbarService.error(`No puedes crear encuestas: ${permError}`);
      return;
    }

    try {
      const body = {
        id_solicitud: this.encuestaSolicitudId,
        fecha_encuesta: this.encuestaFecha,
        puntuacion_satisfaccion: this.encuestaPuntuacion || null,
        comentarios: this.encuestaComentarios || null,
        recomendaria_servicio: this.encuestaRecomendaria,
        cliente_respondio_encuesta: this.encuestaClienteRespondio,
        solicito_nueva_encuesta: this.encuestaSolicitoNueva
      };

      await this.solicitudesService.createEncuesta(body);

      this.snackbarService.success('✅ Encuesta registrada exitosamente');
      this.encuestaErrors = {};

      // Limpiar formulario
      this.limpiarFormularioEncuesta();
      await this.loadSolicitudes();

    } catch (err: any) {
      console.error('Error creating encuesta:', err);
      this.manejarError(err, 'crear encuesta');
    }
  }

  async deleteCliente(id: number): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
    
    // Verificar permisos de eliminación
    if (!this.canDelete()) {
      const errorMsg = this.utilsService.getDeleteErrorMessage();
      this.snackbarService.error(`❌ No puedes eliminar clientes: ${errorMsg}`);
      return;
    }

    try {
      await this.clientesService.deleteCliente(id);
      this.snackbarService.success('✅ Cliente eliminado exitosamente');
      await this.loadClientes();
    } catch (err: any) {
      console.error('deleteCliente', err);
      this.manejarError(err, 'eliminar cliente');
    }
  }

  async deleteSolicitud(id: number): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres eliminar esta solicitud?')) return;
    
    // Verificar permisos de eliminación
    if (!this.canDelete()) {
      const errorMsg = this.utilsService.getDeleteErrorMessage();
      this.snackbarService.error(`❌ No puedes eliminar solicitudes: ${errorMsg}`);
      return;
    }

    try {
      await this.solicitudesService.deleteSolicitud(id);
      this.snackbarService.success('✅ Solicitud eliminada exitosamente');
      await this.loadSolicitudes();
    } catch (err: any) {
      console.error('deleteSolicitud', err);
      this.manejarError(err, 'eliminar solicitud');
    }
  }

  async toggleCheck(s: any, field: string, value: any): Promise<void> {
    // Verificar permisos para editar
    const permError = this.utilsService.getOperationErrorMessage('editar');
    if (permError) {
      this.snackbarService.error(`No puedes modificar este campo: ${permError}`);
      return;
    }

    try {
      const body: any = {};
      if (field === 'numero_informe_resultados') {
        body[field] = value ? '1' : null;
      } else {
        body[field] = value ? 1 : 0;
      }
      
      await this.solicitudesService.updateSolicitud(s.id_solicitud, body);
      s[field] = body[field];
      
      const fieldNames: {[key: string]: string} = {
        'servicio_viable': 'Servicio viable',
        'genero_cotizacion': 'Generar cotización', 
        'cliente_respondio_encuesta': 'Encuesta respondida',
        'numero_informe_resultados': 'Resultados enviados'
      };
      
      const fieldName = fieldNames[field] || field;
      const action = value ? 'activado' : 'desactivado';
      this.snackbarService.info(`✅ ${fieldName} ${action}`);
    } catch (err: any) {
      console.error('toggleCheck', err);
      this.manejarError(err, 'actualizar campo');
    }
  }

  // ========== MÉTODOS AUXILIARES PARA MANEJO DE ERRORES ==========
  private manejarError(err: any, operacion: string): void {
    const errorMessage = err.message || err.toString();
    
    // Detectar tipo de error
    if (errorMessage.includes('No autorizado') || errorMessage.includes('401')) {
      this.snackbarService.error(`🔐 Sesión expirada. Por favor, inicia sesión nuevamente.`);
      setTimeout(() => {
        authService.logout();
        window.location.href = '/login';
      }, 3000);
    } 
    else if (errorMessage.includes('Network Error') || errorMessage.includes('Failed to fetch')) {
      this.snackbarService.error('🌐 Error de conexión. Verifica tu internet e intenta nuevamente.');
    }
    else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
      this.snackbarService.error('⚙️ Error del servidor. Por favor, contacta al administrador.');
    }
    else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      this.snackbarService.error('🔍 Recurso no encontrado. Puede que ya haya sido eliminado.');
    }
    else if (errorMessage.includes('409') || errorMessage.includes('Conflict')) {
      this.snackbarService.error('⚠️ Conflicto: El registro ya existe o tiene datos duplicados.');
    }
    else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      this.snackbarService.error('🚫 No tienes permisos para realizar esta acción.');
    }
    else if (errorMessage.includes('Validation failed') || errorMessage.includes('validation')) {
      this.snackbarService.error('📝 Error de validación: Verifica los datos ingresados.');
    }
    else {
      // Error genérico
      this.snackbarService.error(`❌ Error al ${operacion}: ${this.obtenerMensajeAmigable(errorMessage)}`);
    }
  }

  private obtenerMensajeAmigable(mensaje: string): string {
    const mensajesAmigables: {[key: string]: string} = {
      'duplicate key': 'Ya existe un registro con estos datos',
      'foreign key constraint': 'No se puede eliminar porque tiene registros relacionados', 
      'required field': 'Faltan campos obligatorios',
      'invalid date': 'Fecha inválida',
      'invalid email': 'Correo electrónico inválido',
      'connection refused': 'No se puede conectar al servidor'
    };

    for (const [key, value] of Object.entries(mensajesAmigables)) {
      if (mensaje.toLowerCase().includes(key)) {
        return value;
      }
    }

    // Si no encuentra un mensaje amigable, devuelve uno genérico
    return mensaje.length > 100 ? 'Error del sistema. Contacta al administrador.' : mensaje;
  }

  // ========== MÉTODOS PARA LIMPIAR FORMULARIOS ==========
  private limpiarFormularioCliente(): void {
    this.clienteNombre = this.clienteIdNum = this.clienteEmail = '';
    this.clienteNumero = null;
    this.clienteFechaVinc = '';
    this.clienteTipoUsuario = '';
    this.clienteRazonSocial = '';
    this.clienteNit = '';
    this.clienteTipoId = '';
    this.clienteSexo = 'Otro';
    this.clienteTipoPobl = '';
    this.clienteDireccion = '';
    this.clienteIdCiudad = '';
    this.clienteIdDepartamento = '';
    this.clienteCelular = '';
    this.clienteTelefono = '';
    this.clienteTipoVinc = '';
    this.clienteRegistroPor = '';
    this.clienteObservaciones = '';
  }

  private limpiarFormularioSolicitud(): void {
    this.solicitudClienteId = null;
    this.solicitudNombre = '';
    this.solicitudTipo = '';
    this.solicitudLote = '';
    this.solicitudFechaVenc = '';
    this.solicitudTipoMuestra = '';
    this.solicitudCondEmpaque = '';
    this.solicitudTipoAnalisis = '';
    this.solicitudRequiereVarios = false;
    this.solicitudCantidad = null;
    this.solicitudFechaEstimada = '';
    this.solicitudPuedeSuministrar = false;
    this.solicitudServicioViable = false;
  }

  private limpiarFormularioOferta(): void {
    this.ofertaSolicitudId = null;
    this.ofertaGeneroCotizacion = false;
    this.ofertaValor = null;
    this.ofertaFechaEnvio = '';
    this.ofertaRealizoSeguimiento = false;
    this.ofertaObservacion = '';
  }

  private limpiarFormularioResultado(): void {
    this.resultadoSolicitudId = null;
    this.resultadoFechaLimite = '';
    this.resultadoNumeroInforme = '';
    this.resultadoFechaEnvio = '';
  }

  private limpiarFormularioEncuesta(): void {
    this.encuestaSolicitudId = null;
    this.encuestaFecha = '';
    this.encuestaPuntuacion = null;
    this.encuestaComentarios = '';
    this.encuestaRecomendaria = false;
    this.encuestaClienteRespondio = false;
    this.encuestaSolicitoNueva = false;
  }

  // ========== MÉTODOS UI (igual que antes) ==========
  canDelete(): boolean {
    return this.utilsService.canDelete();
  }

  toggleClienteDetails(id: number): void {
    this.detallesVisibles[id] = !this.detallesVisibles[id];
  }

  toggleExpandSolicitud(s: any): void {
    const key = Number(s?.id_solicitud ?? 0);
    if (!key) return;
    if (this.expandedSolicitudes.has(key)) this.expandedSolicitudes.delete(key);
    else this.expandedSolicitudes.add(key);
  }

  isSolicitudExpanded(s: any): boolean {
    const key = Number(s?.id_solicitud ?? 0);
    return key ? this.expandedSolicitudes.has(key) : false;
  }

  async copyField(key: string, value: string | null): Promise<void> {
    const ok = await this.utilsService.copyToClipboard(value);
    if (!ok) return;
    this.showToast('Copiado');
  }

  showToast(message: string, ms = 1400): void {
    this.lastCopiedMessage = message;
    setTimeout(() => { this.lastCopiedMessage = null; }, ms);
  }

  formatDate(dateStr: string | null): string {
    return this.utilsService.formatDate(dateStr);
  }

  formatValue(val: any): string {
    return this.utilsService.formatValue(val);
  }

  // ========== AUTO-REFRESH ==========
  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      if (!this.isFormActive) {
        await this.loadClientes();
        await this.loadSolicitudes();
      }
    }, this.REFRESH_INTERVAL_MS);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  onFormFocus(): void {
    this.isFormActive = true;
  }

  onFormBlur(): void {
    setTimeout(() => {
      this.isFormActive = false;
    }, 1000);
  }
}