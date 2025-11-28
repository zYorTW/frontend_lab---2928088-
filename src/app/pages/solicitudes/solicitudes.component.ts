import { Component, signal, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClientesService } from '../../services/clientes/clientes.service';
import { SolicitudesService } from '../../services/clientes/solicitudes.service';
import { LocationsService } from '../../services/clientes/locations.service';
import { UtilsService } from '../../services/clientes/utils.service';
import { SnackbarService } from '../../services/snackbar.service';
import { authService } from '../../services/auth/auth.service';
import { NumbersOnlyDirective } from '../../directives/numbers-only.directive';
import { LettersOnlyDirective } from '../../directives/letters-only.directive';
import { AlphaNumericDirective } from '../../directives/alpha-numeric.directive';

@Component({
  standalone: true,
  selector: 'app-solicitudes',
  imports: [CommonModule, FormsModule, RouterModule, NumbersOnlyDirective, LettersOnlyDirective, AlphaNumericDirective],
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

  // Variables de estado para errores de validación
  clienteErrors: { [key: string]: string } = {};
  solicitudErrors: { [key: string]: string } = {};
  ofertaErrors: { [key: string]: string } = {};
  resultadoErrors: { [key: string]: string } = {};
  encuestaErrors: { [key: string]: string } = {};

  // Variables de formulario
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

  // Constantes de validación
  private readonly PATTERNS = {
    NOMBRE: /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\.\-]{2,100}$/,
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    TELEFONO: /^[0-9]{7,15}$/,
    CELULAR: /^3[0-9]{9}$/,
    NIT: /^[0-9]{9}-[0-9]$/,
    IDENTIFICACION: /^[0-9A-Za-z]{5,20}$/,
    LOTE: /^[A-Z0-9\-]{3,20}$/,
    CODIGO_INFORME: /^[A-Z]{2,4}-[0-9]{4}-[0-9]{3,5}$/,
    DIRECCION: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s#\-\.\,]{5,200}$/,
    OBSERVACIONES: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s#\-\.\,\(\)]{0,500}$/,
    MUESTRA: /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.]{2,100}$/
  };

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

  // ========== FILTRADO ==========
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

  // ========== VALIDACIONES COMPLETAS DE LABORATORIO ==========
validarCliente(): boolean {
  this.clienteErrors = {};
  let isValid = true;

  // Validación de nombre (OBLIGATORIO)
  if (!this.clienteNombre.trim()) {
    this.clienteErrors['nombre'] = 'El nombre del solicitante es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.NOMBRE.test(this.clienteNombre)) {
    this.clienteErrors['nombre'] = 'El nombre debe contener solo letras, espacios y puntos (2-100 caracteres)';
    isValid = false;
  }

  // Validación de consecutivo (OBLIGATORIO)
  if (!this.clienteNumero) {
    this.clienteErrors['numero'] = 'El número consecutivo es obligatorio';
    isValid = false;
  } else if (this.clienteNumero < 1 || this.clienteNumero > 9999) {
    this.clienteErrors['numero'] = 'El consecutivo debe estar entre 1 y 9999';
    isValid = false;
  }

  // Validación de fecha de vinculación (OBLIGATORIO)
  if (!this.clienteFechaVinc) {
    this.clienteErrors['fechaVinc'] = 'La fecha de vinculación es obligatoria';
    isValid = false;
  } else {
    const fecha = new Date(this.clienteFechaVinc);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (fecha > hoy) {
      this.clienteErrors['fechaVinc'] = 'La fecha de vinculación no puede ser futura';
      isValid = false;
    }
  }

  // Validación de tipo de usuario (OBLIGATORIO)
  if (!this.clienteTipoUsuario) {
    this.clienteErrors['tipoUsuario'] = 'Debe seleccionar el tipo de cliente';
    isValid = false;
  }

  // ✅ NUEVA: Validación de razón social (OBLIGATORIO)
  if (!this.clienteRazonSocial.trim()) {
    this.clienteErrors['razonSocial'] = 'La razón social es obligatoria';
    isValid = false;
  } else if (this.clienteRazonSocial.length > 200) {
    this.clienteErrors['razonSocial'] = 'La razón social no puede exceder 200 caracteres';
    isValid = false;
  }

  // ✅ NUEVA: Validación de NIT (OBLIGATORIO)
  if (!this.clienteNit.trim()) {
    this.clienteErrors['nit'] = 'El NIT es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.NIT.test(this.clienteNit)) {
    this.clienteErrors['nit'] = 'Formato de NIT inválido (ej: 900123456-7)';
    isValid = false;
  }

  // Validación de tipo de identificación (OBLIGATORIO)
  if (!this.clienteTipoId) {
    this.clienteErrors['tipoId'] = 'Debe seleccionar el tipo de identificación';
    isValid = false;
  }

  // Validación de número de identificación (OBLIGATORIO)
  if (!this.clienteIdNum.trim()) {
    this.clienteErrors['idNum'] = 'El número de identificación es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.IDENTIFICACION.test(this.clienteIdNum)) {
    this.clienteErrors['idNum'] = 'Número de identificación inválido (5-20 caracteres alfanuméricos)';
    isValid = false;
  }

  // ✅ NUEVA: Validación de sexo (OBLIGATORIO)
  if (!this.clienteSexo) {
    this.clienteErrors['sexo'] = 'Debe seleccionar el sexo';
    isValid = false;
  } else if (!['M', 'F', 'Otro'].includes(this.clienteSexo)) {
    this.clienteErrors['sexo'] = 'Seleccione una opción válida para sexo';
    isValid = false;
  }

  // ✅ NUEVA: Validación de tipo población (OBLIGATORIO)
  if (!this.clienteTipoPobl.trim()) {
    this.clienteErrors['tipoPobl'] = 'El tipo de población es obligatorio';
    isValid = false;
  } else if (this.clienteTipoPobl.length > 50) {
    this.clienteErrors['tipoPobl'] = 'El tipo de población no puede exceder 50 caracteres';
    isValid = false;
  }

  // ✅ NUEVA: Validación de dirección (OBLIGATORIO)
  if (!this.clienteDireccion.trim()) {
    this.clienteErrors['direccion'] = 'La dirección es obligatoria';
    isValid = false;
  } else if (!this.PATTERNS.DIRECCION.test(this.clienteDireccion)) {
    this.clienteErrors['direccion'] = 'La dirección contiene caracteres inválidos (máx 200 caracteres)';
    isValid = false;
  }

  // Validación de departamento y ciudad (OBLIGATORIOS)
  if (!this.clienteIdDepartamento) {
    this.clienteErrors['departamento'] = 'Debe seleccionar un departamento';
    isValid = false;
  }
  if (!this.clienteIdCiudad) {
    this.clienteErrors['ciudad'] = 'Debe seleccionar una ciudad';
    isValid = false;
  }

  // ✅ NUEVA: Validación de celular (OBLIGATORIO)
  if (!this.clienteCelular) {
    this.clienteErrors['celular'] = 'El celular es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.CELULAR.test(this.clienteCelular.replace(/\s/g, ''))) {
    this.clienteErrors['celular'] = 'Formato de celular inválido (ej: 3001234567)';
    isValid = false;
  }

  // ✅ NUEVA: Validación de teléfono (NO obligatorio)
  if (this.clienteTelefono && !this.PATTERNS.TELEFONO.test(this.clienteTelefono.replace(/\s/g, ''))) {
    this.clienteErrors['telefono'] = 'Formato de teléfono inválido (7-15 dígitos)';
    isValid = false;
  }

  // ✅ NUEVA: Validación de correo (OBLIGATORIO)
  if (!this.clienteEmail.trim()) {
    this.clienteErrors['email'] = 'El correo electrónico es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.EMAIL.test(this.clienteEmail)) {
    this.clienteErrors['email'] = 'Formato de correo electrónico inválido';
    isValid = false;
  }

  // ✅ NUEVA: Validación de tipo vinculación (OBLIGATORIO)
  if (!this.clienteTipoVinc.trim()) {
    this.clienteErrors['tipoVinc'] = 'El tipo de vinculación es obligatorio';
    isValid = false;
  } else if (this.clienteTipoVinc.length > 50) {
    this.clienteErrors['tipoVinc'] = 'El tipo de vinculación no puede exceder 50 caracteres';
    isValid = false;
  }

  // ✅ NUEVA: Validación de registro realizado por (OBLIGATORIO)
  if (!this.clienteRegistroPor.trim()) {
    this.clienteErrors['registroPor'] = 'El registro realizado por es obligatorio';
    isValid = false;
  } else if (this.clienteRegistroPor.length > 100) {
    this.clienteErrors['registroPor'] = 'El registro realizado por no puede exceder 100 caracteres';
    isValid = false;
  }

  // Validación de observaciones (NO obligatorio)
  if (this.clienteObservaciones && !this.PATTERNS.OBSERVACIONES.test(this.clienteObservaciones)) {
    this.clienteErrors['observaciones'] = 'Las observaciones exceden el límite de 500 caracteres';
    isValid = false;
  }

  return isValid;
}

  validarSolicitud(): boolean {
  this.solicitudErrors = {};
  let isValid = true;

  // Validación de cliente (OBLIGATORIO)
  if (!this.solicitudClienteId) {
    this.solicitudErrors['clienteId'] = 'Debe seleccionar un cliente';
    isValid = false;
  }

  // Validación de tipo de solicitud (OBLIGATORIO)
  if (!this.solicitudTipo.trim()) {
    this.solicitudErrors['tipo'] = 'Debe seleccionar el tipo de solicitud';
    isValid = false;
  }

  // Validación de nombre de muestra (OBLIGATORIO)
  if (!this.solicitudNombre.trim()) {
    this.solicitudErrors['nombre'] = 'El nombre de la muestra es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.MUESTRA.test(this.solicitudNombre)) {
    this.solicitudErrors['nombre'] = 'Nombre de muestra inválido (2-100 caracteres alfanuméricos)';
    isValid = false;
  }

  // Validación de lote (OBLIGATORIO)
  if (!this.solicitudLote.trim()) {
    this.solicitudErrors['lote'] = 'El lote del producto es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.LOTE.test(this.solicitudLote)) {
    this.solicitudErrors['lote'] = 'Formato de lote inválido (3-20 caracteres alfanuméricos)';
    isValid = false;
  }

  // ✅ CORRECCIÓN: Validación de fecha de vencimiento (OBLIGATORIO, NO PASADA)
  if (!this.solicitudFechaVenc) {
    this.solicitudErrors['fechaVenc'] = 'La fecha de vencimiento es obligatoria';
    isValid = false;
  } else {
    const fechaVenc = new Date(this.solicitudFechaVenc);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVenc.setHours(0, 0, 0, 0);
    
    if (fechaVenc < hoy) {
      this.solicitudErrors['fechaVenc'] = 'La fecha de vencimiento no puede ser una fecha pasada';
      isValid = false;
    }
  }

  // Validación de tipo de muestra (OBLIGATORIO)
  if (!this.solicitudTipoMuestra.trim()) {
    this.solicitudErrors['tipoMuestra'] = 'El tipo de muestra es obligatorio';
    isValid = false;
  }

  // Validación de condiciones de empaque (OBLIGATORIO)
  if (!this.solicitudCondEmpaque.trim()) {
    this.solicitudErrors['condEmpaque'] = 'Las condiciones de empaque son obligatorias';
    isValid = false;
  } else if (this.solicitudCondEmpaque.length > 100) {
    this.solicitudErrors['condEmpaque'] = 'Las condiciones de empaque no pueden exceder 100 caracteres';
    isValid = false;
  }

  // Validación de tipo de análisis (OBLIGATORIO)
  if (!this.solicitudTipoAnalisis.trim()) {
    this.solicitudErrors['tipoAnalisis'] = 'El tipo de análisis requerido es obligatorio';
    isValid = false;
  }

  // Validación de cantidad de muestras (OBLIGATORIO)
  if (!this.solicitudCantidad) {
    this.solicitudErrors['cantidad'] = 'La cantidad de muestras es obligatoria';
    isValid = false;
  } else if (this.solicitudCantidad < 1 || this.solicitudCantidad > 100) {
    this.solicitudErrors['cantidad'] = 'La cantidad debe estar entre 1 y 100 muestras';
    isValid = false;
  }

  // Validación de fecha estimada de entrega (OBLIGATORIO)
  if (!this.solicitudFechaEstimada) {
    this.solicitudErrors['fechaEstimada'] = 'La fecha estimada de entrega es obligatoria';
    isValid = false;
  } else {
    const fechaEstimada = new Date(this.solicitudFechaEstimada);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaEstimada < hoy) {
      this.solicitudErrors['fechaEstimada'] = 'La fecha estimada no puede ser anterior a hoy';
      isValid = false;
    }

    

    // Validar que la fecha estimada no sea mayor a 1 año
    const maxFecha = new Date();
    maxFecha.setFullYear(maxFecha.getFullYear() + 1);
    if (fechaEstimada > maxFecha) {
      this.solicitudErrors['fechaEstimada'] = 'La fecha estimada no puede ser mayor a 1 año';
      isValid = false;
    }
  }

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
    } else if (this.ofertaValor > 1000000000) {
      this.ofertaErrors['valor'] = 'El valor no puede exceder $1.000.000.000';
      isValid = false;
    }

    if (!this.ofertaFechaEnvio) {
      this.ofertaErrors['fechaEnvio'] = 'La fecha de envío es obligatoria';
      isValid = false;
    } else {
      const fechaEnvio = new Date(this.ofertaFechaEnvio);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaEnvio > hoy) {
        this.ofertaErrors['fechaEnvio'] = 'La fecha de envío no puede ser futura';
        isValid = false;
      }
    }

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
    } else {
      const fechaLimite = new Date(this.resultadoFechaLimite);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaLimite < hoy) {
        this.resultadoErrors['fechaLimite'] = 'La fecha límite no puede ser anterior a hoy';
        isValid = false;
      }
    }

    if (!this.resultadoNumeroInforme) {
      this.resultadoErrors['numeroInforme'] = 'El número de informe es obligatorio';
      isValid = false;
    } else if (!this.PATTERNS.CODIGO_INFORME.test(this.resultadoNumeroInforme)) {
      this.resultadoErrors['numeroInforme'] = 'Formato de informe inválido (ej: INF-2024-001)';
      isValid = false;
    }

    if (!this.resultadoFechaEnvio) {
      this.resultadoErrors['fechaEnvio'] = 'La fecha de envío es obligatoria';
      isValid = false;
    } else {
      const fechaEnvio = new Date(this.resultadoFechaEnvio);
      const fechaLimite = new Date(this.resultadoFechaLimite);
      
      if (fechaEnvio > fechaLimite) {
        this.resultadoErrors['fechaEnvio'] = 'La fecha de envío no puede ser posterior a la fecha límite';
        isValid = false;
      }
    }

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
    } else {
      const fechaEncuesta = new Date(this.encuestaFecha);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaEncuesta > hoy) {
        this.encuestaErrors['fecha'] = 'La fecha de encuesta no puede ser futura';
        isValid = false;
      }
    }

    if (this.encuestaComentarios && this.encuestaComentarios.length > 1000) {
      this.encuestaErrors['comentarios'] = 'Los comentarios no pueden exceder 1000 caracteres';
      isValid = false;
    }

    if (this.encuestaPuntuacion && (this.encuestaPuntuacion < 1 || this.encuestaPuntuacion > 5)) {
      this.encuestaErrors['puntuacion'] = 'La puntuación debe estar entre 1 y 5';
      isValid = false;
    }

    return isValid;
  }

  // ========== OPERACIONES CRUD (MANTENER IGUAL) ==========
  async createCliente(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarCliente()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de cliente');
      return;
    }

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
      this.limpiarFormularioSolicitud();
      await this.loadSolicitudes();

    } catch (err: any) {
      console.error('Error creating solicitud:', err);
      this.manejarError(err, 'crear solicitud');
    }
  }

  maxDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  minFutureDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  minTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async createOferta(e: Event): Promise<void> {
    e.preventDefault();

    if (!this.validarOferta()) {
      this.snackbarService.warn('Por favor corrige los errores en el formulario de oferta');
      return;
    }

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
      this.limpiarFormularioEncuesta();
      await this.loadSolicitudes();

    } catch (err: any) {
      console.error('Error creating encuesta:', err);
      this.manejarError(err, 'crear encuesta');
    }
  }

  async deleteCliente(id: number): Promise<void> {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) return;
    
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

  // ========== MÉTODOS AUXILIARES (MANTENER IGUAL) ==========
  private manejarError(err: any, operacion: string): void {
    const errorMessage = err.message || err.toString();
    
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

  // ========== MÉTODOS UI ==========
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