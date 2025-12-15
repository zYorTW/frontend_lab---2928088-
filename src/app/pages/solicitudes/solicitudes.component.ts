import { Component, signal, effect, EffectRef, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClientesService } from '../../services/clientes/clientes.service';
import { SolicitudesService } from '../../services/clientes/solicitudes.service';
import { LocationsService } from '../../services/clientes/locations.service';
import { UtilsService } from '../../services/clientes/utils.service';
import { SnackbarService } from '../../shared/snackbar.service';
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
  // Selected items as signals for reactive templates and auto-fill
  selectedCliente = signal<any>(null);
  selectedSolicitud = signal<any>(null);

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
  clienteTipoPoblCustomOptions: string[] = [];
  showTipoPoblModal: boolean = false;
  modalTipoPoblText: string = '';
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
  solicitudFechaSolicitud = '';
  solicitudNumeroFrontPreview: string = '';
  solicitudTipoMuestra = '';
  solicitudCondEmpaque = '';
  solicitudTipoEmpaqueCustomOptions: string[] = [];
  showTipoEmpaqueModal: boolean = false;
  modalTipoEmpaqueText: string = '';
  solicitudTipoAnalisis = '';
  solicitudTipoAnalisisCustomOptions: string[] = [];
  showTipoAnalisisModal: boolean = false;
  modalTipoAnalisisText: string = '';
  solicitudRequiereVarios: any = '';
  solicitudCantidad: number | null = null;
  solicitudFechaEstimada = '';
  solicitudPuedeSuministrar: any = '';
  solicitudServicioViable: any = false;
  solicitudRecibida: string = '';
  solicitudRecibePersonal: string = '';
  solicitudCargoPersonal: string = '';
  solicitudObservaciones: string = '';
  solicitudConsecutivo: number | null = null;

  ofertaSolicitudId: any = '';
  ofertaGeneroCotizacion: any = '';
  ofertaValor: number | null = null;
  ofertaFechaEnvio = '';
  ofertaRealizoSeguimiento: any = '';
  ofertaObservacion = '';

  resultadoSolicitudId: any = '';
  resultadoFechaLimite = '';
  resultadoFechaEnvio = '';
  resultadoServicioViable: any = '';

  encuestaSolicitudId: any = '';
  encuestaFecha = '';
  encuestaFechaRealizacion = ''; 
  encuestaPuntuacion: number | null = null;
  encuestaComentarios = '';
  // encuestaRecomendaria: any = '';
  encuestaClienteRespondio: any = '';
  encuestaSolicitoNueva: any = '';

  // Formulario alterno: actualizar viabilidad
  viableSolicitudId: any = '';
  viableEstado: any = '';

  // Estado UI
  detallesVisibles: { [key: number]: boolean } = {};
  solicitudExpandida: number | null = null;
  lastCopiedMessage: string | null = null;
  
  // Tabs para tarjetas de solicitudes
  solicitudTabs = [
    { key: 'detalle', label: 'Detalle' },
    { key: 'oferta', label: 'Oferta' },
    { key: 'revision', label: 'Revisión' },
    { key: 'encuesta', label: 'Encuesta' }
  ];
  activeSolicitudTab: { [id: number]: string } = {};

  // Estado de carga local (para mostrar skeletons)
  cargando = signal<boolean>(true);

  // Oferta: display string for formatted input
  ofertaValorDisplay: string = '';
  // Keep the last valid raw display to restore when input exceeds limits
  private ofertaValorPrevDisplay: string = '';
  // Error message to show under the oferta valor input
  ofertaValorError: string = '';

  // Efectos (disponibles para limpiar en ngOnDestroy)
  private clientesEffectStop?: EffectRef;
  private solicitudesEffectStop?: EffectRef;

  constructor() {
    // Create effects inside the constructor to ensure we are in an
    // injection context (avoids NG0203 runtime error).
    this.clientesEffectStop = effect(() => {
      this.clientes(); // subscribe to signal
      this.filtrarClientes();
    });

    this.solicitudesEffectStop = effect(() => {
      this.solicitudes(); // subscribe to signal
      this.filtrarSolicitudes();
      try { this.computeNextSolicitudConsecutivo(); } catch (e) { console.warn('computeNextSolicitudConsecutivo effect error', e); }
    });
  }

  // Opciones para selects
  tiposCliente = [
    'Emprendedor',
    'Persona Natural', 
    'Persona Jurídica',
    'Aprendiz SENA',
    'Instructor SENA',
    'Centros SENA'
  ];

  tiposIdentificacion = [
    { value: 'CC', label: 'CC - Cédula de Ciudadanía' },
    { value: 'TI', label: 'TI - Tarjeta de Identidad' },
    { value: 'CE', label: 'CE - Cédula de Extranjería' },
    { value: 'NIT', label: 'NIT - Número de Identificación Tributaria' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
    { value: 'OTRO', label: 'Otro' }
  ];

  opcionesSexo = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
    { value: 'Otro', label: 'Otro' }
  ];

  tiposComunidad = [
    'Campesino',
    'Economía Popular',
    'Madre Cabeza de Familia',
    'Egresado SENA',
    'Indígena',
    'Afrocolombiano',
    'Ninguna',
    'Otras'
  ];

  tiposSolicitud = [
    { value: 'AF', label: 'AF - Apoyo Formación' },
    { value: 'EN', label: 'EN - Ensayos' },
    { value: 'UI', label: 'UI - Uso Infraestructura' },
    { value: 'IA', label: 'IA - Investigación Aplicada' }
  ];

  tiposEmpaque = [
    'Sellado al vacío',
    'Tetrabrik (Tetra Pak)',
    'Envase plástico',
    'Envase de vidrio',
    'Envase metálico',
    'Otras'
  ];

  tiposAnalisis = [
    'BT-Extracción de ADN',
    'MB-Bacterias productoras de ácido láctico-Recuento',
    'MB-Coliformes totales-Recuento-Método horizontal',
    'MB-E. Coli-Recuento-Método horizontal',
    'MB-Hongos y levaduras-Enumeración-Método horizontal',
    'MB-Salmonella-Presencia-Ausencia',
    'QA-Acidez en aderezos',
    'QA-Conductividad en agua',
    'QA-Contenido de Ácido Acético-Ácido Láctico-Etanol-UHPLC',
    'QA-Contenido de Ácido Ascórbico-UHPLC',
    'QA-Contenido de alcohol por hidrometría en bebidas alcohólicas',
    'QA-Extracto seco',
    'QA-Humedad',
    'QA-pH en agua',
    'QA-pH en bebidas alcohólicas',
    'QA-Proteinas por el método de Bradford',
    'QA-Sacarosa-Fructosa-Glucosa-UHPLC',
    'Otro'
  ];

  clienteFields = [
    { key: 'nombre_solicitante', label: 'Nombre solicitante', copyable: true },
    { key: 'razon_social', label: 'Razón social', copyable: true },
    { key: 'fecha_vinculacion', label: 'Fecha vinculación', copyable: true },
    { key: 'tipo_identificacion', label: 'Tipo identificación', copyable: true },
    { key: 'sexo', label: 'Sexo', copyable: false },
    { key: 'tipo_poblacion', label: 'Población', copyable: false },
    { key: 'direccion', label: 'Dirección', copyable: true },
    { key: 'ciudad_departamento', label: 'Ciudad / Departamento', copyable: true, fullWidth: false },
    { key: 'telefono_celular', label: 'Teléfono / Celular', copyable: true, fullWidth: false },
    { key: 'correo_electronico', label: 'Correo', copyable: true },
    { key: 'tipo_vinculacion', label: 'Tipo vinculación', copyable: true },
    { key: 'observaciones', label: 'Observaciones', copyable: true, fullWidth: true },
    { key: 'registro_realizado_por', label: 'Registro por', copyable: true, small: true },
    { key: 'created_at', label: 'Creado', copyable: true, small: true },
    { key: 'updated_at', label: 'Actualizado', copyable: true, small: true }
  ];

  ngOnInit() {
    console.log('🎯 Solicitudes component: Iniciando...');
    this.loadInitialData();
    this.filtrarClientes();
    this.filtrarSolicitudes();
  }

  ngOnDestroy() {
    console.log('🔴 Solicitudes component: Destruyendo...');
    try { if (this.clientesEffectStop) this.clientesEffectStop.destroy(); } catch {}
    try { if (this.solicitudesEffectStop) this.solicitudesEffectStop.destroy(); } catch {}
  }

  private async loadInitialData(): Promise<void> {
    console.log('🔄 Cargando datos iniciales...');
    try {
      await this.locationsService.loadDepartamentos();
      console.log('✅ Departamentos cargados:', this.departamentos().length);
      await this.loadClientes();
      console.log('✅ Clientes cargados:', this.clientes().length);

      // If no solicitud cliente selected, default to first cliente for new solicitudes
      const firstClient = (this.clientes() || [])[0];
      if (firstClient) {
        // Keep selectedCliente for autofill helpers, but do NOT preselect the client in the "Agregar solicitud" form.
        // The placeholder should be shown instead of forcing the first client selection.
        this.selectedCliente.set(firstClient);
      }

      // Preload ciudades for all departamentos present among clients
      const clientesList = this.clientes() || [];
      const depCodes = Array.from(new Set(
        clientesList
          .map(c => c.id_departamento || c.departamento_codigo)
          .filter(Boolean)
          .map(x => String(x))
      ));
      for (const depCode of depCodes) {
        try {
          await this.locationsService.loadCiudades(depCode);
        } catch (e) {
          console.warn('No se pudieron cargar ciudades para departamento', depCode, e);
        }
      }

      this.computeNextClienteNumero();
      await this.loadSolicitudes();
      console.log('✅ Solicitudes cargadas:', this.solicitudes().length);

      // Default selected solicitud when possible
      const firstSolicitud = (this.solicitudes() || [])[0];
      if (firstSolicitud) {
        this.selectedSolicitud.set(firstSolicitud);
      }
      this.computeNextSolicitudConsecutivo();
    } catch (err) {
      console.error('❌ Error cargando datos iniciales:', err);
      this.manejarError(err, 'cargar datos iniciales');
    } finally {
      // Marcar carga inicial como finalizada (muestra listas o mensajes)
      try { this.cargando.set(false); } catch { }
    }
  }

  // Método para obtener fecha actual en formato YYYY-MM-DD
getTodayDate(): string {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

// Método para obtener fecha de mañana en formato YYYY-MM-DD
getTomorrowDate(): string {
  const mañana = new Date();
  mañana.setDate(mañana.getDate() + 1); // Sumar 1 día
  
  const año = mañana.getFullYear();
  const mes = String(mañana.getMonth() + 1).padStart(2, '0');
  const dia = String(mañana.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

  // Calcula el siguiente consecutivo para solicitud
  computeNextSolicitudConsecutivo(): void {
    try {
      const items = this.solicitudes() || [];
      let maxId = 0;
      for (const s of items) {
        const n = Number(s.solicitud_id || s.id_solicitud || 0);
        if (!isNaN(n) && n > maxId) maxId = n;
      }
      const siguiente = maxId + 1;
      // Siempre actualizar el consecutivo para reflejar el estado actual de la base de datos.
      // Esto evita que el contador se quede en un valor anterior cuando se borran todas las solicitudes.
      this.solicitudConsecutivo = siguiente;
    } catch (err) {
      console.warn('computeNextSolicitudConsecutivo error', err);
    }
  }

  // Calcula el siguiente valor para el campo "Consecutivo" del cliente
  computeNextClienteNumero(): void {
    try {
      const clientes = this.clientes() || [];
      let maxNum = 0;
      for (const c of clientes) {
        const n = Number(c.numero || c.numero_cliente || 0);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
      const siguiente = maxNum + 1;
      if (!this.clienteNumero || Number(this.clienteNumero) < siguiente) {
        this.clienteNumero = siguiente;
      }
    } catch (err) {
      console.warn('computeNextClienteNumero error', err);
    }
  }

  // Maneja el cambio del select de tipo de población / comunidad
  handleTipoPoblChange(value: string): void {
    if (value === 'Otras') {
      this.modalTipoPoblText = '';
      this.showTipoPoblModal = true;
      this.clienteTipoPobl = '';
    } else {
      this.clienteTipoPobl = value;
    }
  }

  confirmTipoPoblModal(): void {
    const text = (this.modalTipoPoblText || '').trim();
    if (!text) {
      this.snackbarService.warn('Por favor escribe la descripción de la comunidad');
      return;
    }

    if (!this.clienteTipoPoblCustomOptions.includes(text)) {
      this.clienteTipoPoblCustomOptions.push(text);
    }

    this.clienteTipoPobl = text;
    this.showTipoPoblModal = false;
    this.modalTipoPoblText = '';
  }

  cancelTipoPoblModal(): void {
    this.showTipoPoblModal = false;
    this.modalTipoPoblText = '';
    this.clienteTipoPobl = '';
  }

  // Maneja el cambio del select de Tipo de análisis
  handleTipoAnalisisChange(value: string): void {
    if (value === 'Otro') {
      this.modalTipoAnalisisText = '';
      this.showTipoAnalisisModal = true;
      this.solicitudTipoAnalisis = '';
    } else {
      this.solicitudTipoAnalisis = value;
    }
  }

  // Maneja el cambio del select de Tipo de empaque
  handleTipoEmpaqueChange(value: string): void {
    if (value === 'Otras') {
      this.modalTipoEmpaqueText = '';
      this.showTipoEmpaqueModal = true;
      this.solicitudCondEmpaque = '';
    } else {
      this.solicitudCondEmpaque = value;
    }
  }

  confirmTipoEmpaqueModal(): void {
    const text = (this.modalTipoEmpaqueText || '').trim();
    if (!text) {
      this.snackbarService.warn('Por favor escribe la descripción del tipo de empaque');
      return;
    }
    if (!this.solicitudTipoEmpaqueCustomOptions.includes(text)) {
      this.solicitudTipoEmpaqueCustomOptions.push(text);
    }
    this.solicitudCondEmpaque = text;
    this.showTipoEmpaqueModal = false;
    this.modalTipoEmpaqueText = '';
  }

  cancelTipoEmpaqueModal(): void {
    this.showTipoEmpaqueModal = false;
    this.modalTipoEmpaqueText = '';
    this.solicitudCondEmpaque = '';
  }

  confirmTipoAnalisisModal(): void {
    const text = (this.modalTipoAnalisisText || '').trim();
    if (!text) {
      this.snackbarService.warn('Por favor escribe la descripción del análisis');
      return;
    }
    if (!this.solicitudTipoAnalisisCustomOptions.includes(text)) {
      this.solicitudTipoAnalisisCustomOptions.push(text);
    }
    this.solicitudTipoAnalisis = text;
    this.showTipoAnalisisModal = false;
    this.modalTipoAnalisisText = '';
  }

  cancelTipoAnalisisModal(): void {
    this.showTipoAnalisisModal = false;
    this.modalTipoAnalisisText = '';
    this.solicitudTipoAnalisis = '';
  }

  // Recalcula el preview del código tipo-año-consecutivo
  computeNumeroFrontPreview(): void {
    const tipo = (this.solicitudTipo || '').trim();
    if (!tipo) { 
      this.solicitudNumeroFrontPreview = ''; 
      return; 
    }
    
    const fecha = this.solicitudFechaSolicitud ? new Date(this.solicitudFechaSolicitud) : new Date();
    const year = fecha.getFullYear();
    let count = 0;
    
    for (const s of (this.solicitudes() || [])) {
      const t = (s.tipo_solicitud || '').trim();
      const y = s.fecha_solicitud ? new Date(s.fecha_solicitud).getFullYear() : new Date().getFullYear();
      if (t === tipo && y === year) count++;
    }
    
    const next = count + 1;
    const cc = String(next).padStart(2, '0');
    this.solicitudNumeroFrontPreview = `${tipo}-${year}-${cc}`;
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
      this.computeNumeroFrontPreview();
    } catch (err: any) {
      this.manejarError(err, 'cargar solicitudes');
    }
  }

  onDepartamentoChange(): void {
    this.clienteIdCiudad = '';
    (async () => {
      try {
        await this.locationsService.loadCiudades(this.clienteIdDepartamento);
        const count = this.ciudades().length;
        if (count === 0) {
          this.snackbarService.warn('No se encontraron ciudades para el departamento seleccionado');
        }
      } catch (err: any) {
        this.snackbarService.error('Error cargando ciudades. Verifica la conexión.');
      }
    })();
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
    const base = [...this.solicitudes()];
    
    // Ordenar por fecha y luego por id
    const arr = base.sort((a, b) => {
      const da = a.fecha_solicitud ? new Date(a.fecha_solicitud).getTime() : 0;
      const db = b.fecha_solicitud ? new Date(b.fecha_solicitud).getTime() : 0;
      if (da !== db) return da - db;
      return (a.solicitud_id || a.id_solicitud || 0) - (b.solicitud_id || b.id_solicitud || 0);
    });

    // Normalizar campos
    const normalized = arr.map((s) => {
      const id = s?.solicitud_id ?? s?.id_solicitud ?? s?.solicitudId ?? null;
      const tipo = (s?.tipo_solicitud ?? s?.tipo ?? '').toString().trim();
      const fecha = s?.fecha_solicitud ?? s?.created_at ?? s?.fecha ?? null;
      const nombreSolicitante = s?.nombre_solicitante ?? s?.cliente_nombre ?? s?.nombre_cliente ?? (s?.cliente?.nombre) ?? '';
      const nombreMuestra = s?.nombre_muestra ?? s?.muestra_nombre ?? s?.producto_nombre ?? '';
      
      return {
        ...s,
        id_solicitud: id,
        solicitud_id: id,
        tipo_solicitud: tipo,
        fecha_solicitud: fecha,
        nombre_solicitante: nombreSolicitante,
        nombre_muestra: nombreMuestra
      };
    });

    // Calcular consecutivo por año y tipo
    const counters = new Map<string, number>();
    const solicitudes = normalized.map((s) => {
      const tipo = (s.tipo_solicitud || '').trim();
      const fecha = s.fecha_solicitud ? new Date(s.fecha_solicitud) : new Date();
      const year = fecha.getFullYear();
      const key = `${tipo}|${year}`;
      const curr = counters.get(key) || 0;
      const next = curr + 1;
      counters.set(key, next);
      const consecutivoStr = String(next).padStart(2, '0');
      return {
        ...s,
        numero_solicitud_front: tipo ? `${tipo}-${year}-${consecutivoStr}` : `--${year}-${consecutivoStr}`
      };
    });

    if (!this.solicitudesQ.trim()) {
      this.solicitudesFiltradas.set(solicitudes);
      return;
    }

    const filtro = this.solicitudesQ.toLowerCase().trim();
    const solicitudesFiltradas = solicitudes.filter(solicitud => {
      const id = (solicitud.solicitud_id || solicitud.id_solicitud || '').toString();
      const tipo = (solicitud.tipo_solicitud || '').toLowerCase();
      const numeroFront = (solicitud.numero_solicitud_front || '').toLowerCase();
      const nombreSolicitante = (solicitud.nombre_solicitante || '').toLowerCase();
      const nombreMuestra = (solicitud.nombre_muestra || '').toLowerCase();
      const tipoMuestra = (solicitud.tipo_muestra || '').toLowerCase();
      const tipoAnalisis = (solicitud.analisis_requerido || '').toLowerCase();
      const lote = (solicitud.lote_producto || '').toLowerCase();
      
      return id.includes(filtro) || tipo.includes(filtro) ||
             numeroFront.includes(filtro) || nombreSolicitante.includes(filtro) ||
             nombreMuestra.includes(filtro) || tipoMuestra.includes(filtro) ||
             tipoAnalisis.includes(filtro) || lote.includes(filtro);
    });
    
    this.solicitudesFiltradas.set(solicitudesFiltradas);
  }

  // ========== VALIDACIONES ==========
 validarCliente(): boolean {
  // Validar todos los campos dinámicamente
  this.validarCampoClienteEnTiempoReal('nombre');
  this.validarCampoClienteEnTiempoReal('numero');
  this.validarCampoClienteEnTiempoReal('fechaVinc');
  this.validarCampoClienteEnTiempoReal('tipoUsuario');
  this.validarCampoClienteEnTiempoReal('razonSocial');
  this.validarCampoClienteEnTiempoReal('nit');
  this.validarCampoClienteEnTiempoReal('tipoId');
  this.validarCampoClienteEnTiempoReal('idNum');
  this.validarCampoClienteEnTiempoReal('sexo');
  this.validarCampoClienteEnTiempoReal('tipoPobl');
  this.validarCampoClienteEnTiempoReal('direccion');
  this.validarCampoClienteEnTiempoReal('departamento');
  this.validarCampoClienteEnTiempoReal('ciudad');
  this.validarCampoClienteEnTiempoReal('celular');
  this.validarCampoClienteEnTiempoReal('telefono');
  this.validarCampoClienteEnTiempoReal('email');
  this.validarCampoClienteEnTiempoReal('tipoVinc');
  this.validarCampoClienteEnTiempoReal('registroPor');
  this.validarCampoClienteEnTiempoReal('observaciones');
  
  // Verificar si hay errores
  return Object.values(this.clienteErrors).every(error => !error);
}

  validarSolicitud(): boolean {
  // Validar todos los campos dinámicamente
  this.validarCampoSolicitudEnTiempoReal('consecutivo');
  this.validarCampoSolicitudEnTiempoReal('clienteId');
  this.validarCampoSolicitudEnTiempoReal('tipo');
  this.validarCampoSolicitudEnTiempoReal('nombre');
  this.validarCampoSolicitudEnTiempoReal('lote');
  this.validarCampoSolicitudEnTiempoReal('fechaSolicitud');
  this.validarCampoSolicitudEnTiempoReal('fechaVenc');
  this.validarCampoSolicitudEnTiempoReal('tipoMuestra');
  this.validarCampoSolicitudEnTiempoReal('condEmpaque');
  this.validarCampoSolicitudEnTiempoReal('tipoAnalisis');
  this.validarCampoSolicitudEnTiempoReal('cantidad');
  this.validarCampoSolicitudEnTiempoReal('fechaEstimada');
  this.validarCampoSolicitudEnTiempoReal('requiereVarios');
  this.validarCampoSolicitudEnTiempoReal('solicitudRecibida');
  this.validarCampoSolicitudEnTiempoReal('recibePersonal');
  this.validarCampoSolicitudEnTiempoReal('cargoPersonal');
  this.validarCampoSolicitudEnTiempoReal('observaciones');
  
  // Verificar si hay errores
  return Object.values(this.solicitudErrors).every(error => !error);
}

 validarOferta(): boolean {
  // Validar todos los campos dinámicamente
  this.validarCampoOfertaEnTiempoReal('solicitudId');
  this.validarCampoOfertaEnTiempoReal('valor');
  this.validarCampoOfertaEnTiempoReal('fechaEnvio');
  this.validarCampoOfertaEnTiempoReal('generoCotizacion');
  this.validarCampoOfertaEnTiempoReal('realizoSeguimiento');
  this.validarCampoOfertaEnTiempoReal('observacion');
  
  // Verificar si hay errores
  return Object.values(this.ofertaErrors).every(error => !error);
}

 validarResultado(): boolean {
  // Validar todos los campos dinámicamente
  this.validarCampoResultadoEnTiempoReal('solicitudId');
  this.validarCampoResultadoEnTiempoReal('fechaLimite');
  this.validarCampoResultadoEnTiempoReal('fechaEnvio');
  this.validarCampoResultadoEnTiempoReal('servicioViable');
  
  // Verificar si hay errores
  return Object.values(this.resultadoErrors).every(error => !error);
}

validarEncuesta(): boolean {
  // Validar todos los campos dinámicamente
  this.validarCampoEncuestaEnTiempoReal('solicitudId');
  this.validarCampoEncuestaEnTiempoReal('fecha');
  this.validarCampoEncuestaEnTiempoReal('clienteRespondio');
  
  // Validar fechaRealizacion solo si clienteRespondio es true
  if (this.encuestaClienteRespondio === true) {
    this.validarCampoEncuestaEnTiempoReal('fechaRealizacion');
  }
  
  this.validarCampoEncuestaEnTiempoReal('solicitoNueva');
  this.validarCampoEncuestaEnTiempoReal('comentarios');
  
  // Verificar si hay errores
  return Object.values(this.encuestaErrors).every(error => !error);
}

// ===== VALIDACIÓN DINÁMICA PARA CLIENTE =====
validarCampoClienteEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorCliente(campo);
  this.clienteErrors[campo] = this.validarCampoClienteIndividual(campo, valor);
}

private getValorCliente(campo: string): any {
  switch (campo) {
    case 'nombre': return this.clienteNombre;
    case 'numero': return this.clienteNumero;
    case 'fechaVinc': return this.clienteFechaVinc;
    case 'tipoUsuario': return this.clienteTipoUsuario;
    case 'razonSocial': return this.clienteRazonSocial;
    case 'nit': return this.clienteNit;
    case 'tipoId': return this.clienteTipoId;
    case 'idNum': return this.clienteIdNum;
    case 'sexo': return this.clienteSexo;
    case 'tipoPobl': return this.clienteTipoPobl;
    case 'direccion': return this.clienteDireccion;
    case 'departamento': return this.clienteIdDepartamento;
    case 'ciudad': return this.clienteIdCiudad;
    case 'celular': return this.clienteCelular;
    case 'telefono': return this.clienteTelefono;
    case 'email': return this.clienteEmail;
    case 'tipoVinc': return this.clienteTipoVinc;
    case 'registroPor': return this.clienteRegistroPor;
    case 'observaciones': return this.clienteObservaciones;
    default: return '';
  }
}

private validarCampoClienteIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'nombre':
      const nombreStr = (valor ?? '').toString().trim();
      if (!nombreStr) return 'El nombre del solicitante es obligatorio';
      if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\.\-]{2,100}$/.test(nombreStr))
        return 'El nombre debe contener solo letras, espacios y puntos (2-100 caracteres)';
      return '';
      
    case 'numero':
      if (!valor) return 'El número consecutivo es obligatorio';
      if (Number(valor) < 1 || Number(valor) > 9999)
        return 'El consecutivo debe estar entre 1 y 9999';
      return '';
      
    case 'fechaVinc':
      if (!valor) return 'La fecha de vinculación es obligatoria';
      const fecha = new Date(valor);
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      if (fecha > hoy) return 'La fecha de vinculación no puede ser futura';
      return '';
      
    case 'tipoUsuario':
      if (!valor) return 'Debe seleccionar el tipo de cliente';
      return '';
      
    case 'razonSocial':
      const razonSocialStr = (valor ?? '').toString().trim();
      if (!razonSocialStr) return 'La razón social es obligatoria';
      if (razonSocialStr.length > 200) return 'La razón social no puede exceder 200 caracteres';
      return '';
      
    case 'nit':
      const nitStr = (valor ?? '').toString().trim();
      if (!nitStr) return 'El NIT es obligatorio';
      if (!/^[0-9]{9}-[0-9]$/.test(nitStr))
        return 'Formato de NIT inválido (ej: 900123456-7)';
      return '';
      
    case 'tipoId':
      if (!valor) return 'Debe seleccionar el tipo de identificación';
      return '';
      
    case 'idNum':
      const idNumStr = (valor ?? '').toString().trim();
      if (!idNumStr) return 'El número de identificación es obligatorio';
      if (!/^[0-9A-Za-z]{5,20}$/.test(idNumStr))
        return 'Número de identificación inválido (5-20 caracteres alfanuméricos)';
      return '';
      
    case 'sexo':
      if (!valor) return 'Debe seleccionar el sexo';
      if (!['M', 'F', 'Otro'].includes(valor))
        return 'Seleccione una opción válida para sexo';
      return '';
      
    case 'tipoPobl':
      const tipoPoblStr = (valor ?? '').toString().trim();
      if (!tipoPoblStr) return 'El tipo de comunidad es obligatorio';
      if (tipoPoblStr.length > 50) return 'El tipo de comunidad no puede exceder 50 caracteres';
      return '';
      
    case 'direccion':
      const direccionStr = (valor ?? '').toString().trim();
      if (!direccionStr) return 'La dirección es obligatoria';
      if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s#\-\.\,]{5,200}$/.test(direccionStr))
        return 'La dirección contiene caracteres inválidos (máx 200 caracteres)';
      return '';
      
    case 'departamento':
      if (!valor) return 'Debe seleccionar un departamento';
      return '';
      
    case 'ciudad':
      if (!valor) return 'Debe seleccionar una ciudad';
      return '';
      
    case 'celular':
      const celularStr = (valor ?? '').toString().trim();
      if (!celularStr) return 'El celular es obligatorio';
      if (!/^3[0-9]{9}$/.test(celularStr.replace(/\s/g, '')))
        return 'Formato de celular inválido (ej: 3001234567)';
      return '';
      
    case 'telefono':
      if (valor && !/^[0-9]{7,15}$/.test(valor.toString().replace(/\s/g, '')))
        return 'Formato de teléfono inválido (7-15 dígitos)';
      return '';
      
    case 'email':
      const emailStr = (valor ?? '').toString().trim();
      if (!emailStr) return 'El correo electrónico es obligatorio';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr))
        return 'Formato de correo electrónico inválido';
      return '';
      
    case 'tipoVinc':
      const tipoVincStr = (valor ?? '').toString().trim();
      if (!tipoVincStr) return 'El tipo de vinculación es obligatorio';
      if (tipoVincStr.length > 50) return 'El tipo de vinculación no puede exceder 50 caracteres';
      return '';
      
    case 'registroPor':
      const registroPorStr = (valor ?? '').toString().trim();
      if (!registroPorStr) return 'El registro realizado por es obligatorio';
      if (registroPorStr.length > 100) return 'El registro realizado por no puede exceder 100 caracteres';
      return '';
      
    case 'observaciones':
      if (valor && !/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s#\-\.\,\(\)]{0,500}$/.test(valor.toString()))
        return 'Las observaciones exceden el límite de 500 caracteres';
      return '';
      
    default:
      return '';
  }
}

// ===== VALIDACIÓN DINÁMICA PARA SOLICITUD =====
validarCampoSolicitudEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorSolicitud(campo);
  this.solicitudErrors[campo] = this.validarCampoSolicitudIndividual(campo, valor);
}

private getValorSolicitud(campo: string): any {
  switch (campo) {
    case 'consecutivo': return this.solicitudConsecutivo;
    case 'clienteId': return this.solicitudClienteId;
    case 'tipo': return this.solicitudTipo;
    case 'nombre': return this.solicitudNombre;
    case 'lote': return this.solicitudLote;
    case 'fechaSolicitud': return this.solicitudFechaSolicitud;
    case 'fechaVenc': return this.solicitudFechaVenc;
    case 'tipoMuestra': return this.solicitudTipoMuestra;
    case 'condEmpaque': return this.solicitudCondEmpaque;
    case 'tipoAnalisis': return this.solicitudTipoAnalisis;
    case 'cantidad': return this.solicitudCantidad;
    case 'fechaEstimada': return this.solicitudFechaEstimada;
    case 'requiereVarios': return this.solicitudRequiereVarios;
    case 'solicitudRecibida': return this.solicitudRecibida;
    case 'recibePersonal': return this.solicitudRecibePersonal;
    case 'cargoPersonal': return this.solicitudCargoPersonal;
    case 'observaciones': return this.solicitudObservaciones;
    default: return '';
  }
}

private validarCampoSolicitudIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'consecutivo':
      if (!valor) return 'El consecutivo es obligatorio';
      return '';
      
    case 'clienteId':
      if (!valor) return 'Debe seleccionar un cliente';
      return '';
      
    case 'tipo':
      if (!valor) return 'Debe seleccionar el tipo de solicitud';
      return '';

    case 'nombre':
      const nombreStr = (valor ?? '').toString().trim();
      if (!nombreStr) return 'El nombre de la muestra es obligatorio';
      if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.]{2,100}$/.test(nombreStr))
        return 'Nombre de muestra inválido (2-100 caracteres alfanuméricos)';
      return '';

    case 'lote':
      const loteStr = (valor ?? '').toString().trim();
      if (!loteStr) return 'El lote del producto es obligatorio';

      // Mismo patrón que la directiva (solo letras básicas, números, guiones)
      if (!/^[A-Za-z0-9\-]{3,20}$/.test(loteStr))
        return 'Formato de lote inválido (3-20 caracteres: solo letras, números y guiones)';
      return '';

    case 'fechaSolicitud':
      if (!valor) return 'La fecha de solicitud es obligatoria';
      const fechaSolicitud = new Date(valor);
      if (isNaN(fechaSolicitud.getTime())) return 'Fecha de solicitud inválida';
      const hoySolicitud = new Date();
      hoySolicitud.setHours(23, 59, 59, 999);
      if (fechaSolicitud > hoySolicitud) return 'La fecha de solicitud no puede ser futura';
      return '';

    case 'fechaVenc':
      if (!valor) return 'La fecha de vencimiento es obligatoria';
      const fechaVenc = new Date(valor);
      const hoyVenc = new Date();
      hoyVenc.setHours(0, 0, 0, 0);
      fechaVenc.setHours(0, 0, 0, 0);
      if (fechaVenc < hoyVenc) return 'La fecha de vencimiento no puede ser una fecha pasada';
      return '';

    case 'tipoMuestra':
      const tipoMuestraStr = (valor ?? '').toString().trim();
      if (!tipoMuestraStr) return 'El tipo de muestra es obligatorio';
      if (tipoMuestraStr.length > 50) return 'El tipo de muestra no puede exceder 50 caracteres';
      return '';

    case 'condEmpaque':
      const condEmpaqueStr = (valor ?? '').toString().trim();
      if (!condEmpaqueStr) return 'El tipo de empaque es obligatorio';
      if (condEmpaqueStr.length > 100) return 'El tipo de empaque no puede exceder 100 caracteres';
      return '';
      
    case 'tipoAnalisis':
      const tipoAnalisisStr = (valor ?? '').toString().trim();
      if (!tipoAnalisisStr) return 'El tipo de análisis requerido es obligatorio';
      if (tipoAnalisisStr.length > 100) return 'El tipo de análisis no puede exceder 100 caracteres';
      return '';
      
    case 'cantidad':
      if (!valor && valor !== 0) return 'La cantidad de muestras es obligatoria';
      if (Number(valor) < 1 || Number(valor) > 1000)
        return 'La cantidad debe estar entre 1 y 1000 muestras';
      return '';

    case 'fechaEstimada':
  if (!valor) return 'La fecha estimada de entrega es obligatoria';
  
  // Validar formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return 'Formato de fecha inválido (AAAA-MM-DD)';
  }
  
  // PARSEAR MANUALMENTE - igual que en getTodayDate()
  const partes = valor.split('-');
  const añoEstimado = parseInt(partes[0], 10);
  const mesEstimado = parseInt(partes[1], 10) - 1; // meses 0-indexed
  const diaEstimado = parseInt(partes[2], 10);
  
  const fechaEstimada = new Date(añoEstimado, mesEstimado, diaEstimado);
  
  // Fecha actual (medianoche)
  const hoy = new Date();
  const añoHoy = hoy.getFullYear();
  const mesHoy = hoy.getMonth();
  const diaHoy = hoy.getDate();
  const hoyMedianoche = new Date(añoHoy, mesHoy, diaHoy);
  
  // Comparar
  if (fechaEstimada.getTime() < hoyMedianoche.getTime()) {
    return 'La fecha estimada no puede ser anterior a hoy';
  }
  
  // Validar máximo 1 año
  const maxFecha = new Date(añoHoy + 1, mesHoy, diaHoy);
  
  if (fechaEstimada.getTime() > maxFecha.getTime()) {
    return 'La fecha estimada no puede ser mayor a 1 año';
  }
  
  return '';
      
    case 'requiereVarios':
      if (valor === '' || valor === null || valor === undefined)
        return 'Debe indicar si requiere varios análisis';
      return '';
      
    case 'solicitudRecibida':
      const solicitudRecibidaStr = (valor ?? '').toString().trim();
      if (!solicitudRecibidaStr) return 'Debe indicar cómo se recibió la solicitud';
      if (solicitudRecibidaStr.length > 255) return 'Máximo 255 caracteres';
      return '';
      
    case 'recibePersonal':
      const recibePersonalStr = (valor ?? '').toString().trim();
      if (!recibePersonalStr) return 'Debe indicar quién recibe la solicitud';
      if (recibePersonalStr.length > 255) return 'Máximo 255 caracteres';
      return '';
      
    case 'cargoPersonal':
      const cargoPersonalStr = (valor ?? '').toString().trim();
      if (!cargoPersonalStr) return 'Debe indicar el cargo del personal';
      if (cargoPersonalStr.length > 100) return 'Máximo 100 caracteres';
      return '';
      
    case 'observaciones':
      if (valor && valor.toString().length > 5000)
        return 'Observaciones demasiado largas';
      return '';
      
    default:
      return '';
  }
}

// ===== VALIDACIÓN DINÁMICA PARA OFERTA =====
validarCampoOfertaEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorOferta(campo);
  this.ofertaErrors[campo] = this.validarCampoOfertaIndividual(campo, valor);
}

private getValorOferta(campo: string): any {
  switch (campo) {
    case 'solicitudId': return this.ofertaSolicitudId;
    case 'valor': return this.ofertaValor;
    case 'fechaEnvio': return this.ofertaFechaEnvio;
    case 'generoCotizacion': return this.ofertaGeneroCotizacion;
    case 'realizoSeguimiento': return this.ofertaRealizoSeguimiento;
    case 'observacion': return this.ofertaObservacion;
    default: return '';
  }
}

private validarCampoOfertaIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'solicitudId':
      if (!valor) return 'Debe seleccionar una solicitud';
      return '';
      
    case 'valor':
      if (!valor && valor !== 0) return 'El valor de la oferta es obligatorio';
      if (Number(valor) <= 0) return 'El valor debe ser mayor a 0';
      if (Number(valor) > 1000000000) return 'El valor no puede exceder $1.000.000.000';
      return '';
      
    case 'fechaEnvio':
      if (!valor) return 'La fecha de envío es obligatoria';
      const fechaEnvio = new Date(valor);
      const hoyEnvio = new Date();
      hoyEnvio.setHours(0, 0, 0, 0);
      if (fechaEnvio > hoyEnvio) return 'La fecha de envío no puede ser futura';
      return '';
      
    case 'generoCotizacion':
      if (valor === '' || valor === null || valor === undefined)
        return 'Debe indicar si se generó cotización';
      return '';
      
    case 'realizoSeguimiento':
      if (valor === '' || valor === null || valor === undefined)
        return 'Debe indicar si se realizó seguimiento';
      return '';
      
    case 'observacion':
      if (valor && valor.toString().length > 200)
        return 'La observación no puede exceder 200 caracteres';
      return '';
      
    default:
      return '';
  }
}

// ===== VALIDACIÓN DINÁMICA PARA RESULTADO/REVISIÓN =====
validarCampoResultadoEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorResultado(campo);
  this.resultadoErrors[campo] = this.validarCampoResultadoIndividual(campo, valor);
}

private getValorResultado(campo: string): any {
  switch (campo) {
    case 'solicitudId': return this.resultadoSolicitudId;
    case 'fechaLimite': return this.resultadoFechaLimite;
    case 'fechaEnvio': return this.resultadoFechaEnvio;
    case 'servicioViable': return this.resultadoServicioViable;
    default: return '';
  }
}

private validarCampoResultadoIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'solicitudId':
      if (!valor) return 'Debe seleccionar una solicitud';
      return '';
      
    case 'fechaLimite':
      if (!valor) return 'La fecha límite es obligatoria';
      const fechaLimite = new Date(valor);
      const hoyLimite = new Date();
      hoyLimite.setHours(0, 0, 0, 0);
      if (fechaLimite < hoyLimite) return 'La fecha límite no puede ser anterior a hoy';
      return '';
      
    case 'fechaEnvio':
      if (!valor) return 'La fecha de envío es obligatoria';
      const fechaEnvio = new Date(valor);
      // CORREGIDO: Usar this.resultadoFechaLimite directamente, no redeclarar fechaLimite
      const fechaLimiteExistente = this.resultadoFechaLimite ? new Date(this.resultadoFechaLimite) : null;
      if (fechaLimiteExistente && fechaEnvio > fechaLimiteExistente)
        return 'La fecha de envío no puede ser posterior a la fecha límite';
      return '';
      
    case 'servicioViable':
      if (valor === '' || valor === null || valor === undefined)
        return 'Debe indicar si el servicio es viable';
      return '';
      
    default:
      return '';
  }
}

// ===== VALIDACIÓN DINÁMICA PARA ENCUESTA =====
validarCampoEncuestaEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorEncuesta(campo);
  this.encuestaErrors[campo] = this.validarCampoEncuestaIndividual(campo, valor);
}

private getValorEncuesta(campo: string): any {
    switch (campo) {
      case 'solicitudId': return this.encuestaSolicitudId;
      case 'fecha': return this.encuestaFecha;
      // case 'recomendaria': return this.encuestaRecomendaria;
      case 'fechaRealizacion': return this.encuestaFechaRealizacion;
      case 'clienteRespondio': return this.encuestaClienteRespondio;
      case 'solicitoNueva': return this.encuestaSolicitoNueva;
      case 'comentarios': return this.encuestaComentarios;
      default: return '';
    }
  }

  private validarCampoEncuestaIndividual(campo: string, valor: any): string {
    switch (campo) {

      case 'fechaRealizacion':
        // Solo obligatorio si clienteRespondio es true
        if (this.encuestaClienteRespondio !== true) {
          return ''; // No es obligatorio si el cliente no respondió
        }

        if (!valor) {
          return 'La fecha de realización es obligatoria cuando el cliente respondió';
        }

        // Validar formato básico
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
          return 'Formato de fecha inválido (AAAA-MM-DD)';
        }

        // Validar que sea una fecha válida
        const fechaRealizacion = new Date(valor);
        if (isNaN(fechaRealizacion.getTime())) {
          return 'Fecha inválida';
        }

        return '';


      case 'solicitudId':
        if (!valor) return 'Debe seleccionar una solicitud';
        return '';

      case 'fecha':
        if (!valor) return 'La fecha de la encuesta es obligatoria';

  // Validar formato
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor))
          return 'Formato de fecha inválido (AAAA-MM-DD)';

        const fechaEncuesta = new Date(valor);
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        mañana.setHours(0, 0, 0, 0);

        fechaEncuesta.setHours(0, 0, 0, 0);

        if (isNaN(fechaEncuesta.getTime())) {
          return 'Fecha inválida';
        }

        // DEBE SER FUTURA: fecha >= mañana (no hoy, no pasadas)
        if (fechaEncuesta < mañana) {
          return 'La fecha de envío debe ser futura (mañana en adelante)';
        }

        return '';

    // case 'recomendaria':
    //   if (valor === '' || valor === null || valor === undefined)
    //     return 'Debe indicar si recomendaría el servicio';
    //   return '';
      
    case 'clienteRespondio':
      if (valor === '' || valor === null || valor === undefined)
        return 'Debe indicar si el cliente respondió';
      return '';
      
    case 'solicitoNueva':
      if (valor === '' || valor === null || valor === undefined)
        return 'Debe indicar si se solicitó nueva encuesta';
      return '';
      
    case 'comentarios':
      if (valor && valor.toString().length > 1000)
        return 'Los comentarios no pueden exceder 1000 caracteres';
      return '';
      
    default:
      return '';
  }
}

  // ========== OPERACIONES CRUD ==========
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
        observaciones: this.clienteObservaciones,
        numero: this.clienteNumero
      };

      await this.clientesService.createCliente(payload);

      this.snackbarService.success('✅ Cliente creado exitosamente');
      this.clienteErrors = {};

      this.limpiarFormularioCliente();
      this.computeNextClienteNumero();

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
        solicitud_id: this.solicitudConsecutivo ?? null,
        id_cliente: this.solicitudClienteId,
        tipo_solicitud: this.solicitudTipo,
        nombre_muestra: this.solicitudNombre,
        lote_producto: this.solicitudLote || null,
        fecha_solicitud: this.solicitudFechaSolicitud || null,
        fecha_vencimiento_muestra: this.solicitudFechaVenc || null,
        tipo_muestra: this.solicitudTipoMuestra || null,
        tipo_empaque: this.solicitudCondEmpaque || null,
        analisis_requerido: this.solicitudTipoAnalisis || null,
        req_analisis: this.solicitudRequiereVarios ? 1 : 0,
        cant_muestras: this.solicitudCantidad || null,
        fecha_entrega_muestra: this.solicitudFechaEstimada || null,
        solicitud_recibida: this.solicitudRecibida || (this.solicitudPuedeSuministrar ? 'Sí' : 'No'),
        recibe_personal: this.solicitudRecibePersonal || null,
        cargo_personal: this.solicitudCargoPersonal || null,
        observaciones: this.solicitudObservaciones || null
      };

      const nuevo: any = await this.solicitudesService.createSolicitud(body);

      this.snackbarService.success('✅ Solicitud creada exitosamente');
      this.solicitudErrors = {};

      this.limpiarFormularioSolicitud();

      // Reload solicitudes from server to get canonical IDs and joined data
      await this.loadSolicitudes();
      // Ensure consecutivo is recalculated after the fresh data is loaded
      try { this.computeNextSolicitudConsecutivo(); } catch (e) { console.warn('Error computing consecutivo after createSolicitud load', e); }
      // Try to locate the created solicitud. Prefer ID from response, otherwise match by client + nombre_muestra + fecha_solicitud
      let created = null;
      const nidFromResp = Number(nuevo?.solicitud_id ?? nuevo?.id_solicitud ?? nuevo?.id ?? nuevo?.insertId ?? 0);
      if (nidFromResp) {
        created = (this.solicitudes() || []).find(s => Number(s.solicitud_id) === nidFromResp);
      }
      if (!created) {
        const candidates = (this.solicitudes() || []).filter(s => {
          return Number(s.id_cliente || s.id_cliente) === Number(body.id_cliente) &&
                 ((s.nombre_muestra || '').trim() === (body.nombre_muestra || '').trim());
        });
        if (candidates.length) {
          // pick the one with highest solicitud_id
          created = candidates.reduce((a, b) => (Number(a.solicitud_id || 0) > Number(b.solicitud_id || 0) ? a : b));
        }
      }

      // Update filtered list and expand created card
      this.filtrarSolicitudes();
      if (created) {
        const nid = Number(created.solicitud_id || created.id_solicitud || 0);
        if (nid) {
          this.solicitudExpandida = nid;
          this.activeSolicitudTab[nid] = 'detalle';
        }
      }

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

      const ofertaId = Number(this.ofertaSolicitudId);
      if (isNaN(ofertaId) || ofertaId <= 0) {
        this.snackbarService.warn('Selecciona una solicitud válida antes de registrar la oferta');
        return;
      }

      await this.solicitudesService.upsertOferta(ofertaId, body);

      this.snackbarService.success('✅ Oferta registrada exitosamente');
      this.ofertaErrors = {};

      this.limpiarFormularioOferta();

      // Refresh solicitudes and expand the oferta tab for the affected solicitud
      await this.loadSolicitudes();
      this.filtrarSolicitudes();
      const created = (this.solicitudes() || []).find(s => Number(s.solicitud_id) === Number(ofertaId));
      if (created) {
        const nid = Number(created.solicitud_id || created.id_solicitud || 0);
        if (nid) {
          this.solicitudExpandida = nid;
          this.activeSolicitudTab[nid] = 'oferta';
          this.selectedSolicitud.set(created);
        }
      }

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
        fecha_limite_entrega: this.resultadoFechaLimite,
        fecha_envio_resultados: this.resultadoFechaEnvio,
        servicio_es_viable: this.resultadoServicioViable ? 1 : 0
      };

      await this.solicitudesService.upsertRevision(Number(this.resultadoSolicitudId), body);

      this.snackbarService.success('✅ Resultados registrados exitosamente');
      this.resultadoErrors = {};

      // Optimistic UX: expand card and show 'revision' tab with fresh data
      const sid = Number(this.resultadoSolicitudId);
      if (sid) {
        this.activeSolicitudTab[sid] = 'revision';
        this.solicitudExpandida = sid;
        this.filtrarSolicitudes();
      }

      this.limpiarFormularioResultado();

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
        fecha_encuesta: this.encuestaFecha,
        comentarios: this.encuestaComentarios || null,
        // recomendaria_servicio: this.encuestaRecomendaria,
        fecha_realizacion_encuesta: this.encuestaFechaRealizacion || null,
        cliente_respondio: this.encuestaClienteRespondio,
        solicito_nueva_encuesta: this.encuestaSolicitoNueva
      };

      await this.solicitudesService.upsertSeguimientoEncuesta(Number(this.encuestaSolicitudId), body);

      this.snackbarService.success('✅ Encuesta registrada exitosamente');
      this.encuestaErrors = {};

      // Optimistic UX: expand card and show 'encuesta' tab with fresh data
      const sid = Number(this.encuestaSolicitudId);
      if (sid) {
        this.activeSolicitudTab[sid] = 'encuesta';
        this.solicitudExpandida = sid;
        this.filtrarSolicitudes();
      }

      this.limpiarFormularioEncuesta();

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
      try {
        const next = this.clientesFiltrados().filter(c => Number(c.id_cliente || c.id || c.cliente_id) !== Number(id));
        this.clientesFiltrados.set(next);
      } catch (e) { console.warn('Error actualizando clientesFiltrados tras deleteCliente', e); }
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
      try {
        const next = this.solicitudesFiltradas().filter(s => Number(s.solicitud_id || s.id_solicitud || s.id) !== Number(id));
        this.solicitudesFiltradas.set(next);
      } catch (e) { console.warn('Error actualizando solicitudesFiltradas tras deleteSolicitud', e); }
      try { this.computeNextSolicitudConsecutivo(); } catch (e) { console.warn('Error computing consecutivo after delete', e); }
    } catch (err: any) {
      console.error('deleteSolicitud', err);
      this.manejarError(err, 'eliminar solicitud');
    }
  }

  // ========== MÉTODOS AUXILIARES PARA MANEJO DE ERRORES ==========
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
    // Reset to empty string so the <select> shows the placeholder option (value="").
    this.solicitudClienteId = '';
    this.solicitudNombre = '';
    this.solicitudTipo = '';
    this.solicitudLote = '';
    this.solicitudFechaVenc = '';
    this.solicitudFechaSolicitud = '';
    this.solicitudTipoMuestra = '';
    this.solicitudCondEmpaque = '';
    this.solicitudTipoAnalisis = '';
    this.solicitudRequiereVarios = false;
    this.solicitudCantidad = null;
    this.solicitudFechaEstimada = '';
    this.solicitudPuedeSuministrar = false;
    this.solicitudServicioViable = false;
    this.solicitudRecibida = '';
    this.solicitudRecibePersonal = '';
    this.solicitudCargoPersonal = '';
    this.solicitudObservaciones = '';
    this.computeNextSolicitudConsecutivo();
  }

  private limpiarFormularioOferta(): void {
    this.ofertaSolicitudId = null;
    this.ofertaGeneroCotizacion = false;
    this.ofertaValor = null;
    this.ofertaFechaEnvio = '';
    this.ofertaRealizoSeguimiento = false;
    this.ofertaObservacion = '';
    this.ofertaValorDisplay = '';
  }

  private limpiarFormularioResultado(): void {
    // Reset to empty string so the select shows its placeholder option
    this.resultadoSolicitudId = '';
    this.resultadoFechaLimite = '';
    this.resultadoFechaEnvio = '';
    this.resultadoServicioViable = false;
  }

  private limpiarFormularioEncuesta(): void {
    this.encuestaSolicitudId = null;
    this.encuestaFecha = '';
    this.encuestaPuntuacion = null;
    this.encuestaComentarios = '';
    // this.encuestaRecomendaria = false;
    this.encuestaFechaRealizacion = '';
    this.encuestaClienteRespondio = false;
    this.encuestaSolicitoNueva = false;
  }

  // ========== MÉTODOS UI ==========
  canDelete(): boolean {
    return this.utilsService.canDelete();
  }

  toggleClienteDetails(id: number): void {
    this.detallesVisibles[id] = !this.detallesVisibles[id];
    if (this.detallesVisibles[id]) {
      const c = (this.clientes() || []).find(x => Number(x.id_cliente) === Number(id));
      if (c) this.selectedCliente.set(c);
    }
  }

  toggleExpandSolicitud(s: any): void {
    const key = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
    if (!key) return;
    
    this.solicitudExpandida = this.solicitudExpandida === key ? null : key;
    
    if (this.solicitudExpandida === key && !this.activeSolicitudTab[key]) {
      this.activeSolicitudTab[key] = 'detalle';
    }
    
    // Debug para verificar datos
    console.log('=== DEBUG Solicitud Expandida ===');
    console.log('ID:', key);
    console.log('Datos completos:', s);
    console.log('Campos de oferta:', {
      genero_cotizacion: s?.genero_cotizacion,
      valor_cotizacion: s?.valor_cotizacion,
      fecha_envio_oferta: s?.fecha_envio_oferta,
      realizo_seguimiento_oferta: s?.realizo_seguimiento_oferta,
      observacion_oferta: s?.observacion_oferta
    });
    console.log('Campos de revisión:', {
      fecha_limite_entrega: s?.fecha_limite_entrega,
      fecha_envio_resultados: s?.fecha_envio_resultados,
      servicio_es_viable: s?.servicio_es_viable
    });
    console.log('Campos de encuesta:', {
      fecha_encuesta: s?.fecha_encuesta,
      comentarios: s?.comentarios,
      recomendaria_servicio: s?.recomendaria_servicio,
      cliente_respondio: s?.cliente_respondio,
      solicito_nueva_encuesta: s?.solicito_nueva_encuesta
    });
    console.log('=== FIN DEBUG ===');
    // set selected solicitud for reactive forms/cards
    this.selectedSolicitud.set(s || null);
  }

  isSolicitudExpanded(s: any): boolean {
    const key = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
    return key ? this.solicitudExpandida === key : false;
  }

  selectSolicitudTab(id: number, tabKey: string): void {
    this.activeSolicitudTab[id] = tabKey;
  }

  // ========== EDITAR TARJETAS ==========
  editSolicitud(s: any): void {
    const sid = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
    if (!sid) return;
    this.solicitudExpandida = sid;
    this.activeSolicitudTab[sid] = this.activeSolicitudTab[sid] || 'detalle';
    this.snackbarService.info('Edita los campos desde las pestañas');
  }

  editCliente(u: any): void {
    const cid = Number(u?.id_cliente ?? 0);
    if (!cid) return;
    // Toggle details open for inline editing in the card grid
    this.detallesVisibles[cid] = true;
    this.snackbarService.info('Edita los campos del cliente en el panel');
    // Open modal with prefilled data
    this.editClienteModalOpen = true;
    this.editClienteId = cid;
    this.editClienteNombre = u?.nombre_solicitante || '';
    this.editClienteCorreo = u?.correo_electronico || '';
    this.editClienteCelular = u?.celular || '';
    this.editClienteTelefono = u?.telefono || '';
    this.editClienteDireccion = u?.direccion || '';
    this.editClienteDep = String(u?.id_departamento || u?.departamento_codigo || '');
    this.editClienteCiudad = String(u?.id_ciudad || u?.ciudad_codigo || '');
    this.editClienteRazonSocial = u?.razon_social || '';
    this.editClienteNit = u?.nit || '';
    this.editClienteTipoUsuario = u?.tipo_usuario || '';
    this.editClienteTipoId = u?.tipo_identificacion || '';
    this.editClienteNumeroIdentificacion = u?.numero_identificacion || '';
    this.editClienteSexo = u?.sexo || '';
    this.editClienteTipoPobl = u?.tipo_poblacion || '';
    this.editClienteFechaVinculacion = this.toDateInput(u?.fecha_vinculacion);
    this.editClienteTipoVinculacion = u?.tipo_vinculacion || '';
    this.editClienteRegistroPor = u?.registro_realizado_por || '';
    this.editClienteObservaciones = u?.observaciones || '';
    // set reactive selected cliente
    this.selectedCliente.set(u);
  }

  // Normaliza valores de fecha a formato input date (YYYY-MM-DD)
  private toDateInput(v: any): string {
    if (!v) return '';
    try {
      // Si viene como Date o timestamp
      if (v instanceof Date) {
        const yyyy = v.getFullYear();
        const mm = String(v.getMonth() + 1).padStart(2, '0');
        const dd = String(v.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const s = String(v);
      // Si viene como ISO, tomar primeros 10 caracteres
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        return s.slice(0, 10);
      }
      // Intentar parsear
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return '';
    } catch {
      return '';
    }
  }

  // ======= Estado modal de edición de cliente =======
  editClienteModalOpen = false;
  editClienteId: number | null = null;
  editClienteNombre = '';
  editClienteCorreo = '';
  editClienteCelular = '';
  editClienteTelefono = '';
  editClienteDireccion = '';
  editClienteDep = '';
  editClienteCiudad = '';
  editClienteRazonSocial = '';
  editClienteNit = '';
  editClienteTipoUsuario = '';
  editClienteTipoId = '';
  editClienteNumeroIdentificacion = '';
  editClienteSexo = '';
  editClienteTipoPobl = '';
  editClienteFechaVinculacion = '';
  editClienteTipoVinculacion = '';
  editClienteRegistroPor = '';
  editClienteObservaciones = '';

  closeEditClienteModal(): void {
    this.editClienteModalOpen = false;
    this.editClienteId = null;
  }

  async onEditDepChange(): Promise<void> {
    try {
      await this.locationsService.loadCiudades(this.editClienteDep);
    } catch (err: any) {
      console.warn('onEditDepChange: error cargando ciudades', err);
    }
  }

  async saveEditCliente(): Promise<void> {
    if (!this.editClienteId) return;
    const body = {
      nombre_solicitante: this.editClienteNombre,
      correo_electronico: this.editClienteCorreo,
      celular: this.editClienteCelular || null,
      telefono: this.editClienteTelefono || null,
      direccion: this.editClienteDireccion || null,
      id_departamento: this.editClienteDep || null,
      id_ciudad: this.editClienteCiudad || null,
      razon_social: this.editClienteRazonSocial || null,
      nit: this.editClienteNit || null,
      tipo_usuario: this.editClienteTipoUsuario || null,
      tipo_identificacion: this.editClienteTipoId || null,
      numero_identificacion: this.editClienteNumeroIdentificacion || null,
      sexo: this.editClienteSexo || null,
      tipo_poblacion: this.editClienteTipoPobl || null,
      fecha_vinculacion: this.editClienteFechaVinculacion || null,
      tipo_vinculacion: this.editClienteTipoVinculacion || null,
      registro_realizado_por: this.editClienteRegistroPor || null,
      observaciones: this.editClienteObservaciones || null
    };
    try {
      await this.clientesService.updateCliente(this.editClienteId, body);
      this.snackbarService.success('✅ Cliente actualizado');
      this.closeEditClienteModal();
    } catch (err: any) {
      console.error('saveEditCliente', err);
      this.manejarError(err, 'actualizar cliente');
    }
  }

  // ======= Estado modal de edición de solicitud =======
  editSolicitudModalOpen = false;
  // When true the modal is playing the closing animation but remains in DOM
  editSolicitudModalClosing = false;
  editSolicitudId: number | null = null;
  editSolicitudNombreMuestra = '';
  editSolicitudTipo = '';
  editSolicitudFechaSolicitud = '';
  editSolicitudFechaVenc = '';
  // Additional solicitud fields
  editSolicitudLote = '';
  editSolicitudTipoMuestra = '';
  editSolicitudTipoEmpaque = '';
  editSolicitudAnalisisRequerido = '';
  editSolicitudReqAnalisis: any = null;
  editSolicitudCantMuestras: number | null = null;
  editSolicitudSolicitudRecibida = '';
  editSolicitudFechaEntrega = '';
  editSolicitudRecibePersonal = '';
  editSolicitudCargoPersonal = '';
  editSolicitudObservaciones = '';
  // Tabs state for solicitud edit modal
  editSolicitudActiveTab: 'solicitud' | 'oferta' | 'revision' | 'encuesta' = 'solicitud';

  // Oferta fields
  editOfertaGeneroCotizacion: any = null;
  editOfertaValorCotizacion: any = null;
  editOfertaFechaEnvio: string = '';
  editOfertaRealizoSeguimiento: any = null;
  editOfertaObservacion: string = '';

  // Revision fields
  editRevisionFechaLimite: string = '';
  editRevisionFechaEnvio: string = '';
  editRevisionServicioViable: any = null;

  // Encuesta fields
  editEncuestaFecha: string = '';
  editEncuestaComentarios: string = '';
  // editEncuestaRecomendaria: any = null;
  editEncuestaFechaRealizacion: string = '';
  editEncuestaClienteRespondio: any = null;
  editEncuestaSolicitoNueva: any = null;

  editSolicitudOpen(s: any): void {
    const sid = Number(s?.solicitud_id ?? s?.id_solicitud ?? 0);
    if (!sid) return;
    // If we were in a closing animation, cancel it and open immediately
    this.editSolicitudModalClosing = false;
    this.editSolicitudModalOpen = true;
    this.editSolicitudId = sid;
    this.editSolicitudNombreMuestra = s?.nombre_muestra || '';
    this.editSolicitudTipo = s?.tipo_solicitud || '';
    this.editSolicitudFechaSolicitud = this.toDateInput(s?.fecha_solicitud);
    this.editSolicitudFechaVenc = this.toDateInput(s?.fecha_vencimiento_muestra);
    // additional solicitud prefill
    this.editSolicitudLote = s?.lote_producto || '';
    this.editSolicitudTipoMuestra = s?.tipo_muestra || '';
    this.editSolicitudTipoEmpaque = s?.tipo_empaque || '';
    this.editSolicitudAnalisisRequerido = s?.analisis_requerido || '';
    this.editSolicitudReqAnalisis = s?.req_analisis === null ? null : (s?.req_analisis ? true : false);
    this.editSolicitudCantMuestras = s?.cant_muestras ?? null;
    this.editSolicitudSolicitudRecibida = s?.solicitud_recibida || '';
    this.editSolicitudFechaEntrega = this.toDateInput(s?.fecha_entrega_muestra);
    this.editSolicitudRecibePersonal = s?.recibe_personal || '';
    this.editSolicitudCargoPersonal = s?.cargo_personal || '';
    this.editSolicitudObservaciones = s?.observaciones || '';
    // reset tab
    this.editSolicitudActiveTab = 'solicitud';

    // Prefill oferta
    this.editOfertaGeneroCotizacion = s?.genero_cotizacion === null ? null : (s?.genero_cotizacion ? true : false);
    this.editOfertaValorCotizacion = s?.valor_cotizacion ?? null;
    this.editOfertaFechaEnvio = this.toDateInput(s?.fecha_envio_oferta);
    this.editOfertaRealizoSeguimiento = s?.realizo_seguimiento_oferta === null ? null : (s?.realizo_seguimiento_oferta ? true : false);
    this.editOfertaObservacion = s?.observacion_oferta || '';

    // Prefill revision
    this.editRevisionFechaLimite = this.toDateInput(s?.fecha_limite_entrega);
    this.editRevisionFechaEnvio = this.toDateInput(s?.fecha_envio_resultados);
    this.editRevisionServicioViable = s?.servicio_es_viable === null ? null : (s?.servicio_es_viable ? true : false);

    // Prefill encuesta
    this.editEncuestaFecha = this.toDateInput(s?.fecha_encuesta);
    this.editEncuestaComentarios = s?.comentarios || '';
    // this.editEncuestaRecomendaria = s?.recomendaria_servicio === null ? null : (s?.recomendaria_servicio ? true : false);
    this.editEncuestaFechaRealizacion = this.toDateInput(s?.fecha_realizacion_encuesta);
    this.editEncuestaClienteRespondio = s?.cliente_respondio === null ? null : (s?.cliente_respondio ? true : false);
    this.editEncuestaSolicitoNueva = s?.solicito_nueva_encuesta === null ? null : (s?.solicito_nueva_encuesta ? true : false);
    // set reactive selected solicitud
    this.selectedSolicitud.set(s);
  }

  // When user chooses a client in the create-solicitud select, update selectedCliente signal
  onSelectSolicitudCliente(value: any): void {
    try {
      const id = Number(value);
      const found = (this.clientes() || []).find(c => Number(c.id_cliente) === id);
      if (found) this.selectedCliente.set(found);
    } catch (err) { /* ignore */ }
  }

  // When user chooses a solicitud in oferta/result/encuesta selects, update selectedSolicitud signal
  onSelectSolicitudOferta(value: any): void {
    try {
      const id = Number(value);
      const found = (this.solicitudes() || []).find(s => Number(s.solicitud_id) === id || Number(s.id_solicitud) === id);
      if (found) this.selectedSolicitud.set(found);
    } catch (err) { /* ignore */ }
  }

  closeEditSolicitudModal(): void {
    // Play a smooth close animation before actually removing modal from DOM.
    if (!this.editSolicitudModalOpen || this.editSolicitudModalClosing) {
      // already closed or closing
      return;
    }
    this.editSolicitudModalClosing = true;
    // Delay should match CSS transition duration (200ms)
    setTimeout(() => {
      this.editSolicitudModalClosing = false;
      this.editSolicitudModalOpen = false;
      this.editSolicitudId = null;
    }, 220);
  }

  async saveEditSolicitud(): Promise<void> {
    if (!this.editSolicitudId) return;
    const body: any = {
      nombre_muestra: this.editSolicitudNombreMuestra,
      tipo_solicitud: this.editSolicitudTipo,
      lote_producto: this.editSolicitudLote || null,
      fecha_solicitud: this.editSolicitudFechaSolicitud || null,
      fecha_vencimiento_muestra: this.editSolicitudFechaVenc || null,
      tipo_muestra: this.editSolicitudTipoMuestra || null,
      tipo_empaque: this.editSolicitudTipoEmpaque || null,
      analisis_requerido: this.editSolicitudAnalisisRequerido || null,
      req_analisis: this.editSolicitudReqAnalisis === null ? null : (this.editSolicitudReqAnalisis ? 1 : 0),
      cant_muestras: this.editSolicitudCantMuestras ?? null,
      fecha_entrega_muestra: this.editSolicitudFechaEntrega || null,
      solicitud_recibida: this.editSolicitudSolicitudRecibida || null,
      recibe_personal: this.editSolicitudRecibePersonal || null,
      cargo_personal: this.editSolicitudCargoPersonal || null,
      observaciones: this.editSolicitudObservaciones || null
    };
    try {
      await this.solicitudesService.updateSolicitud(this.editSolicitudId, body);
      this.snackbarService.success('✅ Solicitud actualizada');
      this.closeEditSolicitudModal();
      await this.loadSolicitudes();
    } catch (err: any) {
      console.error('saveEditSolicitud', err);
      this.manejarError(err, 'actualizar solicitud');
    }
  }

  // Save oferta tab
  async saveEditOferta(): Promise<void> {
    if (!this.editSolicitudId) return;
    const body: any = {
      genero_cotizacion: this.editOfertaGeneroCotizacion === null ? null : (this.editOfertaGeneroCotizacion ? 1 : 0),
      valor_cotizacion: this.editOfertaValorCotizacion,
      fecha_envio_oferta: this.editOfertaFechaEnvio || null,
      realizo_seguimiento_oferta: this.editOfertaRealizoSeguimiento === null ? null : (this.editOfertaRealizoSeguimiento ? 1 : 0),
      observacion_oferta: this.editOfertaObservacion || null
    };
    try {
      await this.solicitudesService.upsertOferta(Number(this.editSolicitudId), body);
      this.snackbarService.success('✅ Oferta actualizada');
      // refresh local prefill
      await this.loadSolicitudes();
      const updated = (this.solicitudes() || []).find(s => Number(s.solicitud_id) === Number(this.editSolicitudId));
      if (updated) this.editSolicitudOpen(updated);
    } catch (err: any) {
      console.error('saveEditOferta', err);
      this.manejarError(err, 'actualizar oferta');
    }
  }

  // Save revision tab
  async saveEditRevision(): Promise<void> {
    if (!this.editSolicitudId) return;
    const body: any = {
      fecha_limite_entrega: this.editRevisionFechaLimite || null,
      fecha_envio_resultados: this.editRevisionFechaEnvio || null,
      servicio_es_viable: this.editRevisionServicioViable === null ? null : (this.editRevisionServicioViable ? 1 : 0)
    };
    try {
      await this.solicitudesService.upsertRevision(Number(this.editSolicitudId), body);
      this.snackbarService.success('✅ Revisión actualizada');
      await this.loadSolicitudes();
      const updated = (this.solicitudes() || []).find(s => Number(s.solicitud_id) === Number(this.editSolicitudId));
      if (updated) this.editSolicitudOpen(updated);
    } catch (err: any) {
      console.error('saveEditRevision', err);
      this.manejarError(err, 'actualizar revisión');
    }
  }

  // Save encuesta tab
  async saveEditEncuesta(): Promise<void> {
    if (!this.editSolicitudId) return;
    const body: any = {
      fecha_encuesta: this.editEncuestaFecha || null,
      comentarios: this.editEncuestaComentarios || null,
      // recomendaria_servicio: this.editEncuestaRecomendaria === null ? null : (this.editEncuestaRecomendaria ? 1 : 0),
      fecha_realizacion_encuesta: this.editEncuestaFechaRealizacion || null,
      cliente_respondio: this.editEncuestaClienteRespondio === null ? null : (this.editEncuestaClienteRespondio ? 1 : 0),
      solicito_nueva_encuesta: this.editEncuestaSolicitoNueva === null ? null : (this.editEncuestaSolicitoNueva ? 1 : 0)
    };
    try {
      await this.solicitudesService.upsertSeguimientoEncuesta(Number(this.editSolicitudId), body);
      this.snackbarService.success('✅ Encuesta actualizada');
      await this.loadSolicitudes();
      const updated = (this.solicitudes() || []).find(s => Number(s.solicitud_id) === Number(this.editSolicitudId));
      if (updated) this.editSolicitudOpen(updated);
    } catch (err: any) {
      console.error('saveEditEncuesta', err);
      this.manejarError(err, 'actualizar encuesta');
    }
  }

  // Save all tabs at once (global save)
  async saveAllEditSolicitud(): Promise<void> {
    if (!this.editSolicitudId) return;
    try {
      // 1) Update main solicitud
      await this.solicitudesService.updateSolicitud(this.editSolicitudId, {
        nombre_muestra: this.editSolicitudNombreMuestra,
        tipo_solicitud: this.editSolicitudTipo,
        lote_producto: this.editSolicitudLote || null,
        fecha_solicitud: this.editSolicitudFechaSolicitud || null,
        fecha_vencimiento_muestra: this.editSolicitudFechaVenc || null,
        tipo_muestra: this.editSolicitudTipoMuestra || null,
        tipo_empaque: this.editSolicitudTipoEmpaque || null,
        analisis_requerido: this.editSolicitudAnalisisRequerido || null,
        req_analisis: this.editSolicitudReqAnalisis === null ? null : (this.editSolicitudReqAnalisis ? 1 : 0),
        cant_muestras: this.editSolicitudCantMuestras ?? null,
        fecha_entrega_muestra: this.editSolicitudFechaEntrega || null,
        solicitud_recibida: this.editSolicitudSolicitudRecibida || null,
        recibe_personal: this.editSolicitudRecibePersonal || null,
        cargo_personal: this.editSolicitudCargoPersonal || null,
        observaciones: this.editSolicitudObservaciones || null
      });

      // 2) Oferta
      await this.solicitudesService.upsertOferta(Number(this.editSolicitudId), {
        genero_cotizacion: this.editOfertaGeneroCotizacion === null ? null : (this.editOfertaGeneroCotizacion ? 1 : 0),
        valor_cotizacion: this.editOfertaValorCotizacion,
        fecha_envio_oferta: this.editOfertaFechaEnvio || null,
        realizo_seguimiento_oferta: this.editOfertaRealizoSeguimiento === null ? null : (this.editOfertaRealizoSeguimiento ? 1 : 0),
        observacion_oferta: this.editOfertaObservacion || null
      });

      // 3) Revision
      await this.solicitudesService.upsertRevision(Number(this.editSolicitudId), {
        fecha_limite_entrega: this.editRevisionFechaLimite || null,
        fecha_envio_resultados: this.editRevisionFechaEnvio || null,
        servicio_es_viable: this.editRevisionServicioViable === null ? null : (this.editRevisionServicioViable ? 1 : 0)
      });

      // 4) Encuesta
      await this.solicitudesService.upsertSeguimientoEncuesta(Number(this.editSolicitudId), {
        fecha_encuesta: this.editEncuestaFecha || null,
        comentarios: this.editEncuestaComentarios || null,
        // recomendaria_servicio: this.editEncuestaRecomendaria === null ? null : (this.editEncuestaRecomendaria ? 1 : 0),
        fecha_realizacion_encuesta: this.editEncuestaFechaRealizacion || null,
        cliente_respondio: this.editEncuestaClienteRespondio === null ? null : (this.editEncuestaClienteRespondio ? 1 : 0),
        solicito_nueva_encuesta: this.editEncuestaSolicitoNueva === null ? null : (this.editEncuestaSolicitoNueva ? 1 : 0)
      });

      // Refresh and close
      await this.loadSolicitudes();
      this.snackbarService.success('✅ Todos los cambios guardados');
      this.closeEditSolicitudModal();
    } catch (err: any) {
      console.error('saveAllEditSolicitud', err);
      this.manejarError(err, 'guardar cambios');
    }
  }

  // Helpers: resolve display names for departamento/ciudad from IDs or codes
  resolveDepartamento(cliente: any): string {
    const nombre = cliente?.departamento;
    if (nombre) return this.formatValue(nombre);
    const codigo = cliente?.id_departamento || cliente?.departamento_codigo;
    const depList = this.departamentos();
    const found = depList.find(d => String(d.codigo) === String(codigo));
    return this.formatValue(found?.nombre) || '—';
  }

  resolveCiudad(cliente: any): string {
    // Try common name keys first
    const nombre = cliente?.ciudad
      || cliente?.ciudad_nombre
      || cliente?.nombre_ciudad
      || cliente?.municipio
      || cliente?.municipio_nombre;
    if (nombre) return this.formatValue(nombre);
    // Try to resolve by code if we have cities loaded
    const codigo = cliente?.id_ciudad || cliente?.ciudad_codigo || cliente?.codigo_ciudad;
    const cityList = this.ciudades();
    if (codigo && Array.isArray(cityList) && cityList.length) {
      const found = cityList.find(c => String(c.codigo) === String(codigo));
      if (found?.nombre) return this.formatValue(found.nombre);
    }
    return '—';
  }

  async copyField(key: string, value: string | null): Promise<void> {
    const ok = await this.utilsService.copyToClipboard(value);
    if (!ok) return;
    this.showToast('Copiado');
  }

  getClienteFieldValue(cliente: any, key: string): string {
    switch (key) {
      case 'nombre_solicitante':
        return this.formatValue(cliente.nombre_solicitante);
      case 'razon_social':
        return this.formatValue(cliente.razon_social);
      case 'fecha_vinculacion':
        return this.formatValue(cliente.fecha_vinculacion);
      case 'tipo_identificacion':
        return this.formatValue(cliente.tipo_identificacion);
      case 'sexo':
        return cliente.sexo || '-';
      case 'tipo_poblacion':
        return cliente.tipo_poblacion || '-';
      case 'direccion':
        return this.formatValue(cliente.direccion);
      case 'ciudad_departamento':
        return `${this.formatValue(cliente.ciudad)} / ${this.formatValue(cliente.departamento)}`;
      case 'telefono_celular':
        return `${this.formatValue(cliente.telefono)} / ${this.formatValue(cliente.celular)}`;
      case 'correo_electronico':
        return this.formatValue(cliente.correo_electronico);
      case 'tipo_vinculacion':
        return this.formatValue(cliente.tipo_vinculacion);
      case 'observaciones':
        return this.formatValue(cliente.observaciones);
      case 'registro_realizado_por':
        return this.formatValue(cliente.registro_realizado_por);
      case 'created_at':
        return this.formatValue(cliente.created_at);
      case 'updated_at':
        return this.formatValue(cliente.updated_at);
      default:
        return this.formatValue(cliente[key]);
    }
  }

  showToast(message: string, ms = 1400): void {
    this.lastCopiedMessage = message;
    setTimeout(() => { this.lastCopiedMessage = null; }, ms);
  }

  formatValue(val: any): string {
    return this.utilsService.formatValue(val);
  }

  formatCurrency(val: any): string {
    return this.utilsService.formatCurrency(val);
  }

  // Indica si la pestaña para una solicitud ya tiene datos completados
  hasTabCompleted(solicitud: any, tabKey: string): boolean {
    if (!solicitud) return false;
    switch ((tabKey || '').toString()) {
      case 'oferta': {
        // Chulo solo cuando el usuario elige SÍ en seguimiento oferta
        return solicitud.realizo_seguimiento_oferta === 1 || solicitud.realizo_seguimiento_oferta === true;
      }
      case 'revision': {
        // Chulo solo cuando el usuario elige SÍ en servicio viable
        return solicitud.servicio_es_viable === 1 || solicitud.servicio_es_viable === true;
      }
      case 'encuesta': {
        // Mantener la lógica existente para encuesta
        if (solicitud.fecha_encuesta) return true;
        if (solicitud.comentarios) return true;
        if (solicitud.recomendaria_servicio === 1 || solicitud.recomendaria_servicio === true) return true;
        if (solicitud.cliente_respondio === 1 || solicitud.cliente_respondio === true) return true;
        if (solicitud.solicito_nueva_encuesta === 1 || solicitud.solicito_nueva_encuesta === true) return true;
        return false;
      }
      default:
        return false;
    }
  }

  onOfertaValorInput(value: string): void {
    // Reject letters immediately: if user types letters, restore previous and show error
    if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(String(value || ''))) {
      this.ofertaValorError = 'Solo se permiten números y separador decimal';
      this.ofertaValorDisplay = this.ofertaValorPrevDisplay;
      return;
    }

    this.ofertaValorError = '';

    // Keep user's raw input in the display while typing to avoid cursor jumps,
    // but enforce a maximum of 13 integer digits and up to 2 decimal digits.
    let raw = String(value || '').replace(/[^0-9,.,-]/g, '').trim();
    // Normalize comma to dot for decimal parsing
    raw = raw.replace(/,/g, '.');

    // Determine last dot as decimal separator (if any)
    const lastDot = raw.lastIndexOf('.');
    let intPart = '';
    let decPart = '';
    if (lastDot === -1) {
      // No decimal separator; remove any stray dots used as thousand separators
      intPart = raw.replace(/\./g, '');
    } else {
      intPart = raw.slice(0, lastDot).replace(/\./g, '');
      decPart = raw.slice(lastDot + 1).replace(/\./g, '');
    }

    // Enforce limits: if exceeded, reject the new input and restore previous valid display
    if (intPart.length > 13 || decPart.length > 2) {
      // Restore previous valid entry (prevent typing extra digits)
      this.ofertaValorError = 'Máx. 13 enteros y 2 decimales';
      this.ofertaValorDisplay = this.ofertaValorPrevDisplay;
      return;
    }

    // Reconstruct normalized value without thousands separators to keep typing stable
    const normalized = decPart ? `${intPart}.${decPart}` : intPart;

    // Update internal numeric value
    if (normalized === '' || normalized === '.') {
      this.ofertaValor = null as any;
      this.ofertaValorDisplay = '';
      this.ofertaValorPrevDisplay = '';
      this.ofertaValorError = '';
    } else {
      const num = Number(normalized);
      this.ofertaValor = isNaN(num) ? null as any : num;
      // Show unformatted numeric string while typing to avoid cursor jumps
      this.ofertaValorDisplay = decPart ? `${intPart}.${decPart}` : intPart;
      this.ofertaValorPrevDisplay = this.ofertaValorDisplay;
      this.ofertaValorError = '';
    }
  }

  onOfertaValorFocus(): void {
    // When focusing, show the raw numeric value (no formatting) to allow smooth editing
    if (this.ofertaValor !== null && this.ofertaValor !== undefined) {
      // Use plain number string without thousands separators
      this.ofertaValorDisplay = String(this.ofertaValor);
    }
  }

  onOfertaValorBlur(): void {
    // When leaving the field, show formatted currency for clarity
    if (this.ofertaValor !== null && this.ofertaValor !== undefined && !isNaN(Number(this.ofertaValor))) {
      this.ofertaValorDisplay = this.formatCurrency(this.ofertaValor);
    } else {
      this.ofertaValorDisplay = '';
    }
  }

  // Control de formularios (mostrar/ocultar desde las tarjetas de acción)
  formularioActivo: string | null = null;

  // Mostrar/ocultar formularios al pulsar las tarjetas de acción
  toggleFormulario(tipo: string) {
    if (this.formularioActivo === tipo) {
      this.formularioActivo = null;
    } else {
      // cerrar cualquiera abierto y abrir el solicitado
      this.formularioActivo = tipo;
    }
  }

  // Auto-resize handler for modal textareas: expand height as user types, up to a limit
  autoResizeTextarea(e: Event): void {
    try {
      const el = e.target as HTMLTextAreaElement | null;
      if (!el) return;
      // reset to auto to correctly measure scrollHeight
      el.style.height = 'auto';
      const scroll = el.scrollHeight;
      const viewportMax = Math.floor(window.innerHeight * 0.6); // up to 60% of viewport
      const newHeight = Math.min(scroll, viewportMax);
      el.style.height = `${newHeight}px`;
    } catch (err) {
      // silent
    }
  }
}