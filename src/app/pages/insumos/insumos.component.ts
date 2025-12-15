import { Component, OnInit, signal, ElementRef, ViewChild, HostListener } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SnackbarService } from '../../shared/snackbar.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { authService, authUser } from '../../services/auth/auth.service';
import { insumosService } from '../../services/insumos.service';
import { NumbersOnlyDirective } from '../../directives/numbers-only.directive';
import { LettersOnlyDirective } from '../../directives/letters-only.directive';
import { AlphaNumericDirective } from '../../directives/alpha-numeric.directive';

@Component({  
  standalone: true,
  selector: 'app-insumos',
  templateUrl: './insumos.component.html',
  styleUrls: ['./insumos.component.css'],
  imports: [CommonModule, FormsModule, RouterModule, NumbersOnlyDirective, LettersOnlyDirective, AlphaNumericDirective],
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
  catalogoErrors: { [key: string]: string } = {};
insumoErrors: { [key: string]: string } = {};


  // Track which quick-action form is active (null = none)
  formularioActivo: string | null = null;

  // Toggle which formulario is active; clicking again closes it
  toggleFormulario(tipo: string) {
    const opening = this.formularioActivo !== tipo;
    this.formularioActivo = opening ? tipo : null;
    // Only auto-scroll when opening the 'crear-insumo' form to avoid
    // jumping the page for other quick-actions.
    if (opening && tipo === 'crear-insumo') {
      setTimeout(() => {
        try {
          if (this.insumoFormSection) {
            this.insumoFormSection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optionally focus the first input inside the section
            const first = this.insumoFormSection.nativeElement.querySelector('input, textarea, select') as HTMLElement | null;
            if (first) first.focus();
          }
        } catch (e) { /* ignore scroll/focus errors */ }
      }, 60);
    }
  }

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
  // Paginación del catálogo removida: siempre mostrar todo

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

// (Listado de insumos eliminado: señales, filtros y edición inline removidos)

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

  // ===== Inventario: funcionalidades de tarjetas eliminadas =====

// (Helpers de obtención de nombres eliminados al retirar vista de listado de insumos)

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

async crearCatalogo(e: Event) {
  e.preventDefault();
  this.catalogoMsg = '';
  
  // USAR EL MÉTODO DE VALIDACIÓN NUEVO (igual que en Solicitudes)
  if (!this.validarCatalogo()) {
    this.snack.warn('Por favor corrige los campos resaltados.');
    return;
  }
  
  try {
    const itemStr = (this.catItem ?? '').toString().trim();
    const nombreStr = (this.catNombre ?? '').toString().trim();
    
    const form = new FormData();
    form.append('nombre', nombreStr);
    const descStr = (this.catDescripcion ?? '').toString().trim();
    if (descStr) form.append('descripcion', descStr);
    if (itemStr) form.append('item', itemStr);
    if (this.catImagen) form.append('imagen', this.catImagen);
    
    await insumosService.crearCatalogo(form);
    
    this.snack.success('Se creó el item de catálogo');
    
    // Limpiar errores después de éxito
    this.catalogoErrors = {};
    
    // Limpiar formulario
    this.catItem = '' as any;
    this.catNombre = '';
    this.catDescripcion = '';
    this.catImagen = null;
    // Limpiar input file explícitamente (si existe)
    try {
      const input = document.getElementById('catImagen') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch {}
    
    // Recargar catálogo
    await this.cargarCatalogoBase();
    
    if ((this.itemFiltro || '').trim() || (this.nombreFiltro || '').trim()) {
      this.filtrarCatalogoPorCampos();
    } else {
      this.catalogoQ = '';
      await this.buscarCatalogo();
    }
  } catch (err: any) {
    this.snack.error(err?.message || 'Error al crear el item de catálogo');
  }
}

validarCatalogo(): boolean {
  this.catalogoErrors = {};
  let isValid = true;

  // ===== VALIDACIÓN DE CAMPOS OBLIGATORIOS =====

  // 1. Validación de item (OBLIGATORIO)
  const itemStr = (this.catItem ?? '').toString().trim();
  if (!itemStr) {
    this.catalogoErrors['item'] = 'El item es obligatorio';
    isValid = false;
  } else if (isNaN(Number(itemStr))) {
    this.catalogoErrors['item'] = 'El item debe ser numérico';
    isValid = false;
  } else if (Number(itemStr) <= 0) {
    this.catalogoErrors['item'] = 'El item debe ser mayor a 0';
    isValid = false;
  } else if (Number(itemStr) > 999999) {
    this.catalogoErrors['item'] = 'El item no puede exceder 999,999';
    isValid = false;
  }

  // 2. Validación de nombre (OBLIGATORIO)
  const nombreStr = (this.catNombre ?? '').toString().trim();
  if (!nombreStr) {
    this.catalogoErrors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (nombreStr.length > 200) {
    this.catalogoErrors['nombre'] = 'El nombre no puede exceder 200 caracteres';
    isValid = false;
  } else if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.\,\/\(\)]{2,200}$/.test(nombreStr)) {
    this.catalogoErrors['nombre'] = 'El nombre contiene caracteres no permitidos';
    isValid = false;
  }

  // ===== VALIDACIÓN DE CAMPOS NO OBLIGATORIOS (si se ingresan) =====

  // 3. Validación de descripción (NO obligatorio)
  if (this.catDescripcion && this.catDescripcion.trim()) {
    if (this.catDescripcion.length > 500) {
      this.catalogoErrors['descripcion'] = 'La descripción no puede exceder 500 caracteres';
      isValid = false;
    }
  }

  // 4. Validación de imagen (NO obligatorio, pero validar tipo si se sube)
  if (this.catImagen) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    // Validar tipo de archivo
    if (!validTypes.includes(this.catImagen.type.toLowerCase())) {
      this.catalogoErrors['imagen'] = 'Formato de imagen no válido (JPEG, PNG, GIF, WebP)';
      isValid = false;
    }
    
    // Validar tamaño
    if (this.catImagen.size > maxSize) {
      this.catalogoErrors['imagen'] = 'La imagen no puede exceder 5 MB';
      isValid = false;
    }
    
    // Validar nombre de archivo (opcional)
    const fileName = this.catImagen.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      this.catalogoErrors['imagen'] = 'Extensión de archivo no válida';
      isValid = false;
    }
  }

  return isValid;
}

// ===== VALIDACIÓN EN TIEMPO REAL PARA CATÁLOGO =====
validarCampoCatalogoEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorCatalogo(campo);
  this.catalogoErrors[campo] = this.validarCampoCatalogoIndividual(campo, valor);
}

private getValorCatalogo(campo: string): any {
  switch (campo) {
    case 'item': return this.catItem;
    case 'nombre': return this.catNombre;
    case 'descripcion': return this.catDescripcion;
    case 'imagen': return this.catImagen;
    default: return '';
  }
}

private validarCampoCatalogoIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'item':
      const itemStr = (valor ?? '').toString().trim();
      if (!itemStr) return 'El item es obligatorio';
      if (isNaN(Number(itemStr))) return 'El item debe ser numérico';
      if (Number(itemStr) <= 0) return 'El item debe ser mayor a 0';
      if (Number(itemStr) > 999999) return 'El item no puede exceder 999,999';
      return '';
      
    case 'nombre':
      const nombreStr = (valor ?? '').toString().trim();
      if (!nombreStr) return 'El nombre es obligatorio';
      if (nombreStr.length > 200) return 'El nombre no puede exceder 200 caracteres';
      if (!/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s\-\.\,\/\(\)]{2,200}$/.test(nombreStr)) 
        return 'El nombre contiene caracteres no permitidos';
      return '';
      
    case 'descripcion':
      if (valor && valor.trim() && valor.length > 500) 
        return 'La descripción no puede exceder 500 caracteres';
      return '';
      
    case 'imagen':
      if (valor) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
        const maxSize = 5 * 1024 * 1024;
        
        if (!validTypes.includes(valor.type.toLowerCase())) 
          return 'Formato de imagen no válido (JPEG, PNG, GIF, WebP)';
        
        if (valor.size > maxSize) 
          return 'La imagen no puede exceder 5 MB';
        
        const fileName = valor.name.toLowerCase();
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) 
          return 'Extensión de archivo no válida';
      }
      return '';
      
    default:
      return '';
  }
}

// ===== VALIDACIÓN EN TIEMPO REAL PARA INSUMO =====
validarCampoInsumoEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorInsumo(campo);
  this.insumoErrors[campo] = this.validarCampoInsumoIndividual(campo, valor);
}

private getValorInsumo(campo: string): any {
  switch (campo) {
    case 'item_catalogo': return this.item_catalogo;
    case 'nombre': return this.nombre;
    case 'marca': return this.marca;
    case 'presentacion': return this.presentacion;
    case 'referencia': return this.referencia;
    case 'cantidad_adquirida': return this.cantidad_adquirida;
    case 'cantidad_existente': return this.cantidad_existente;
    case 'fecha_adquisicion': return this.fecha_adquisicion;
    case 'ubicacion': return this.ubicacion;
    case 'descripcion': return this.descripcion;
    case 'observaciones': return this.observaciones;
    default: return '';
  }
}

private validarCampoInsumoIndividual(campo: string, valor: any): string {
  switch (campo) {
    case 'item_catalogo':
      if (!valor && valor !== 0) return 'El item de catálogo es obligatorio';
      if (isNaN(Number(valor))) return 'El item debe ser numérico';
      if (Number(valor) <= 0) return 'El item debe ser mayor a 0';
      return '';
      
    case 'nombre':
      const nombreStr = (valor ?? '').toString().trim();
      if (!nombreStr) return 'El nombre es obligatorio';
      if (nombreStr.length > 200) return 'El nombre no puede exceder 200 caracteres';
      return '';
      
    case 'marca':
      const marcaStr = (valor ?? '').toString().trim();
      if (!marcaStr) return 'La marca es obligatoria';
      if (marcaStr.length > 100) return 'La marca no puede exceder 100 caracteres';
      return '';
      
    case 'presentacion':
      const presentacionStr = (valor ?? '').toString().trim();
      if (!presentacionStr) return 'La presentación es obligatoria';
      if (presentacionStr.length > 100) return 'La presentación no puede exceder 100 caracteres';
      return '';
      
    case 'referencia':
      const referenciaStr = (valor ?? '').toString().trim();
      if (!referenciaStr) return 'La referencia es obligatoria';
      if (referenciaStr.length > 100) return 'La referencia no puede exceder 100 caracteres';
      return '';
      
    case 'cantidad_adquirida':
      if (valor === null || valor === undefined) return 'La cantidad adquirida es obligatoria';
      if (valor < 0) return 'La cantidad no puede ser negativa';
      return '';
      
    case 'cantidad_existente':
      if (valor === null || valor === undefined) return 'La cantidad existente es obligatoria';
      if (valor < 0) return 'La cantidad no puede ser negativa';
      
      // Validación cruzada solo si ambos campos tienen valor
      const cantidadAdquirida = this.cantidad_adquirida;
      if (cantidadAdquirida !== null && cantidadAdquirida !== undefined && 
          Number(valor) > Number(cantidadAdquirida)) {
        return 'La cantidad existente no puede ser mayor que la cantidad adquirida';
      }
      return '';
      
    case 'fecha_adquisicion':
      const fechaStr = (valor ?? '').toString().trim();
      if (!fechaStr) return 'La fecha de adquisición es obligatoria';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return 'Formato de fecha inválido (AAAA-MM-DD)';
      
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return 'Fecha inválida';
      
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      if (fecha > hoy) return 'La fecha no puede ser futura';
      return '';
      
    case 'ubicacion':
      const ubicacionStr = (valor ?? '').toString().trim();
      if (!ubicacionStr) return 'La ubicación es obligatoria';
      if (ubicacionStr.length > 200) return 'La ubicación no puede exceder 200 caracteres';
      return '';
      
    case 'descripcion':
      if (valor && valor.trim() && valor.length > 500) 
        return 'La descripción no puede exceder 500 caracteres';
      return '';
      
    case 'observaciones':
      if (valor && valor.trim() && valor.length > 1000) 
        return 'Las observaciones no pueden exceder 1000 caracteres';
      return '';
      
    default:
      return '';
  }
}

async crearInsumo(e: Event) {
  e.preventDefault();
  this.insumoMsgSig.set('');
  
  // USAR EL MÉTODO DE VALIDACIÓN NUEVO (igual que en Solicitudes)
  if (!this.validarInsumo()) {
    this.snack.warn('Por favor corrige los campos resaltados.');
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

    // Limpiar errores después de éxito
    this.insumoErrors = {};

    await this.loadInsumos();
    this.resetInsumoForm();
  } catch (err: any) {
    this.snack.error(err?.message || 'Error al crear el insumo');
  }
}

validarInsumo(): boolean {
  this.insumoErrors = {};
  let isValid = true;

  // ===== VALIDACIÓN DE TODOS LOS CAMPOS OBLIGATORIOS =====

  // 1. Validación de item catálogo (OBLIGATORIO)
  if (!this.item_catalogo && this.item_catalogo !== 0) {
    this.insumoErrors['item_catalogo'] = 'El item de catálogo es obligatorio';
    isValid = false;
  } else if (isNaN(Number(this.item_catalogo))) {
    this.insumoErrors['item_catalogo'] = 'El item debe ser numérico';
    isValid = false;
  } else if (Number(this.item_catalogo) <= 0) {
    this.insumoErrors['item_catalogo'] = 'El item debe ser mayor a 0';
    isValid = false;
  }

  // 2. Validación de nombre (OBLIGATORIO)
  if (!this.nombre?.trim()) {
    this.insumoErrors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (this.nombre.length > 200) {
    this.insumoErrors['nombre'] = 'El nombre no puede exceder 200 caracteres';
    isValid = false;
  }

  // 3. Validación de cantidad adquirida (OBLIGATORIO)
  if (this.cantidad_adquirida === null || this.cantidad_adquirida === undefined) {
    this.insumoErrors['cantidad_adquirida'] = 'La cantidad adquirida es obligatoria';
    isValid = false;
  } else if (this.cantidad_adquirida < 0) {
    this.insumoErrors['cantidad_adquirida'] = 'La cantidad no puede ser negativa';
    isValid = false;
  }

  // 4. Validación de cantidad existente (OBLIGATORIO)
  if (this.cantidad_existente === null || this.cantidad_existente === undefined) {
    this.insumoErrors['cantidad_existente'] = 'La cantidad existente es obligatoria';
    isValid = false;
  } else if (this.cantidad_existente < 0) {
    this.insumoErrors['cantidad_existente'] = 'La cantidad no puede ser negativa';
    isValid = false;
  }

  // 5. Validación de presentación (OBLIGATORIO)
  if (!this.presentacion?.trim()) {
    this.insumoErrors['presentacion'] = 'La presentación es obligatoria';
    isValid = false;
  } else if (this.presentacion.length > 100) {
    this.insumoErrors['presentacion'] = 'La presentación no puede exceder 100 caracteres';
    isValid = false;
  }

  // 6. Validación de marca (OBLIGATORIO)
  if (!this.marca?.trim()) {
    this.insumoErrors['marca'] = 'La marca es obligatoria';
    isValid = false;
  } else if (this.marca.length > 100) {
    this.insumoErrors['marca'] = 'La marca no puede exceder 100 caracteres';
    isValid = false;
  }

  // 7. Validación de referencia (OBLIGATORIO)
  if (!this.referencia?.trim()) {
    this.insumoErrors['referencia'] = 'La referencia es obligatoria';
    isValid = false;
  } else if (this.referencia.length > 100) {
    this.insumoErrors['referencia'] = 'La referencia no puede exceder 100 caracteres';
    isValid = false;
  }

  // 8. Validación de ubicación (OBLIGATORIO)
  if (!this.ubicacion?.trim()) {
    this.insumoErrors['ubicacion'] = 'La ubicación es obligatoria';
    isValid = false;
  } else if (this.ubicacion.length > 200) {
    this.insumoErrors['ubicacion'] = 'La ubicación no puede exceder 200 caracteres';
    isValid = false;
  }

  // 9. Validación de fecha adquisición (OBLIGATORIO)
  if (!this.fecha_adquisicion?.trim()) {
    this.insumoErrors['fecha_adquisicion'] = 'La fecha de adquisición es obligatoria';
    isValid = false;
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(this.fecha_adquisicion)) {
    this.insumoErrors['fecha_adquisicion'] = 'Formato de fecha inválido (AAAA-MM-DD)';
    isValid = false;
  } else {
    const fecha = new Date(this.fecha_adquisicion);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (isNaN(fecha.getTime())) {
      this.insumoErrors['fecha_adquisicion'] = 'Fecha inválida';
      isValid = false;
    } else if (fecha > hoy) {
      this.insumoErrors['fecha_adquisicion'] = 'La fecha no puede ser futura';
      isValid = false;
    }
  }

  // ===== VALIDACIÓN DE CAMPOS NO OBLIGATORIOS =====

  // 10. Validación de descripción (NO obligatorio)
  if (this.descripcion && this.descripcion.trim()) {
    if (this.descripcion.length > 500) {
      this.insumoErrors['descripcion'] = 'La descripción no puede exceder 500 caracteres';
      isValid = false;
    }
  }

  // 11. Validación de observaciones (NO obligatorio)
  if (this.observaciones && this.observaciones.trim()) {
    if (this.observaciones.length > 1000) {
      this.insumoErrors['observaciones'] = 'Las observaciones no pueden exceder 1000 caracteres';
      isValid = false;
    }
  }

  // ===== VALIDACIONES CRUZADAS =====

  // 12. Validar que cantidad existente no sea mayor que cantidad adquirida
  if (this.cantidad_adquirida !== null && this.cantidad_existente !== null &&
      Number(this.cantidad_existente) > Number(this.cantidad_adquirida)) {
    this.insumoErrors['cantidad_existente'] = 'La cantidad existente no puede ser mayor que la cantidad adquirida';
    isValid = false;
  }

  return isValid;
}

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
  try {
    const input = document.getElementById('catImagen') as HTMLInputElement | null;
    if (input) input.value = '';
  } catch {}
}

logout() {
  authService.logout();
}

// Imagen catálogo helper
getCatalogoImagenUrl(item: number | string) {
  return insumosService.getCatalogoImagenUrl(item);
}

onCatImagenChange(ev: any) {
  const file = ev?.target?.files?.[0];
  this.catImagen = file || null;
}

onImgError(ev: any) {
  try {
    const img = ev?.target as HTMLImageElement;
    if (img) img.style.display = 'none';
  } catch {}
}


}