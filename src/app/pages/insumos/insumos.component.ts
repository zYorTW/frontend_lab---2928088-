import { Component, OnInit, signal, ElementRef, ViewChild, HostListener } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SnackbarService } from '../../services/snackbar.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { authService, authUser } from '../../services/auth/auth.service';
import { insumosService } from '../../services/insumos.service';

@Component({  
  standalone: true,
  selector: 'app-insumos',
  templateUrl: './insumos.component.html',
  styleUrls: ['./insumos.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class InsumosComponent implements OnInit {
    public get esAuxiliar(): boolean {
      const user = authUser();
      return user?.rol === 'Auxiliar';
    }
  @ViewChild('insumoFormSection') insumoFormSection?: ElementRef<HTMLElement>;
  @ViewChild('itemCatalogoInput') itemCatalogoInput?: ElementRef<HTMLInputElement>;
  // Aux lists
  tipos: Array<any> = [];
  clasif: Array<any> = [];
  unidades: Array<any> = [];
  estado: Array<any> = [];
  recipiente: Array<any> = [];
  almacen: Array<any> = [];
  insumoSeleccionado: any = null;
  mostrarDetalles: boolean = false;

  // Signals para errores de validación
  readonly catalogoErrors = signal<{[key: string]: string}>({});
  readonly insumoErrors = signal<{[key: string]: string}>({});

  // Patrones de validación
  private readonly PATTERNS = {
    NOMBRE: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.]{2,100}$/,
    ITEM: /^[0-9]{1,10}$/,
    DESCRIPCION: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.\,]{0,500}$/,
    MARCA: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.]{0,50}$/,
    REFERENCIA: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.]{0,50}$/,
    PRESENTACION: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.]{0,50}$/,
    UBICACION: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\#]{0,100}$/,
    OBSERVACIONES: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.\,]{0,500}$/
  };

  ngOnInit() {
    // Ejecutar inicialización al montar el componente
    this.init();
  }

  // Catálogo form (signals con accessors para compatibilidad con template)
  private catItemSig = signal<string>('');
  get catItem() { return this.catItemSig(); }
  set catItem(v: string) { this.catItemSig.set(v ?? ''); }

  private catNombreSig = signal<string>('');
  get catNombre() { return this.catNombreSig(); }
  set catNombre(v: string) { this.catNombreSig.set(v ?? ''); }

  private catDescripcionSig = signal<string>('');
  get catDescripcion() { return this.catDescripcionSig(); }
  set catDescripcion(v: string) { this.catDescripcionSig.set(v ?? ''); }

  private catImagenSig = signal<File | null>(null);
  get catImagen() { return this.catImagenSig(); }
  set catImagen(f: File | null) { this.catImagenSig.set(f ?? null); }

  private catalogoMsgSig = signal<string>('');
  get catalogoMsg() { return this.catalogoMsgSig(); }
  set catalogoMsg(v: string) { this.catalogoMsgSig.set(v ?? ''); }

  private itemFiltroSig = signal<string>('');
  get itemFiltro() { return this.itemFiltroSig(); }
  set itemFiltro(v: string) { this.itemFiltroSig.set(v ?? ''); }

  // Catálogo búsqueda y selección
  catalogoQ = '';
  // Signals para catálogo
  catalogoResultadosSig = signal<Array<any>>([]);
  catalogoSeleccionado: any = null;
  private catalogoCargandoSig = signal<boolean>(false);
  get catalogoCargando() { return this.catalogoCargandoSig(); }
  set catalogoCargando(v: boolean) { this.catalogoCargandoSig.set(!!v); }
  // Base y listas filtradas para selects (signal)
  catalogoBaseSig = signal<Array<any>>([]);
  catalogoItemResultados: Array<any> = [];
  catalogoNombreResultados: Array<any> = [];
  private nombreFiltroSig = signal<string>('');
  get nombreFiltro() { return this.nombreFiltroSig(); }
  set nombreFiltro(v: string) { this.nombreFiltroSig.set(v ?? ''); }
  // Catálogo sin paginación: traer todo y filtrar localmente
  private catalogoTotalSig = signal<number>(0);
  get catalogoTotal() { return this.catalogoTotalSig(); }
  set catalogoTotal(v: number) { this.catalogoTotalSig.set(Number(v) || 0); }

  // ===== Listado de insumos (tarjetas) =====
  private insumosAllSig = signal<Array<any>>([]);
  private insumosListSig = signal<Array<any>>([]);
  private insumosCargandoSig = signal<boolean>(false);
  private insumosErrorSig = signal<string>('');
  get insumosList() { return this.insumosListSig(); }
  get insumosCargando() { return this.insumosCargandoSig(); }
  get insumosError() { return this.insumosErrorSig(); }
  skeletonInsumos = Array.from({ length: 6 });

  // Filtros de inventario
  private invItemFiltroSig = signal<string>('');
  get invItemFiltro() { return this.invItemFiltroSig(); }
  set invItemFiltro(v: string) { this.invItemFiltroSig.set(v ?? ''); }
  private invNombreFiltroSig = signal<string>('');
  get invNombreFiltro() { return this.invNombreFiltroSig(); }
  set invNombreFiltro(v: string) { this.invNombreFiltroSig.set(v ?? ''); }

  // Control de quitar cantidad por tarjeta
  private removeQtyMap: Record<number, number | null> = {};
  private busyIds = new Set<number>();
  private openItem: any | null = null;
  getRemoveQty(id: number): number | null { return this.removeQtyMap[id] ?? null; }
  setRemoveQty(id: number, v: any) {
    const num = Number(v);
    this.removeQtyMap[id] = Number.isFinite(num) ? num : null;
  }
  isBusy(id: number) { return this.busyIds.has(id); }
  isValidQty(v: any) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }
  isOpen(item: any) { return this.openItem === item; }
  toggleOpen(item: any) {
    this.openItem = (this.openItem === item) ? null : item;
  }

  // ===== Menú contextual (click derecho) =====
  contextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;
  contextMenuTarget: any = null;

  // Cierre global del menú: cualquier clic izquierdo en el documento
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    if (!this.contextMenuVisible) return;
    if (ev.button !== 0) return; // solo clic izquierdo
    this.closeContextMenu();
  }

  onCatalogContextMenu(ev: MouseEvent, item: any) {
    ev.preventDefault();
    ev.stopPropagation();
    const { clientX, clientY } = ev;
    // Posicionar menú; ajustar si se acerca al borde inferior
    const viewportH = window.innerHeight;
    const menuHeight = 90; // altura estimada
    let y = clientY;
    if (clientY + menuHeight > viewportH - 8) {
      y = viewportH - menuHeight - 8;
    }
    this.contextMenuX = clientX;
    this.contextMenuY = y;
    this.contextMenuTarget = item;
    this.contextMenuVisible = true;
  }

  closeContextMenu() {
    this.contextMenuVisible = false;
    this.contextMenuTarget = null;
  }

  onContextMenuEliminar() {
    if (!this.contextMenuTarget) { this.closeContextMenu(); return; }
    const target = this.contextMenuTarget;
    this.closeContextMenu();
    // Diferenciar si es catálogo (tiene .item y no .id) o inventario (tiene .id)
    const isCatalogo = typeof target?.item !== 'undefined' && typeof target?.id === 'undefined';
    if (isCatalogo) {
      const codigo = target.item;
      if (!window.confirm(`¿Eliminar del catálogo el insumo "${target?.nombre || codigo}"?`)) return;
      insumosService.eliminarCatalogoInsumos(codigo)
        .then((res: any) => {
          // Tras éxito, recargar desde backend para asegurar consistencia
          this.cargarCatalogoBase();
          const deleted = (res && typeof res.deleted !== 'undefined') ? Number(res.deleted) : 1;
          this.snack.success(deleted > 0 ? 'Item de catálogo eliminado' : 'Operación completada');
        })
        .catch(e => {
          const status = (e as any)?.status;
          if (status === 401) {
            this.snack.error('Debes iniciar sesión para eliminar del catálogo');
          } else if (status === 403) {
            this.snack.error('No tienes permisos para eliminar del catálogo');
          } else if (status === 409) {
            this.snack.error('No se puede eliminar: hay insumos que usan este item de catálogo');
          } else if (status === 404) {
            this.snack.error('El item no existe (ya fue eliminado)');
            // Refrescar para reflejar el estado real
            this.cargarCatalogoBase();
          } else {
            this.snack.error(e?.message || 'Error eliminando del catálogo');
          }
          console.error('Error eliminando catálogo insumos:', e);
        });
    } else {
      this.eliminar(target);
    }
  }

  // Cerrar al hacer click en cualquier parte
  onGlobalClick(ev: any) {
    if (!this.contextMenuVisible) return;
    try {
      // Cerrar solo con click primario (izquierdo) para no interferir con right-click
      if (ev instanceof MouseEvent && ev.button !== 0) return;
    } catch {}
    this.closeContextMenu();
  }

  async eliminar(ins: any) {
    const id = Number(ins?.id);
    if (!Number.isFinite(id)) { this.snack.warn('No se pudo determinar el ID del insumo'); return; }
    const ok = window.confirm(`¿Eliminar el insumo "${ins?.nombre || ''}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      this.busyIds.add(id);
      await insumosService.eliminarInsumo(id);
  // actualizar listas locales (base y filtrada)
  const removeFrom = (arr: any[]) => arr.filter(x => x.id !== id);
  this.insumosAllSig.set(removeFrom(this.insumosAllSig()));
  this.insumosListSig.set(removeFrom(this.insumosListSig()));
      // limpiar estados asociados
      delete this.removeQtyMap[id];
      if (this.openItem === ins) this.openItem = null;
      this.snack.success('Insumo eliminado');
    } catch (e: any) {
      this.snack.error(e?.message || 'Error al eliminar el insumo');
    } finally {
      this.busyIds.delete(id);
    }
  }

  // Gestión de PDFs
  hojaUrl: string | null = null;
  certUrl: string | null = null;
  hojaFile: File | null = null;
  certFile: File | null = null;
  hojaMsg = '';
  certMsg = '';

  // Insumo form (nuevo esquema)
  // Formulario de insumo (signals con accessors)
  private itemCatalogoSig = signal<number | null>(null);
  get item_catalogo() { return this.itemCatalogoSig(); }
  set item_catalogo(v: number | null) {
    const n = v as any;
    if (n === null || typeof n === 'undefined' || n === '') { this.itemCatalogoSig.set(null); return; }
    const num = Number(n);
    this.itemCatalogoSig.set(Number.isFinite(num) ? num : null);
  }

  private nombreSig = signal<string>('');
  get nombre() { return this.nombreSig(); }
  set nombre(v: string) { this.nombreSig.set((v ?? '').toString()); }

  private marcaSig = signal<string>('');
  get marca() { return this.marcaSig(); }
  set marca(v: string) { this.marcaSig.set((v ?? '').toString()); }

  private presentacionSig = signal<string>('');
  get presentacion() { return this.presentacionSig(); }
  set presentacion(v: string) { this.presentacionSig.set((v ?? '').toString()); }

  private referenciaSig = signal<string>('');
  get referencia() { return this.referenciaSig(); }
  set referencia(v: string) { this.referenciaSig.set((v ?? '').toString()); }

  private cantAdqSig = signal<number | null>(null);
  get cantidad_adquirida() { return this.cantAdqSig(); }
  set cantidad_adquirida(v: number | null) {
    const n = (v as any);
    if (n === null || typeof n === 'undefined' || n === '') { this.cantAdqSig.set(null); return; }
    const num = Number(n);
    this.cantAdqSig.set(Number.isFinite(num) ? num : null);
  }

  private cantExSig = signal<number | null>(null);
  get cantidad_existente() { return this.cantExSig(); }
  set cantidad_existente(v: number | null) {
    const n = (v as any);
    if (n === null || typeof n === 'undefined' || n === '') { this.cantExSig.set(null); return; }
    const num = Number(n);
    this.cantExSig.set(Number.isFinite(num) ? num : null);
  }

  private fechaAdqSig = signal<string>('');
  get fecha_adquisicion() { return this.fechaAdqSig(); }
  set fecha_adquisicion(v: string) { this.fechaAdqSig.set((v ?? '').toString()); }

  private ubicacionSig = signal<string>('');
  get ubicacion() { return this.ubicacionSig(); }
  set ubicacion(v: string) { this.ubicacionSig.set((v ?? '').toString()); }

  private observacionesSig = signal<string>('');
  get observaciones() { return this.observacionesSig(); }
  set observaciones(v: string) { this.observacionesSig.set((v ?? '').toString()); }

  private descripcionSig = signal<string>('');
  get descripcion() { return this.descripcionSig(); }
  set descripcion(v: string) { this.descripcionSig.set((v ?? '').toString()); }

// Mensaje de operación (signal)
private insumoMsgSig = signal<string>('');
get insumoMsg() { return this.insumoMsgSig(); }
set insumoMsg(v: string) { this.insumoMsgSig.set(v || ''); }

// Panel de catálogo dentro del formulario (autocompletar)
mostrarCatalogoFormPanel: boolean = false;

constructor(private sanitizer: DomSanitizer, private snack: SnackbarService) {}

async init() {
  try {
    // Cargar auxiliares y catálogo en paralelo para reducir tiempo de espera perceptual
    this.catalogoCargando = true;
    await Promise.all([
      this.loadAux(),
      this.loadCatalogoInicial(),
      this.loadInsumos()
    ]);
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
  this.insumosErrorSig.set('');
  this.insumosCargandoSig.set(true);
  try {
    const rows = await insumosService.listarInsumos('', limit || 0);
    const list = Array.isArray(rows) ? rows : [];
    this.insumosAllSig.set(list);
    this.insumosListSig.set(list);
  } catch (e) {
    console.error('Error cargando listado de insumos', e);
    this.insumosErrorSig.set('Error cargando insumos');
    this.insumosListSig.set([]);
    this.insumosAllSig.set([]);
  } finally {
    this.insumosCargandoSig.set(false);
  }
}

filtrarInsumosPorCampos() {
  const codeQ = (this.invItemFiltro || '').trim().toLowerCase();
  const nameQ = (this.invNombreFiltro || '').trim().toLowerCase();
  let filtered = this.insumosAllSig();
  if (codeQ) filtered = filtered.filter(x => String(x.item_catalogo || '').toLowerCase().includes(codeQ));
  if (nameQ) filtered = filtered.filter(x => String(x.nombre || '').toLowerCase().includes(nameQ));
  this.insumosListSig.set(filtered);
}

async quitar(ins: any) {
  try {
    const id = Number(ins?.id);
    const qty = this.getRemoveQty(id);
    if (!this.isValidQty(qty)) { this.snack.warn('Ingresa una cantidad válida (> 0)'); return; }
    this.busyIds.add(id);
    const delta = -Math.abs(Number(qty));
    const resp = await insumosService.ajustarExistencias(id, { delta });
    const nuevo = (resp as any)?.cantidad_existente;
    if (typeof nuevo !== 'undefined') {
      // Actualizar en listas locales
      const updater = (arr: any[]) => arr.map(x => x.id === id ? { ...x, cantidad_existente: nuevo } : x);
      this.insumosAllSig.set(updater(this.insumosAllSig()));
      this.insumosListSig.set(updater(this.insumosListSig()));
    }
    this.setRemoveQty(id, null);
    this.snack.success('Existencias actualizadas');
  } catch (e: any) {
    this.snack.error(e?.message || 'Error al ajustar existencias');
  } finally {
    // ensure removal of busy flag
    try { const id = Number(ins?.id); this.busyIds.delete(id); } catch {}
  }
}

async buscarCatalogo() {
  const q = this.normalizarTexto(this.catalogoQ || '');
  if (!this.catalogoBaseSig().length) {
    await this.cargarCatalogoBase();
  }
  this.catalogoCargandoSig.set(true);
  try {
    if (!q) {
      this.catalogoResultadosSig.set(this.catalogoBaseSig().slice());
    } else {
      const filtered = this.catalogoBaseSig().filter(c =>
        this.normalizarTexto(c.item || '').includes(q) ||
        this.normalizarTexto(c.nombre || '').includes(q)
      );
      this.catalogoResultadosSig.set(filtered);
    }
  } finally {
    this.catalogoCargandoSig.set(false);
  }
}

async cargarCatalogoBase() {
  try {
    const resp = await insumosService.buscarCatalogo('');
    if (Array.isArray(resp)) {
      this.catalogoBaseSig.set(resp);
      this.catalogoTotalSig.set(resp.length);
      this.catalogoResultadosSig.set(resp.slice());
    } else {
      const base = resp.rows || [];
      this.catalogoBaseSig.set(base);
      this.catalogoTotalSig.set(base.length);
      this.catalogoResultadosSig.set(base.slice());
    }
    this.catalogoItemResultados = this.catalogoBaseSig().slice();
    this.catalogoNombreResultados = this.catalogoBaseSig().slice();
  } catch (e) {
    console.error('Error cargando catálogo inicial de insumos', e);
    this.catalogoMsgSig.set('Error cargando catálogo');
    this.catalogoBaseSig.set([]);
    this.catalogoResultadosSig.set([]);
    this.catalogoTotalSig.set(0);
  }
}

async loadCatalogoInicial() {
  this.itemFiltroSig.set('');
  this.nombreFiltroSig.set('');
  try {
    await this.cargarCatalogoBase();
  } finally {
    this.catalogoCargandoSig.set(false);
  }
}

  seleccionarCatalogo(catalogoItem: any) {
    this.catalogoSeleccionado = catalogoItem;
    
    // ✅ Asignar item_catalogo desde el catálogo
    this.item_catalogo = parseInt(catalogoItem.item) || null;
    this.nombre = catalogoItem.nombre || '';
    this.descripcion = catalogoItem.descripcion || '';
    
    // Ocultar panel de catálogo
    this.mostrarCatalogoFormPanel = false;
  }

filtrarCatalogoItem() {
  const q = this.normalizarTexto(this.itemFiltro || '');
  if (!q) {
    this.catalogoItemResultados = this.catalogoBaseSig().slice();
  } else {
    // Coincidencia insensible a mayúsculas y en cualquier parte del código
    this.catalogoItemResultados = this.catalogoBaseSig().filter(c => this.normalizarTexto(c.item || '').includes(q));
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
  const codeQraw = (this.itemFiltro || '').trim();
  const nameQraw = (this.nombreFiltro || '').trim();
  const codeQ = this.normalizarTexto(codeQraw);
  const nameQ = this.normalizarTexto(nameQraw);
  // Estrategia sin paginado: si sólo hay código o sólo nombre, consultamos backend con ese término; si ambos, traemos todo y filtramos local con AND
  let backendQuery = '';
  if (codeQ && !nameQ) backendQuery = codeQraw;
  else if (nameQ && !codeQ) backendQuery = nameQraw;
  else backendQuery = '';

  const resp = await insumosService.buscarCatalogo(backendQuery);
  let base: any[] = [];
  if (Array.isArray(resp)) {
    base = resp;
    this.catalogoTotal = resp.length;
  } else {
    base = resp.rows || [];
    this.catalogoTotal = base.length;
  }

  // Filtrado exclusivo (local)
  let filtered = base;
  if (codeQ) {
    filtered = filtered.filter(c => this.normalizarTexto(c.item || '').includes(codeQ));
  }
  if (nameQ) {
    filtered = filtered.filter(c => this.normalizarTexto(c.nombre || '').includes(nameQ));
  }

  this.catalogoBaseSig.set(base);
  this.catalogoResultadosSig.set(filtered);
  this.catalogoTotalSig.set(filtered.length);
  this.catalogoItemResultados = this.catalogoBaseSig().slice();
  this.catalogoNombreResultados = this.catalogoBaseSig().slice();
}

normalizarTexto(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Reiniciar filtros y recargar catálogo completo
resetCatalogoPaginado() {
  this.itemFiltroSig.set('');
  this.nombreFiltroSig.set('');
  this.cargarCatalogoBase();
}

 trackByCatalogo(index: number, catalogoItem: any) {
    return catalogoItem?.item || index;
  }

  // Click en tarjeta del catálogo: precargar datos y enfocar el formulario de crear insumo
  onCatalogCardClick(c: any) {
    try {
      const itemNum = parseInt(String(c?.item), 10);
      this.item_catalogo = Number.isNaN(itemNum) ? null : itemNum;
      this.nombre = c?.nombre || '';
      this.descripcion = c?.descripcion || '';
      this.mostrarDetalles = false;

      // Desplazar hasta el formulario y enfocar el campo Item catálogo
      this.scrollToInsumoForm();
    } catch (e) {
      console.error('Error al manejar click en tarjeta de catálogo', e);
    }
  }

  private scrollToInsumoForm() {
    try {
      // Retrasar para asegurar que el *ngIf renderizó el formulario
      setTimeout(() => {
        this.insumoFormSection?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Enfocar tras un pequeño delay para permitir el scroll/render
        setTimeout(() => {
          this.itemCatalogoInput?.nativeElement?.focus();
          // Seleccionar valor para facilitar sobreescritura si se desea
          const el = this.itemCatalogoInput?.nativeElement;
          if (el) {
            try { el.setSelectionRange(0, String(el.value || '').length); } catch {}
          }
        }, 200);
      }, 50);
    } catch {}
  }

// Selección desde el catálogo
  onItemSeleccionado() {
    const catalogoItem = this.catalogoBaseSig().find(c => 
      String(c.item) === String(this.item_catalogo) 
    );
    if (!catalogoItem) return;
    
    this.catalogoSeleccionado = catalogoItem;
    this.nombre = catalogoItem.nombre || '';
    this.descripcion = catalogoItem.descripcion || '';
  }

onNombreSeleccionado() {
  const catalogoItem = this.catalogoBaseSig().find(c => (c.nombre || '') === (this.nombre || ''));
  if (!catalogoItem) return;
  this.catalogoSeleccionado = catalogoItem;
  this.item_catalogo = parseInt(catalogoItem.item) || null;            
  this.descripcion = catalogoItem.descripcion || '';
}

// Getters para mantener compatibilidad con el template existente
get catalogoResultados() { return this.catalogoResultadosSig(); }
get catalogoBase() { return this.catalogoBaseSig(); }

// Resalta coincidencias de búsqueda/filtro dentro de campos
highlightField(value: string, field:'nombre' | 'otro' | 'item'): SafeHtml {
  if (!value) return '';
  // Determinar si el usuario está filtrando exclusivamente por código o exclusivamente por nombre
  const hasCode = !!this.itemFiltro.trim();
  const hasName = !!this.nombreFiltro.trim();
  const exclusiveCode = hasCode && !hasName;
  const exclusiveName = hasName && !hasCode;

  let term: string | null = null; 
  if (exclusiveCode && field === 'item') {
    term = this.normalizarTexto(this.itemFiltro);
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

// ===== VALIDACIONES CATÁLOGO =====
private validarFormularioCatalogo(): boolean {
  const errors: {[key: string]: string} = {};
  let isValid = true;

  // Validación de item (OBLIGATORIO)
  const itemStr = (this.catItem ?? '').toString().trim();
  if (!itemStr) {
    errors['item'] = 'El item es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.ITEM.test(itemStr)) {
    errors['item'] = 'El item debe contener solo números (1-10 dígitos)';
    isValid = false;
  } else if (isNaN(Number(itemStr))) {
    errors['item'] = 'El item debe ser un número válido';
    isValid = false;
  }

  // Validación de nombre (OBLIGATORIO)
  const nombreStr = (this.catNombre ?? '').toString().trim();
  if (!nombreStr) {
    errors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.NOMBRE.test(nombreStr)) {
    errors['nombre'] = 'El nombre debe contener solo letras, números y espacios (2-100 caracteres)';
    isValid = false;
  }

  // Validación de descripción (NO obligatorio)
  const descStr = (this.catDescripcion ?? '').toString().trim();
  if (descStr && !this.PATTERNS.DESCRIPCION.test(descStr)) {
    errors['descripcion'] = 'La descripción no puede exceder 500 caracteres';
    isValid = false;
  }

  // Validación de imagen (OBLIGATORIO)
  if (!this.catImagen) {
    errors['imagen'] = 'La imagen es obligatoria';
    isValid = false;
  } else {
    const file = this.catImagen;
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      errors['imagen'] = 'El archivo debe ser una imagen';
      isValid = false;
    }
    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      errors['imagen'] = 'La imagen no puede pesar más de 5 MB';
      isValid = false;
    }
  }

  this.catalogoErrors.set(errors);
  return isValid;
}

// ===== VALIDACIONES INSUMO =====
private validarFormularioInsumo(): boolean {
  const errors: {[key: string]: string} = {};
  let isValid = true;

  // Validación de item catálogo (OBLIGATORIO)
  if (!this.item_catalogo) {
    errors['item_catalogo'] = 'El item de catálogo es obligatorio';
    isValid = false;
  } else if (this.item_catalogo! <= 0) {
    errors['item_catalogo'] = 'El item de catálogo debe ser mayor a 0';
    isValid = false;
  }

  // Validación de nombre (OBLIGATORIO)
  const nombreStr = (this.nombre ?? '').toString().trim();
  if (!nombreStr) {
    errors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (!this.PATTERNS.NOMBRE.test(nombreStr)) {
    errors['nombre'] = 'El nombre debe contener solo letras, números y espacios (2-100 caracteres)';
    isValid = false;
  }

  // Validación de cantidad adquirida (OBLIGATORIO)
  if (this.cantidad_adquirida === null) {
    errors['cantidad_adquirida'] = 'La cantidad adquirida es obligatoria';
    isValid = false;
  } else if (this.cantidad_adquirida! < 0) {
    errors['cantidad_adquirida'] = 'La cantidad adquirida debe ser mayor o igual a 0';
    isValid = false;
  }

  // Validación de cantidad existente (OBLIGATORIO)
  if (this.cantidad_existente === null) {
    errors['cantidad_existente'] = 'La cantidad existente es obligatoria';
    isValid = false;
  } else if (this.cantidad_existente! < 0) {
    errors['cantidad_existente'] = 'La cantidad existente debe ser mayor o igual a 0';
    isValid = false;
  }

  // Validación de presentación (OBLIGATORIO)
  const presentacionStr = (this.presentacion ?? '').toString().trim();
  if (!presentacionStr) {
    errors['presentacion'] = 'La presentación es obligatoria';
    isValid = false;
  } else if (!this.PATTERNS.PRESENTACION.test(presentacionStr)) {
    errors['presentacion'] = 'La presentación no puede exceder 50 caracteres';
    isValid = false;
  }

  // Validación de marca (OBLIGATORIO)
  const marcaStr = (this.marca ?? '').toString().trim();
  if (!marcaStr) {
    errors['marca'] = 'La marca es obligatoria';
    isValid = false;
  } else if (!this.PATTERNS.MARCA.test(marcaStr)) {
    errors['marca'] = 'La marca no puede exceder 50 caracteres';
    isValid = false;
  }

  // Validación de referencia (OBLIGATORIO)
  const referenciaStr = (this.referencia ?? '').toString().trim();
  if (!referenciaStr) {
    errors['referencia'] = 'La referencia es obligatoria';
    isValid = false;
  } else if (!this.PATTERNS.REFERENCIA.test(referenciaStr)) {
    errors['referencia'] = 'La referencia no puede exceder 50 caracteres';
    isValid = false;
  }

  // Validación de ubicación (OBLIGATORIO)
  const ubicacionStr = (this.ubicacion ?? '').toString().trim();
  if (!ubicacionStr) {
    errors['ubicacion'] = 'La ubicación es obligatoria';
    isValid = false;
  } else if (!this.PATTERNS.UBICACION.test(ubicacionStr)) {
    errors['ubicacion'] = 'La ubicación no puede exceder 100 caracteres';
    isValid = false;
  }

  // Validación de fecha adquisición (OBLIGATORIO)
  if (!this.fecha_adquisicion) {
    errors['fecha_adquisicion'] = 'La fecha de adquisición es obligatoria';
    isValid = false;
  } else {
    const fechaAdq = new Date(this.fecha_adquisicion);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (fechaAdq > hoy) {
      errors['fecha_adquisicion'] = 'La fecha de adquisición no puede ser futura';
      isValid = false;
    }
  }

  // Validación de descripción (OBLIGATORIO)
  const descripcionStr = (this.descripcion ?? '').toString().trim();
  if (!descripcionStr) {
    errors['descripcion'] = 'La descripción es obligatoria';
    isValid = false;
  } else if (!this.PATTERNS.DESCRIPCION.test(descripcionStr)) {
    errors['descripcion'] = 'La descripción no puede exceder 500 caracteres';
    isValid = false;
  }

  // Validación de observaciones (NO obligatorio)
  const observacionesStr = (this.observaciones ?? '').toString().trim();
  if (observacionesStr && !this.PATTERNS.OBSERVACIONES.test(observacionesStr)) {
    errors['observaciones'] = 'Las observaciones no pueden exceder 500 caracteres';
    isValid = false;
  }

  this.insumoErrors.set(errors);
  return isValid;
}

async crearCatalogo(e: Event) {
  e.preventDefault();
  this.catalogoMsg = '';
  
  // Reemplazar validación actual con la nueva
  if (!this.validarFormularioCatalogo()) {
    this.snack.warn('Por favor corrige los errores en el formulario');
    return;
  }
  
  const itemStr = (this.catItem ?? '').toString().trim();
  const nombreStr = (this.catNombre ?? '').toString().trim();
  
  try {
    const form = new FormData();
    form.append('nombre', nombreStr);
    const descStr = (this.catDescripcion ?? '').toString().trim();
    if (descStr) form.append('descripcion', descStr);
    if (itemStr) form.append('item', itemStr);
    if (this.catImagen) form.append('imagen', this.catImagen);
    
    await insumosService.crearCatalogo(form);
    this.snack.success('Se creó el item de catálogo');
    
    // Limpiar formulario y errores
    this.catItem = '' as any;
    this.catNombre = '';
    this.catDescripcion = '';
    this.catImagen = null;
    this.catalogoErrors.set({});
    
    // Limpiar input file explícitamente
    try {
      const input = document.getElementById('catImagen') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch {}
    
    // Recargar catálogo
    await this.cargarCatalogoBase();
    
  } catch (err: any) {
    this.snack.error(err?.message || 'Error al crear el item de catálogo');
  }
}

async crearInsumo(e: Event) {
  e.preventDefault();
  this.insumoMsgSig.set('');
  
  // Reemplazar validación actual con la nueva
  if (!this.validarFormularioInsumo()) {
    this.snack.warn('Por favor corrige los errores en el formulario');
    return;
  }
  
  try {
    const payload = {
      item_catalogo: this.item_catalogo,
      nombre: this.nombre.trim(),
      marca: this.marca.trim(),
      presentacion: this.presentacion?.trim() || null,
      referencia: this.referencia?.trim() || null,
      cantidad_adquirida: this.cantidad_adquirida,
      cantidad_existente: this.cantidad_existente,
      fecha_adquisicion: this.fecha_adquisicion,
      ubicacion: this.ubicacion.trim() || null,
      observaciones: this.observaciones.trim() || null,
      descripcion: this.descripcion.trim() || null,
    };

    await insumosService.crearInsumo(payload);
    this.snack.success('Se creó el insumo');

    await this.loadInsumos();
    // Reset campos y limpiar errores
    this.resetInsumoForm();
    this.insumoErrors.set({});
    
  } catch (err: any) {
    this.snack.error(err?.message || 'Error al crear el insumo');
  }
}

// Actualizar método reset para limpiar errores
resetInsumoForm() {
  this.item_catalogo = null;
  this.nombre = '';
  this.marca = '';
  this.presentacion = '';
  this.referencia = '';
  this.cantidad_adquirida = null;
  this.cantidad_existente = null;
  this.fecha_adquisicion = '';
  this.ubicacion = '';
  this.observaciones = '';
  this.descripcion = '';
  this.insumoMsg = '';
  this.insumoErrors.set({});
  
  try {
    const input = document.getElementById('catImagen') as HTMLInputElement | null;
    if (input) input.value = '';
  } catch {}
}

// Limpiar error de imagen al seleccionar archivo
onCatImagenChange(ev: any) {
  const file = ev?.target?.files?.[0];
  this.catImagen = file || null;
  
  // Limpiar error de imagen al seleccionar archivo
  if (file) {
    this.catalogoErrors.update(errors => {
      const newErrors = { ...errors };
      delete newErrors['imagen'];
      return newErrors;
    });
  }
}

logout() {
  authService.logout();
}

// Imagen catálogo helper
getCatalogoImagenUrl(item: number | string) {
  return insumosService.getCatalogoImagenUrl(item);
}

onImgError(ev: any) {
  try {
    const img = ev?.target as HTMLImageElement;
    if (img) img.style.display = 'none';
  } catch {}
}
}