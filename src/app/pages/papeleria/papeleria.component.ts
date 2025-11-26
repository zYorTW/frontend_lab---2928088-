import { Component, OnInit, signal, ElementRef, ViewChild, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SnackbarService } from '../../services/snackbar.service';
import { authService, authUser } from '../../services/auth/auth.service';
import { PapeleriaService, CatalogoItem, PapeleriaItem } from '../../services/papeleria.service';

interface CreatePapeleriaPayload {
  item_catalogo: number;
  nombre: string;
  cantidad_adquirida: number;
  cantidad_existente: number;
  presentacion?: string | null;
  marca?: string | null;
  descripcion?: string | null;
  fecha_adquisicion?: string | null;
  ubicacion?: string | null;
  observaciones?: string | null;
}

@Component({
  standalone: true,
  selector: 'app-papeleria',
  templateUrl: './papeleria.component.html',
  styleUrls: ['./papeleria.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class PapeleriaComponent implements OnInit {
  // Inyección de dependencias
  private sanitizer = inject(DomSanitizer);
  private snack = inject(SnackbarService);
  private papeleriaService = inject(PapeleriaService);

  // Referencias de elementos del DOM
  @ViewChild('papFormSection') papFormSection?: ElementRef<HTMLElement>;
  @ViewChild('itemCatalogoInput') itemCatalogoInput?: ElementRef<HTMLInputElement>;

  // Estado del usuario
  readonly esAuxiliar = computed(() => {
    const user = authUser();
    return user?.rol === 'Auxiliar';
  });

  // ===== FORMULARIO CATÁLOGO =====
  readonly catItem = signal<string>('');
  readonly catNombre = signal<string>('');
  readonly catDescripcion = signal<string>('');
  readonly catImagen = signal<File | null>(null);
  readonly catalogoMsg = signal<string>('');

  // ===== LISTADO CATÁLOGO =====
  readonly catalogoResultados = signal<CatalogoItem[]>([]);
  readonly catalogoBase = signal<CatalogoItem[]>([]);
  readonly catalogoCargando = signal<boolean>(false);
  readonly itemFiltro = signal<string>('');
  readonly nombreFiltro = signal<string>('');
  readonly catalogoTotal = signal<number>(0);

  // Paginación del catálogo
  private catalogoOffset = 0;
  private catalogoVisibleCount = 10;

  // ===== FORMULARIO INVENTARIO PAPELERÍA =====
  readonly item_catalogo = signal<number | null>(null);
  readonly nombre = signal<string>('');
  readonly cantidad_adquirida = signal<number | null>(null);
  readonly cantidad_existente = signal<number | null>(null);
  readonly presentacion = signal<string>('');
  readonly marca = signal<string>('');
  readonly descripcion = signal<string>('');
  readonly fecha_adquisicion = signal<string>('');
  readonly ubicacion = signal<string>('');
  readonly observaciones = signal<string>('');
  readonly papMsg = signal<string>('');

  // ===== INVENTARIO PAPELERÍA =====
  readonly papeleriaList = signal<PapeleriaItem[]>([]);
  readonly papeleriaCargando = signal<boolean>(false);
  readonly papeleriaError = signal<string>('');
  readonly papeleriaLastCreated = signal<PapeleriaItem | null>(null);
  
  // Estado para skeletons
  readonly skeletonPapeleria = Array.from({ length: 6 });

  // ===== FILTROS INVENTARIO =====
  readonly invItemFiltro = signal<string>('');
  readonly invNombreFiltro = signal<string>('');

  // ===== ESTADO INTERNO =====
  private removeQtyMap = new Map<number, number | null>();
  private busyIds = new Set<number>();
  private openItem: PapeleriaItem | null = null;
  private papeleriaAll: PapeleriaItem[] = [];

  // ===== MENÚ CONTEXTUAL =====
  readonly contextMenuVisible = signal<boolean>(false);
  private contextTarget: CatalogoItem | PapeleriaItem | null = null;
  contextMenuX = 0;
  contextMenuY = 0;

  // ===== MÉTODOS PÚBLICOS PARA TEMPLATE =====
  
  getRemoveQty(id: number): number | null {
    return this.removeQtyMap.get(id) ?? null;
  }

  setRemoveQty(id: number, value: any): void {
    const num = Number(value);
    this.removeQtyMap.set(id, Number.isFinite(num) ? num : null);
  }

  isBusy(id: number): boolean {
    return this.busyIds.has(id);
  }

  isValidQty(value: any): boolean {
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  }

  isOpen(item: PapeleriaItem): boolean {
    return this.openItem === item;
  }

  toggleOpen(item: PapeleriaItem): void {
    this.openItem = this.openItem === item ? null : item;
  }

  // ===== LIFECYCLE =====
  ngOnInit(): void {
    this.loadCatalogoInicial();
  }

  ngAfterViewInit(): void {
    this.loadPapeleriaList();
  }

  // ===== MANEJO DE EVENTOS GLOBALES =====
  onGlobalClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.contextMenuVisible() && !target.closest('.context-menu')) {
      this.closeContextMenu();
    }
  }

  // ===== CATÁLOGO - MÉTODOS PRINCIPALES =====
  async loadCatalogoInicial(): Promise<void> {
    this.catalogoOffset = 0;
    this.catalogoVisibleCount = 10;
    this.itemFiltro.set('');
    this.nombreFiltro.set('');

    try {
      this.catalogoCargando.set(true);
      const response = await this.papeleriaService.buscarCatalogo('', this.catalogoVisibleCount, this.catalogoOffset);
      
      // CORREGIDO: Usar || consistentemente
      const base = Array.isArray(response) ? response : (response.rows || []);
      this.catalogoBase.set(base);
      this.catalogoResultados.set([...base]);
      this.catalogoTotal.set(Array.isArray(response) ? base.length : (response.total || base.length));
    } catch (error) {
      console.error('Error cargando catálogo inicial:', error);
      this.snack.error('Error al cargar el catálogo');
    } finally {
      this.catalogoCargando.set(false);
    }
  }

  filtrarCatalogoPorCampos(): void {
    const codeQuery = this.itemFiltro().trim().toLowerCase();
    const nameQuery = this.nombreFiltro().trim().toLowerCase();
    const base = this.catalogoBase();

    let filtered = base;

    if (codeQuery) {
      filtered = filtered.filter(item => 
        String(item.item || '').toLowerCase().includes(codeQuery)
      );
    }

    if (nameQuery) {
      filtered = filtered.filter(item =>
        String(item.nombre || '').toLowerCase().includes(nameQuery)
      );
    }

    this.catalogoResultados.set(filtered);
  }

  async cargarMasCatalogo(): Promise<void> {
    if (this.catalogoResultados().length >= this.catalogoTotal()) return;

    this.catalogoOffset += this.catalogoVisibleCount;

    try {
      const query = this.itemFiltro() || this.nombreFiltro() || '';
      const response = await this.papeleriaService.buscarCatalogo(query, this.catalogoVisibleCount, this.catalogoOffset);
      
      // CORREGIDO: Usar || consistentemente
      const nuevos = Array.isArray(response) ? response : (response.rows || []);
      this.catalogoResultados.update(current => [...current, ...nuevos]);
      
      if (!Array.isArray(response)) {
        this.catalogoTotal.set(response.total || this.catalogoTotal());
      }
    } catch (error) {
      console.error('Error cargando más elementos del catálogo:', error);
      this.snack.error('Error al cargar más elementos');
    }
  }

  resetCatalogoPaginado(): void {
    this.catalogoVisibleCount = 10;
    this.catalogoOffset = 0;
    this.loadCatalogoInicial();
  }

  onCatImagenChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.catImagen.set(file);
  }

  async crearCatalogo(event: Event): Promise<void> {
    event.preventDefault();

    const itemStr = this.catItem().trim();
    const nombreStr = this.catNombre().trim();

    if (!itemStr || !nombreStr) {
      this.snack.warn('Faltan campos requeridos: Item y Nombre');
      return;
    }

    if (isNaN(Number(itemStr))) {
      this.snack.warn('El item debe ser numérico');
      return;
    }

    const formData = new FormData();
    formData.set('item', itemStr);
    formData.set('nombre', nombreStr);
    
    if (this.catDescripcion()) {
      formData.set('descripcion', this.catDescripcion());
    }
    
    if (this.catImagen()) {
      formData.set('imagen', this.catImagen()!);
    }

    try {
      await this.papeleriaService.crearCatalogo(formData);
      this.snack.success('Item de catálogo creado exitosamente');

      this.catItem.set('');
      this.catNombre.set('');
      this.catDescripcion.set('');
      this.catImagen.set(null);

      await this.loadCatalogoInicial();
    } catch (error: any) {
      console.error('Error creando catálogo:', error);
      this.snack.error(error?.message || 'Error al crear el item de catálogo');
    }
  }

  // ===== INVENTARIO PAPELERÍA - MÉTODOS PRINCIPALES =====
  async loadPapeleriaList(limit?: number): Promise<void> {
    this.papeleriaError.set('');
    this.papeleriaCargando.set(true);

    try {
      const response = await this.papeleriaService.listar('', limit || 0);
      
      // CORREGIDO: Usar || consistentemente
      const rows = Array.isArray(response) ? response : (response.rows || []);
      this.papeleriaAll = rows;
      this.papeleriaList.set(rows);
    } catch (error) {
      console.error('Error cargando listado de papelería:', error);
      this.papeleriaError.set('Error al cargar el inventario de papelería');
      this.papeleriaAll = [];
      this.papeleriaList.set([]);
    } finally {
      this.papeleriaCargando.set(false);
    }
  }

  filtrarPapeleriaPorCampos(): void {
    const codeQuery = this.invItemFiltro().trim().toLowerCase();
    const nameQuery = this.invNombreFiltro().trim().toLowerCase();

    let filtered = this.papeleriaAll;

    if (codeQuery) {
      filtered = filtered.filter(item =>
        String(item.item_catalogo || '').toLowerCase().includes(codeQuery)
      );
    }

    if (nameQuery) {
      filtered = filtered.filter(item =>
        String(item.nombre || '').toLowerCase().includes(nameQuery)
      );
    }

    this.papeleriaList.set(filtered);
  }

  async quitar(item: PapeleriaItem): Promise<void> {
    const id = item.id;
    const quantity = this.getRemoveQty(id);

    if (!this.isValidQty(quantity)) {
      this.snack.warn('Ingresa una cantidad válida mayor a 0');
      return;
    }

    try {
      this.busyIds.add(id);
      const delta = -Math.abs(Number(quantity));
      
      const response = await this.papeleriaService.ajustarExistencias(id, { delta });
      const nuevaCantidad = (response as any)?.cantidad_existente;

      if (typeof nuevaCantidad !== 'undefined') {
        this.actualizarCantidadExistente(id, nuevaCantidad);
      }

      this.setRemoveQty(id, null);
      this.snack.success('Existencias actualizadas correctamente');
    } catch (error: any) {
      console.error('Error ajustando existencias:', error);
      this.snack.error(error?.message || 'Error al ajustar las existencias');
    } finally {
      this.busyIds.delete(id);
    }
  }

  async eliminar(item: PapeleriaItem): Promise<void> {
    const confirmacion = window.confirm(
      `¿Eliminar el registro de papelería "${item.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmacion) return;

    try {
      this.busyIds.add(item.id);
      await this.papeleriaService.eliminar(item.id);
      
      this.papeleriaAll = this.papeleriaAll.filter(x => x.id !== item.id);
      this.papeleriaList.update(current => current.filter(x => x.id !== item.id));
      
      this.removeQtyMap.delete(item.id);
      
      if (this.openItem === item) {
        this.openItem = null;
      }

      this.snack.success('Registro eliminado exitosamente');
    } catch (error: any) {
      console.error('Error eliminando registro:', error);
      this.snack.error(error?.message || 'Error al eliminar el registro');
    } finally {
      this.busyIds.delete(item.id);
    }
  }

  async crearPapeleria(event: Event): Promise<void> {
    event.preventDefault();
    this.papMsg.set('');

    if (!this.validarFormularioPapeleria()) {
      return;
    }

    try {
      const payload: CreatePapeleriaPayload = {
        item_catalogo: this.item_catalogo()!,
        nombre: this.nombre().trim(),
        cantidad_adquirida: this.cantidad_adquirida()!,
        cantidad_existente: this.cantidad_existente()!,
        presentacion: this.presentacion().trim() || null,
        marca: this.marca().trim() || null,
        descripcion: this.descripcion().trim() || null,
        fecha_adquisicion: this.fecha_adquisicion() || null,
        ubicacion: this.ubicacion().trim() || null,
        observaciones: this.observaciones().trim() || null,
      };

      const created = await this.papeleriaService.crear(payload);
      await this.procesarRegistroCreado(created, payload);
      
      this.limpiarFormularioPapeleria();
      this.snack.success('Registro de papelería creado exitosamente');
    } catch (error: any) {
      console.error('Error creando registro de papelería:', error);
      this.snack.error(error?.message || 'Error al crear el registro de papelería');
    }
  }

  // ===== MÉTODOS DE INTERACCIÓN CON LA UI =====
  onCatalogCardClick(item: CatalogoItem): void {
    try {
      const itemNum = parseInt(String(item.item), 10);
      this.item_catalogo.set(Number.isNaN(itemNum) ? null : itemNum);
      this.nombre.set(item.nombre || '');
      this.descripcion.set(item.descripcion || '');
      this.scrollToPapForm();
    } catch (error) {
      console.error('Error procesando click en tarjeta:', error);
    }
  }

  onCatalogContextMenu(event: MouseEvent, item: CatalogoItem | PapeleriaItem): void {
    event.preventDefault();
    event.stopPropagation();

    this.contextTarget = item;
    this.contextMenuX = event.pageX;
    this.contextMenuY = event.pageY;
    this.contextMenuVisible.set(true);
  }

  async onContextMenuEliminar(): Promise<void> {
    if (!this.contextTarget) {
      this.closeContextMenu();
      return;
    }

    try {
      if ('item' in this.contextTarget) {
        await this.eliminarItemCatalogo(this.contextTarget);
      } else if ('id' in this.contextTarget) {
        await this.eliminar(this.contextTarget);
      }
    } catch (error: any) {
      this.snack.error(error?.message || 'Error al eliminar');
    } finally {
      this.closeContextMenu();
    }
  }

  // ===== MÉTODOS AUXILIARES =====
  private async eliminarItemCatalogo(item: CatalogoItem): Promise<void> {
    const confirmacion = window.confirm(`¿Eliminar del catálogo el item ${item.item}?`);
    if (!confirmacion) return;

    await this.papeleriaService.eliminarCatalogoPapeleria(item.item);
    this.snack.success('Item de catálogo eliminado exitosamente');
    await this.loadCatalogoInicial();
  }

  private closeContextMenu(): void {
    this.contextMenuVisible.set(false);
    this.contextTarget = null;
  }

  private scrollToPapForm(): void {
    setTimeout(() => {
      this.papFormSection?.nativeElement?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      
      setTimeout(() => {
        this.itemCatalogoInput?.nativeElement?.focus();
      }, 200);
    }, 50);
  }

  private actualizarCantidadExistente(id: number, nuevaCantidad: number): void {
    const actualizarLista = (items: PapeleriaItem[]) =>
      items.map(item => 
        item.id === id ? { ...item, cantidad_existente: nuevaCantidad } : item
      );

    this.papeleriaAll = actualizarLista(this.papeleriaAll);
    this.papeleriaList.update(actualizarLista);
  }

  private validarFormularioPapeleria(): boolean {
    if (!this.item_catalogo() || !this.nombre().trim() || 
        this.cantidad_adquirida() == null || this.cantidad_existente() == null) {
      this.snack.warn('Faltan campos requeridos del formulario');
      return false;
    }

    if (this.cantidad_adquirida()! < 0 || this.cantidad_existente()! < 0) {
      this.snack.warn('Las cantidades deben ser números mayores o iguales a 0');
      return false;
    }

    return true;
  }

  private async procesarRegistroCreado(created: any, payload: CreatePapeleriaPayload): Promise<void> {
    const idReal = created?.id || created?.insertId || created?.lastId;

    if (!idReal || !Number.isFinite(Number(idReal))) {
      await this.loadPapeleriaList();
      return;
    }

    const registro: PapeleriaItem = {
      id: Number(idReal),
      item_catalogo: payload.item_catalogo,
      nombre: created?.nombre ?? payload.nombre,
      cantidad_adquirida: created?.cantidad_adquirida ?? payload.cantidad_adquirida,
      cantidad_existente: created?.cantidad_existente ?? payload.cantidad_existente,
      presentacion: (created?.presentacion ?? payload.presentacion) || undefined,
      marca: (created?.marca ?? payload.marca) || undefined,
      descripcion: (created?.descripcion ?? payload.descripcion) || undefined,
      fecha_adquisicion: (created?.fecha_adquisicion ?? payload.fecha_adquisicion) || undefined,
      ubicacion: (created?.ubicacion ?? payload.ubicacion) || undefined,
      observaciones: (created?.observaciones ?? payload.observaciones) || undefined,
    };

    this.papeleriaLastCreated.set(registro);
    this.papeleriaAll = [registro, ...this.papeleriaAll];
    this.filtrarPapeleriaPorCampos();
  }

  private limpiarFormularioPapeleria(): void {
    this.item_catalogo.set(null);
    this.nombre.set('');
    this.cantidad_adquirida.set(null);
    this.cantidad_existente.set(null);
    this.presentacion.set('');
    this.marca.set('');
    this.descripcion.set('');
    this.fecha_adquisicion.set('');
    this.ubicacion.set('');
    this.observaciones.set('');

    try {
      const input = document.getElementById('catImagen') as HTMLInputElement;
      if (input) input.value = '';
    } catch (error) {}
  }

  // ===== MÉTODOS PARA TEMPLATE =====
  getCatalogoImagenUrl(item: number | string): string {
    return this.papeleriaService.getCatalogoImagenUrl(item);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  private normalizarTexto(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  highlightField(value: string, field: 'nombre' | 'item'): SafeHtml {
    if (!value) return '';

    const hasCode = !!this.itemFiltro().trim();
    const hasName = !!this.nombreFiltro().trim();
    const exclusiveCode = hasCode && !hasName;
    const exclusiveName = hasName && !hasCode;

    let term: string | null = null;

    if (exclusiveCode && field === 'item') {
      term = this.normalizarTexto(this.itemFiltro());
    } else if (exclusiveName && field === 'nombre') {
      term = this.normalizarTexto(this.nombreFiltro());
    } else {
      return value;
    }

    if (!term) return value;

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'ig');
    const html = value.replace(regex, '<mark>$1</mark>');
    
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}