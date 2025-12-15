import { Component, OnInit, signal, ChangeDetectorRef, computed } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { authService, authUser } from '../../services/auth/auth.service';
import { SnackbarService } from '../../shared/snackbar.service';
import { reactivosService } from '../../services/reactivos.service';
import { NumbersOnlyDirective } from '../../directives/numbers-only.directive';
import { LettersOnlyDirective } from '../../directives/letters-only.directive';
import { AlphaNumericDirective } from '../../directives/alpha-numeric.directive';

@Component({
  standalone: true,
  selector: 'app-reactivos',
  templateUrl: './reactivos.component.html',
  styleUrls: ['./reactivos.component.css'],
  imports: [CommonModule, FormsModule, RouterModule, NumbersOnlyDirective, LettersOnlyDirective, AlphaNumericDirective],
})
export class ReactivosComponent implements OnInit {
  public get esAuxiliar(): boolean {
    const user = authUser();
    return user?.rol === 'Auxiliar';
  }

  // Signals separadas para catálogo
  catalogoCompletoSig = signal<Array<any>>([]); // Para códigos consecutivos (siempre todos los reactivos)
  catalogoBaseSig = signal<Array<any>>([]); // Para filtrado y visualización
  reactivosSig = signal<Array<any>>([]);

  // Computed para códigos consecutivos que se actualizan automáticamente
  nextCodigosSig = computed(() => {
    const catalogo = this.catalogoCompletoSig(); // Usar catalogoCompletoSig en lugar de catalogoBaseSig
    const inventario = this.reactivosSig();
    const codigos = [...catalogo, ...inventario].map(r => r.codigo).filter(Boolean);
    
    const maxCodigo = (tipo: string) => {
      const prefix = tipo + '-';
      const nums = codigos
        .filter(c => c && c.startsWith(prefix))
        .map(c => {
          const numStr = c.replace(prefix, '');
          return parseInt(numStr, 10);
        })
        .filter(n => !isNaN(n) && n > 0);
      return nums.length ? Math.max(...nums) : 0;
    };
    
    return {
      S: 'S-' + String(maxCodigo('S') + 1).padStart(3, '0'),
      R: 'R-' + String(maxCodigo('R') + 1).padStart(3, '0'),
      M: 'M-' + String(maxCodigo('M') + 1).padStart(3, '0')
    };
  });

  // Getters para usar en el template
  get nextCodigoS(): string {
    return this.nextCodigosSig().S;
  }

  get nextCodigoR(): string {
    return this.nextCodigosSig().R;
  }

  get nextCodigoM(): string {
    return this.nextCodigosSig().M;
  }

  // Aux lists
  tipos: Array<any> = [];
  clasif: Array<any> = [];
  unidades: Array<any> = [];
  estado: Array<any> = [];
  recipiente: Array<any> = [];
  almacen: Array<any> = [];
  reactivoSeleccionado: any = null;
  mostrarDetalles: boolean = false;
  private expandedLotes = new Set<string>();
  // Control which form is currently active via dashboard action cards
  formularioActivo: string | null = null;
  
  ngOnInit() {
    // Ejecutar inicialización al montar el componente
    this.init();
  }

  // Catálogo form
  catCodigo = '';
  catNombre = '';
  catTipo = '';
  catClasificacion = '';
  catDescripcion = '';
  catalogoMsg = '';
  submittedCatalogo = false;

  // Catálogo búsqueda y selección
  catalogoQ = '';
  // Signals para catálogo
  catalogoResultadosSig = signal<Array<any>>([]);
  catalogoSugerenciasSig = signal<Array<any>>([]);
  catalogoSeleccionado: any = null;
  catalogoCargando: boolean = false;
  // Listas filtradas para selects
  catalogoCodigoResultados: Array<any> = [];
  catalogoNombreResultados: Array<any> = [];
  codigoFiltro: string = '';
  nombreFiltro: string = '';
  // Paginación catálogo
  catalogoVisibleCount: number = 10; // tamaño página frontend respaldo
  catalogoTotal: number = 0;
  catalogoOffset: number = 0; // offset usado en backend
  catalogoDeleting = new Set<string>();
  // Paginación del catálogo removida: siempre mostrar todo

  // Gestión de PDFs
  hojaUrl: string | null = null;
  certUrl: string | null = null;
  hojaFile: File | null = null;
  certFile: File | null = null;
  hojaMsg = '';
  certMsg = '';
  // Files selected when creating/editing a reactivo (SDS / CoA at creation time)
  reactivoSdsFile: File | null = null;
  reactivoCoaFile: File | null = null;

  // Reactivo form
  lote = '';
  codigo = '';
  nombre = '';
  marca = '';
  referencia = '';
  cas = '';
  presentacion: number | null = null;
  presentacion_cant: number | null = null;
  cantidad_total: number | null = null;
  fecha_adquisicion = '';
  fecha_vencimiento = '';
  observaciones = '';

  tipo_id: any = '';
  clasificacion_id: any = '';
  unidad_id: any = '';
  estado_id: any = '';
  almacenamiento_id: any = '';
  tipo_recipiente_id: any = '';

  reactivoMsg = '';
  submittedReactivo = false;
  // Edición de reactivo
  editMode = false;
  editOriginalLote: string | null = null;
  // Modal de edición
  editModalOpen = false;
  editSubmitted = false;
  editFormData: any = {
    loteOriginal: '',
    lote: '', codigo: '', nombre: '', marca: '', referencia: '', cas: '',
    presentacion: null as number | null,
    presentacion_cant: null as number | null,
    cantidad_total: null as number | null,
    fecha_adquisicion: '', fecha_vencimiento: '', observaciones: '',
    tipo_id: '', clasificacion_id: '', unidad_id: '', estado_id: '', almacenamiento_id: '', tipo_recipiente_id: ''
  };

  // Lista de reactivos (signals para refresco inmediato)
  reactivosTotal: number = 0; // total real de reactivos en BD
  allReactivosLoaded: boolean = false; // indica si ya tenemos todo el universo cargado para filtros locales
  reactivosPageSize: number = 10; // tamaño de página inicial para inventario
  // Filtros de inventario (3 campos en una fila)
  reactivosLoteQ = '';
  reactivosCodigoQ = '';
  reactivosNombreQ = '';
  reactivosFiltradosSig = signal<Array<any>>([]);
  reactivosQ = '';

  catalogoErrors: { [key: string]: string } = {};
reactivoErrors: { [key: string]: string } = {};
  // Panel de catálogo dentro del formulario (se mantiene para autocompletar)
  mostrarCatalogoFormPanel: boolean = false; // deprecado visualmente
  private catalogoDebounce: any = null;
  catalogoFiltroCampo: 'codigo' | 'nombre' | 'mixto' = 'mixto';
  isCodigoFocused: boolean = false;
  isNombreFocused: boolean = false;

  // Estado de disponibilidad de PDFs por código (catálogo)
  pdfStatus: { [codigo: string]: { hoja: boolean | null; cert: boolean | null } } = {};
  // Estado de disponibilidad de PDFs por reactivo (lote) con Signals para refresco inmediato en UI
  reactivoPdfStatusSig = signal<{ [lote: string]: { hoja: boolean | null; cert: boolean | null } }>({});
  // Toast ephemeral message (used instead of catalogoMsg for uploads)
  toastMsg: string = '';
  private toastTimeout: any = null;
  // Helper para actualizar estado PDF y forzar cambio de referencia
  private setPdfStatus(codigo: string, changes: Partial<{ hoja: boolean | null; cert: boolean | null }>) {
    const prev = this.pdfStatus[codigo] || { hoja: null, cert: null };
    this.pdfStatus = { ...this.pdfStatus, [codigo]: { ...prev, ...changes } };
    this.persistPdfStatus();
    // Force change detection so badges update as soon as status changes
    try { this.cdr.detectChanges(); } catch (e) { /* non-fatal */ }
  }

  private setReactivoPdfStatus(lote: string, changes: Partial<{ hoja: boolean | null; cert: boolean | null }>) {
    this.reactivoPdfStatusSig.update(state => {
      const prev = state[lote] || { hoja: null, cert: null };
      return { ...state, [lote]: { ...prev, ...changes } };
    });
    this.persistReactivoPdfStatus();
  }

  private showToast(msg: string, duration = 3000) {
    // Clear existing
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    this.toastMsg = msg;
    try { this.cdr.detectChanges(); } catch (e) {}
    this.toastTimeout = setTimeout(() => {
      this.toastMsg = '';
      try { this.cdr.detectChanges(); } catch (e) {}
      this.toastTimeout = null;
    }, duration);
  }

  constructor(private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef, public snack: SnackbarService) {}

  toggleFormulario(tipo: string) {
    this.formularioActivo = this.formularioActivo === tipo ? null : tipo;
    try { this.cdr.detectChanges(); } catch (e) { /* ignore */ }
  }

  async init() {
    try {
      // Restaurar cache pdfStatus si existe
      try {
        const cache = sessionStorage.getItem('pdfStatusCache');
        if (cache) {
          this.pdfStatus = JSON.parse(cache);
        }
      } catch {}
      try {
        const cacheR = sessionStorage.getItem('reactivoPdfStatusCache');
        if (cacheR) {
          this.reactivoPdfStatusSig.set(JSON.parse(cacheR));
        }
      } catch {}
      // Cargar auxiliares y catálogo en paralelo para reducir tiempo de espera perceptual
      this.catalogoCargando = true;
      await this.loadAux();
      await this.loadReactivos(10, 0);
      await this.loadCatalogoInicial();
      // Asegurar re-render de tarjetas una vez que auxiliares y reactivos estén listos
      // Esto fuerza a recalcular nombres (tipo/unidad/estado/SGA) y evita depender de un clic
      this.aplicarFiltroReactivos();
      // Guardar cache inicial tras carga
      this.persistPdfStatus();
      this.persistReactivoPdfStatus();
    } catch (err) {
      console.error('Error inicializando Reactivos:', err);
    }
  }

  // Convierte distintos formatos de fecha a 'yyyy-MM-dd' para inputs type="date"
  private toDateInputValue(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') {
      const s = v.trim();
      // ISO o 'yyyy-MM-dd...' -> tomar primeros 10
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      // 'dd-mm-yyyy' -> reordenar a 'yyyy-MM-dd'
      const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
      }
      // Intentar parseo general
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return '';
    }
    try {
      const d = v instanceof Date ? v : new Date(v);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
    return '';
  }

  // Normalización reutilizable de CAS: recorta, mapea guiones unicode a '-', elimina espacios, deja solo dígitos y '-', colapsa guiones múltiples y auto-formatea a A-B-C (2-7 | 2 | 1)
  private normalizeCas(v: any): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v);
    // Reemplazar espacios no separables por espacios normales y recortar
    const trimmed = s.replace(/\u00A0/g, ' ').trim();
    if (!trimmed) return null;
    // Mapear diferentes tipos de guiones a '-'
    const dashNormalized = trimmed.replace(/[\u2010-\u2015\u2212]/g, '-');
    // Eliminar espacios alrededor de guiones y dentro del string
    const noSpaces = dashNormalized.replace(/\s+/g, '');
    // Dejar solo dígitos o '-'
    const digitsAndDash = noSpaces.replace(/[^0-9-]/g, '');
    // Colapsar múltiples guiones
    const compact = digitsAndDash.replace(/-+/g, '-');
    // Construir versión con solo dígitos
    const digitsOnly = compact.replace(/-/g, '');
    // Si parece un CAS válido (5 a 10 dígitos), auto-formatear: A-B-C, donde C=1 dígito, B=2 dígitos, A=resto
    if (digitsOnly.length >= 5 && digitsOnly.length <= 10) {
      const len = digitsOnly.length;
      const a = digitsOnly.slice(0, len - 3);
      const b = digitsOnly.slice(len - 3, len - 1);
      const c = digitsOnly.slice(len - 1);
      return `${a}-${b}-${c}`;
    }
    return compact;
  }

  // Limpia el CAS del modal al perder foco para evitar falsos inválidos visuales
  onEditCasBlur() {
    const n = this.normalizeCas(this.editFormData.cas);
    this.editFormData.cas = n === null ? '' : n;
  }

  // Limpia el CAS del formulario principal al perder foco
  onCasBlur() {
    const n = this.normalizeCas(this.cas);
    this.cas = n === null ? '' : n;
  }

  async loadAux() {
    const data = await reactivosService.aux();
    this.tipos = data.tipos || [];
    this.clasif = data.clasif || [];
    this.unidades = data.unidades || [];
    this.estado = data.estado || [];
    this.recipiente = data.recipiente || [];
    this.almacen = data.almacen || [];
  }

  async loadReactivos(limit?: number, offset?: number) {
    const resp = await reactivosService.listarReactivos(this.reactivosQ || '', limit, offset);
    let rows: any[] = [];
    if (Array.isArray(resp)) {
      rows = resp;
      this.reactivosTotal = resp.length;
    } else {
      rows = resp.rows || [];
      this.reactivosTotal = resp.total || rows.length;
    }
    this.reactivosSig.set(rows || []);
    this.aplicarFiltroReactivos();
    // Preload PDF availability for items in inventory (by lote)
    try { this.preloadDocsForReactivosVisible(this.reactivosSig()); } catch (e) { /* non-fatal */ }

    // Fallback: si el total coincide artificialmente con el tamaño de página y limit se pidió, obtener total real
    if (limit && limit > 0 && this.reactivosTotal === rows.length) {
      try {
        const t = await reactivosService.totalReactivos();
        if (t && typeof t.total === 'number' && t.total >= rows.length) {
          this.reactivosTotal = t.total;
        }
      } catch (e) {
        // silencioso: mantener valor existente
      }
    }
    // Marcar si ya tenemos todo (cuando la cantidad cargada alcanza el total estimado)
    // Actualizar bandera de universo cargado según el contexto (limit 0 => todo cargado)
    if (!limit || limit === 0) {
      this.allReactivosLoaded = true;
    } else {
      this.allReactivosLoaded = this.reactivosSig().length >= this.reactivosTotal;
    }
  }

  async buscarCatalogo() {
    const q = this.normalizarTexto(this.catalogoQ || '');
    if (!this.catalogoBaseSig().length) {
      await this.cargarCatalogoBase();
    }
    // Importante: no tocar catalogoCargando aquí para no afectar la lista de catálogo
    if (!q) {
      this.catalogoSugerenciasSig.set([]); // sólo dropdown
    } else {
      const base = this.catalogoBaseSig();
      const filtered = base.filter(c => {
        const cod = this.normalizarTexto(c.codigo || '');
        const nom = this.normalizarTexto(c.nombre || '');
        if (this.catalogoFiltroCampo === 'codigo') return cod.includes(q);
        if (this.catalogoFiltroCampo === 'nombre') return nom.includes(q);
        // mixto
        return cod.includes(q) || nom.includes(q);
      });
      this.catalogoSugerenciasSig.set(filtered);
    }
  }

  async cargarCatalogoBase() {
    try {
      // Traer todo (sin límite) para que los filtros y sugerencias funcionen sobre el universo completo
      const resp = await reactivosService.buscarCatalogo('', 0, 0);
      const base = Array.isArray(resp) ? resp : (resp.rows || []);
      
      // Actualizar ambas signals
      this.catalogoCompletoSig.set(base); // Para códigos consecutivos
      this.catalogoBaseSig.set(base);     // Para filtrado
      
      this.catalogoTotal = Array.isArray(resp) ? resp.length : (resp.total || base.length);
      // Mostrar solo los primeros N en el catálogo (independiente del dropdown)
      this.catalogoResultadosSig.set(base.slice(0, this.catalogoVisibleCount));
      this.catalogoCodigoResultados = this.catalogoBaseSig().slice();
      this.catalogoNombreResultados = this.catalogoBaseSig().slice();
      // Pre-cargar disponibilidad de PDFs para los visibles iniciales
      this.preloadDocsForVisible();
    } catch (e) {
      console.error('Error cargando catálogo inicial', e);
      this.catalogoMsg = 'Error cargando catálogo';
      this.catalogoCompletoSig.set([]);
      this.catalogoBaseSig.set([]);
      this.catalogoResultadosSig.set([]);
      this.catalogoTotal = 0;
    }
  }

  async loadCatalogoInicial() {
    this.catalogoOffset = 0;
    this.catalogoVisibleCount = 10;
    this.codigoFiltro = '';
    this.nombreFiltro = '';
    try {
      await this.cargarCatalogoBase();
    } finally {
      this.catalogoCargando = false;
    }
  }

  // Método para validar catálogo (siguiendo el patrón de validarCliente)
validarCatalogo(): boolean {
  this.catalogoErrors = {};
  let isValid = true;

  // Validación de código (OBLIGATORIO)
  if (!this.catCodigo?.trim()) {
    this.catalogoErrors['codigo'] = 'El código es obligatorio';
    isValid = false;
  }

  // Validación de nombre (OBLIGATORIO)
  if (!this.catNombre?.trim()) {
    this.catalogoErrors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (this.catNombre.length > 100) {
    this.catalogoErrors['nombre'] = 'El nombre no puede exceder 100 caracteres';
    isValid = false;
  }

  // Validación de tipo (OBLIGATORIO)
  if (!this.catTipo?.trim()) {
    this.catalogoErrors['tipo'] = 'El tipo de reactivo es obligatorio';
    isValid = false;
  }

  // Validación de clasificación (OBLIGATORIO)
  if (!this.catClasificacion?.trim()) {
    this.catalogoErrors['clasificacion'] = 'La clasificación SGA es obligatoria';
    isValid = false;
  }

  return isValid;
}

// Método para validar reactivo (siguiendo el patrón de validarSolicitud)
validarReactivo(): boolean {
  this.reactivoErrors = {};
  let isValid = true;

  // Validación de lote (OBLIGATORIO)
  if (!this.lote?.trim()) {
    this.reactivoErrors['lote'] = 'El lote es obligatorio';
    isValid = false;
  } else if (!/^[A-Z0-9\-]{3,20}$/.test(this.lote)) {
    this.reactivoErrors['lote'] = 'Formato de lote inválido (3-20 caracteres alfanuméricos)';
    isValid = false;
  }

  // Validación de código (OBLIGATORIO)
  if (!this.codigo?.trim()) {
    this.reactivoErrors['codigo'] = 'El código es obligatorio';
    isValid = false;
  } else if (this.codigo.length > 50) {
    this.reactivoErrors['codigo'] = 'El código no puede exceder 50 caracteres';
    isValid = false;
  }

  // Validación de nombre (OBLIGATORIO)
  if (!this.nombre?.trim()) {
    this.reactivoErrors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (this.nombre.length > 200) {
    this.reactivoErrors['nombre'] = 'El nombre no puede exceder 200 caracteres';
    isValid = false;
  }

  // Validación de marca (OBLIGATORIO)
  if (!this.marca?.trim()) {
    this.reactivoErrors['marca'] = 'La marca es obligatoria';
    isValid = false;
  } else if (this.marca.length > 100) {
    this.reactivoErrors['marca'] = 'La marca no puede exceder 100 caracteres';
    isValid = false;
  }

  // Validación de referencia (OBLIGATORIO)
  if (!this.referencia?.trim()) {
    this.reactivoErrors['referencia'] = 'La referencia es obligatoria';
    isValid = false;
  } else if (this.referencia.length > 100) {
    this.reactivoErrors['referencia'] = 'La referencia no puede exceder 100 caracteres';
    isValid = false;
  }

  // Validación de CAS (OBLIGATORIO - ya tienes validación de patrón)
  if (!this.cas?.trim()) {
    this.reactivoErrors['cas'] = 'El número CAS es obligatorio';
    isValid = false;
  } else if (!/^\d{1,7}-\d{2}-\d{1}$/.test(this.cas)) {
    this.reactivoErrors['cas'] = 'Formato CAS inválido (ej: 64-17-5)';
    isValid = false;
  }

  // Validación de presentación (OBLIGATORIO)
  if (this.presentacion === null || this.presentacion === undefined) {
    this.reactivoErrors['presentacion'] = 'La presentación es obligatoria';
    isValid = false;
  } else if (this.presentacion < 0) {
    this.reactivoErrors['presentacion'] = 'La presentación no puede ser negativa';
    isValid = false;
  }

  // Validación de unidad (OBLIGATORIO)
  if (!this.unidad_id) {
    this.reactivoErrors['unidad_id'] = 'La unidad es obligatoria';
    isValid = false;
  }

  // Validación de cantidad por presentación (OBLIGATORIO)
  if (this.presentacion_cant === null || this.presentacion_cant === undefined) {
    this.reactivoErrors['presentacion_cant'] = 'La cantidad por presentación es obligatoria';
    isValid = false;
  } else if (this.presentacion_cant < 0) {
    this.reactivoErrors['presentacion_cant'] = 'La cantidad no puede ser negativa';
    isValid = false;
  }

  // Validación de fecha adquisición (OBLIGATORIO)
  if (!this.fecha_adquisicion) {
    this.reactivoErrors['fecha_adquisicion'] = 'La fecha de adquisición es obligatoria';
    isValid = false;
  } else {
    const fechaAdq = new Date(this.fecha_adquisicion);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (fechaAdq > hoy) {
      this.reactivoErrors['fecha_adquisicion'] = 'La fecha de adquisición no puede ser futura';
      isValid = false;
    }
  }

  // Validación de fecha vencimiento (OBLIGATORIO)
  if (!this.fecha_vencimiento) {
    this.reactivoErrors['fecha_vencimiento'] = 'La fecha de vencimiento es obligatoria';
    isValid = false;
  } else {
    const fechaVenc = new Date(this.fecha_vencimiento);
    const fechaAdq = this.fecha_adquisicion ? new Date(this.fecha_adquisicion) : null;
    
    if (fechaAdq && fechaVenc < fechaAdq) {
      this.reactivoErrors['fecha_vencimiento'] = 'La fecha de vencimiento no puede ser anterior a la adquisición';
      isValid = false;
    }
  }

  // Validación de tipo reactivo (OBLIGATORIO)
  if (!this.tipo_id) {
    this.reactivoErrors['tipo_id'] = 'El tipo de reactivo es obligatorio';
    isValid = false;
  }

  // Validación de clasificación SGA (OBLIGATORIO)
  if (!this.clasificacion_id) {
    this.reactivoErrors['clasificacion_id'] = 'La clasificación SGA es obligatoria';
    isValid = false;
  }

  // Validación de estado (OBLIGATORIO)
  if (!this.estado_id) {
    this.reactivoErrors['estado_id'] = 'El estado es obligatorio';
    isValid = false;
  }

  // Validación de tipo recipiente (OBLIGATORIO)
  if (!this.tipo_recipiente_id) {
    this.reactivoErrors['tipo_recipiente_id'] = 'El tipo de recipiente es obligatorio';
    isValid = false;
  }

  // Validación de almacenamiento (OBLIGATORIO)
  if (!this.almacenamiento_id) {
    this.reactivoErrors['almacenamiento_id'] = 'El almacenamiento es obligatorio';
    isValid = false;
  }

  // Observaciones NO es obligatorio - no se valida

  return isValid;
}

// ===== VALIDACIÓN EN TIEMPO REAL PARA CATÁLOGO =====
validarCampoCatalogoEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorCatalogo(campo);
  this.catalogoErrors[campo] = this.validarCampoCatalogoIndividual(campo, valor);
}

private getValorCatalogo(campo: string): any {
  switch (campo) {
    case 'codigo': return this.catCodigo;
    case 'nombre': return this.catNombre;
    case 'tipo': return this.catTipo;
    case 'clasificacion': return this.catClasificacion;
    case 'descripcion': return this.catDescripcion;
    default: return '';
  }
}

private validarCampoCatalogoIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'codigo':
      if (!valor?.trim()) return 'El código es obligatorio';
      return '';
      
    case 'nombre':
      const nombreStr = (valor ?? '').toString().trim();
      if (!nombreStr) return 'El nombre es obligatorio';
      if (nombreStr.length > 100) return 'El nombre no puede exceder 100 caracteres';
      return '';
      
    case 'tipo':
      if (!valor?.trim()) return 'El tipo de reactivo es obligatorio';
      return '';
      
    case 'clasificacion':
      if (!valor?.trim()) return 'La clasificación SGA es obligatoria';
      return '';
      
    case 'descripcion':
      // NO obligatorio - no hay validación
      return '';
      
    default:
      return '';
  }
}

// ===== VALIDACIÓN EN TIEMPO REAL PARA REACTIVO =====
validarCampoReactivoEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorReactivo(campo);
  this.reactivoErrors[campo] = this.validarCampoReactivoIndividual(campo, valor);
}

private getValorReactivo(campo: string): any {
  switch (campo) {
    case 'lote': return this.lote;
    case 'codigo': return this.codigo;
    case 'nombre': return this.nombre;
    case 'marca': return this.marca;
    case 'referencia': return this.referencia;
    case 'cas': return this.cas;
    case 'presentacion': return this.presentacion;
    case 'presentacion_cant': return this.presentacion_cant;
    case 'unidad_id': return this.unidad_id;
    case 'fecha_adquisicion': return this.fecha_adquisicion;
    case 'fecha_vencimiento': return this.fecha_vencimiento;
    case 'tipo_id': return this.tipo_id;
    case 'clasificacion_id': return this.clasificacion_id;
    case 'estado_id': return this.estado_id;
    case 'tipo_recipiente_id': return this.tipo_recipiente_id;
    case 'almacenamiento_id': return this.almacenamiento_id;
    case 'observaciones': return this.observaciones;
    default: return '';
  }
}

private validarCampoReactivoIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'lote':
      if (!valor?.trim()) return 'El lote es obligatorio';
      if (!/^[A-Z0-9\-]{3,20}$/.test(valor)) 
        return 'Formato de lote inválido (3-20 caracteres alfanuméricos)';
      return '';
      
    case 'codigo':
      if (!valor?.trim()) return 'El código es obligatorio';
      if (valor.length > 50) return 'El código no puede exceder 50 caracteres';
      return '';
      
    case 'nombre':
      const nombreStr = (valor ?? '').toString().trim();
      if (!nombreStr) return 'El nombre es obligatorio';
      if (nombreStr.length > 200) return 'El nombre no puede exceder 200 caracteres';
      return '';
      
    case 'marca':
      if (!valor?.trim()) return 'La marca es obligatoria';
      if (valor.length > 100) return 'La marca no puede exceder 100 caracteres';
      return '';
      
    case 'referencia':
      if (!valor?.trim()) return 'La referencia es obligatoria';
      if (valor.length > 100) return 'La referencia no puede exceder 100 caracteres';
      return '';
      
    case 'cas':
      if (!valor?.trim()) return 'El número CAS es obligatorio';
      if (!/^\d{1,7}-\d{2}-\d{1}$/.test(valor)) 
        return 'Formato CAS inválido (ej: 64-17-5)';
      return '';
      
    case 'presentacion':
      if (valor === null || valor === undefined) return 'La presentación es obligatoria';
      if (valor < 0) return 'La presentación no puede ser negativa';
      return '';
      
    case 'presentacion_cant':
      if (valor === null || valor === undefined) return 'La cantidad por presentación es obligatoria';
      if (valor < 0) return 'La cantidad no puede ser negativa';
      return '';
      
    case 'unidad_id':
      if (!valor) return 'La unidad es obligatoria';
      return '';
      
    case 'fecha_adquisicion':
      if (!valor) return 'La fecha de adquisición es obligatoria';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) 
        return 'Formato de fecha inválido (AAAA-MM-DD)';
      
      const fechaAdqValidacion = new Date(valor);
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      
      if (fechaAdqValidacion > hoy) return 'La fecha de adquisición no puede ser futura';
      return '';
      
    case 'fecha_vencimiento':
      if (!valor) return 'La fecha de vencimiento es obligatoria';
      
      const fechaVencValidacion = new Date(valor);
      const fechaAdqActual = this.fecha_adquisicion ? new Date(this.fecha_adquisicion) : null;
      
      if (fechaAdqActual && fechaVencValidacion < fechaAdqActual) 
        return 'La fecha de vencimiento no puede ser anterior a la adquisición';
      return '';
      
    case 'tipo_id':
      if (!valor) return 'El tipo de reactivo es obligatorio';
      return '';
      
    case 'clasificacion_id':
      if (!valor) return 'La clasificación SGA es obligatoria';
      return '';
      
    case 'estado_id':
      if (!valor) return 'El estado es obligatorio';
      return '';
      
    case 'tipo_recipiente_id':
      if (!valor) return 'El tipo de recipiente es obligatorio';
      return '';
      
    case 'almacenamiento_id':
      if (!valor) return 'El almacenamiento es obligatorio';
      return '';
      
    case 'observaciones':
      // NO obligatorio - no hay validación
      return '';
      
    default:
      return '';
  }
}

  seleccionarCatalogo(item: any) {
    this.catalogoSeleccionado = item;
    // Rellenar campos del formulario reactivo
    this.codigo = item.codigo || '';
    this.nombre = item.nombre || '';
    // Mapear tipo/clasificación por nombre a IDs de tablas auxiliares
    const tipo = this.tipos.find(t => (t.nombre || '').toLowerCase().trim() === (item.tipo_reactivo || '').toLowerCase().trim());
    const clasif = this.clasif.find(c => (c.nombre || '').toLowerCase().trim() === (item.clasificacion_sga || '').toLowerCase().trim());
    this.tipo_id = tipo ? tipo.id : '';
    this.clasificacion_id = clasif ? clasif.id : '';

    // Cargar PDFs existentes
    this.loadDocs(item.codigo);
    // Ocultar panel de catálogo embebido
    this.mostrarCatalogoFormPanel = false;
    // Limpiar sugerencias para cerrar dropdowns
    this.catalogoSugerenciasSig.set([]);
    this.catalogoQ = '';
  }

  filtrarCatalogoCodigo() {
    const q = this.normalizarTexto(this.codigoFiltro || '');
    if (!q) {
      this.catalogoCodigoResultados = this.catalogoBaseSig().slice();
    } else {
      // Coincidencia insensible a mayúsculas y en cualquier parte del código
      this.catalogoCodigoResultados = this.catalogoBaseSig().filter(c => this.normalizarTexto(c.codigo || '').includes(q));
    }
  }

  filtrarCatalogoNombre() {
    const q = this.normalizarTexto(this.nombreFiltro || '');
    if (!q) {
      this.catalogoNombreResultados = this.catalogoBaseSig().slice();
    } else {
      this.catalogoNombreResultados = this.catalogoBaseSig().filter(c => this.normalizarTexto(c.nombre || '').includes(q));
    }
  }

  async filtrarCatalogoPorCampos() {
    const codeQraw = (this.codigoFiltro || '').trim();
    const nameQraw = (this.nombreFiltro || '').trim();
    const codeQ = this.normalizarTexto(codeQraw);
    const nameQ = this.normalizarTexto(nameQraw);
    this.catalogoOffset = 0;

    // Estrategia: no mezclamos. Si sólo hay código -> buscar por código; si sólo nombre -> buscar por nombre; si ambos -> cargar base limitada y filtrar local con AND.
    let backendQuery = '';
    if (codeQ && !nameQ) backendQuery = codeQraw; // enviar tal cual para que backend pueda usar LIKE sobre codigo
    else if (nameQ && !codeQ) backendQuery = nameQraw; // sólo nombre
    else backendQuery = ''; // ambos o ninguno -> traer primer page y filtrar local

  // Si la búsqueda es de un único carácter (código o nombre), ampliamos límite para no truncar demasiados resultados.
  const singleCharQuery = (backendQuery && backendQuery.length === 1);
  const effectiveLimit = singleCharQuery ? 0 : this.catalogoVisibleCount; // 0 => backend sin límite
  const resp = await reactivosService.buscarCatalogo(backendQuery, effectiveLimit, this.catalogoOffset);
    let base: any[] = [];
    if (Array.isArray(resp)) {
      base = resp;
      this.catalogoTotal = resp.length;
    } else {
      base = resp.rows || [];
      this.catalogoTotal = resp.total || base.length;
    }

    // Filtrado exclusivo
    let filtered = base;
    if (codeQ) {
      filtered = filtered.filter(c => this.normalizarTexto(c.codigo || '').includes(codeQ));
    }
    if (nameQ) {
      // filtrado adicional por nombre, pero sin que el nombre afecte el código (AND si ambos presentes)
      filtered = filtered.filter(c => this.normalizarTexto(c.nombre || '').includes(nameQ));
    }

    // Solo actualizar catalogoBaseSig para filtrado, NO catalogoCompletoSig
    this.catalogoBaseSig.set(base);
    // La lista principal siempre limitada a catalogoVisibleCount
    this.catalogoResultadosSig.set((singleCharQuery ? filtered : filtered).slice(0, this.catalogoVisibleCount));
    this.catalogoTotal = filtered.length;
    this.catalogoCodigoResultados = this.catalogoBaseSig().slice();
    this.catalogoNombreResultados = this.catalogoBaseSig().slice();
    this.preloadDocsForVisible();
  }

  normalizarTexto(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Sin cargarMasCatalogo: se muestra todo
  resetCatalogoPaginado() {
    this.catalogoVisibleCount = 10;
    this.catalogoOffset = 0;
    this.cargarCatalogoBase();
  }

  async cargarMasCatalogo() {
    if (this.catalogoResultadosSig().length >= this.catalogoTotal) return;
    this.catalogoOffset += this.catalogoVisibleCount;
    const resp = await reactivosService.buscarCatalogo(this.codigoFiltro || this.nombreFiltro || '', this.catalogoVisibleCount, this.catalogoOffset);
    let nuevos: any[] = [];
    if (Array.isArray(resp)) {
      nuevos = resp;
    } else {
      nuevos = resp.rows || [];
      this.catalogoTotal = resp.total || this.catalogoTotal;
    }
    this.catalogoResultadosSig.set(this.catalogoResultadosSig().concat(nuevos));
    this.preloadDocsForVisible(nuevos);
  }

  trackByCatalogo(index: number, item: any) {
    return item?.codigo || index;
  }

  trackByReactivo(index: number, item: any) {
    // Prefer lote as unique key; fallback to codigo + index
    return item?.lote || `${item?.codigo || 'item'}-${index}`;
  }

  // --- Acciones PDF en tabla catálogo ---
  async onSubirHojaCatalogo(ev: any, codigo: string) {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    if (f && f.type !== 'application/pdf' && !String(f.name || '').toLowerCase().endsWith('.pdf')) {
      this.snack.warn('Seleccione un archivo PDF');
      if (ev?.target) ev.target.value = '';
      return;
    }
    try {
      await reactivosService.subirHojaSeguridad(codigo, f);
  this.snack.success(`Hoja de seguridad subida para ${codigo}`);
    this.setPdfStatus(codigo, { hoja: true });
    } catch (e: any) {
  this.snack.error(e?.message || 'Error subiendo hoja de seguridad');
    } finally {
      if (ev?.target) ev.target.value = '';
    }
  }
  async onEliminarHojaCatalogo(codigo: string) {
    if (!confirm('¿Eliminar hoja de seguridad?')) return;
    try {
      await reactivosService.eliminarHojaSeguridad(codigo);
  this.snack.success(`Hoja de seguridad eliminada para ${codigo}`);
  this.setPdfStatus(codigo, { hoja: false });
    } catch (e: any) {
  this.setPdfStatus(codigo, { hoja: false });
  this.snack.error(e?.message || 'Error eliminando hoja de seguridad');
    }
  }
  async onSubirCertCatalogo(ev: any, codigo: string) {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    if (f && f.type !== 'application/pdf' && !String(f.name || '').toLowerCase().endsWith('.pdf')) {
      this.snack.warn('Seleccione un archivo PDF');
      if (ev?.target) ev.target.value = '';
      return;
    }
    try {
      await reactivosService.subirCertAnalisis(codigo, f);
  this.snack.success(`Certificado de análisis subido para ${codigo}`);
  this.setPdfStatus(codigo, { cert: true });
    } catch (e: any) {
  this.snack.error(e?.message || 'Error subiendo certificado de análisis');
    } finally {
      if (ev?.target) ev.target.value = '';
    }
  }
  async onEliminarCertCatalogo(codigo: string) {
    if (!confirm('¿Eliminar certificado de análisis?')) return;
    try {
      await reactivosService.eliminarCertAnalisis(codigo);
  this.snack.success(`Certificado de análisis eliminado para ${codigo}`);
  this.setPdfStatus(codigo, { cert: false });
    } catch (e: any) {
  this.setPdfStatus(codigo, { cert: false });
  this.snack.error(e?.message || 'Error eliminando certificado de análisis');
    }
  }

  // --- Acciones PDF en tarjetas de inventario (por lote) ---
  async onSubirHojaReactivo(ev: any, lote: string) {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    if (f && f.type !== 'application/pdf' && !String(f.name || '').toLowerCase().endsWith('.pdf')) {
      this.snack.warn('Seleccione un archivo PDF');
      if (ev?.target) ev.target.value = '';
      return;
    }
    try {
      await reactivosService.subirHojaSeguridadReactivo(lote, f);
  this.snack.success(`Hoja de seguridad subida para lote ${lote}`);
      this.setReactivoPdfStatus(lote, { hoja: true });
    } catch (e: any) {
  this.snack.error(e?.message || 'Error subiendo hoja de seguridad');
    } finally {
      if (ev?.target) ev.target.value = '';
    }
  }
  async onEliminarHojaReactivo(lote: string) {
    if (!confirm('¿Eliminar hoja de seguridad?')) return;
    try {
      await reactivosService.eliminarHojaSeguridadReactivo(lote);
  this.snack.success(`Hoja de seguridad eliminada para lote ${lote}`);
      this.setReactivoPdfStatus(lote, { hoja: false });
    } catch (e: any) {
      this.setReactivoPdfStatus(lote, { hoja: false });
  this.snack.error(e?.message || 'Error eliminando hoja de seguridad');
    }
  }
  async onSubirCertReactivo(ev: any, lote: string) {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    if (f && f.type !== 'application/pdf' && !String(f.name || '').toLowerCase().endsWith('.pdf')) {
      this.snack.warn('Seleccione un archivo PDF');
      if (ev?.target) ev.target.value = '';
      return;
    }
    try {
      await reactivosService.subirCertAnalisisReactivo(lote, f);
  this.snack.success(`Certificado de análisis subido para lote ${lote}`);
      this.setReactivoPdfStatus(lote, { cert: true });
    } catch (e: any) {
  this.snack.error(e?.message || 'Error subiendo certificado de análisis');
    } finally {
      if (ev?.target) ev.target.value = '';
    }
  }
  async onEliminarCertReactivo(lote: string) {
    if (!confirm('¿Eliminar certificado de análisis?')) return;
    try {
      await reactivosService.eliminarCertAnalisisReactivo(lote);
  this.snack.success(`Certificado de análisis eliminado para lote ${lote}`);
      this.setReactivoPdfStatus(lote, { cert: false });
    } catch (e: any) {
      this.setReactivoPdfStatus(lote, { cert: false });
  this.snack.error(e?.message || 'Error eliminando certificado de análisis');
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
  }

  mostrarDetallesReactivo(reactivo: any) {
    this.reactivoSeleccionado = reactivo;
    this.mostrarDetalles = true;
  }

  // Inline expand/collapse per card
  toggleExpand(r: any) {
    const key = String(r?.lote ?? '');
    if (!key) return;
    if (this.expandedLotes.has(key)) this.expandedLotes.delete(key);
    else this.expandedLotes.add(key);
  }
  isExpanded(r: any): boolean {
    const key = String(r?.lote ?? '');
    return key ? this.expandedLotes.has(key) : false;
  }

  // Funciones auxiliares para obtener nombres descriptivos
  obtenerNombreTipo(id: any): string {
    const tipo = this.tipos.find(t => t.id == id);
    return tipo ? tipo.nombre : 'N/A';
  }

  obtenerNombreClasificacion(id: any): string {
    const clasif = this.clasif.find(c => c.id == id);
    return clasif ? clasif.nombre : 'N/A';
  }

  // Devuelve el color HEX para la clasificación SGA (según guía aportada)
  getClasifColor(id: any): string {
    const nombre = this.obtenerNombreClasificacion(id);
    const n = this.normalizarTexto(nombre);
    return this.mapClasifHex(n);
  }

  // Versión por nombre directo (para options que usan c.nombre)
  getClasifColorByName(nombre: string): string {
    const n = this.normalizarTexto(nombre || '');
    return this.mapClasifHex(n);
  }

  // Color de texto sugerido para buen contraste sobre el fondo dado
  getClasifTextColor(hex: string): string {
    const h = (hex || '').toUpperCase();
    // Forzar texto negro en fondos claros (amarillos/grises)
    if (h === '#D9D9D9' || h === '#FEC720' || h === '#FFFF00') return '#000';
    return '#FFF';
  }

  private mapClasifHex(n: string): string {
    if (!n || n === 'n/a') return '#2d7dd2';
    if (n.includes('irritacion') || n.includes('irritación')) return '#4A90D9';
    if (n.includes('inflamable')) return '#FF0000';
    if (n.includes('corrosivo')) return '#FEC720';
    if (n.includes('respiracion') || n.includes('respiración')) return '#792C9B';
    if (n.includes('no peligro')) return '#D9D9D9';
    if (n.includes('toxico') || n.includes('tóxico')) return '#00B050';
    if (n.includes('medio ambiente') || n.includes('ambiente')) return '#792C9B';
    if (n.includes('comburente') || n.includes('oxidante')) return '#FFFF00';
    return '#2d7dd2';
  }

  // Estilos para que el <select> se vea coloreado con la opción elegida (por nombre)
  getSelectStyleForName(nombre: string | null | undefined): {[k: string]: string} {
    if (!nombre) return {};
    const bg = this.getClasifColorByName(nombre);
    const fg = this.getClasifTextColor(bg);
    return { 'background-color': bg, 'color': fg };
  }

  // Estilos para que el <select> se vea coloreado con la opción elegida (por id)
  getSelectStyleForId(id: any): {[k: string]: string} {
    if (!id && id !== 0) return {};
    const bg = this.getClasifColor(id);
    const fg = this.getClasifTextColor(bg);
    return { 'background-color': bg, 'color': fg };
  }

  obtenerNombreUnidad(id: any): string {
    const unidad = this.unidades.find(u => u.id == id);
    return unidad ? unidad.nombre : 'N/A';
  }

  obtenerNombreEstado(id: any): string {
    const estado = this.estado.find(e => e.id == id);
    return estado ? estado.nombre : 'N/A';
  }

  obtenerNombreAlmacenamiento(id: any): string {
    const almacen = this.almacen.find(a => a.id == id);
    return almacen ? almacen.nombre : 'N/A';
  }

  obtenerNombreTipoRecipiente(id: any): string {
    const recipiente = this.recipiente.find(r => r.id == id);
    return recipiente ? recipiente.nombre : 'N/A';
  }

  async onVerHojaCatalogo(codigo: string) {
    // Open a blank window synchronously to avoid popup blockers, then set location after we have the URL
    const win = window.open('', '_blank');
    try {
      const r = await reactivosService.obtenerHojaSeguridad(codigo);
      const url = r?.url;
      if (url) {
        try {
          if (win) win.location.href = url;
          else window.open(url, '_blank');
        } catch (err) {
          // Fallback: if assigning location fails, try to open normally
          window.open(url, '_blank');
        }
      } else {
        if (win) win.close();
        this.showToast('Hoja de seguridad no disponible');
      }
    } catch (e: any) {
      if (win) win.close();
      this.showToast(e?.message || 'Hoja de seguridad no disponible');
    }
  }

  async onVerCertCatalogo(codigo: string) {
    // Open a blank window synchronously to avoid popup blockers, then set location after we have the URL
    const win = window.open('', '_blank');
    try {
      const r = await reactivosService.obtenerCertAnalisis(codigo);
      const url = r?.url;
      if (url) {
        try {
          if (win) win.location.href = url;
          else window.open(url, '_blank');
        } catch (err) {
          window.open(url, '_blank');
        }
      } else {
        if (win) win.close();
        this.showToast('Certificado de análisis no disponible');
      }
    } catch (e: any) {
      if (win) win.close();
      this.showToast(e?.message || 'Certificado de análisis no disponible');
    }
  }

  async onVerHojaReactivo(lote: string) {
    const win = window.open('', '_blank');
    try {
      const r = await reactivosService.obtenerHojaSeguridadReactivo(lote);
      const url = r?.url;
      if (url) {
        try { if (win) win.location.href = url; else window.open(url, '_blank'); } catch { window.open(url, '_blank'); }
      } else { if (win) win.close(); this.snack.warn('Hoja de seguridad no disponible'); }
    } catch (e: any) { if (win) win.close(); this.snack.warn(e?.message || 'Hoja de seguridad no disponible'); }
  }

  async onVerCertReactivo(lote: string) {
    const win = window.open('', '_blank');
    try {
      const r = await reactivosService.obtenerCertAnalisisReactivo(lote);
      const url = r?.url;
      if (url) {
        try { if (win) win.location.href = url; else window.open(url, '_blank'); } catch { window.open(url, '_blank'); }
      } else { if (win) win.close(); this.snack.warn('Certificado de análisis no disponible'); }
    } catch (e: any) { if (win) win.close(); this.snack.warn(e?.message || 'Certificado de análisis no disponible'); }
  }

  onCodigoSeleccionado() {
    const item = this.catalogoBaseSig().find(c => (c.codigo || '') === (this.codigo || ''));
    if (!item) return;
    this.catalogoSeleccionado = item;
    this.nombre = item.nombre || '';
    const tipo = this.tipos.find(t => (t.nombre || '').toLowerCase().trim() === (item.tipo_reactivo || '').toLowerCase().trim());
    const clasif = this.clasif.find(c => (c.nombre || '').toLowerCase().trim() === (item.clasificacion_sga || '').toLowerCase().trim());
    this.tipo_id = tipo ? tipo.id : '';
    this.clasificacion_id = clasif ? clasif.id : '';
    this.loadDocs(item.codigo);
  }

  onNombreSeleccionado() {
    const item = this.catalogoBaseSig().find(c => (c.nombre || '') === (this.nombre || ''));
    if (!item) return;
    this.catalogoSeleccionado = item;
    this.codigo = item.codigo || '';
    const tipo = this.tipos.find(t => (t.nombre || '').toLowerCase().trim() === (item.tipo_reactivo || '').toLowerCase().trim());
    const clasif = this.clasif.find(c => (c.nombre || '').toLowerCase().trim() === (item.clasificacion_sga || '').toLowerCase().trim());
    this.tipo_id = tipo ? tipo.id : '';
    this.clasificacion_id = clasif ? clasif.id : '';
    this.loadDocs(item.codigo);
  }

  // Getters para mantener compatibilidad con el template existente
  get reactivos() { return this.reactivosSig(); }
  get reactivosFiltrados() { return this.reactivosFiltradosSig(); }
  get catalogoResultados() { return this.catalogoResultadosSig(); }
  get catalogoBase() { return this.catalogoBaseSig(); }
  get catalogoSugerencias() { return this.catalogoSugerenciasSig(); }

  // Pre-carga de disponibilidad de PDFs (solo estado, no abre ventana)
  async preloadDocsForVisible(list?: any[]) {
    const items = list || this.catalogoResultadosSig();
    // Limitar a 20 para evitar tormenta de peticiones
    const slice = items.slice(0, 20);
    for (const item of slice) {
      const codigo = item.codigo;
      if (!codigo) continue;
      if (!this.pdfStatus[codigo]) {
        // Initialize via setter so persistence and change-detection happen
        this.setPdfStatus(codigo, { hoja: null, cert: null });
        // Lanzar comprobaciones en paralelo (sin await secuencial bloqueante)
        this.checkPdfAvailability(codigo);
      }
    }
  }

  private async checkPdfAvailability(codigo: string) {
    try { await reactivosService.obtenerHojaSeguridad(codigo); this.setPdfStatus(codigo, { hoja: true }); }
    catch { this.setPdfStatus(codigo, { hoja: false }); }
    try { await reactivosService.obtenerCertAnalisis(codigo); this.setPdfStatus(codigo, { cert: true }); }
    catch { this.setPdfStatus(codigo, { cert: false }); }
  }

  // Pre-carga de PDFs por lote para inventario
  async preloadDocsForReactivosVisible(list?: any[]) {
    const items = list || this.reactivosSig();
    const slice = items.slice(0, 20);
    for (const item of slice) {
      const lote = item?.lote;
      if (!lote) continue;
      if (!this.reactivoPdfStatusSig()[lote]) {
        this.setReactivoPdfStatus(lote, { hoja: null, cert: null });
        this.checkPdfAvailabilityByLote(lote);
      }
    }
  }

  private async checkPdfAvailabilityByLote(lote: string) {
    try { await reactivosService.obtenerHojaSeguridadReactivo(lote); this.setReactivoPdfStatus(lote, { hoja: true }); }
    catch { this.setReactivoPdfStatus(lote, { hoja: false }); }
    try { await reactivosService.obtenerCertAnalisisReactivo(lote); this.setReactivoPdfStatus(lote, { cert: true }); }
    catch { this.setReactivoPdfStatus(lote, { cert: false }); }
  }

  // Resalta coincidencias de búsqueda/filtro dentro de campos
  highlightField(value: string, field: 'codigo' | 'nombre' | 'otro' = 'otro'): SafeHtml {
    if (!value) return '';
    // Determinar si el usuario está filtrando exclusivamente por código o exclusivamente por nombre
    const hasCode = !!this.codigoFiltro.trim();
    const hasName = !!this.nombreFiltro.trim();
    const exclusiveCode = hasCode && !hasName;
    const exclusiveName = hasName && !hasCode;

    let term: string | null = null;
    if (exclusiveCode && field === 'codigo') {
      term = this.normalizarTexto(this.codigoFiltro);
    } else if (exclusiveName && field === 'nombre') {
      term = this.normalizarTexto(this.nombreFiltro);
    } else {
      // No resaltar en otros casos para evitar "sombreado" no deseado
      return value;
    }
    if (!term) return value;
  // Escapar caracteres especiales para construir regex seguro
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'ig');
    const html = value.replace(re, '<mark>$1</mark>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private persistPdfStatus() {
    try { sessionStorage.setItem('pdfStatusCache', JSON.stringify(this.pdfStatus)); } catch {}
  }

  private persistReactivoPdfStatus() {
    try { sessionStorage.setItem('reactivoPdfStatusCache', JSON.stringify(this.reactivoPdfStatusSig())); } catch {}
  }

  async loadDocs(codigo: string) {
    this.hojaUrl = null; this.certUrl = null; this.hojaMsg = ''; this.certMsg = '';
    try {
      const hoja = await reactivosService.obtenerHojaSeguridad(codigo);
      this.hojaUrl = hoja?.url || null;
    } catch {}
    try {
      const cert = await reactivosService.obtenerCertAnalisis(codigo);
      this.certUrl = cert?.url || null;
    } catch {}
  }

  async loadDocsByLote(lote: string) {
    this.hojaUrl = null; this.certUrl = null; this.hojaMsg = ''; this.certMsg = '';
    try {
      const hoja = await reactivosService.obtenerHojaSeguridadReactivo(lote);
      this.hojaUrl = hoja?.url || null;
    } catch {}
    try {
      const cert = await reactivosService.obtenerCertAnalisisReactivo(lote);
      this.certUrl = cert?.url || null;
    } catch {}
  }

  onHojaSelected(ev: any) {
    const f = ev?.target?.files?.[0];
    this.hojaFile = f || null;
  }
  async subirHoja() {
    if (!this.catalogoSeleccionado?.codigo || !this.hojaFile) { this.hojaMsg = 'Seleccione código y archivo'; return; }
    this.hojaMsg = '';
    try {
      const r = await reactivosService.subirHojaSeguridad(this.catalogoSeleccionado.codigo, this.hojaFile);
      this.hojaUrl = r?.url || null;
      this.hojaMsg = 'Hoja de seguridad subida';
      this.hojaFile = null;
    } catch (e: any) {
      this.hojaMsg = e?.message || 'Error subiendo hoja';
    }
  }
  async eliminarHoja() {
    if (!this.catalogoSeleccionado?.codigo) return;
    if (!confirm('¿Eliminar hoja de seguridad?')) return;
    try {
      await reactivosService.eliminarHojaSeguridad(this.catalogoSeleccionado.codigo);
      this.hojaUrl = null;
      this.hojaMsg = 'Hoja de seguridad eliminada';
      const codigo = this.catalogoSeleccionado.codigo;
      this.setPdfStatus(codigo, { hoja: false });
    } catch (e) {
      this.hojaMsg = 'Error eliminando hoja';
    }
  }

  onCertSelected(ev: any) {
    const f = ev?.target?.files?.[0];
    this.certFile = f || null;
  }
  async subirCert() {
    if (!this.catalogoSeleccionado?.codigo || !this.certFile) { this.certMsg = 'Seleccione código y archivo'; return; }
    this.certMsg = '';
    try {
      const r = await reactivosService.subirCertAnalisis(this.catalogoSeleccionado.codigo, this.certFile);
      this.certUrl = r?.url || null;
      this.certMsg = 'Certificado de análisis subido';
      this.certFile = null;
    } catch (e: any) {
      this.certMsg = e?.message || 'Error subiendo certificado';
    }
  }
  async eliminarCert() {
    if (!this.catalogoSeleccionado?.codigo) return;
    if (!confirm('¿Eliminar certificado de análisis?')) return;
    try {
      await reactivosService.eliminarCertAnalisis(this.catalogoSeleccionado.codigo);
      this.certUrl = null;
      this.certMsg = 'Certificado de análisis eliminado';
      const codigo = this.catalogoSeleccionado.codigo;
      this.setPdfStatus(codigo, { cert: false });
    } catch (e) {
      this.certMsg = 'Error eliminando certificado';
    }
  }

  calcularCantidadTotal() {
    if (this.presentacion != null && this.presentacion_cant != null) {
      this.cantidad_total = Number(this.presentacion) * Number(this.presentacion_cant);
    }
  }

  async crearCatalogo(e: Event, form?: NgForm) {
  e.preventDefault();
  this.catalogoMsg = '';
  this.submittedCatalogo = true;
  
  // USAR EL MÉTODO DE VALIDACIÓN NUEVO (igual que en Solicitudes)
  if (!this.validarCatalogo()) {
    this.snack.warn('Por favor corrige los campos resaltados.');
    return;
  }
  
  try {
    const safeTrim = (v: any): string => typeof v === 'string' ? v.trim() : '';
    await reactivosService.crearCatalogo({
      codigo: safeTrim(this.catCodigo),
      nombre: safeTrim(this.catNombre),
      tipo_reactivo: safeTrim(this.catTipo),
      clasificacion_sga: safeTrim(this.catClasificacion),
      descripcion: (() => { const d = safeTrim(this.catDescripcion); return d ? d : null; })()
    });
    this.snack.success('Catálogo creado correctamente');
    
    // Limpiar errores después de éxito
    this.catalogoErrors = {};
    
    // limpiar
    this.catCodigo = this.catNombre = this.catTipo = this.catClasificacion = this.catDescripcion = '';
    // Resetear estado del formulario para limpiar touched/dirty y evitar resaltar en rojo
    try { if (form) form.resetForm({ catCodigo:'', catNombre:'', catTipo:'', catClasificacion:'', catDescripcion:'' }); } catch {}
    this.submittedCatalogo = false;
    // Recargar base y re-aplicar filtros/búsqueda para que el nuevo elemento aparezca
    await this.cargarCatalogoBase();
    if ((this.codigoFiltro || '').trim() || (this.nombreFiltro || '').trim()) {
      this.filtrarCatalogoPorCampos();
    } else {
      this.catalogoQ = '';
      await this.buscarCatalogo();
    }
  } catch (err: any) {
    this.snack.error(err?.message || 'Error creando catálogo');
  }
}

  async crearReactivo(e: Event, form?: NgForm) {
  e.preventDefault();
  this.reactivoMsg = '';
  this.submittedReactivo = true;
  
  // Normalizar CAS antes de validar
  const n = this.normalizeCas(this.cas);
  this.cas = n === null ? '' : n;
  
  // USAR EL MÉTODO DE VALIDACIÓN NUEVO (igual que en Solicitudes)
  if (!this.validarReactivo()) {
    this.snack.warn('Por favor corrige los campos resaltados.');
    return;
  }
  
  try {
    // Validación mínima de campos obligatorios
    if (!this.lote.trim() || !this.codigo.trim() || !this.nombre.trim()) {
      this.snack.warn('Por favor completa Lote, Código y Nombre.');
      return;
    }

    const toNull = (v: any) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') {
        const t = v.trim();
        return t === '' ? null : t;
      }
      return v;
    };

    this.calcularCantidadTotal();
    const payload = {
      lote: this.lote.trim(),
      codigo: this.codigo.trim(),
      nombre: this.nombre.trim(),
      marca: toNull(this.marca),
      referencia: toNull(this.referencia),
      cas: this.normalizeCas(this.cas),
      presentacion: this.presentacion,
      presentacion_cant: this.presentacion_cant,
      cantidad_total: this.cantidad_total,
      fecha_adquisicion: toNull(this.fecha_adquisicion),
      fecha_vencimiento: toNull(this.fecha_vencimiento),
      observaciones: toNull(this.observaciones),
      tipo_id: toNull(this.tipo_id),
      clasificacion_id: toNull(this.clasificacion_id),
      unidad_id: toNull(this.unidad_id),
      estado_id: toNull(this.estado_id),
      almacenamiento_id: toNull(this.almacenamiento_id),
      tipo_recipiente_id: toNull(this.tipo_recipiente_id)
    };
    
    if (this.editMode && this.editOriginalLote) {
      // Actualizar: usar lote original como clave en la URL
      await reactivosService.actualizarReactivo(this.editOriginalLote, payload);
      this.snack.success('Reactivo actualizado correctamente');
    } else {
      await reactivosService.crearReactivo(payload);
      this.snack.success('Reactivo creado correctamente');
    }
    
    // Limpiar errores después de éxito
    this.reactivoErrors = {};
    
    // If files were selected during creation/edit, upload them now (by lote)
    try {
      const lote = payload.lote;
      if (this.reactivoSdsFile) {
        await reactivosService.subirHojaSeguridadReactivo(lote, this.reactivoSdsFile);
        this.setReactivoPdfStatus(lote, { hoja: true });
        this.reactivoSdsFile = null;
      }
      if (this.reactivoCoaFile) {
        await reactivosService.subirCertAnalisisReactivo(lote, this.reactivoCoaFile);
        this.setReactivoPdfStatus(lote, { cert: true });
        this.reactivoCoaFile = null;
      }
    } catch (upErr) {
      // don't fail creation if upload fails; show a message
      console.warn('Error uploading docs for reactivo:', upErr);
      this.snack.warn('Reactivo creado pero ocurrió un error subiendo documentos');
    }
    
    await this.loadReactivos();
    // Limpiar modelo y restablecer estado visual del formulario (pristine/untouched)
    this.resetReactivoForm();
    this.submittedReactivo = false;
    try { if (form) form.resetForm(); } catch {}
  } catch (err: any) {
    this.snack.error(err?.message || 'Error creando reactivo');
  }
}

  canDelete(): boolean {
  const user = authUser();
  // Solo Administrador y Superadmin pueden eliminar
  return user?.rol === 'Administrador' || user?.rol === 'Superadmin';
}

  isDeleteCatalogoLoading(c: any): boolean {
    const code = c?.codigo || '';
    return !!code && this.catalogoDeleting.has(code);
  }

  async onDeleteCatalogo(c: any, ev?: Event) {
    try { ev?.stopPropagation(); } catch {}
    if (!this.canDelete()) return;
    const codigo = c?.codigo;
    const nombre = c?.nombre || '';
    if (!codigo) return;
    if (!confirm(`¿Eliminar del catálogo el reactivo "${nombre || codigo}"?`)) return;
    this.catalogoDeleting.add(codigo);
    try {
      await reactivosService.eliminarCatalogo(codigo);
      this.snack.success('Eliminado del catálogo');
      await this.cargarCatalogoBase();
    } catch (e: any) {
      this.snack.error(e?.message || 'Error eliminando del catálogo');
    } finally {
      this.catalogoDeleting.delete(codigo);
    }
  }

  // Handlers for file inputs in reactivo creation form
  onSdsSelected(ev: any) {
    const f = ev?.target?.files?.[0];
    if (f && f.type !== 'application/pdf' && !String(f.name || '').toLowerCase().endsWith('.pdf')) {
      this.showToast('Seleccione un archivo PDF');
      if (ev?.target) ev.target.value = '';
      this.reactivoSdsFile = null;
      return;
    }
    this.reactivoSdsFile = f || null;
  }
  onCoaSelected(ev: any) {
    const f = ev?.target?.files?.[0];
    if (f && f.type !== 'application/pdf' && !String(f.name || '').toLowerCase().endsWith('.pdf')) {
      this.showToast('Seleccione un archivo PDF');
      if (ev?.target) ev.target.value = '';
      this.reactivoCoaFile = null;
      return;
    }
    this.reactivoCoaFile = f || null;
  }

  resetReactivoForm() {
    this.lote = this.codigo = this.nombre = this.marca = this.referencia = this.cas = '';
    this.presentacion = this.presentacion_cant = this.cantidad_total = null;
    this.fecha_adquisicion = this.fecha_vencimiento = this.observaciones = '';
    this.tipo_id = this.clasificacion_id = this.unidad_id = this.estado_id = this.almacenamiento_id = this.tipo_recipiente_id = '';
    this.editMode = false;
    this.editOriginalLote = null;
  }

  // Iniciar edición tomando datos del reactivo y subiendo el formulario
  startEditReactivo(r: any) {
    // Cargar valores en el formulario
    this.lote = r.lote || '';
    this.codigo = r.codigo || '';
    this.nombre = r.nombre || '';
    this.marca = r.marca || '';
    this.referencia = r.referencia || '';
    this.cas = r.cas || '';
    this.presentacion = r.presentacion ?? null;
    this.presentacion_cant = r.presentacion_cant ?? null;
    this.cantidad_total = r.cantidad_total ?? null;
    this.fecha_adquisicion = r.fecha_adquisicion || '';
    this.fecha_vencimiento = r.fecha_vencimiento || '';
    this.observaciones = r.observaciones || '';
    this.tipo_id = r.tipo_id ?? '';
    this.clasificacion_id = r.clasificacion_id ?? '';
    this.unidad_id = r.unidad_id ?? '';
    this.estado_id = r.estado_id ?? '';
    this.almacenamiento_id = r.almacenamiento_id ?? '';
    this.tipo_recipiente_id = r.tipo_recipiente_id ?? '';
    this.editMode = true;
    this.editOriginalLote = String(r.lote ?? '');
    // Asegurar cantidad total consistente
    this.calcularCantidadTotal();
    // Abrir el panel de edición (el formulario está arriba en la vista)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Abrir modal de edición sin tocar el formulario principal
  openEditModal(r: any) {
    this.editFormData = {
      loteOriginal: String(r.lote ?? ''),
      lote: r.lote || '',
      codigo: r.codigo || '',
      nombre: r.nombre || '',
      marca: r.marca || '',
      referencia: r.referencia || '',
      cas: r.cas || '',
      presentacion: r.presentacion ?? null,
      presentacion_cant: r.presentacion_cant ?? null,
      cantidad_total: r.cantidad_total ?? null,
      fecha_adquisicion: this.toDateInputValue(r.fecha_adquisicion),
      fecha_vencimiento: this.toDateInputValue(r.fecha_vencimiento),
      observaciones: r.observaciones || '',
      tipo_id: r.tipo_id ?? '',
      clasificacion_id: r.clasificacion_id ?? '',
      unidad_id: r.unidad_id ?? '',
      estado_id: r.estado_id ?? '',
      almacenamiento_id: r.almacenamiento_id ?? '',
      tipo_recipiente_id: r.tipo_recipiente_id ?? ''
    };
    this.editSubmitted = false;
    this.editModalOpen = true;
  }

  // Cerrar modal y limpiar flags
  closeEditModal() {
    this.editModalOpen = false;
    this.editSubmitted = false;
  }

  // Guardar cambios desde el modal
  async guardarEdicion(form?: NgForm) {
    this.editSubmitted = true;
    // Normalizar CAS antes de que Angular valide el formulario, por si el usuario no salió del campo
    {
      const n = this.normalizeCas(this.editFormData.cas);
      this.editFormData.cas = n === null ? '' : n;
    }
    if (form && form.invalid) {
      try { form.control.markAllAsTouched(); } catch {}
      return;
    }
    // Normalizar campos antes de construir el payload
    const toNull = (v: any) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') {
        const t = v.trim();
        return t === '' ? null : t;
      }
      return v;
    };
    // Recalcular cantidad total si aplica
    const cantidad_total = (this.editFormData.presentacion != null && this.editFormData.presentacion_cant != null)
      ? Number(this.editFormData.presentacion) * Number(this.editFormData.presentacion_cant)
      : this.editFormData.cantidad_total;
    const payload = {
      lote: String(this.editFormData.lote || '').trim(),
      codigo: String(this.editFormData.codigo || '').trim(),
      nombre: String(this.editFormData.nombre || '').trim(),
      marca: toNull(this.editFormData.marca),
      referencia: toNull(this.editFormData.referencia),
  cas: this.normalizeCas(this.editFormData.cas),
      presentacion: this.editFormData.presentacion,
      presentacion_cant: this.editFormData.presentacion_cant,
      cantidad_total,
      fecha_adquisicion: toNull(this.editFormData.fecha_adquisicion),
      fecha_vencimiento: toNull(this.editFormData.fecha_vencimiento),
      observaciones: toNull(this.editFormData.observaciones),
      tipo_id: toNull(this.editFormData.tipo_id),
      clasificacion_id: toNull(this.editFormData.clasificacion_id),
      unidad_id: toNull(this.editFormData.unidad_id),
      estado_id: toNull(this.editFormData.estado_id),
      almacenamiento_id: toNull(this.editFormData.almacenamiento_id),
      tipo_recipiente_id: toNull(this.editFormData.tipo_recipiente_id)
    };
    try {
      if (!payload.lote || !payload.codigo || !payload.nombre) {
        this.snack.warn('Por favor completa Lote, Código y Nombre.');
        return;
      }
      await reactivosService.actualizarReactivo(this.editFormData.loteOriginal, payload);
      this.snack.success('Reactivo actualizado correctamente');
      this.closeEditModal();
      await this.loadReactivos();
    } catch (e: any) {
      this.snack.error(e?.message || 'Error actualizando reactivo');
    }
  }


  async onCodigoInput() {
    const q = (this.codigo || '').trim();
    this.catalogoQ = q;
    this.catalogoFiltroCampo = 'codigo';
    if (this.catalogoDebounce) clearTimeout(this.catalogoDebounce);
    this.catalogoDebounce = setTimeout(async () => {
      if (q.length >= 1) {
        await this.buscarCatalogo();
      } else {
        // Cuando vacío, limpiar solo el dropdown (no tocar la lista principal)
        this.catalogoSugerenciasSig.set([]);
      }
    }, 150);
    this.mostrarCatalogoFormPanel = false;
  }

  onCodigoFocus() {
    this.isCodigoFocused = true;
    this.catalogoFiltroCampo = 'codigo';
  }
  onCodigoBlur() {
    // Timeout corto para permitir click en opción (mousedown previene blur en el botón)
    setTimeout(() => { this.isCodigoFocused = false; }, 80);
  }

  async onNombreInput() {
    const q = (this.nombre || '').trim();
    this.catalogoQ = q;
    this.catalogoFiltroCampo = 'nombre';
    if (this.catalogoDebounce) clearTimeout(this.catalogoDebounce);
    this.catalogoDebounce = setTimeout(async () => {
      if (q.length >= 1) {
        await this.buscarCatalogo();
      } else {
        this.catalogoSugerenciasSig.set([]);
      }
    }, 150);
    this.mostrarCatalogoFormPanel = false;
  }

  onNombreFocus() {
    this.isNombreFocused = true;
    this.catalogoFiltroCampo = 'nombre';
  }
  onNombreBlur() {
    setTimeout(() => { this.isNombreFocused = false; }, 80);
  }

  cerrarCatalogoFormPanel() {
    this.mostrarCatalogoFormPanel = false;
  }


  async filtrarReactivos() {
    const qLote = (this.reactivosLoteQ || '').trim();
    const qCod = (this.reactivosCodigoQ || '').trim();
    const qNom = (this.reactivosNombreQ || '').trim();
    const hayFiltro = qLote || qCod || qNom;

    if (hayFiltro) {
      // Construir consulta base para el backend (usa OR sobre lote/codigo/nombre/marca)
      // Prioriza un campo si solo hay uno; si hay varios, usa el primero no vacío para reducir dataset
      const q = qLote || qCod || qNom;
      this.reactivosQ = q;
      try {
        await this.loadReactivos(0, 0); // sin límite: obtener solo coincidencias del backend
      } catch (e) {
        console.error('No se pudo cargar coincidencias desde el servidor para filtrar', e);
      }
      // Aplicar filtro local adicional (AND) sobre los tres campos
      this.aplicarFiltroReactivos();
      return;
    }

    // No hay filtros: restablecer a primera página y limpiar consulta del backend
    this.reactivosQ = '';
    try {
      await this.loadReactivos(this.reactivosPageSize, 0);
    } catch (e) {
      console.error('No se pudo recargar la primera página de reactivos', e);
    }
    // Mostrar la página sin filtros
    this.aplicarFiltroReactivos();
  }

  private aplicarFiltroReactivos() {
    const normalizar = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const qLote = normalizar(this.reactivosLoteQ);
    const qCod = normalizar(this.reactivosCodigoQ);
    const qNom = normalizar(this.reactivosNombreQ);

    if (!qLote && !qCod && !qNom) {
      this.reactivosFiltradosSig.set(this.reactivosSig().slice());
      return;
    }

    const filtrados = (this.reactivosSig() || []).filter((r: any) => {
      const lote = normalizar(String(r.lote ?? ''));
      const codigo = normalizar(String(r.codigo ?? ''));
      const nombre = normalizar(String(r.nombre ?? ''));
      if (qLote && !lote.includes(qLote)) return false;
      if (qCod && !codigo.includes(qCod)) return false;
      if (qNom && !nombre.includes(qNom)) return false;
      return true;
    });
    this.reactivosFiltradosSig.set(filtrados);
  }

  async mostrarTodosReactivos() {
    this.reactivosQ = '';
    await this.loadReactivos(); // sin límite => todos
  }

  async eliminarReactivo(lote: string) {
    if (!confirm('¿Eliminar reactivo ' + lote + '?')) return;
    try {
      // Optimista: quitar de la lista inmediatamente
      const prev = this.reactivosSig();
      const next = prev.filter(r => String(r.lote) !== String(lote));
      this.reactivosSig.set(next);
      this.aplicarFiltroReactivos();

      await reactivosService.eliminarReactivo(lote);
      // Para consistencia estricta, podría recargarse del servidor:
      // await this.loadReactivos();
    } catch (err) {
      console.error('Error eliminando reactivo', err);
      await this.loadReactivos();
    }
  }

  // Eliminación masiva de reactivos actualmente filtrados
  bulkDeletingReactivos = false;
  bulkDeleteProgress: number = 0; // porcentaje 0-100
  bulkDeleteTotal: number = 0; // total de items a eliminar en operación actual
  exportandoExcel: boolean = false;
  async eliminarReactivosListado() {
    if (!this.canDelete()) return;
    // Construir lista global filtrada: si el total real supera lo cargado actualmente, traer todos sin límite
    let lista = this.reactivosFiltradosSig();
    let usedFullDataset = false;
    if (this.reactivosTotal > this.reactivosSig().length) {
      try {
        const respAll = await reactivosService.listarReactivos(this.reactivosQ || '', 0, 0); // sin límite
        const allRows = Array.isArray(respAll) ? respAll : (respAll.rows || []);
        usedFullDataset = true;
        // Reaplicar filtros locales (lote, codigo, nombre)
        const normalizar = (v: string) => (v || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
        const qLote = normalizar(this.reactivosLoteQ || '');
        const qCod = normalizar(this.reactivosCodigoQ || '');
        const qNom = normalizar(this.reactivosNombreQ || '');
        lista = allRows.filter((r: any) => {
          const lote = normalizar(String(r.lote ?? ''));
          const codigo = normalizar(String(r.codigo ?? ''));
          const nombre = normalizar(String(r.nombre ?? ''));
          if (qLote && !lote.includes(qLote)) return false;
          if (qCod && !codigo.includes(qCod)) return false;
          if (qNom && !nombre.includes(qNom)) return false;
          return true;
        });
      } catch (e) {
        console.error('Fallo obteniendo lista completa para borrado masivo, se usa subset cargado', e);
      }
    }
    if (!lista.length) {
      this.snack.warn('No hay reactivos filtrados para eliminar');
      return;
    }
    if (!confirm(`¿Eliminar ${lista.length} reactivo(s) filtrado(s) de un total de ${this.reactivosTotal}? Esta acción no se puede deshacer.`)) return;
    this.bulkDeletingReactivos = true;
    this.bulkDeleteProgress = 0;
    this.bulkDeleteTotal = lista.length;
    const lotesEliminados: string[] = [];
    const errores: string[] = [];
    // Eliminación secuencial para evitar saturar backend y permitir fallback
    for (let i = 0; i < lista.length; i++) {
      const r: any = lista[i];
      const lote = String(r.lote || '').trim();
      if (!lote) continue;
      try {
        await reactivosService.eliminarReactivo(lote);
        lotesEliminados.push(lote);
      } catch (e: any) {
        console.error('Fallo eliminando lote', lote, e);
        errores.push(lote);
      }
      // Actualizar progreso después de cada intento (éxito o error)
      this.bulkDeleteProgress = Math.round(((i + 1) / this.bulkDeleteTotal) * 100);
      try { this.cdr.detectChanges(); } catch {}
    }
    // Actualizar listado local eliminando los exitosos
    if (lotesEliminados.length) {
      const prev = this.reactivosSig();
      const restantes = prev.filter(r => !lotesEliminados.includes(String(r.lote)));
      this.reactivosSig.set(restantes);
      this.aplicarFiltroReactivos();
    }
    this.bulkDeletingReactivos = false;
    if (errores.length && lotesEliminados.length) {
      this.snack.warn(`Eliminados ${lotesEliminados.length}, fallaron ${errores.length}`);
    } else if (errores.length && !lotesEliminados.length) {
      this.snack.error('No se pudo eliminar ningún reactivo');
    } else {
      this.snack.success(`Eliminados ${lotesEliminados.length} reactivo(s)`);
    }

    // Actualizar total real tras eliminación usando backend para evitar inconsistencias
    try {
      const t = await reactivosService.totalReactivos();
      if (t && typeof t.total === 'number') {
        this.reactivosTotal = t.total;
      } else if (!usedFullDataset) {
        // fallback si no hubo respuesta estructurada
        this.reactivosTotal = Math.max(0, this.reactivosTotal - lotesEliminados.length);
      }
    } catch {
      if (!usedFullDataset) {
        this.reactivosTotal = Math.max(0, this.reactivosTotal - lotesEliminados.length);
      }
    }

    // Si usamos dataset completo, recargar la página inicial para reflejar estado consistente
    if (usedFullDataset) {
      try { await this.loadReactivos(10, 0); } catch {}
    }
    // Reset visual tras terminar
    this.bulkDeleteTotal = 0;
    this.bulkDeleteProgress = 0;
  }

  async descargarReactivosExcel() {
    if (this.exportandoExcel) return;
    this.exportandoExcel = true;
    try {
      const blob = await reactivosService.exportarReactivosExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.download = `reactivos_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.snack.success('Archivo Excel generado');
    } catch (e: any) {
      console.error('Error exportando Excel', e);
      this.snack.error(e?.message || 'Error exportando Excel');
    } finally {
      this.exportandoExcel = false;
    }
  }

  // Validación cruzada simple: vencimiento >= adquisición
  fechasInconsistentes(): boolean {
    if (!this.fecha_adquisicion || !this.fecha_vencimiento) return false;
    const adq = new Date(this.fecha_adquisicion);
    const ven = new Date(this.fecha_vencimiento);
    if (isNaN(adq.getTime()) || isNaN(ven.getTime())) return false;
    return ven < adq;
  }

  // Estado visual de vencimiento: negro (vencido), rojo (<=2 meses), amarillo (<=6 meses)
  getVencimientoInfo(fecha: string | null | undefined): { text: string; bg: string; fg: string; title: string } | null {
    if (!fecha) return null;
    let d = new Date(fecha);
    // Fallback para formato dd-mm-yyyy insertado manualmente por SQL
    if (isNaN(d.getTime())) {
      const m = /^([0-3]?\d)-([0-1]?\d)-(\d{4})$/.exec(fecha.trim());
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        d = new Date(`${yyyy}-${mm}-${dd}`);
      }
    }
    if (isNaN(d.getTime())) return null; // Fecha definitivamente inválida

    const today = new Date();
    const toMid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.floor((toMid(d) - toMid(today)) / 86400000);

    // 0 o negativo -> vencido
    if (days <= 0) {
      return { text: 'Vencido', bg: '#000000', fg: '#FFFFFF', title: 'El reactivo está vencido' };
    }
    // <= 30 días -> cuenta regresiva exacta
    if (days <= 30) {
      const plural = days === 1 ? '' : 's';
      return { text: `Vence en ${days} día${plural}`, bg: '#FF0000', fg: '#FFFFFF', title: `El reactivo vence en ${days} día${plural}` };
    }
    // <= 60 días (aprox 2 meses)
    if (days <= 60) {
      return { text: 'Vence ≤ 2 meses', bg: '#FF0000', fg: '#FFFFFF', title: 'El reactivo vence en 2 meses o menos' };
    }
    // <= 180 días (<= 6 meses)
    if (days <= 180) {
      return { text: 'Vence ≤ 6 meses', bg: '#FFC107', fg: '#000000', title: 'El reactivo vence en 6 meses o menos' };
    }
    // <= 365 días: mostrar meses aproximados
    if (days <= 365) {
      const months = Math.round(days / 30); // aproximación
      return { text: `Vence en ~${months} mes${months === 1 ? '' : 'es'}`, bg: '#4CAF50', fg: '#FFFFFF', title: `Aproximadamente ${months} mes${months === 1 ? '' : 'es'} restantes` };
    }
    // > 1 año: mostrar años aproximados
    const years = Math.round(days / 365);
    return { text: `Vence en ~${years} año${years === 1 ? '' : 's'}`, bg: '#1976D2', fg: '#FFFFFF', title: `Aproximadamente ${years} año${years === 1 ? '' : 's'} restantes` };
  }
  logout() {
    authService.logout();
  }

}