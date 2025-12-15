import { Component, signal, effect, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { equiposService } from '../../services/equipos.service';
import { SnackbarService } from '../../shared/snackbar.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-equipos',
  templateUrl: './equipos.component.html',
  styleUrls: ['./equipos.component.css'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class EquiposComponent implements OnInit {
  // Map to keep references to event handlers for cleanup
  private _dropdownToggleHandler: EventListener | null = null;
  private _resizeHandler: EventListener | null = null;
      // API base URL from environment
      API_EQUIPOS = (window as any).__env?.API_EQUIPOS || 'http://localhost:4000/api/equipos';

      // Tabs para la información del equipo
      equipoTabs = [
        { key: 'hojaVida', label: 'Hoja de Vida' },
        { key: 'historial', label: 'Historial' },
        { key: 'intervalo', label: 'Intervalo' }
      ];

      // Control de pestaña activa por equipo
      activeTab: { [codigo: string]: string } = {};

      // Almacenar historial e intervalo por equipo
      historialPorEquipo: { [codigo: string]: any[] } = {};
      intervaloPorEquipo: { [codigo: string]: any[] } = {};

      // Modal de imagen (firma)
      firmaModalVisible = false;
      firmaModalSrc: string | null = null;

      abrirFirmaModal(src: string) {
        this.firmaModalSrc = src;
        this.firmaModalVisible = true;
      }

      cerrarFirmaModal() {
        this.firmaModalVisible = false;
        this.firmaModalSrc = null;
      }

      // Edit modal state (tabs + save)
      editModalVisible: boolean = false;
      editModalClosing: boolean = false;
      editModalActiveTab: string = 'hojaVida';

      // Temporary fields for adding a historial/intervalo from modal
      newHistorialTipo: string = '';
      newHistorialFecha: string = '';
      newHistorialObservaciones: string = '';
      newHistorialRealizo: string = '';
      newHistorialSuperviso: string = '';

      newIntervaloDescripcion: string = '';
      newIntervaloFecha: string = '';

      closeEditEquipoModal() {
        this.editModalVisible = false;
        this.editModalClosing = false;
        // clear new entry fields
        this.newHistorialTipo = '';
        this.newHistorialFecha = '';
        this.newHistorialObservaciones = '';
        this.newHistorialRealizo = '';
        this.newHistorialSuperviso = '';
        this.newIntervaloDescripcion = '';
        this.newIntervaloFecha = '';
      }

      async saveAllEditEquipo() {
        // Build payload from current form fields
        if (!this.editingEquipoCodigo) {
          this.snack.error('No se ha seleccionado equipo para editar');
          return;
        }
        const payload: any = {
          codigo_identificacion: this.codigo_identificacion,
          nombre: this.nombre,
          modelo: this.modelo,
          marca: this.marca,
          inventario_sena: this.inventario_sena,
          ubicacion: this.ubicacion,
          acreditacion: this.acreditacion,
          tipo_manual: this.tipo_manual,
          numero_serie: this.numero_serie,
          tipo: this.tipo,
          clasificacion: this.clasificacion,
          manual_usuario: this.manual_usuario,
          puesta_en_servicio: this.puesta_en_servicio,
          fecha_adquisicion: this.fecha_adquisicion,
          requerimientos_equipo: this.requerimientos_equipo,
          elementos_electricos: this.elementos_electricos,
          voltaje: this.voltaje,
          elementos_mecanicos: this.elementos_mecanicos,
          frecuencia: this.frecuencia,
          campo_medicion: this.campo_medicion,
          exactitud: this.exactitud,
          sujeto_verificar: this.sujeto_verificar,
          sujeto_calibracion: this.sujeto_calibracion,
          resolucion_division: this.resolucion_division,
          sujeto_calificacion: this.sujeto_calificacion,
          accesorios: this.accesorios
        };

        try {
          await equiposService.actualizarEquipo(this.editingEquipoCodigo, payload);
          // If user added a historial entry in modal, create it
          if (this.newHistorialTipo || this.newHistorialFecha || this.newHistorialObservaciones) {
            try {
              await equiposService.crearHistorial({
                codigo_registro: this.editingEquipoCodigo,
                fecha: this.newHistorialFecha || undefined,
                tipo_historial: this.newHistorialTipo || undefined,
                observaciones: this.newHistorialObservaciones || undefined,
                realizo: this.newHistorialRealizo || undefined,
                superviso: this.newHistorialSuperviso || undefined
              });
            } catch (hErr) {
              console.warn('No se pudo crear historial desde modal:', hErr);
            }
          }
          // If user added an intervalo entry in modal, create it
          if (this.newIntervaloDescripcion || this.newIntervaloFecha) {
            try {
              await equiposService.crearIntervalo({
                codigo_registro: this.editingEquipoCodigo,
                fecha: this.newIntervaloFecha || undefined,
                descripcion: this.newIntervaloDescripcion || undefined
              });
            } catch (iErr) {
              console.warn('No se pudo crear intervalo desde modal:', iErr);
            }
          }

          this.snack.success('Cambios guardados');
          await this.obtenerEquiposRegistrados();
          this.closeEditEquipoModal();
          this.editEquipoMode = false;
          this.editingEquipoCodigo = null;
        } catch (err: any) {
          console.error('Error actualizando equipo:', err);
          this.snack.error(err?.message || 'Error al guardar cambios del equipo');
        }
      }

      // Edit mode for equipo: open form prefilled
      editEquipoMode: boolean = false;
      editingEquipoCodigo: string | null = null;

      abrirEditarEquipo(equipo: any, event?: Event) {
        if (event) event.stopPropagation();
        if (!equipo) return;
        // Prefill the form fields used by crearEquipo / modal
        this.codigo_identificacion = equipo.codigo_identificacion || '';
        this.nombre = equipo.nombre || '';
        this.modelo = equipo.modelo || '';
        this.marca = equipo.marca || '';
        this.inventario_sena = equipo.inventario_sena || '';
        this.ubicacion = equipo.ubicacion || '';
        this.acreditacion = equipo.acreditacion || '';
        this.tipo_manual = equipo.tipo_manual || '';
        this.numero_serie = equipo.numero_serie || '';
        this.tipo = equipo.tipo || '';
        this.clasificacion = equipo.clasificacion || '';
        this.manual_usuario = equipo.manual_usuario || '';
        // Format date fields for type="date" inputs (yyyy-MM-dd)
        this.puesta_en_servicio = equipo.puesta_en_servicio ? this.formatearFecha(equipo.puesta_en_servicio) : '';
        this.fecha_adquisicion = equipo.fecha_adquisicion ? this.formatearFecha(equipo.fecha_adquisicion) : '';
        this.requerimientos_equipo = equipo.requerimientos_equipo || '';
        this.elementos_electricos = equipo.elementos_electricos || '';
        this.voltaje = equipo.voltaje || '';
        this.elementos_mecanicos = equipo.elementos_mecanicos || '';
        this.frecuencia = equipo.frecuencia || '';
        this.campo_medicion = equipo.campo_medicion || '';
        this.exactitud = equipo.exactitud || '';
        this.sujeto_verificar = equipo.sujeto_verificar || '';
        this.sujeto_calibracion = equipo.sujeto_calibracion || '';
        this.resolucion_division = equipo.resolucion_division || '';
        this.sujeto_calificacion = equipo.sujeto_calificacion || '';
        this.accesorios = equipo.accesorios || '';

        this.editEquipoMode = true;
        this.editingEquipoCodigo = equipo.codigo_identificacion || null;
        // Open edit modal with tabs
        this.editModalVisible = true;
        this.editModalClosing = false;
        this.editModalActiveTab = 'hojaVida';
      }

      // Control de registros de historial expandidos
      historialExpandido: { [key: string]: boolean } = {};

      // Control de registros de intervalo expandidos
      intervaloExpandido: { [key: string]: boolean } = {};

      // Toggle para expandir/contraer registro de historial
      toggleHistorialRegistro(equipoId: string, consecutivo: number) {
        const key = `${equipoId}_${consecutivo}`;
        this.historialExpandido[key] = !this.historialExpandido[key];
      }

      // Toggle para expandir/contraer registro de intervalo
      toggleIntervaloRegistro(equipoId: string, consecutivo: number) {
        const key = `${equipoId}_${consecutivo}`;
        this.intervaloExpandido[key] = !this.intervaloExpandido[key];
      }

      // Start editing a historial registro inline in the modal
      startEditHistorial(registro: any) {
        if (!registro) return;
        if (!registro._edit) {
          // create a shallow clone for editing
          registro._edit = { ...registro };
          // Ensure date inputs get a yyyy-MM-dd string so type="date" shows the value
          if (registro.fecha) {
            try {
              registro._edit.fecha = this.formatearFecha(registro.fecha);
            } catch (e) {
              // fallback: leave as-is
            }
          } else {
            registro._edit.fecha = '';
          }
        }
      }

      // Save edited historial registro
      async saveHistorialEdits(equipoCodigo: string, registro: any) {
        if (!registro || !registro._edit) return;
        try {
          const payload = { ...registro._edit };
          // call service to update by equipo + consecutivo
          const updated = await equiposService.actualizarHistorial(equipoCodigo, registro.consecutivo, payload);
          // merge updated fields back into registro
          Object.assign(registro, updated);
          delete registro._edit;
          this.snack.success('Registro de historial actualizado');
          // refresh local list if needed
          if (this.historialPorEquipo[equipoCodigo]) {
            const arr = this.historialPorEquipo[equipoCodigo];
            const idx = arr.findIndex((r: any) => r.id === registro.id);
            if (idx >= 0) arr[idx] = registro;
          }
        } catch (err: any) {
          console.error('Error actualizando historial:', err);
          // If backend returns 404 it likely means the API doesn't support updates for historial
          if (err && err.message && err.message.toString().includes('404')) {
            this.snack.error('El servidor no admite actualización de historial (404)');
          } else {
            this.snack.error(err?.message || 'Error al actualizar historial');
          }
        }
      }

      // Cancel editing and discard changes
      cancelHistorialEdits(registro: any) {
        if (registro && registro._edit) delete registro._edit;
      }

      // Start editing an intervalo registro inline in the modal
      startEditIntervalo(registro: any) {
        if (!registro) return;
        if (!registro._edit) {
          registro._edit = { ...registro };
          // Ensure date inputs get a yyyy-MM-dd string so type="date" shows the value
          if (registro.fecha_c1) {
            try { registro._edit.fecha_c1 = this.formatearFecha(registro.fecha_c1); } catch (e) { }
          } else {
            registro._edit.fecha_c1 = '';
          }
          if (registro.fecha_c2) {
            try { registro._edit.fecha_c2 = this.formatearFecha(registro.fecha_c2); } catch (e) { }
          } else {
            registro._edit.fecha_c2 = '';
          }
        }
      }

      // Save edited intervalo registro
      async saveIntervaloEdits(equipoCodigo: string, registro: any) {
        if (!registro || !registro._edit) return;
        try {
          const payload = { ...registro._edit };
          const svc: any = equiposService as any;
          if (svc && typeof svc.actualizarIntervalo === 'function') {
            // backend supports update by equipo + consecutivo
            const updated = await svc.actualizarIntervalo(equipoCodigo, registro.consecutivo, payload);
            // merge updated fields back into registro
            Object.assign(registro, updated);
            delete registro._edit;
            this.snack.success('Registro de intervalo actualizado');
            // refresh list for equipo
            try {
              const data = await equiposService.listarIntervaloPorEquipo(equipoCodigo);
              this.intervaloPorEquipo[equipoCodigo] = data;
            } catch (e) {
              // ignore refresh errors
            }
          } else {
            // No backend update route available — apply changes locally
            Object.assign(registro, registro._edit);
            delete registro._edit;
            this.snack.warn('Actualización local aplicada (el servidor no soporta actualización de intervalo)');
          }
        } catch (err: any) {
          console.error('Error actualizando intervalo:', err);
          if (err && err.message && err.message.toString().includes('404')) {
            this.snack.error('El servidor no admite actualización de intervalo (404)');
          } else {
            this.snack.error(err?.message || 'Error al actualizar intervalo');
          }
        }
      }

      // Cancel editing intervalo and discard changes
      cancelIntervaloEdits(registro: any) {
        if (registro && registro._edit) delete registro._edit;
      }

      // Seleccionar pestaña
      async selectTab(codigo: string, tabKey: string) {
        this.activeTab[codigo] = tabKey;
        // Los datos ya están precargados, solo cambiar de pestaña
        this.cdr.detectChanges();
      }

    // Formatea una fecha ISO a yyyy-MM-dd para el input type="date"
    formatearFecha(fecha: string): string {
      if (!fecha) return '';
      const d = new Date(fecha);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    }
  
    // PDF lists per equipo (map keyed by codigo_identificacion)
    pdfListByEquipo: { [codigo: string]: Array<{ id?: number; name: string; url: string; categoria?: string; size?: number; mime?: string; fecha_subida?: Date | null; displayName?: string }> } = {};
    selectedPdfByEquipo: { [codigo: string]: string | null } = {};
    menuCategoriaPdfVisible: { [codigo: string]: boolean } = {};

    mostrarMenuCategoriaPdf(codigo: string, event?: Event) {
      if (event) event.stopPropagation();
      // Alternar visibilidad del menú
      this.menuCategoriaPdfVisible[codigo] = !this.menuCategoriaPdfVisible[codigo];
      // Cerrar otros menús abiertos
      Object.keys(this.menuCategoriaPdfVisible).forEach(key => {
        if (key !== codigo) {
          this.menuCategoriaPdfVisible[key] = false;
        }
      });
    }

    async listarPdfs(codigo: string) {
      try {
          const data: any[] = await equiposService.listarPdfsPorEquipo(codigo);
          // Normalize and keep fecha_subida for ordering
          const items: any[] = (data || []).map(p => ({
            id: p.id,
            name: p.nombre_archivo || p.name || 'Archivo',
            url: p.url_archivo || p.url,
            categoria: p.categoria,
            size: p.size_bytes,
            mime: p.mime,
            fecha_subida: p.fecha_subida ? new Date(p.fecha_subida) : null
          }));

          // Sort by fecha_subida ascending so the earliest uploaded is first
          items.sort((a, b) => {
            if (!a.fecha_subida && !b.fecha_subida) return 0;
            if (!a.fecha_subida) return 1;
            if (!b.fecha_subida) return -1;
            return a.fecha_subida.getTime() - b.fecha_subida.getTime();
          });

          // Assign display names by grouping per category and numbering only when there are multiple
          const groups: { [cat: string]: Array<any> } = {};
          for (const it of items) {
            const cat = (it.categoria || '').trim();
            if (!cat) continue;
            groups[cat] = groups[cat] || [];
            groups[cat].push(it);
          }

          // For each group, sort by fecha_subida (already sorted globally) and assign numbers only if group has more than one
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

          // For items without category, fallback to filename
          for (const it of items) {
            if (!it.categoria || !it.categoria.toString().trim()) {
              it.displayName = it.name;
            }
          }

          this.pdfListByEquipo[codigo] = items;
          this.selectedPdfByEquipo[codigo] = this.pdfListByEquipo[codigo]?.[0]?.url || null;
          this.cdr.detectChanges();
        } catch (err) {
          console.warn('Error listando PDFs', err);
          this.pdfListByEquipo[codigo] = [];
          this.selectedPdfByEquipo[codigo] = null;
          this.cdr.detectChanges();
        }
    }

    openPdf(codigo: string, event?: Event) {
      if (event) event.stopPropagation();
      const url = this.selectedPdfByEquipo[codigo] || this.pdfListByEquipo[codigo]?.[0]?.url;
      if (!url) {
        this.snack.warn('No hay PDF seleccionado para ver');
        return;
      }
      window.open(url, '_blank');
    }

    async deletePdf(codigo: string, event?: Event) {
      if (event) event.stopPropagation();
      const url = this.selectedPdfByEquipo[codigo];
      if (!url) {
        this.snack.warn('Seleccione un PDF para eliminar');
        return;
      }
      const item = (this.pdfListByEquipo[codigo] || []).find(p => p.url === url);
      if (!item || !item.id) {
        this.snack.warn('No se encontró el PDF para eliminar');
        return;
      }

      const confirmMsg = `¿Eliminar "${item.name}"? Esta acción no se puede deshacer.`;
      if (!window.confirm(confirmMsg)) return;

      try {
        await equiposService.eliminarPdf(item.id);
        this.snack.success('PDF eliminado');
        await this.listarPdfs(codigo);
      } catch (err: any) {
        console.error('Error eliminando PDF', err);
        this.snack.error(err.message || 'Error al eliminar PDF');
      }
    }

    // Start upload flow: open file picker and upload selected PDF with given category
    iniciarUpload(codigo: string, categoria: string, event?: Event) {
      if (event) event.stopPropagation();
      // Cerrar el menú de categorías
      this.menuCategoriaPdfVisible[codigo] = false;
      
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          await equiposService.subirPdfEquipo(codigo, categoria, file);
          this.snack.success('PDF subido correctamente');
          await this.listarPdfs(codigo);
        } catch (err: any) {
          console.error('Error subiendo PDF', err);
          this.snack.error(err.message || 'Error al subir PDF');
        }
      };
      input.click();
    }
  // Variable para controlar el formulario activo
  formularioActivo: string | null = null;

  // Variable para controlar el equipo expandido en la lista
  equipoExpandido: string | null = null;
  // Segundo nivel: tarjeta de información completa
  equipoInfoExpandido: string | null = null;

  // Variables para búsqueda y autocompletado
  busquedaEquipo = '';
  tipoFiltro: string = 'todos'; // 'todos', 'codigo', 'nombre', 'marca', 'modelo'
  equiposFiltrados: any[] = [];
  equipoSeleccionado: any = null;
  mostrarResultados: boolean = false;

  // Opciones para el select de filtro
  opcionesFiltro = [
    { valor: 'todos', texto: 'Todos los campos' },
    { valor: 'codigo', texto: 'Código' },
    { valor: 'nombre', texto: 'Nombre' },
    { valor: 'marca', texto: 'Marca' },
    { valor: 'modelo', texto: 'Modelo' }
  ];

  // Campos para ficha_tecnica_de_equipos
  codigo_identificador = '';
  nombre_ficha = '';
  marca_ficha = '';
  modelo_ficha = '';
  serie_ficha = '';
  fabricante = '';
  fecha_adq = '';
  uso = '';
  fecha_func = '';
  precio: number | null = null;
  accesorios_ficha = '';
  manual_ope = '';
  idioma_manual = '';
  
  // Especificaciones de medición
  magnitud = '';
  resolucion = '';
  precision_med = '';
  exactitud_ficha = '';
  rango_de_medicion = '';
  rango_de_uso = '';
  
  // Especificaciones eléctricas
  voltaje_ficha = '';
  potencia = '';
  amperaje = '';
  frecuencia_ficha = '';
  
  // Dimensiones físicas
  ancho: number | null = null;
  alto: number | null = null;
  peso_kg: number | null = null;
  profundidad: number | null = null;
  
  // Condiciones ambientales
  temperatura_c: number | null = null;
  humedad_porcentaje: number | null = null;
  limitaciones_e_interferencias = '';
  otros = '';
  
  // Especificaciones técnicas del software
  especificaciones_software = '';
  
  // Información del proveedor
  proveedor = '';
  email = '';
  telefono = '';
  fecha_de_instalacion = '';
  alcance_del_servicio = '';
  garantia = '';
  observaciones_ficha = '';
  recibido_por = '';
  // Reemplazo de cargo_y_firma por imagen de firma
  firmaArchivo: File | null = null;
  fecha_ficha = '';

  // Campos para intervalo_hv
  consecutivo_intervalo: number | null = null;
  equipo_id_intervalo: string = '';
  unidad_nominal_g: number | null = null;
  calibracion_1: string = '';
  fecha_c1: string = '';
  error_c1_g: number | null = null;
  calibracion_2: string = '';
  fecha_c2: string = '';
  error_c2_g: number | null = null;
  diferencia_dias: number | null = null;
  desviacion: number | null = null;
  deriva: number | null = null;
  tolerancia_g_intervalo: number | null = null;
  intervalo_calibraciones_dias: number | null = null;
  intervalo_calibraciones_anios: number | null = null;

  // Campos para historial_hv
  consecutivo: number | null = null;
  equipo_id: string = '';
  fecha: string = '';
  tipo_historial: string = '';
  codigo_registro: string = '';
  tolerancia_g: number | null = null;
  tolerancia_error_g: number | null = null;
  incertidumbre_u: number | null = null;
  realizo: string = '';
  superviso: string = '';
  observaciones: string = '';

  // Campos del formulario principal
  codigo_identificacion = '';
  codigo_identificacion_intervalo = '';
  nombre = '';
  modelo = '';
  marca = '';
  inventario_sena = '';
  ubicacion = '';
  acreditacion = '';
  tipo_manual = '';
  numero_serie = '';
  tipo = '';
  clasificacion = '';
  manual_usuario = '';
  puesta_en_servicio = '';
  fecha_adquisicion = '';
  requerimientos_equipo = '';
  elementos_electricos = '';
  voltaje = '';
  elementos_mecanicos = '';
  frecuencia = '';
  campo_medicion = '';
  exactitud = '';
  sujeto_verificar = '';
  sujeto_calibracion = '';
  resolucion_division = '';
  sujeto_calificacion = '';
  accesorios = '';

  equiposRegistrados: any[] = [];
  cargandoEquipos = false;

  // Señales para selección y consecutivos
  codigoHistorialSig = signal<string>('');
  consecutivoHistorialSig = signal<number | null>(null);
  codigoIntervaloSig = signal<string>('');
  consecutivoIntervaloSig = signal<number | null>(null);

  constructor(public snack: SnackbarService, private cdr: ChangeDetectorRef) {
    // Efecto: cuando cambia el código de historial, obtener siguiente consecutivo
    effect(() => {
      const codigo = this.codigoHistorialSig();
      if (this.formularioActivo === 'historial' && codigo) {
        equiposService.obtenerNextHistorial(codigo)
          .then(resp => this.consecutivoHistorialSig.set(resp.next))
          .catch(() => this.snack.warn('No se pudo cargar consecutivo historial'));
      } else if (this.formularioActivo === 'historial' && !codigo) {
        this.consecutivoHistorialSig.set(null);
      }
    });

    // Efecto: cuando cambia el código de intervalo, obtener siguiente consecutivo
    effect(() => {
      const codigo = this.codigoIntervaloSig();
      if (this.formularioActivo === 'intervalo' && codigo) {
        equiposService.obtenerNextIntervalo(codigo)
          .then(resp => this.consecutivoIntervaloSig.set(resp.next))
          .catch(() => this.snack.warn('No se pudo cargar consecutivo intervalo'));
      } else if (this.formularioActivo === 'intervalo' && !codigo) {
        this.consecutivoIntervaloSig.set(null);
      }
    });
  }

  ngOnInit() {
    console.log('🎯 EquiposComponent inicializado - cargando equipos...');
    // Cargar equipos al inicializar el componente
    this.obtenerEquiposRegistrados();
    // Attach dropdown flip handlers: use event delegation for details 'toggle'
    this._dropdownToggleHandler = (evt: Event) => {
      const target = evt.target as HTMLElement;
      if (!target) return;
      if (target.classList && target.classList.contains('compact-dropdown')) {
        this._adjustDropdown(target as HTMLDetailsElement);
      }
    };
    document.addEventListener('toggle', this._dropdownToggleHandler, true);

    this._resizeHandler = () => {
      // Adjust any open dropdowns on resize
      const openDropdowns = Array.from(document.querySelectorAll('.compact-dropdown[open]')) as HTMLElement[];
      for (const d of openDropdowns) this._adjustDropdown(d as HTMLDetailsElement);
    };
    window.addEventListener('resize', this._resizeHandler);

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

  ngOnDestroy(): void {
    if (this._dropdownToggleHandler) document.removeEventListener('toggle', this._dropdownToggleHandler, true);
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
  }

  // (Implementaciones reales al final del archivo)



  // Función para buscar equipos con filtro específico
  buscarEquipos() {
    if (!this.busquedaEquipo.trim()) {
      this.equiposFiltrados = [];
      this.mostrarResultados = false;
      return;
    }
    
    const busqueda = this.busquedaEquipo.toLowerCase().trim();
    this.mostrarResultados = true;
    
    this.equiposFiltrados = this.equiposRegistrados.filter(equipo => {
      switch (this.tipoFiltro) {
        case 'codigo':
          return equipo.codigo_identificacion?.toLowerCase().includes(busqueda);
        
        case 'nombre':
          return equipo.nombre?.toLowerCase().includes(busqueda);
        
        case 'marca':
          return equipo.marca?.toLowerCase().includes(busqueda);
        
        case 'modelo':
          return equipo.modelo?.toLowerCase().includes(busqueda);
        
        case 'todos':
        default:
          return (
            equipo.codigo_identificacion?.toLowerCase().includes(busqueda) ||
            equipo.nombre?.toLowerCase().includes(busqueda) ||
            equipo.marca?.toLowerCase().includes(busqueda) ||
            equipo.modelo?.toLowerCase().includes(busqueda)
          );
      }
    });
  }

  // Adjust dropdown position by adding/removing the 'flip' class
  private _adjustDropdown(details: HTMLDetailsElement) {
    try {
      const menu = details.querySelector('.compact-menu') as HTMLElement | null;
      if (!menu) return;
      // Ensure menu is visible to compute size
      // If details is closed, nothing to do
      if (!details.open) {
        details.classList.remove('flip');
        return;
      }

      const rect = menu.getBoundingClientRect();
      const margin = 8; // small margin from viewport edge
      const overBottom = rect.bottom > (window.innerHeight - margin);
      const overTop = rect.top < margin;

      if (overBottom && !overTop) {
        details.classList.add('flip');
      } else if (overTop && !overBottom) {
        details.classList.add('flip');
      } else {
        details.classList.remove('flip');
      }
    } catch (err) {
      // silent
    }
  }

  // Devuelve el número de registros asociados a una pestaña (historial/intervalo)
  getTabCount(equipo: any, tabKey: string): number {
    if (!equipo || !tabKey) return 0;
    const codigo = equipo.codigo_identificacion || equipo.codigo_identificador || equipo.codigo || equipo.id;
    if (!codigo) return 0;
    if (tabKey === 'historial') {
      const arr = this.historialPorEquipo[codigo];
      return Array.isArray(arr) ? arr.length : 0;
    }
    if (tabKey === 'intervalo') {
      const arr = this.intervaloPorEquipo[codigo];
      return Array.isArray(arr) ? arr.length : 0;
    }
    return 0;
  }

  // Función para cambiar el tipo de filtro
  cambiarTipoFiltro(tipo: string) {
    this.tipoFiltro = tipo;
    if (this.busquedaEquipo.trim()) {
      this.buscarEquipos();
    }
  }

  // Función para seleccionar equipo y autocompletar SOLO campos similares
  seleccionarEquipo(equipo: any) {
    this.equipoSeleccionado = equipo;
    this.busquedaEquipo = `${equipo.codigo_identificacion} - ${equipo.nombre}`;
    this.equiposFiltrados = [];
    this.mostrarResultados = false;

    // Solo autocompletar los campos solicitados
    this.codigo_identificador = equipo.codigo_identificacion || '';
    this.nombre_ficha = equipo.nombre || '';
    this.marca_ficha = equipo.marca || '';
    this.modelo_ficha = equipo.modelo || '';
    this.serie_ficha = equipo.numero_serie || '';
    this.fecha_adq = equipo.fecha_adquisicion ? this.formatearFecha(equipo.fecha_adquisicion) : '';
    this.fecha_func = equipo.puesta_en_servicio ? this.formatearFecha(equipo.puesta_en_servicio) : '';
    this.voltaje_ficha = equipo.voltaje || '';
    this.frecuencia_ficha = equipo.frecuencia || '';
    this.accesorios_ficha = equipo.accesorios || '';

    // Limpiar los demás campos autocompletados previamente (excepto los que se deben autocompletar)
    this.fabricante = '';
    this.uso = '';
    this.magnitud = '';
    this.exactitud_ficha = '';
    this.resolucion = '';
    this.limitaciones_e_interferencias = '';
    this.otros = '';

    this.snack.success(`Datos de "${equipo.nombre}" cargados en ficha técnica (solo campos permitidos)`);
  }

  // Limpiar búsqueda
  limpiarBusqueda() {
    this.busquedaEquipo = '';
    this.tipoFiltro = 'todos';
    this.equiposFiltrados = [];
    this.equipoSeleccionado = null;
    this.mostrarResultados = false;
  }

  // Método para obtener el placeholder dinámico
  getPlaceholder(): string {
    switch (this.tipoFiltro) {
      case 'codigo':
        return 'Buscar por código...';
      case 'nombre':
        return 'Buscar por nombre...';
      case 'marca':
        return 'Buscar por marca...';
      case 'modelo':
        return 'Buscar por modelo...';
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

  async obtenerEquiposRegistrados() {
    console.log('🔄 Iniciando carga de equipos...');
    this.cargandoEquipos = true;
    try {
      const equipos = await equiposService.listarEquipos();
      console.log('✅ Equipos recibidos del servicio:', equipos);
      
      // Precargar historial e intervalo para todos los equipos
      await Promise.all(equipos.map(async (equipo: any) => {
        const codigo = equipo.codigo_identificacion;
        try {
          const [historial, intervalo] = await Promise.all([
            equiposService.listarHistorialPorEquipo(codigo),
            equiposService.listarIntervaloPorEquipo(codigo)
          ]);
          this.historialPorEquipo[codigo] = historial;
          this.intervaloPorEquipo[codigo] = intervalo;
          // Inicializar lista de PDFs por equipo (si el backend devuelve un campo `pdfs`),
          // si no existen, consultamos el servicio específico
          if (equipo.pdfs && equipo.pdfs.length) {
            this.pdfListByEquipo[codigo] = (equipo.pdfs || []).map((p: any) => ({ id: p.id, name: p.nombre_archivo || p.name || 'Archivo', url: p.url_archivo || p.url, categoria: p.categoria }));
            this.selectedPdfByEquipo[codigo] = this.pdfListByEquipo[codigo]?.[0]?.url || null;
            // Ensure displayName numbering is applied for initial data
            this.computePdfDisplayNames(codigo);
          } else {
            try {
              const pdfsData: any[] = await equiposService.listarPdfsPorEquipo(codigo);
              this.pdfListByEquipo[codigo] = (pdfsData || []).map(p => ({ id: p.id, name: p.nombre_archivo || p.name || 'Archivo', url: p.url_archivo || p.url, categoria: p.categoria, fecha_subida: p.fecha_subida }));
              // Normalize display names/numbering
              this.computePdfDisplayNames(codigo);
              this.selectedPdfByEquipo[codigo] = this.pdfListByEquipo[codigo]?.[0]?.url || null;
            } catch (err) {
              this.pdfListByEquipo[codigo] = [];
              this.selectedPdfByEquipo[codigo] = null;
            }
          }
        } catch (error) {
          console.warn(`Error al precargar datos para equipo ${codigo}:`, error);
          this.historialPorEquipo[codigo] = [];
          this.intervaloPorEquipo[codigo] = [];
        }
      }));
      
      // Aseguramos que cada equipo tenga todos los campos necesarios para la visualización
      this.equiposRegistrados = equipos.map((equipo: any) => ({
        codigo_identificacion: equipo.codigo_identificacion,
        nombre: equipo.nombre,
        modelo: equipo.modelo,
        marca: equipo.marca,
        numero_serie: equipo.numero_serie,
        clasificacion: equipo.clasificacion,
        tipo: equipo.tipo,
        ubicacion: equipo.ubicacion,
        acreditacion: equipo.acreditacion,
        inventario_sena: equipo.inventario_sena,
        tipo_manual: equipo.tipo_manual,
        manual_usuario: equipo.manual_usuario,
        fecha_adquisicion: equipo.fecha_adquisicion,
        puesta_en_servicio: equipo.puesta_en_servicio,
        elementos_electricos: equipo.elementos_electricos,
        voltaje: equipo.voltaje,
        elementos_mecanicos: equipo.elementos_mecanicos,
        frecuencia: equipo.frecuencia,
        requerimientos_equipo: equipo.requerimientos_equipo,
        campo_medicion: equipo.campo_medicion,
        exactitud: equipo.exactitud,
        sujeto_verificar: equipo.sujeto_verificar,
        sujeto_calibracion: equipo.sujeto_calibracion,
        resolucion_division: equipo.resolucion_division,
        sujeto_calificacion: equipo.sujeto_calificacion,
        accesorios: equipo.accesorios,
        // Campos de ficha técnica
        fabricante: equipo.fabricante,
        uso: equipo.uso,
        fecha_adq: equipo.fecha_adq,
        fecha_func: equipo.fecha_func,
        precio: equipo.precio,
        manual_ope: equipo.manual_ope,
        idioma_manual: equipo.idioma_manual,
        magnitud: equipo.magnitud,
        resolucion: equipo.resolucion,
        precision_med: equipo.precision_med,
        rango_de_medicion: equipo.rango_de_medicion,
        rango_de_uso: equipo.rango_de_uso,
        potencia: equipo.potencia,
        amperaje: equipo.amperaje,
        ancho: equipo.ancho,
        alto: equipo.alto,
        peso_kg: equipo.peso_kg,
        profundidad: equipo.profundidad,
        temperatura_c: equipo.temperatura_c,
        humedad_porcentaje: equipo.humedad_porcentaje,
        limitaciones_e_interferencias: equipo.limitaciones_e_interferencias,
        otros: equipo.otros,
        especificaciones_software: equipo.especificaciones_software,
        proveedor: equipo.proveedor,
        email: equipo.email,
        telefono: equipo.telefono,
        fecha_de_instalacion: equipo.fecha_de_instalacion,
        alcance_del_servicio: equipo.alcance_del_servicio,
        garantia: equipo.garantia,
        observaciones: equipo.observaciones,
        recibido_por: equipo.recibido_por,
        fecha: equipo.fecha
      }));
      console.log('✅ Equipos procesados. Total:', this.equiposRegistrados.length);
      console.log('✅ Estado cargandoEquipos antes de finally:', this.cargandoEquipos);
    } catch (error: any) {
      console.error('❌ Error al obtener equipos:', error);
      this.snack.error(error.message || 'Error al obtener equipos registrados');
      this.equiposRegistrados = []; // Asegurar que el array esté inicializado
    } finally {
      console.log('🏁 Finally block ejecutado, estableciendo cargandoEquipos = false');
      this.cargandoEquipos = false;
      this.cdr.detectChanges(); // Forzar detección de cambios
      console.log('✅ Estado cargandoEquipos después de finally:', this.cargandoEquipos);
    }
  }

  // Compute displayName for pdfListByEquipo[codigo]: if multiple files share the same category,
  // append numbering like 'Categoria - 1', otherwise show just the category. Fallback to filename.
  computePdfDisplayNames(codigo: string) {
    const items = this.pdfListByEquipo[codigo] || [];
    if (!items.length) return;

    // Ensure fecha_subida is Date where present
    for (const it of items) {
      if (it.fecha_subida && !(it.fecha_subida instanceof Date)) {
        try { it.fecha_subida = new Date(it.fecha_subida); } catch { it.fecha_subida = null; }
      }
    }

    // Maintain current order (or by fecha_subida if present)
    items.sort((a: any, b: any) => {
      if (a.fecha_subida && b.fecha_subida) return new Date(a.fecha_subida).getTime() - new Date(b.fecha_subida).getTime();
      return 0; // keep existing order
    });

    const groups: { [cat: string]: any[] } = {};
    for (const it of items) {
      const cat = (it.categoria || '').toString().trim();
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
      if (!it.categoria || !it.categoria.toString().trim()) it.displayName = it.name;
    }

    // write back
    this.pdfListByEquipo[codigo] = items;
  }

  // Método para crear ficha técnica
  async crearFichaTecnica(event: Event) {
    event.preventDefault();
    
    // Validación básica
    if (!this.codigo_identificador || !this.nombre_ficha) {
      this.snack.warn('Código y nombre son obligatorios');
      return;
    }
    
    try {
      const form = new FormData();
      form.append('codigo_identificador', this.codigo_identificador);
      form.append('nombre', this.nombre_ficha);
      form.append('marca', this.marca_ficha);
      form.append('modelo', this.modelo_ficha);
      form.append('serie', this.serie_ficha);
      form.append('fabricante', this.fabricante);
      form.append('fecha_adq', this.fecha_adq || '');
      form.append('uso', this.uso);
      form.append('fecha_func', this.fecha_func || '');
      if (this.precio !== null && this.precio !== undefined) form.append('precio', String(this.precio));
      form.append('accesorios', this.accesorios_ficha);
      form.append('manual_ope', this.manual_ope);
      form.append('idioma_manual', this.idioma_manual);
      form.append('magnitud', this.magnitud);
      form.append('resolucion', this.resolucion);
      form.append('precision_med', this.precision_med);
      form.append('exactitud', this.exactitud_ficha);
      form.append('rango_de_medicion', this.rango_de_medicion);
      form.append('rango_de_uso', this.rango_de_uso);
      form.append('voltaje', this.voltaje_ficha);
      form.append('potencia', this.potencia);
      form.append('amperaje', this.amperaje);
      form.append('frecuencia', this.frecuencia_ficha);
      if (this.ancho !== null) form.append('ancho', String(this.ancho));
      if (this.alto !== null) form.append('alto', String(this.alto));
      if (this.peso_kg !== null) form.append('peso_kg', String(this.peso_kg));
      if (this.profundidad !== null) form.append('profundidad', String(this.profundidad));
      if (this.temperatura_c !== null) form.append('temperatura_c', String(this.temperatura_c));
      if (this.humedad_porcentaje !== null) form.append('humedad_porcentaje', String(this.humedad_porcentaje));
      form.append('limitaciones_e_interferencias', this.limitaciones_e_interferencias);
      form.append('otros', this.otros);
      form.append('especificaciones_software', this.especificaciones_software);
      form.append('proveedor', this.proveedor);
      form.append('email', this.email);
      form.append('telefono', this.telefono);
      form.append('fecha_de_instalacion', this.fecha_de_instalacion || '');
      form.append('alcance_del_servicio', this.alcance_del_servicio);
      form.append('garantia', this.garantia);
      form.append('observaciones', this.observaciones_ficha);
      form.append('recibido_por', this.recibido_por);
      // Enviar la imagen de firma si existe
      if (this.firmaArchivo) {
        form.append('firma', this.firmaArchivo);
      }
      form.append('fecha', this.fecha_ficha || '');

      await equiposService.crearFichaTecnica(form);
      this.snack.success('Ficha técnica registrada exitosamente');
      await this.obtenerEquiposRegistrados(); // Recargar equipos para mostrar datos actualizados
      this.resetFormFichaTecnica();
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar ficha técnica');
    }
  }

  // Resetear formulario de ficha técnica
  resetFormFichaTecnica() {
    this.codigo_identificador = '';
    this.nombre_ficha = '';
    this.marca_ficha = '';
    this.modelo_ficha = '';
    this.serie_ficha = '';
    this.fabricante = '';
    this.fecha_adq = '';
    this.uso = '';
    this.fecha_func = '';
    this.precio = null;
    this.accesorios_ficha = '';
    this.manual_ope = '';
    this.idioma_manual = '';
    this.magnitud = '';
    this.resolucion = '';
    this.precision_med = '';
    this.exactitud_ficha = '';
    this.rango_de_medicion = '';
    this.rango_de_uso = '';
    this.voltaje_ficha = '';
    this.potencia = '';
    this.amperaje = '';
    this.frecuencia_ficha = '';
    this.ancho = null;
    this.alto = null;
    this.peso_kg = null;
    this.profundidad = null;
    this.temperatura_c = null;
    this.humedad_porcentaje = null;
    this.limitaciones_e_interferencias = '';
    this.otros = '';
    this.especificaciones_software = '';
    this.proveedor = '';
    this.email = '';
    this.telefono = '';
    this.fecha_de_instalacion = '';
    this.alcance_del_servicio = '';
    this.garantia = '';
    this.observaciones_ficha = '';
    this.recibido_por = '';
    this.firmaArchivo = null;
    this.fecha_ficha = '';
    this.limpiarBusqueda();
  }

  onFirmaChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.firmaArchivo = input.files[0];
    } else {
      this.firmaArchivo = null;
    }
  }

  // Calcular diferencia de días entre fecha_c2 y fecha_c1
  calcularDiferenciaDias() {
    if (this.fecha_c1 && this.fecha_c2) {
      const fecha1 = new Date(this.fecha_c1);
      const fecha2 = new Date(this.fecha_c2);
      
      // Calcular diferencia en milisegundos y convertir a días
      const diferenciaMilisegundos = fecha2.getTime() - fecha1.getTime();
      const diferenciaDias = Math.round(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
      
      this.diferencia_dias = diferenciaDias;
      this.calcularDeriva(); // Recalcular deriva cuando cambia diferencia_dias
    } else {
      this.diferencia_dias = null;
      this.deriva = null;
    }
  }

  // Calcular desviación como valor absoluto de la diferencia entre error_c2_g y error_c1_g
  calcularDesviacion() {
    if (this.error_c1_g !== null && this.error_c2_g !== null) {
      this.desviacion = Math.abs(this.error_c2_g - this.error_c1_g);
      this.calcularDeriva(); // Recalcular deriva cuando cambia desviación
    } else {
      this.desviacion = null;
      this.deriva = null;
    }
  }

  // Calcular deriva como desviación / diferencia_dias
  calcularDeriva() {
    if (this.desviacion !== null && this.diferencia_dias !== null && this.diferencia_dias !== 0) {
      this.deriva = this.desviacion / this.diferencia_dias;
      this.calcularIntervaloCalibDias(); // Recalcular intervalo cuando cambia deriva
    } else {
      this.deriva = null;
      this.intervalo_calibraciones_dias = null;
    }
  }

  // Calcular intervalo calibraciones (días) como ABS(tolerancia_g_intervalo / deriva)
  calcularIntervaloCalibDias() {
    if (this.tolerancia_g_intervalo !== null && this.deriva !== null && this.deriva !== 0) {
      this.intervalo_calibraciones_dias = Math.abs(this.tolerancia_g_intervalo / this.deriva);
      this.calcularIntervaloCalibAnios(); // Recalcular años cuando cambian los días
    } else {
      this.intervalo_calibraciones_dias = null;
      this.intervalo_calibraciones_anios = null;
    }
  }

  // Calcular intervalo calibraciones (años) como intervalo_calibraciones_dias / 365
  calcularIntervaloCalibAnios() {
    if (this.intervalo_calibraciones_dias !== null) {
      this.intervalo_calibraciones_anios = this.intervalo_calibraciones_dias / 365;
    } else {
      this.intervalo_calibraciones_anios = null;
    }
  }

  async crearIntervalo(event: Event) {
    event.preventDefault();
    
    const consecutivo = this.consecutivoIntervaloSig();
    const equipo_id = this.codigoIntervaloSig();
    
    if (!consecutivo || !equipo_id) {
      this.snack.warn('Debe seleccionar un equipo y tener un consecutivo válido');
      return;
    }
    // Validation: fecha_c2 cannot be earlier than fecha_c1
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
    
    try {
      await equiposService.crearIntervalo({
        consecutivo: consecutivo,
        equipo_id: equipo_id,
        unidad_nominal_g: this.unidad_nominal_g,
        calibracion_1: this.calibracion_1,
        fecha_c1: this.fecha_c1,
        error_c1_g: this.error_c1_g,
        calibracion_2: this.calibracion_2,
        fecha_c2: this.fecha_c2,
        error_c2_g: this.error_c2_g,
        diferencia_dias: this.diferencia_dias,
        desviacion: this.desviacion,
        deriva: this.deriva,
        tolerancia_g: this.tolerancia_g_intervalo,
        intervalo_calibraciones_dias: this.intervalo_calibraciones_dias,
        intervalo_calibraciones_anios: this.intervalo_calibraciones_anios
      });
      this.snack.success('Intervalo registrado exitosamente');
      this.resetFormIntervalo();
      // Recargar lista si está en la pestaña intervalo
      if (this.intervaloPorEquipo[equipo_id]) {
        const data = await equiposService.listarIntervaloPorEquipo(equipo_id);
        this.intervaloPorEquipo[equipo_id] = data;
      }
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar intervalo');
    }
  }

  async crearHistorial(event: Event) {
    event.preventDefault();
    
    const consecutivo = this.consecutivoHistorialSig();
    const equipo_id = this.codigoHistorialSig();
    
    if (!consecutivo || !equipo_id) {
      this.snack.warn('Debe seleccionar un equipo y tener un consecutivo válido');
      return;
    }
    
    try {
      await equiposService.crearHistorial({
        consecutivo: consecutivo,
        equipo_id: equipo_id,
        fecha: this.fecha,
        tipo_historial: this.tipo_historial,
        codigo_registro: this.codigo_registro,
        tolerancia_g: this.tolerancia_g,
        tolerancia_error_g: this.tolerancia_error_g,
        incertidumbre_u: this.incertidumbre_u,
        realizo: this.realizo,
        superviso: this.superviso,
        observaciones: this.observaciones
      });
      this.snack.success('Historial registrado exitosamente');
      this.resetFormHistorial();
      // Recargar lista si está en la pestaña historial
      if (this.historialPorEquipo[equipo_id]) {
        const data = await equiposService.listarHistorialPorEquipo(equipo_id);
        this.historialPorEquipo[equipo_id] = data;
      }
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar historial');
    }
  }

  async crearEquipo(event: Event) {
    event.preventDefault();
    
    if (!this.codigo_identificacion || !this.nombre) {
      this.snack.warn('Código y nombre son obligatorios');
      return;
    }

    // Validación: la fecha de puesta en servicio no puede ser menor que la de adquisición
    if (this.fecha_adquisicion && this.puesta_en_servicio) {
      const fa = new Date(this.fecha_adquisicion);
      const fs = new Date(this.puesta_en_servicio);
      fa.setHours(0,0,0,0);
      fs.setHours(0,0,0,0);
      if (fs < fa) {
        this.snack.warn('La fecha de puesta en servicio no puede ser menor que la fecha de adquisición');
        return;
      }
    }
    
    try {
      const payload = {
        codigo_identificacion: this.codigo_identificacion,
        nombre: this.nombre,
        modelo: this.modelo,
        marca: this.marca,
        inventario_sena: this.inventario_sena,
        ubicacion: this.ubicacion,
        acreditacion: this.acreditacion,
        tipo_manual: this.tipo_manual,
        numero_serie: this.numero_serie,
        tipo: this.tipo,
        clasificacion: this.clasificacion,
        manual_usuario: this.manual_usuario,
        puesta_en_servicio: this.puesta_en_servicio,
        fecha_adquisicion: this.fecha_adquisicion,
        requerimientos_equipo: this.requerimientos_equipo,
        elementos_electricos: this.elementos_electricos,
        voltaje: this.voltaje,
        elementos_mecanicos: this.elementos_mecanicos,
        frecuencia: this.frecuencia,
        campo_medicion: this.campo_medicion,
        exactitud: this.exactitud,
        sujeto_verificar: this.sujeto_verificar,
        sujeto_calibracion: this.sujeto_calibracion,
        resolucion_division: this.resolucion_division,
        sujeto_calificacion: this.sujeto_calificacion,
        accesorios: this.accesorios
      };

      if (this.editEquipoMode && this.editingEquipoCodigo) {
        // Update existing equipo
        await equiposService.actualizarEquipo(this.editingEquipoCodigo, payload);
        this.snack.success('Equipo actualizado exitosamente');
        this.editEquipoMode = false;
        this.editingEquipoCodigo = null;
        this.resetForm();
        await this.obtenerEquiposRegistrados();
      } else {
        await equiposService.crearEquipo(payload);
        this.snack.success('Equipo registrado exitosamente');
        this.resetForm();
        this.obtenerEquiposRegistrados(); // Actualizar lista
      }
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar equipo');
    }
  }

  // Ajustar fecha mínima de puesta en servicio cuando cambia la de adquisición
  onFechaAdquisicionChange() {
    // Si la puesta en servicio ya fue puesta y quedó menor, limpiar o ajustar
    if (this.fecha_adquisicion && this.puesta_en_servicio) {
      const fa = new Date(this.fecha_adquisicion);
      const fs = new Date(this.puesta_en_servicio);
      fa.setHours(0,0,0,0);
      fs.setHours(0,0,0,0);
      if (fs < fa) {
        this.puesta_en_servicio = this.fecha_adquisicion;
      }
    }
  }

  // Eliminar equipo (con confirmación)
  async eliminarEquipo(equipo: any, event?: Event) {
    if (event) event.stopPropagation();
    const codigo = equipo?.codigo_identificacion;
    if (!codigo) return;
    const confirmado = window.confirm(`¿Eliminar el equipo "${equipo.nombre}" (${codigo})? Se eliminarán también sus historiales, intervalos y ficha técnica.`);
    if (!confirmado) return;
    try {
      await equiposService.eliminarEquipo(codigo);
      this.snack.success('Equipo eliminado');
      // Actualizar lista local
      this.equiposRegistrados = this.equiposRegistrados.filter(e => e.codigo_identificacion !== codigo);
      // Limpiar estados asociados
      delete this.historialPorEquipo[codigo];
      delete this.intervaloPorEquipo[codigo];
      delete this.activeTab[codigo];
      if (this.equipoExpandido === codigo) this.equipoExpandido = null;
      if (this.equipoInfoExpandido === codigo) this.equipoInfoExpandido = null;
    } catch (error: any) {
      this.snack.error(error.message || 'No se pudo eliminar el equipo');
    }
  }

  resetForm() {
    this.codigo_identificacion = '';
    this.nombre = '';
    this.modelo = '';
    this.marca = '';
    this.inventario_sena = '';
    this.ubicacion = '';
    this.acreditacion = '';
    this.tipo_manual = '';
    this.numero_serie = '';
    this.tipo = '';
    this.clasificacion = '';
    this.manual_usuario = '';
    this.puesta_en_servicio = '';
    this.fecha_adquisicion = '';
    this.requerimientos_equipo = '';
    this.elementos_electricos = '';
    this.voltaje = '';
    this.elementos_mecanicos = '';
    this.frecuencia = '';
    this.campo_medicion = '';
    this.exactitud = '';
    this.sujeto_verificar = '';
    this.sujeto_calibracion = '';
    this.resolucion_division = '';
    this.sujeto_calificacion = '';
    this.accesorios = '';
  }

  resetFormIntervalo() {
    this.consecutivo_intervalo = null;
    this.equipo_id_intervalo = '';
    this.unidad_nominal_g = null;
    this.calibracion_1 = '';
    this.fecha_c1 = '';
    this.error_c1_g = null;
    this.calibracion_2 = '';
    this.fecha_c2 = '';
    this.error_c2_g = null;
    this.diferencia_dias = null;
    this.desviacion = null;
    this.deriva = null;
    this.tolerancia_g_intervalo = null;
    this.intervalo_calibraciones_dias = null;
    this.intervalo_calibraciones_anios = null;
  }

  resetFormHistorial() {
    this.consecutivo = null;
    this.equipo_id = '';
    this.fecha = '';
    this.tipo_historial = '';
    this.codigo_registro = '';
    this.tolerancia_g = null;
    this.tolerancia_error_g = null;
    this.incertidumbre_u = null;
    this.realizo = '';
    this.superviso = '';
    this.observaciones = '';
  }

// Función para cuando se selecciona un equipo en historial

// Función para cuando se selecciona un equipo en intervalo

// Modificar las funciones de apertura para limpiar los campos
async abrirFormularioHistorial() {
  this.formularioActivo = 'historial';
  this.codigo_identificacion = '';
  this.consecutivo = null;
}

async abrirFormularioIntervalo() {
  this.formularioActivo = 'intervalo';
  this.codigo_identificacion_intervalo = '';
  this.consecutivo_intervalo = null;
}

// Función para mostrar/ocultar formularios
toggleFormulario(tipo: string) {
  if (this.formularioActivo === tipo) {
    this.formularioActivo = null;
  } else {
    // Limpiar todos los formularios antes de abrir uno nuevo
    this.resetForm();
    this.resetFormFichaTecnica();
    this.resetFormHistorial();
    this.resetFormIntervalo();
    this.limpiarBusqueda();

    if (tipo === 'historial') {
      this.formularioActivo = tipo;
      // No cargar consecutivo hasta que se seleccione un equipo
      this.consecutivo = null;
      this.equipo_id = '';
      this.codigoHistorialSig.set('');
      this.consecutivoHistorialSig.set(null);
    } else if (tipo === 'intervalo') {
      this.formularioActivo = tipo;
      // No cargar consecutivo hasta que se seleccione un equipo
      this.consecutivo_intervalo = null;
      this.equipo_id_intervalo = '';
      this.codigoIntervaloSig.set('');
      this.consecutivoIntervaloSig.set(null);
    } else {
      this.formularioActivo = tipo;
    }
  }
}

// Función para expandir/contraer detalles de equipo
toggleDetalleEquipo(codigoEquipo: string) {
    this.equipoExpandido = this.equipoExpandido === codigoEquipo ? null : codigoEquipo;
    if (this.equipoExpandido !== codigoEquipo) {
      this.equipoInfoExpandido = null;
    }
    // Inicializar pestaña activa al abrir detalles
    if (this.equipoExpandido === codigoEquipo && !this.activeTab[codigoEquipo]) {
      this.activeTab[codigoEquipo] = 'general';
    }
}

toggleInfoEquipo(codigoEquipo: string) {
  this.equipoInfoExpandido = this.equipoInfoExpandido === codigoEquipo ? null : codigoEquipo;
}

// Handlers para actualizar señales desde el template
onSeleccionEquipoHistorialChange(codigo: string) {
  this.equipo_id = codigo;
  this.codigoHistorialSig.set(codigo);
}

onSeleccionEquipoIntervaloChange(codigo: string) {
  this.equipo_id_intervalo = codigo;
  this.codigoIntervaloSig.set(codigo);
}

}
