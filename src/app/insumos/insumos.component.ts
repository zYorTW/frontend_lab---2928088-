import { Component, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { authService } from '../services/auth.service';
import { insumosService } from '../services/insumos.service';

@Component({  
  standalone: true,
  selector: 'app-insumos',
  templateUrl: './insumos.component.html',
  styleUrls: ['./insumos.component.css'],
  imports: [CommonModule, NgIf, FormsModule, RouterModule]
})

export class InsumosComponent implements OnInit {
  // Aux lists
  tipos: Array<any> = [];
  clasif: Array<any> = [];
  unidades: Array<any> = [];
  estado: Array<any> = [];
  recipiente: Array<any> = [];
  almacen: Array<any> = [];
  insumoSeleccionado: any = null;
  mostrarDetalles: boolean = false;

  ngOnInit() {
    // Ejecutar inicialización al montar el componente
    this.init();
  }

  // Catálogo form
  catItem = '';
  catCodigo = '';
  catNombre = '';
  catTipo = '';
  catClasificacion = '';
  catDescripcion = '';
  catalogoMsg = '';
  itemFiltro = '';


  // Catálogo búsqueda y selección
  catalogoQ = '';
  // Signals para catálogo
  catalogoResultadosSig = signal<Array<any>>([]);
  catalogoSeleccionado: any = null;
  catalogoCargando: boolean = false;
  // Base y listas filtradas para selects (signal)
  catalogoBaseSig = signal<Array<any>>([]);
  catalogoCodigoResultados: Array<any> = [];
  catalogoNombreResultados: Array<any> = [];
  codigoFiltro: string = '';
  nombreFiltro: string = '';
  // Paginación catálogo
  catalogoVisibleCount: number = 10; // tamaño página frontend respaldo
  catalogoTotal: number = 0;
  catalogoOffset: number = 0; // offset usado en backend
  // Paginación del catálogo removida: siempre mostrar todo

  // Gestión de PDFs
  hojaUrl: string | null = null;
  certUrl: string | null = null;
  hojaFile: File | null = null;
  certFile: File | null = null;
  hojaMsg = '';
  certMsg = '';

  // Insumo form
item = 0; // corresponde al campo "item" de la tabla insumos
codigo = '';
nombre = '';
marca = '';
presentacion: number | null = null;
cantidad_adquirida: number | null = null;
cantidad_existente: number | null = null;
cantidad_total: number | null = null;
fecha_adquisicion = '';
ubicacion = '';
observaciones = '';
descripcion = '';

// IDs relacionados (si aplican)
tipo_id: any = '';
clasificacion_id: any = '';
unidad_id: any = '';
estado_id: any = '';
almacenamiento_id: any = '';
tipo_recipiente_id: any = '';

// Mensaje de operación
insumoMsg = '';

// Lista de insumos
insumos: Array<any> = [];
// Filtros de inventario
insumosItemQ = '';
insumosCodigoQ = '';
insumosNombreQ = '';
insumosFiltrados: Array<any> = [];
insumosQ = '';

// Panel de catálogo dentro del formulario (autocompletar)
mostrarCatalogoFormPanel: boolean = false;

// Estado de disponibilidad de PDFs por código
pdfStatus: { [codigo: string]: { hoja: boolean | null; cert: boolean | null } } = {};

// Helper para actualizar estado PDF y forzar cambio de referencia
private setPdfStatus(codigo: string, changes: Partial<{ hoja: boolean | null; cert: boolean | null }>) {
  const prev = this.pdfStatus[codigo] || { hoja: null, cert: null };
  this.pdfStatus = { ...this.pdfStatus, [codigo]: { ...prev, ...changes } };
  this.persistPdfStatus();
}

constructor(private sanitizer: DomSanitizer) {}

async init() {
  try {
    // Restaurar cache pdfStatus si existe
    try {
      const cache = sessionStorage.getItem('pdfStatusCache');
      if (cache) {
        this.pdfStatus = JSON.parse(cache);
      }
    } catch {}

    // Cargar auxiliares y catálogo en paralelo para reducir tiempo de espera perceptual
    this.catalogoCargando = true;
    await Promise.all([
      this.loadAux(),
      this.loadInsumos(10),
      this.loadCatalogoInicial()
    ]);

    // Guardar cache inicial tras carga
    this.persistPdfStatus();
  } catch (err) {
    console.error('Error inicializando Insumos:', err);
  }
}

async loadAux() {
  const data = await insumosService.aux();
  this.tipos = data.tipos || [];
  this.clasif = data.clasif || [];
  this.unidades = data.unidades || [];
  this.estado = data.estado || [];
  this.recipiente = data.recipiente || [];
  this.almacen = data.almacen || [];
}

async loadInsumos(limit?: number) {
  const rows = await insumosService.listarInsumos(this.insumosQ || '', limit);
  this.insumos = rows || [];
  this.aplicarFiltroInsumos();
}

async buscarCatalogo() {
  const q = this.normalizarTexto(this.catalogoQ || '');
  if (!this.catalogoBaseSig().length) {
    await this.cargarCatalogoBase();
  }
  this.catalogoCargando = true;
  try {
    if (!q) {
      this.catalogoResultadosSig.set(this.catalogoBaseSig().slice());
    } else {
      const filtered = this.catalogoBaseSig().filter(c =>
        this.normalizarTexto(c.codigo || '').includes(q) ||
        this.normalizarTexto(c.nombre || '').includes(q)
      );
      this.catalogoResultadosSig.set(filtered);
    }
  } finally {
    this.catalogoCargando = false;
  }
}

async cargarCatalogoBase() {
  try {
    const resp = await insumosService.buscarCatalogo('', this.catalogoVisibleCount, this.catalogoOffset);
    if (Array.isArray(resp)) {
      this.catalogoBaseSig.set(resp);
      this.catalogoTotal = resp.length;
      this.catalogoResultadosSig.set(resp.slice(0, this.catalogoVisibleCount));
    } else {
      const base = resp.rows || [];
      this.catalogoBaseSig.set(base);
      this.catalogoTotal = resp.total || base.length;
      this.catalogoResultadosSig.set(base.slice());
    }
    this.catalogoCodigoResultados = this.catalogoBaseSig().slice();
    this.catalogoNombreResultados = this.catalogoBaseSig().slice();

    // Pre-cargar disponibilidad de PDFs para los visibles iniciales
    this.preloadDocsForVisible();
  } catch (e) {
    console.error('Error cargando catálogo inicial de insumos', e);
    this.catalogoMsg = 'Error cargando catálogo';
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

seleccionarCatalogo(item: any) {
  this.catalogoSeleccionado = item;

  // Rellenar campos del formulario de insumo
  this.codigo = item.codigo || '';
  this.nombre = item.nombre || '';

  // Mapear tipo/clasificación por nombre a IDs de tablas auxiliares
  const tipo = this.tipos.find(t => (t.nombre || '').toLowerCase().trim() === (item.tipo_insumo || '').toLowerCase().trim());
  const clasif = this.clasif.find(c => (c.nombre || '').toLowerCase().trim() === (item.clasificacion_sga || '').toLowerCase().trim());
  this.tipo_id = tipo ? tipo.id : '';
  this.clasificacion_id = clasif ? clasif.id : '';

  // Cargar PDFs existentes
  this.loadDocs(item.codigo);

  // Ocultar panel de catálogo embebido
  this.mostrarCatalogoFormPanel = false;
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
  if (codeQ && !nameQ) backendQuery = codeQraw; // enviar tal cual para backend
  else if (nameQ && !codeQ) backendQuery = nameQraw; // sólo nombre
  else backendQuery = ''; // ambos o ninguno -> traer primer page y filtrar local

  // Si la búsqueda es de un único carácter (código o nombre), ampliamos límite para no truncar demasiados resultados.
  const singleCharQuery = (backendQuery && backendQuery.length === 1);
  const effectiveLimit = singleCharQuery ? 0 : this.catalogoVisibleCount; // 0 => backend sin límite

  // Usar insumosService
  const resp = await insumosService.buscarCatalogo(backendQuery, effectiveLimit, this.catalogoOffset);
  let base: any[] = [];
  if (Array.isArray(resp)) {
    base = resp;
    this.catalogoTotal = resp.length;
  } else {
    base = resp.rows || [];
    this.catalogoTotal = resp.total || base.length;
  }

  // Filtrado exclusivo (local)
  let filtered = base;
  if (codeQ) {
    filtered = filtered.filter(c => this.normalizarTexto(c.codigo || '').includes(codeQ));
  }
  if (nameQ) {
    filtered = filtered.filter(c => this.normalizarTexto(c.nombre || '').includes(nameQ));
  }

  this.catalogoBaseSig.set(base);
  this.catalogoResultadosSig.set(singleCharQuery ? filtered : filtered.slice(0, this.catalogoVisibleCount));
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
  const resp = await insumosService.buscarCatalogo(this.codigoFiltro || this.nombreFiltro || '', this.catalogoVisibleCount, this.catalogoOffset);
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

// --- Acciones PDF en tabla catálogo ---
async onSubirHojaCatalogo(ev: any, codigo: string) {
  const f = ev?.target?.files?.[0];
  if (!f) return;
  try {
    await insumosService.subirHojaSeguridad(codigo, f);
    this.catalogoMsg = `Hoja de seguridad subida para ${codigo}`;
    this.setPdfStatus(codigo, { hoja: true });
  } catch (e: any) {
    this.catalogoMsg = e?.message || 'Error subiendo hoja de seguridad';
  } finally {
    if (ev?.target) ev.target.value = '';
  }
}

  async onEliminarHojaCatalogo(codigo: string) {
    if (!confirm('¿Eliminar hoja de seguridad?')) return;
    try {
      await insumosService.eliminarHojaSeguridad(Number(codigo));

      this.catalogoMsg = `Hoja de seguridad eliminada para ${codigo}`;
      this.setPdfStatus(codigo, { hoja: false });
    } catch (e: any) {
      this.setPdfStatus(codigo, { hoja: false });
      this.catalogoMsg = e?.message || 'Error eliminando hoja de seguridad';
    }
  }

async onSubirCertCatalogo(ev: any, codigo: string) {
  const f = ev?.target?.files?.[0];
  if (!f) return;
  try {
    await insumosService.subirCertAnalisis(codigo, f);
    this.catalogoMsg = `Certificado de análisis subido para ${codigo}`;
    this.setPdfStatus(codigo, { cert: true });
  } catch (e: any) {
    this.catalogoMsg = e?.message || 'Error subiendo certificado de análisis';
  } finally {
    if (ev?.target) ev.target.value = '';
  }
}

async onEliminarCertCatalogo(codigo: string) {
  if (!confirm('¿Eliminar certificado de análisis?')) return;
  try {
    await insumosService.eliminarCertAnalisis(codigo);
    this.catalogoMsg = `Certificado de análisis eliminado para ${codigo}`;
    this.setPdfStatus(codigo, { cert: false });
  } catch (e: any) {
    this.setPdfStatus(codigo, { cert: false });
    this.catalogoMsg = e?.message || 'Error eliminando certificado de análisis';
  }
}

formatearFecha(fecha: string): string {
  if (!fecha) return '';
  const date = new Date(fecha);
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}

mostrarDetallesInsumo(insumo: any) {
  this.insumoSeleccionado = insumo; // puedes renombrar a insumoSeleccionado si quieres
  this.mostrarDetalles = true;
}

// Funciones auxiliares para obtener nombres descriptivos
obtenerNombreTipo(id: any): string {
  const tipo = this.tipos.find(t => t.id == id);
  return tipo ? tipo.nombre : 'N/A';
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

// Visualización de PDFs
async onVerHojaCatalogo(codigo: string) {
  try {
    const r = await insumosService.obtenerHojaSeguridad(codigo);
    const url = r?.url;
    if (url) {
      window.open(url, '_blank');
    } else {
      this.catalogoMsg = 'Hoja de seguridad no disponible';
    }
  } catch (e: any) {
    this.catalogoMsg = e?.message || 'Hoja de seguridad no disponible';
  }
}

async onVerCertCatalogo(codigo: string) {
  try {
    const r = await insumosService.obtenerCertAnalisis(codigo);
    const url = r?.url;
    if (url) {
      window.open(url, '_blank');
    } else {
      this.catalogoMsg = 'Certificado de análisis no disponible';
    }
  } catch (e: any) {
    this.catalogoMsg = e?.message || 'Certificado de análisis no disponible';
  }
}

// Selección desde el catálogo
onCodigoSeleccionado() {
  const item = this.catalogoBaseSig().find(c => (c.codigo || '') === (this.codigo || ''));
  if (!item) return;
  this.catalogoSeleccionado = item;
  this.nombre = item.nombre || '';
  const tipo = this.tipos.find(t => (t.nombre || '').toLowerCase().trim() === (item.tipo_insumo || '').toLowerCase().trim());
  this.tipo_id = tipo ? tipo.id : '';
  this.loadDocs(item.codigo);
}

onNombreSeleccionado() {
  const item = this.catalogoBaseSig().find(c => (c.nombre || '') === (this.nombre || ''));
  if (!item) return;
  this.catalogoSeleccionado = item;
  this.codigo = item.codigo || '';
  const tipo = this.tipos.find(t => (t.nombre || '').toLowerCase().trim() === (item.tipo_insumo || '').toLowerCase().trim());
  this.tipo_id = tipo ? tipo.id : '';
  this.loadDocs(item.codigo);
}

// Getters para mantener compatibilidad con el template existente
get catalogoResultados() { return this.catalogoResultadosSig(); }
get catalogoBase() { return this.catalogoBaseSig(); }

// Pre-carga de disponibilidad de PDFs (solo estado, no abre ventana)
async preloadDocsForVisible(list?: any[]) {
  const items = list || this.catalogoResultadosSig();
  // Limitar a 20 para evitar tormenta de peticiones
  const slice = items.slice(0, 20);
  for (const item of slice) {
    const codigo = item.codigo;
    if (!codigo) continue;
    if (!this.pdfStatus[codigo]) {
      this.pdfStatus[codigo] = { hoja: null, cert: null };
      // Lanzar comprobaciones en paralelo (sin await secuencial bloqueante)
      this.checkPdfAvailability(codigo);
    }
  }
}

private async checkPdfAvailability(codigo: string) {
  try { await insumosService.obtenerHojaSeguridad(codigo); this.setPdfStatus(codigo, { hoja: true }); }
  catch { this.setPdfStatus(codigo, { hoja: false }); }
  try { await insumosService.obtenerCertAnalisis(codigo); this.setPdfStatus(codigo, { cert: true }); }
  catch { this.setPdfStatus(codigo, { cert: false }); }
}

// Resalta coincidencias de búsqueda/filtro dentro de campos
highlightField(value: string, field: 'codigo' | 'nombre' | 'otro' | 'item'): SafeHtml {
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

async loadDocs(codigo: string) {
  this.hojaUrl = null; this.certUrl = null; this.hojaMsg = ''; this.certMsg = '';
  try {
    const hoja = await insumosService.obtenerHojaSeguridad(codigo);
    this.hojaUrl = hoja?.url || null;
  } catch {}
  try {
    const cert = await insumosService.obtenerCertAnalisis(codigo);
    this.certUrl = cert?.url || null;
  } catch {}
}

onHojaSelected(ev: any) {
  const f = ev?.target?.files?.[0];
  this.hojaFile = f || null;
}

async subirHoja() {
  if (!this.catalogoSeleccionado?.codigo || !this.hojaFile) { 
    this.hojaMsg = 'Seleccione código y archivo'; 
    return; 
  }
  this.hojaMsg = '';
  try {
    const r = await insumosService.subirHojaSeguridad(this.catalogoSeleccionado.codigo, this.hojaFile);
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
    await insumosService.eliminarHojaSeguridad(this.catalogoSeleccionado.codigo);
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
  if (!this.catalogoSeleccionado?.codigo || !this.certFile) { 
    this.certMsg = 'Seleccione código y archivo'; 
    return; 
  }
  this.certMsg = '';
  try {
    const r = await insumosService.subirCertAnalisis(this.catalogoSeleccionado.codigo, this.certFile);
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
    await insumosService.eliminarCertAnalisis(this.catalogoSeleccionado.codigo);
    this.certUrl = null;
    this.certMsg = 'Certificado de análisis eliminado';
    const codigo = this.catalogoSeleccionado.codigo;
    this.setPdfStatus(codigo, { cert: false });
  } catch (e) {
    this.certMsg = 'Error eliminando certificado';
  }
}

calcularCantidadTotal() {
  if (this.cantidad_adquirida != null && this.presentacion != null) {
    this.cantidad_existente = Number(this.cantidad_adquirida) * Number(this.presentacion);
  }
}


async crearCatalogo(e: Event) {
  e.preventDefault();
  this.catalogoMsg = '';
  try {
    await insumosService.crearCatalogo({
      codigo: this.catCodigo.trim(),
      nombre: this.catNombre.trim(),
      tipo: this.catTipo.trim(),
      descripcion: this.catDescripcion.trim() || null
    });
    this.catalogoMsg = 'Catálogo creado correctamente';
    // limpiar
    this.catCodigo = this.catNombre = this.catTipo = this.catDescripcion = '';
    // Recargar base y re-aplicar filtros/búsqueda para que el nuevo elemento aparezca
    await this.cargarCatalogoBase();
    if ((this.codigoFiltro || '').trim() || (this.nombreFiltro || '').trim()) {
      this.filtrarCatalogoPorCampos();
    } else {
      this.catalogoQ = '';
      await this.buscarCatalogo();
    }
  } catch (err: any) {
    this.catalogoMsg = err?.message || 'Error creando catálogo';
  }
}

async crearInsumo(e: Event) {
  e.preventDefault();
  this.insumoMsg = ''; // usamos el mensaje correcto
  try {
    this.calcularCantidadTotal(); // usa la versión adaptada para insumos
    const payload = {
      item: this.item, // o null si lo crea el backend automáticamente
      codigo: this.codigo.trim(),
      nombre: this.nombre.trim(),
      marca: this.marca.trim(),
      presentacion: this.presentacion,
      cantidad_adquirida: this.cantidad_adquirida,
      cantidad_existente: this.cantidad_existente,
      fecha_adquisicion: this.fecha_adquisicion,
      ubicacion: this.ubicacion.trim() || null,
      observaciones: this.observaciones.trim() || null,
      descripcion: this.descripcion.trim() || null,
      tipo_id: this.tipo_id,
      unidad_id: this.unidad_id,
      estado_id: this.estado_id,
      almacenamiento_id: this.almacenamiento_id,
      tipo_recipiente_id: this.tipo_recipiente_id
    };

    await insumosService.crearInsumo(payload);
    this.insumoMsg = 'Insumo creado correctamente';

    await this.loadInsumos();
  } catch (err: any) {
    this.insumoMsg = err?.message || 'Error creando insumo';
  }
}


resetInsumoForm() {
  this.item = 0;
  this.codigo = '';
  this.nombre = '';
  this.marca = '';
  this.presentacion = null;
  this.cantidad_adquirida = null;
  this.cantidad_existente = null;
  this.cantidad_total = null;
  this.fecha_adquisicion = '';
  this.ubicacion = '';
  this.observaciones = '';
  this.descripcion = '';

  this.tipo_id = '';
  this.clasificacion_id = '';
  this.unidad_id = '';
  this.estado_id = '';
  this.almacenamiento_id = '';
  this.tipo_recipiente_id = '';

  this.insumoMsg = '';
}


async onCodigoInput() {
  const q = (this.codigo || '').trim();
  if (q.length >= 1) {
    this.catalogoQ = q;
    await this.buscarCatalogo();
    this.mostrarCatalogoFormPanel = true;
  } else {
    this.mostrarCatalogoFormPanel = false;
  }
}

async onNombreInput() {
  const q = (this.nombre || '').trim();
  if (q.length >= 1) {
    this.catalogoQ = q;
    await this.buscarCatalogo();
    this.mostrarCatalogoFormPanel = true;
  } else {
    this.mostrarCatalogoFormPanel = false;
  }
}

cerrarCatalogoFormPanel() {
  this.mostrarCatalogoFormPanel = false;
}

async filtrarInsumos() {
  // Filtrado local por lote, código y nombre (insensible a mayúsculas/acentos)
  this.aplicarFiltroInsumos();
}

private aplicarFiltroInsumos() {
  const normalizar = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const qItem = normalizar(this.insumosItemQ || '');
  const qCod  = normalizar(this.insumosCodigoQ || '');
  const qNom  = normalizar(this.insumosNombreQ || '');

  // Si no hay filtros, devolver copia completa
  if (!qItem && !qCod && !qNom) {
    this.insumosFiltrados = (this.insumos || []).slice();
    return;
  }

  this.insumosFiltrados = (this.insumos || []).filter(i => {
    const itemStr  = normalizar(String(i.item ?? ''));
    const codigo   = normalizar(String(i.codigo ?? ''));
    const nombre   = normalizar(String(i.nombre ?? ''));

    if (qItem && !itemStr.includes(qItem)) return false;
    if (qCod  && !codigo.includes(qCod))   return false;
    if (qNom  && !nombre.includes(qNom))   return false;
    return true;
  });
}


async mostrarTodosInsumos() {
  this.insumosQ = '';
  await this.loadInsumos(); // renombrable a loadInsumos() si quieres
}

async eliminarInsumo(item: number) {
  if (!confirm('¿Eliminar insumo ' + item + '?')) return;
  try {
    await insumosService.eliminarInsumo(item);
    await this.loadInsumos(); // recarga la lista
  } catch (err) {
    console.error('Error eliminando insumo', err);
  }
}

logout() {
  authService.logout();
}


}