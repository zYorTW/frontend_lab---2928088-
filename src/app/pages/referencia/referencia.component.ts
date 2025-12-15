import { Component, signal, effect, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SnackbarService } from '../../shared/snackbar.service';
import { ReferenciaService } from '../../services/referencia.service';

@Component({
  standalone: true,
  selector: 'app-referencia',
  templateUrl: './referencia.component.html',
  styleUrls: ['./referencia.component.css'],
  imports: [CommonModule, FormsModule, RouterModule],
  providers: [ReferenciaService]
})
export class ReferenciaComponent implements OnInit {
  // Tabs para la información del material de referencia
  referenciaTabs = [
    { key: 'general', label: 'General' },
    { key: 'historial', label: 'Historial' },
    { key: 'intervalo', label: 'Intervalo' }
  ];

  // Control de pestaña activa por material
  activeTab: { [codigo: string]: string } = {};

  // Almacenar historial e intervalo por material
  historialPorMaterial: { [codigo: string]: any[] } = {};
  intervaloPorMaterial: { [codigo: string]: any[] } = {};

  // Control de formularios
  formularioActivo: string | null = null;

  // Control de material expandido
  materialExpandido: string | null = null;

  // Variables para búsqueda y autocompletado
  busquedaMaterial = '';
  tipoFiltro: string = 'todos';
  materialesFiltrados: any[] = [];
  materialSeleccionado: any = null;
  mostrarResultados: boolean = false;

  // Opciones para el select de filtro
  opcionesFiltro = [
    { valor: 'todos', texto: 'Todos los campos' },
    { valor: 'codigo', texto: 'Código' },
    { valor: 'nombre', texto: 'Nombre' },
    { valor: 'marca', texto: 'Marca' },
    { valor: 'serie', texto: 'Serie' }
  ];

  // Señal para el siguiente código disponible
  codigoIdSig = signal<number>(1);
  
  // Calcula el siguiente código disponible
  get nextCodigoId(): number {
    if (!this.materialesRegistrados.length) return 1;
    const max = Math.max(...this.materialesRegistrados.map(m => Number(m.codigo_id) || 0));
    return max + 1;
  }

  // Campos para material_referencia
  nombre_material = '';
  rango_medicion = '';
  marca = '';
  serie = '';
  error_max_permitido: number | null = null;
  modelo = '';

  // Campos para historial_referencia
  consecutivo_historial: number | null = null;
  codigo_material_historial: number | null = null;
  fecha_historial = '';
  tipo_historial_instrumento = '';
  codigo_registro_historial = '';
  realizo = '';
  superviso = '';

  // Campos para intervalo_referencia
  consecutivo_intervalo: number | null = null;
  codigo_material_intervalo: number | null = null;
  valor_nominal: number | null = null;
  fecha_c1 = '';
  error_c1: number | null = null;
  fecha_c2 = '';
  error_c2: number | null = null;
  diferencia_tiempo_dias: number | null = null;
  desviacion_abs: number | null = null;
  deriva: number | null = null;
  tolerancia: number | null = null;
  intervalo_calibracion_dias: number | null = null;
  intervalo_calibracion_anos: number | null = null;
  incertidumbre_exp: number | null = null;

  // Lista de materiales registrados
  materialesRegistrados: any[] = [];
  cargandoMateriales = false;

  // Señales para consecutivos
  codigoHistorialSig = signal<number | null>(null);
  consecutivoHistorialSig = signal<number | null>(null);
  codigoIntervaloSig = signal<number | null>(null);
  consecutivoIntervaloSig = signal<number | null>(null);

  // Control de registros expandidos
  historialExpandido: { [key: string]: boolean } = {};
  intervaloExpandido: { [key: string]: boolean } = {};

  // PDF management
  pdfListByMaterial: { [codigo: string]: Array<{ id?: number; name: string; url: string; categoria?: string; size?: number; mime?: string; fecha_subida?: Date | null; displayName?: string }> } = {};
  selectedPdfByMaterial: { [codigo: string]: string | null } = {};
  menuCategoriaPdfVisible: { [codigo: string]: boolean } = {};

  // Edit modal state
  editModalVisible: boolean = false;
  editModalClosing: boolean = false;
  editModalActiveTab: string = 'general';
  editMaterialMode: boolean = false;
  editingMaterialCodigo: number | null = null;

  constructor(
    public snack: SnackbarService, 
    private cdr: ChangeDetectorRef, 
    public referenciaService: ReferenciaService
  ) {
    // Efectos para consecutivos
    effect(() => {
      const codigo = this.codigoHistorialSig();
      if (this.formularioActivo === 'historial' && codigo) {
        referenciaService.obtenerNextHistorial(codigo)
          .then((resp: any) => this.consecutivoHistorialSig.set(resp.next))
          .catch(() => this.snack.warn('No se pudo cargar consecutivo historial'));
      } else if (this.formularioActivo === 'historial' && !codigo) {
        this.consecutivoHistorialSig.set(null);
      }
    });

    effect(() => {
      const codigo = this.codigoIntervaloSig();
      if (this.formularioActivo === 'intervalo' && codigo) {
        referenciaService.obtenerNextIntervalo(codigo)
          .then((resp: any) => this.consecutivoIntervaloSig.set(resp.next))
          .catch(() => this.snack.warn('No se pudo cargar consecutivo intervalo'));
      } else if (this.formularioActivo === 'intervalo' && !codigo) {
        this.consecutivoIntervaloSig.set(null);
      }
    });
  }

  ngOnInit() {
    console.log('🎯 ReferenciaComponent inicializado - cargando materiales...');
    this.obtenerMaterialesRegistrados();
    
    // Cerrar menú de categorías cuando se hace clic fuera
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.categoria-pdf-menu') && !target.closest('.btn.add')) {
        Object.keys(this.menuCategoriaPdfVisible).forEach(key => {
          this.menuCategoriaPdfVisible[key] = false;
        });
      }
    });
  }

  async obtenerMaterialesRegistrados() {
    console.log('🔄 Iniciando carga de materiales de referencia...');
    this.cargandoMateriales = true;
    try {
      const materiales = await this.referenciaService.listarMateriales();
      console.log('✅ Materiales de referencia recibidos:', materiales);
      
      // Precargar historial e intervalo
      await Promise.all(materiales.map(async (material: any) => {
        const codigo = material.codigo_id;
        try {
          const [historial, intervalo] = await Promise.all([
            this.referenciaService.listarHistorialPorMaterial(codigo),
            this.referenciaService.listarIntervaloPorMaterial(codigo)
          ]);
          this.historialPorMaterial[codigo] = historial;
          this.intervaloPorMaterial[codigo] = intervalo;
        } catch (error) {
          console.warn(`Error al precargar datos para material ${codigo}:`, error);
          this.historialPorMaterial[codigo] = [];
          this.intervaloPorMaterial[codigo] = [];
        }
      }));
      
      this.materialesRegistrados = materiales.map((material: any) => ({
        codigo_id: material.codigo_id,
        nombre_material: material.nombre_material,
        rango_medicion: material.rango_medicion,
        marca: material.marca,
        serie: material.serie,
        error_max_permitido: material.error_max_permitido,
        modelo: material.modelo
      }));
      
      // Actualizar la señal automáticamente
      this.codigoIdSig.set(this.nextCodigoId);
      console.log('✅ Materiales procesados. Total:', this.materialesRegistrados.length);
    } catch (error: any) {
      console.error('❌ Error al obtener materiales de referencia:', error);
      this.snack.error(error.message || 'Error al obtener materiales registrados');
      this.materialesRegistrados = [];
    } finally {
      this.cargandoMateriales = false;
      this.cdr.detectChanges();
    }
  }

  // Función para buscar materiales
  buscarMateriales() {
    if (!this.busquedaMaterial.trim()) {
      this.materialesFiltrados = [];
      this.mostrarResultados = false;
      return;
    }
    
    const busqueda = this.busquedaMaterial.toLowerCase().trim();
    this.mostrarResultados = true;
    
    this.materialesFiltrados = this.materialesRegistrados.filter(material => {
      switch (this.tipoFiltro) {
        case 'codigo':
          return material.codigo_id?.toString().includes(busqueda);
        case 'nombre':
          return material.nombre_material?.toLowerCase().includes(busqueda);
        case 'marca':
          return material.marca?.toLowerCase().includes(busqueda);
        case 'serie':
          return material.serie?.toLowerCase().includes(busqueda);
        case 'todos':
        default:
          return (
            material.codigo_id?.toString().includes(busqueda) ||
            material.nombre_material?.toLowerCase().includes(busqueda) ||
            material.marca?.toLowerCase().includes(busqueda) ||
            material.serie?.toLowerCase().includes(busqueda) ||
            material.modelo?.toLowerCase().includes(busqueda)
          );
      }
    });
  }

  // Función para seleccionar material
  seleccionarMaterial(material: any) {
    this.materialSeleccionado = material;
    this.busquedaMaterial = `${material.codigo_id} - ${material.nombre_material}`;
    this.materialesFiltrados = [];
    this.mostrarResultados = false;

    // Autocompletar campos del formulario actual
    if (this.formularioActivo === 'material') {
      this.codigoIdSig.set(material.codigo_id);
      this.nombre_material = material.nombre_material;
      this.rango_medicion = material.rango_medicion;
      this.marca = material.marca;
      this.serie = material.serie;
      this.error_max_permitido = material.error_max_permitido;
      this.modelo = material.modelo;
    }

    this.snack.success(`Datos de "${material.nombre_material}" cargados`);
  }

  // Limpiar búsqueda
  limpiarBusqueda() {
    this.busquedaMaterial = '';
    this.tipoFiltro = 'todos';
    this.materialesFiltrados = [];
    this.materialSeleccionado = null;
    this.mostrarResultados = false;
  }

  // Método para obtener placeholder dinámico
  getPlaceholder(): string {
    switch (this.tipoFiltro) {
      case 'codigo':
        return 'Buscar por código...';
      case 'nombre':
        return 'Buscar por nombre...';
      case 'marca':
        return 'Buscar por marca...';
      case 'serie':
        return 'Buscar por serie...';
      case 'todos':
      default:
        return 'Buscar en todos los campos...';
    }
  }

  // Ocultar resultados cuando se hace clic fuera
  onFocusOut() {
    setTimeout(() => {
      this.mostrarResultados = false;
    }, 200);
  }

  // Formatear fecha
  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  // Crear material de referencia
  async crearMaterial(event: Event) {
    event.preventDefault();
    const nextCodigo = this.codigoIdSig();
    if (!nextCodigo || !this.nombre_material) {
      this.snack.warn('Código y nombre son obligatorios');
      return;
    }
    try {
      const payload = {
        codigo_id: nextCodigo,
        nombre_material: this.nombre_material,
        rango_medicion: this.rango_medicion,
        marca: this.marca,
        serie: this.serie,
        error_max_permitido: this.error_max_permitido,
        modelo: this.modelo
      };
      await this.referenciaService.crearMaterial(payload);
      this.snack.success('Material de referencia registrado exitosamente');
      this.resetFormMaterial();
      await this.obtenerMaterialesRegistrados();
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar material');
    }
  }

  // Crear historial
  async crearHistorial(event: Event) {
    event.preventDefault();
    
    const consecutivo = this.consecutivoHistorialSig();
    const codigo_material = this.codigoHistorialSig();
    
    if (!consecutivo || !codigo_material) {
      this.snack.warn('Debe seleccionar un material y tener un consecutivo válido');
      return;
    }
    
    try {
      await this.referenciaService.crearHistorial({
        consecutivo: consecutivo,
        codigo_material: codigo_material,
        fecha: this.fecha_historial,
        tipo_historial_instrumento: this.tipo_historial_instrumento,
        codigo_registro: this.codigo_registro_historial,
        realizo: this.realizo,
        superviso: this.superviso
      });
      
      this.snack.success('Historial registrado exitosamente');
      this.resetFormHistorial();
      
      // Actualizar lista local
      if (this.historialPorMaterial[codigo_material]) {
        const data = await this.referenciaService.listarHistorialPorMaterial(codigo_material);
        this.historialPorMaterial[codigo_material] = data;
      }
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar historial');
    }
  }

  // Crear intervalo
  async crearIntervalo(event: Event) {
    event.preventDefault();
    
    const consecutivo = this.consecutivoIntervaloSig();
    const codigo_material = this.codigoIntervaloSig();
    
    if (!consecutivo || !codigo_material) {
      this.snack.warn('Debe seleccionar un material y tener un consecutivo válido');
      return;
    }
    
    // Validación: fecha_c2 no puede ser anterior a fecha_c1
    if (this.fecha_c1 && this.fecha_c2) {
      const f1 = new Date(this.fecha_c1);
      const f2 = new Date(this.fecha_c2);
      f1.setHours(0,0,0,0);
      f2.setHours(0,0,0,0);
      if (f2 < f1) {
        this.snack.warn('La fecha de calibración 2 no puede ser anterior a la fecha de calibración 1');
        return;
      }
    }
    
    // Calcular diferencia de días si hay fechas
    let diferenciaDias = null;
    if (this.fecha_c1 && this.fecha_c2) {
      const fecha1 = new Date(this.fecha_c1);
      const fecha2 = new Date(this.fecha_c2);
      diferenciaDias = Math.round((fecha2.getTime() - fecha1.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Calcular desviación absoluta
    let desviacionAbs = null;
    if (this.error_c1 !== null && this.error_c2 !== null) {
      desviacionAbs = Math.abs(this.error_c2 - this.error_c1);
    }
    
    // Calcular deriva
    let deriva = null;
    if (desviacionAbs !== null && diferenciaDias !== null && diferenciaDias !== 0) {
      deriva = desviacionAbs / diferenciaDias;
    }
    
    // Calcular intervalo de calibración en días
    let intervaloDias = null;
    if (this.tolerancia !== null && deriva !== null && deriva !== 0) {
      intervaloDias = Math.abs(this.tolerancia / deriva);
    }
    
    // Calcular intervalo en años
    let intervaloAnos = null;
    if (intervaloDias !== null) {
      intervaloAnos = intervaloDias / 365;
    }
    
    try {
      await this.referenciaService.crearIntervalo({
        consecutivo: consecutivo,
        codigo_material: codigo_material,
        valor_nominal: this.valor_nominal,
        fecha_c1: this.fecha_c1,
        error_c1: this.error_c1,
        fecha_c2: this.fecha_c2,
        error_c2: this.error_c2,
        diferencia_tiempo_dias: diferenciaDias,
        desviacion_abs: desviacionAbs,
        deriva: deriva,
        tolerancia: this.tolerancia,
        intervalo_calibracion_dias: intervaloDias,
        intervalo_calibracion_anos: intervaloAnos,
        incertidumbre_exp: this.incertidumbre_exp
      });
      
      this.snack.success('Intervalo registrado exitosamente');
      this.resetFormIntervalo();
      
      // Actualizar lista local
      if (this.intervaloPorMaterial[codigo_material]) {
        const data = await this.referenciaService.listarIntervaloPorMaterial(codigo_material);
        this.intervaloPorMaterial[codigo_material] = data;
      }
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar intervalo');
    }
  }

  // Reset forms
  resetFormMaterial() {
    this.codigoIdSig.set(this.nextCodigoId);
    this.nombre_material = '';
    this.rango_medicion = '';
    this.marca = '';
    this.serie = '';
    this.error_max_permitido = null;
    this.modelo = '';
    this.limpiarBusqueda();
  }

  resetFormHistorial() {
    this.consecutivo_historial = null;
    this.codigo_material_historial = null;
    this.fecha_historial = '';
    this.tipo_historial_instrumento = '';
    this.codigo_registro_historial = '';
    this.realizo = '';
    this.superviso = '';
  }

  resetFormIntervalo() {
    this.consecutivo_intervalo = null;
    this.codigo_material_intervalo = null;
    this.valor_nominal = null;
    this.fecha_c1 = '';
    this.error_c1 = null;
    this.fecha_c2 = '';
    this.error_c2 = null;
    this.diferencia_tiempo_dias = null;
    this.desviacion_abs = null;
    this.deriva = null;
    this.tolerancia = null;
    this.intervalo_calibracion_dias = null;
    this.intervalo_calibracion_anos = null;
    this.incertidumbre_exp = null;
  }

  // Toggle para formularios
  toggleFormulario(tipo: string) {
    if (this.formularioActivo === tipo) {
      this.formularioActivo = null;
    } else {
      // Limpiar todos los formularios antes de abrir uno nuevo
      this.resetFormMaterial();
      this.resetFormHistorial();
      this.resetFormIntervalo();
      this.limpiarBusqueda();

      if (tipo === 'historial') {
        this.formularioActivo = tipo;
        this.consecutivo_historial = null;
        this.codigo_material_historial = null;
        this.codigoHistorialSig.set(null);
        this.consecutivoHistorialSig.set(null);
      } else if (tipo === 'intervalo') {
        this.formularioActivo = tipo;
        this.consecutivo_intervalo = null;
        this.codigo_material_intervalo = null;
        this.codigoIntervaloSig.set(null);
        this.consecutivoIntervaloSig.set(null);
      } else {
        this.formularioActivo = tipo;
      }
    }
  }

  // Toggle para expandir/contraer detalles
  toggleDetalleMaterial(codigoMaterial: string) {
    this.materialExpandido = this.materialExpandido === codigoMaterial ? null : codigoMaterial;
    if (this.materialExpandido === codigoMaterial && !this.activeTab[codigoMaterial]) {
      this.activeTab[codigoMaterial] = 'general';
    }
  }

  // Toggle para expandir/contraer registros
  toggleHistorialRegistro(materialId: string, consecutivo: number) {
    const key = `${materialId}_${consecutivo}`;
    this.historialExpandido[key] = !this.historialExpandido[key];
  }

  toggleIntervaloRegistro(materialId: string, consecutivo: number) {
    const key = `${materialId}_${consecutivo}`;
    this.intervaloExpandido[key] = !this.intervaloExpandido[key];
  }

  // Seleccionar pestaña
  selectTab(codigo: string, tabKey: string) {
    this.activeTab[codigo] = tabKey;
    this.cdr.detectChanges();
  }

  // Obtener número de registros por pestaña
  getTabCount(material: any, tabKey: string): number {
    if (!material || !tabKey) return 0;
    const codigo = material.codigo_id;
    if (!codigo) return 0;
    
    if (tabKey === 'historial') {
      const arr = this.historialPorMaterial[codigo];
      return Array.isArray(arr) ? arr.length : 0;
    }
    
    if (tabKey === 'intervalo') {
      const arr = this.intervaloPorMaterial[codigo];
      return Array.isArray(arr) ? arr.length : 0;
    }
    
    return 0;
  }

  // Handlers para actualizar señales
  onSeleccionMaterialHistorialChange(codigo: number) {
    this.codigo_material_historial = codigo;
    this.codigoHistorialSig.set(codigo);
  }

  onSeleccionMaterialIntervaloChange(codigo: number) {
    this.codigo_material_intervalo = codigo;
    this.codigoIntervaloSig.set(codigo);
  }

  // PDF management methods
  async listarPdfs(codigo: string) {
    try {
      const data: any[] = await this.referenciaService.listarPdfsPorMaterial(codigo);
      const items: any[] = (data || []).map(p => ({
        id: p.id,
        name: p.nombre_archivo || p.name || 'Archivo',
        url: p.url_archivo || p.url,
        categoria: p.categoria,
        size: p.size_bytes,
        mime: p.mime,
        fecha_subida: p.fecha_subida ? new Date(p.fecha_subida) : null
      }));

      // Sort by fecha_subida
      items.sort((a, b) => {
        if (!a.fecha_subida && !b.fecha_subida) return 0;
        if (!a.fecha_subida) return 1;
        if (!b.fecha_subida) return -1;
        return a.fecha_subida.getTime() - b.fecha_subida.getTime();
      });

      // Assign display names
      this.computePdfDisplayNames(items);
      this.pdfListByMaterial[codigo] = items;
      this.selectedPdfByMaterial[codigo] = this.pdfListByMaterial[codigo]?.[0]?.url || null;
      this.cdr.detectChanges();
    } catch (err) {
      console.warn('Error listando PDFs', err);
      this.pdfListByMaterial[codigo] = [];
      this.selectedPdfByMaterial[codigo] = null;
      this.cdr.detectChanges();
    }
  }

  computePdfDisplayNames(items: any[]) {
    const groups: { [cat: string]: Array<any> } = {};
    for (const it of items) {
      const cat = (it.categoria || '').trim();
      if (!cat) continue;
      groups[cat] = groups[cat] || [];
      groups[cat].push(it);
    }

    for (const cat of Object.keys(groups)) {
      const group = groups[cat];
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          group[i].displayName = `${cat} - ${i + 1}`;
        }
      } else {
        group[0].displayName = cat;
      }
    }

    for (const it of items) {
      if (!it.categoria || !it.categoria.toString().trim()) {
        it.displayName = it.name;
      }
    }
  }

  openPdf(codigo: string, event?: Event) {
    if (event) event.stopPropagation();
    const url = this.selectedPdfByMaterial[codigo] || this.pdfListByMaterial[codigo]?.[0]?.url;
    if (!url) {
      this.snack.warn('No hay PDF seleccionado para ver');
      return;
    }
    window.open(url, '_blank');
  }

  async deletePdf(codigo: string, event?: Event) {
    if (event) event.stopPropagation();
    const url = this.selectedPdfByMaterial[codigo];
    if (!url) {
      this.snack.warn('Seleccione un PDF para eliminar');
      return;
    }
    const item = (this.pdfListByMaterial[codigo] || []).find(p => p.url === url);
    if (!item || !item.id) {
      this.snack.warn('No se encontró el PDF para eliminar');
      return;
    }

    const confirmMsg = `¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await this.referenciaService.eliminarPdf(item.id);
      this.snack.success('PDF eliminado');
      await this.listarPdfs(codigo);
    } catch (err: any) {
      console.error('Error eliminando PDF', err);
      this.snack.error(err.message || 'Error al eliminar PDF');
    }
  }

  mostrarMenuCategoriaPdf(codigo: string, event?: Event) {
    if (event) event.stopPropagation();
    this.menuCategoriaPdfVisible[codigo] = !this.menuCategoriaPdfVisible[codigo];
    Object.keys(this.menuCategoriaPdfVisible).forEach(key => {
      if (key !== codigo) {
        this.menuCategoriaPdfVisible[key] = false;
      }
    });
  }

  iniciarUpload(codigo: string, categoria: string, event?: Event) {
    if (event) event.stopPropagation();
    this.menuCategoriaPdfVisible[codigo] = false;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await this.referenciaService.subirPdfMaterial(codigo, categoria, file);
        this.snack.success('PDF subido correctamente');
        await this.listarPdfs(codigo);
      } catch (err: any) {
        console.error('Error subiendo PDF', err);
        this.snack.error(err.message || 'Error al subir PDF');
      }
    };
    input.click();
  }

  // Eliminar material
  async eliminarMaterial(material: any, event?: Event) {
    if (event) event.stopPropagation();
    const codigo = material?.codigo_id;
    if (!codigo) return;
    
    const confirmado = window.confirm(`¿Eliminar el material "${material.nombre_material}" (${codigo})? Se eliminarán también sus historiales e intervalos.`);
    if (!confirmado) return;
    
    try {
      await this.referenciaService.eliminarMaterial(codigo);
      this.snack.success('Material eliminado');
      this.materialesRegistrados = this.materialesRegistrados.filter(m => m.codigo_id !== codigo);
      
      // Limpiar estados asociados
      delete this.historialPorMaterial[codigo];
      delete this.intervaloPorMaterial[codigo];
      delete this.activeTab[codigo];
      if (this.materialExpandido === codigo.toString()) this.materialExpandido = null;
    } catch (error: any) {
      this.snack.error(error.message || 'No se pudo eliminar el material');
    }
  }

  // Editar material
  abrirEditarMaterial(material: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!material) return;
    
    // Prefill form fields
    this.codigoIdSig.set(material.codigo_id);
    this.nombre_material = material.nombre_material || '';
    this.rango_medicion = material.rango_medicion || '';
    this.marca = material.marca || '';
    this.serie = material.serie || '';
    this.error_max_permitido = material.error_max_permitido || null;
    this.modelo = material.modelo || '';
    
    this.editMaterialMode = true;
    this.editingMaterialCodigo = material.codigo_id;
    this.editModalVisible = true;
    this.editModalClosing = false;
    this.editModalActiveTab = 'general';
  }

  async saveAllEditMaterial() {
    if (!this.editingMaterialCodigo) {
      this.snack.error('No se ha seleccionado material para editar');
      return;
    }
    
    const payload: any = {
      codigo_id: this.codigoIdSig(),
      nombre_material: this.nombre_material,
      rango_medicion: this.rango_medicion,
      marca: this.marca,
      serie: this.serie,
      error_max_permitido: this.error_max_permitido,
      modelo: this.modelo
    };

    try {
      await this.referenciaService.actualizarMaterial(this.editingMaterialCodigo, payload);
      this.snack.success('Cambios guardados');
      await this.obtenerMaterialesRegistrados();
      this.closeEditMaterialModal();
    } catch (err: any) {
      console.error('Error actualizando material:', err);
      this.snack.error(err?.message || 'Error al guardar cambios del material');
    }
  }

  closeEditMaterialModal() {
    this.editModalVisible = false;
    this.editModalClosing = false;
    this.editMaterialMode = false;
    this.editingMaterialCodigo = null;
  }

  // --- Edición inline de historial ---
  editarRegistroHistorial(registro: any) {
    registro._backup = { ...registro };
    registro.editando = true;
  }

  cancelarEdicionHistorial(codigo_material: number, registro: any) {
    Object.assign(registro, registro._backup);
    delete registro._backup;
    registro.editando = false;
  }

  async guardarEdicionHistorial(codigo_material: number, registro: any) {
    try {
      await this.referenciaService.actualizarHistorial(codigo_material, registro.consecutivo, {
        tipo_historial_instrumento: registro.tipo_historial_instrumento,
        codigo_registro: registro.codigo_registro,
        realizo: registro.realizo,
        superviso: registro.superviso
      });
      this.snack.success('Historial actualizado');
      registro.editando = false;
      delete registro._backup;
      // Refrescar lista
      const data = await this.referenciaService.listarHistorialPorMaterial(codigo_material);
      this.historialPorMaterial[codigo_material] = data;
    } catch (e: any) {
      this.snack.error(e.message || 'Error al actualizar historial');
    }
  }

  // --- Edición inline de intervalo ---
  editarRegistroIntervalo(registro: any) {
    registro._backup = { ...registro };
    registro.editando = true;
  }

  cancelarEdicionIntervalo(codigo_material: number, registro: any) {
    Object.assign(registro, registro._backup);
    delete registro._backup;
    registro.editando = false;
  }

  async guardarEdicionIntervalo(codigo_material: number, registro: any) {
    try {
      await this.referenciaService.actualizarIntervalo(codigo_material, registro.consecutivo, {
        valor_nominal: registro.valor_nominal,
        fecha_c1: registro.fecha_c1,
        error_c1: registro.error_c1,
        fecha_c2: registro.fecha_c2,
        error_c2: registro.error_c2,
        diferencia_tiempo_dias: registro.diferencia_tiempo_dias,
        desviacion_abs: registro.desviacion_abs,
        deriva: registro.deriva,
        tolerancia: registro.tolerancia,
        intervalo_calibracion_dias: registro.intervalo_calibracion_dias,
        intervalo_calibracion_anos: registro.intervalo_calibracion_anos,
        incertidumbre_exp: registro.incertidumbre_exp
      });
      this.snack.success('Intervalo actualizado');
      registro.editando = false;
      delete registro._backup;
      // Refrescar lista
      const data = await this.referenciaService.listarIntervaloPorMaterial(codigo_material);
      this.intervaloPorMaterial[codigo_material] = data;
    } catch (e: any) {
      this.snack.error(e.message || 'Error al actualizar intervalo');
    }
  }
}