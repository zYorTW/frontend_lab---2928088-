import { Component, OnInit, signal, ElementRef, ViewChild, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SnackbarService } from '../../shared/snackbar.service';
import { authService, authUser } from '../../services/auth/auth.service';
import { PapeleriaService, CatalogoItem, PapeleriaItem } from '../../services/papeleria.service';
import { NumbersOnlyDirective } from '../../directives/numbers-only.directive';
import { LettersOnlyDirective } from '../../directives/letters-only.directive';
import { AlphaNumericDirective } from '../../directives/alpha-numeric.directive';

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
  imports: [CommonModule, FormsModule, RouterModule, NumbersOnlyDirective, LettersOnlyDirective, AlphaNumericDirective],
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

    catalogoErrors: { [key: string]: string } = {};
  papeleriaErrors: { [key: string]: string } = {};

  // Control de cual formulario rápido está abierto (null = ninguno)
  formularioActivo: string | null = null;

  // Alterna el formulario activo; si se abre 'crear-papeleria' intenta hacer scroll y focus
  toggleFormulario(tipo: string) {
    const opening = this.formularioActivo !== tipo;
    this.formularioActivo = opening ? tipo : null;
    if (opening && tipo === 'crear-papeleria') {
      setTimeout(() => {
        try {
          if (this.papFormSection) {
            this.papFormSection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const first = this.papFormSection.nativeElement.querySelector('input, textarea, select') as HTMLElement | null;
            if (first) first.focus();
          }
        } catch (e) { /* ignore */ }
      }, 60);
    }
  }

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

  validarCatalogo(): boolean {
  this.catalogoErrors = {};
  let isValid = true;

  // ===== VALIDACIÓN DE CAMPOS OBLIGATORIOS =====

  // 1. Validación de item (OBLIGATORIO)
  const itemStr = (this.catItem() ?? '').toString().trim();
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
  const nombreStr = (this.catNombre() ?? '').toString().trim();
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
  if (this.catDescripcion() && this.catDescripcion().trim()) {
    if (this.catDescripcion().length > 500) {
      this.catalogoErrors['descripcion'] = 'La descripción no puede exceder 500 caracteres';
      isValid = false;
    }
  }

  // 4. Validación de imagen (NO obligatorio, pero validar tipo si se sube)
  if (this.catImagen()) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    // Validar tipo de archivo
    if (!validTypes.includes(this.catImagen()!.type.toLowerCase())) {
      this.catalogoErrors['imagen'] = 'Formato de imagen no válido (JPEG, PNG, GIF, WebP)';
      isValid = false;
    }
    
    // Validar tamaño
    if (this.catImagen()!.size > maxSize) {
      this.catalogoErrors['imagen'] = 'La imagen no puede exceder 5 MB';
      isValid = false;
    }
    
    // Validar nombre de archivo (opcional)
    const fileName = this.catImagen()!.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      this.catalogoErrors['imagen'] = 'Extensión de archivo no válida';
      isValid = false;
    }
  }

  return isValid;
}

validarPapeleria(): boolean {
  this.papeleriaErrors = {};
  let isValid = true;

  // ===== VALIDACIÓN DE TODOS LOS CAMPOS OBLIGATORIOS =====

  // 1. Validación de item catálogo (OBLIGATORIO)
  if (!this.item_catalogo() && this.item_catalogo() !== 0) {
    this.papeleriaErrors['item_catalogo'] = 'El item de catálogo es obligatorio';
    isValid = false;
  } else if (isNaN(Number(this.item_catalogo()))) {
    this.papeleriaErrors['item_catalogo'] = 'El item debe ser numérico';
    isValid = false;
  } else if (Number(this.item_catalogo()) <= 0) {
    this.papeleriaErrors['item_catalogo'] = 'El item debe ser mayor a 0';
    isValid = false;
  }

  // 2. Validación de nombre (OBLIGATORIO)
  if (!this.nombre()?.trim()) {
    this.papeleriaErrors['nombre'] = 'El nombre es obligatorio';
    isValid = false;
  } else if (this.nombre().length > 200) {
    this.papeleriaErrors['nombre'] = 'El nombre no puede exceder 200 caracteres';
    isValid = false;
  }

  // 3. Validación de cantidad adquirida (OBLIGATORIO)
  if (this.cantidad_adquirida() === null || this.cantidad_adquirida() === undefined) {
    this.papeleriaErrors['cantidad_adquirida'] = 'La cantidad adquirida es obligatoria';
    isValid = false;
  } else if (this.cantidad_adquirida()! < 0) {
    this.papeleriaErrors['cantidad_adquirida'] = 'La cantidad no puede ser negativa';
    isValid = false;
  }

  // 4. Validación de cantidad existente (OBLIGATORIO)
  if (this.cantidad_existente() === null || this.cantidad_existente() === undefined) {
    this.papeleriaErrors['cantidad_existente'] = 'La cantidad existente es obligatoria';
    isValid = false;
  } else if (this.cantidad_existente()! < 0) {
    this.papeleriaErrors['cantidad_existente'] = 'La cantidad no puede ser negativa';
    isValid = false;
  }

  // 5. Validación de presentación (OBLIGATORIO)
  if (!this.presentacion()?.trim()) {
    this.papeleriaErrors['presentacion'] = 'La presentación es obligatoria';
    isValid = false;
  } else if (this.presentacion().length > 100) {
    this.papeleriaErrors['presentacion'] = 'La presentación no puede exceder 100 caracteres';
    isValid = false;
  }

  // 6. Validación de marca (OBLIGATORIO)
  if (!this.marca()?.trim()) {
    this.papeleriaErrors['marca'] = 'La marca es obligatoria';
    isValid = false;
  } else if (this.marca().length > 100) {
    this.papeleriaErrors['marca'] = 'La marca no puede exceder 100 caracteres';
    isValid = false;
  }

  // 7. Validación de ubicación (OBLIGATORIO)
  if (!this.ubicacion()?.trim()) {
    this.papeleriaErrors['ubicacion'] = 'La ubicación es obligatoria';
    isValid = false;
  } else if (this.ubicacion().length > 200) {
    this.papeleriaErrors['ubicacion'] = 'La ubicación no puede exceder 200 caracteres';
    isValid = false;
  }

  // 8. Validación de fecha adquisición (OBLIGATORIO)
  if (!this.fecha_adquisicion()?.trim()) {
    this.papeleriaErrors['fecha_adquisicion'] = 'La fecha de adquisición es obligatoria';
    isValid = false;
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(this.fecha_adquisicion())) {
    this.papeleriaErrors['fecha_adquisicion'] = 'Formato de fecha inválido (AAAA-MM-DD)';
    isValid = false;
  } else {
    const fecha = new Date(this.fecha_adquisicion());
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (isNaN(fecha.getTime())) {
      this.papeleriaErrors['fecha_adquisicion'] = 'Fecha inválida';
      isValid = false;
    } else if (fecha > hoy) {
      this.papeleriaErrors['fecha_adquisicion'] = 'La fecha no puede ser futura';
      isValid = false;
    }
  }

  // ===== VALIDACIÓN DE CAMPOS NO OBLIGATORIOS =====

  // 9. Validación de descripción (NO obligatorio)
  if (this.descripcion() && this.descripcion().trim()) {
    if (this.descripcion().length > 500) {
      this.papeleriaErrors['descripcion'] = 'La descripción no puede exceder 500 caracteres';
      isValid = false;
    }
  }

  // 10. Validación de observaciones (NO obligatorio)
  if (this.observaciones() && this.observaciones().trim()) {
    if (this.observaciones().length > 1000) {
      this.papeleriaErrors['observaciones'] = 'Las observaciones no pueden exceder 1000 caracteres';
      isValid = false;
    }
  }

  // ===== VALIDACIONES CRUZADAS =====

  // 11. Validar que cantidad existente no sea mayor que cantidad adquirida
  if (this.cantidad_adquirida() !== null && this.cantidad_existente() !== null &&
      Number(this.cantidad_existente()) > Number(this.cantidad_adquirida())) {
    this.papeleriaErrors['cantidad_existente'] = 'La cantidad existente no puede ser mayor que la cantidad adquirida';
    isValid = false;
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
    case 'item': return this.catItem();
    case 'nombre': return this.catNombre();
    case 'descripcion': return this.catDescripcion();
    case 'imagen': return this.catImagen();
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

// ===== VALIDACIÓN EN TIEMPO REAL PARA PAPELERÍA =====
validarCampoPapeleriaEnTiempoReal(campo: string, event?: Event): void {
  const valor = this.getValorPapeleria(campo);
  this.papeleriaErrors[campo] = this.validarCampoPapeleriaIndividual(campo, valor);
}

private getValorPapeleria(campo: string): any {
  switch (campo) {
    case 'item_catalogo': return this.item_catalogo();
    case 'nombre': return this.nombre();
    case 'cantidad_adquirida': return this.cantidad_adquirida();
    case 'cantidad_existente': return this.cantidad_existente();
    case 'presentacion': return this.presentacion();
    case 'marca': return this.marca();
    case 'ubicacion': return this.ubicacion();
    case 'fecha_adquisicion': return this.fecha_adquisicion();
    case 'descripcion': return this.descripcion();
    case 'observaciones': return this.observaciones();
    default: return '';
  }
}

private validarCampoPapeleriaIndividual(campo: string, valor: any): string {
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
      
    case 'cantidad_adquirida':
      if (valor === null || valor === undefined) return 'La cantidad adquirida es obligatoria';
      if (valor < 0) return 'La cantidad no puede ser negativa';
      return '';
      
    case 'cantidad_existente':
      if (valor === null || valor === undefined) return 'La cantidad existente es obligatoria';
      if (valor < 0) return 'La cantidad no puede ser negativa';
      
      // Validación cruzada solo si ambos campos tienen valor
      const cantidadAdquirida = this.cantidad_adquirida();
      if (cantidadAdquirida !== null && cantidadAdquirida !== undefined && 
          Number(valor) > Number(cantidadAdquirida)) {
        return 'La cantidad existente no puede ser mayor que la cantidad adquirida';
      }
      return '';
      
    case 'presentacion':
      const presentacionStr = (valor ?? '').toString().trim();
      if (!presentacionStr) return 'La presentación es obligatoria';
      if (presentacionStr.length > 100) return 'La presentación no puede exceder 100 caracteres';
      return '';
      
    case 'marca':
      const marcaStr = (valor ?? '').toString().trim();
      if (!marcaStr) return 'La marca es obligatoria';
      if (marcaStr.length > 100) return 'La marca no puede exceder 100 caracteres';
      return '';
      
    case 'ubicacion':
      const ubicacionStr = (valor ?? '').toString().trim();
      if (!ubicacionStr) return 'La ubicación es obligatoria';
      if (ubicacionStr.length > 200) return 'La ubicación no puede exceder 200 caracteres';
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

  async crearCatalogo(event: Event): Promise<void> {
  event.preventDefault();
  this.catalogoMsg.set('');
  
  // USAR EL MÉTODO DE VALIDACIÓN NUEVO (igual que en Insumos)
  if (!this.validarCatalogo()) {
    this.snack.warn('Por favor corrige los campos resaltados.');
    return;
  }
  
  try {
    const itemStr = this.catItem().toString().trim();
    const nombreStr = this.catNombre().toString().trim();
    
    const formData = new FormData();
    formData.set('nombre', nombreStr);
    
    const descStr = this.catDescripcion().toString().trim();
    if (descStr) formData.set('descripcion', descStr);
    
    if (itemStr) formData.set('item', itemStr);
    if (this.catImagen()) formData.set('imagen', this.catImagen()!);
    
    await this.papeleriaService.crearCatalogo(formData);
    this.snack.success('Se creó el item de catálogo');
    
    // Limpiar errores después de éxito (PATRÓN INSUMOS)
    this.catalogoErrors = {};
    
    // Limpiar formulario
    this.catItem.set('');
    this.catNombre.set('');
    this.catDescripcion.set('');
    this.catImagen.set(null);
    
    // Limpiar input file explícitamente (si existe)
    try {
      const input = document.getElementById('catImagen') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch {}
    
    // Recargar catálogo
    await this.loadCatalogoInicial();
    
    if (this.itemFiltro().trim() || this.nombreFiltro().trim()) {
      this.filtrarCatalogoPorCampos();
    }
    
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
  
  // USAR EL MÉTODO DE VALIDACIÓN NUEVO (igual que en Insumos)
  if (!this.validarPapeleria()) {
    this.snack.warn('Por favor corrige los campos resaltados.');
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
    
    // Limpiar errores después de éxito 
    this.papeleriaErrors = {};
    
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

  // private validarFormularioPapeleria(): boolean {
  //   if (!this.item_catalogo() || !this.nombre().trim() || 
  //       this.cantidad_adquirida() == null || this.cantidad_existente() == null) {
  //     this.snack.warn('Faltan campos requeridos del formulario');
  //     return false;
  //   }

  //   if (this.cantidad_adquirida()! < 0 || this.cantidad_existente()! < 0) {
  //     this.snack.warn('Las cantidades deben ser números mayores o iguales a 0');
  //     return false;
  //   }

  //   return true;
  // }

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