import { Component } from '@angular/core';
import { equiposService } from '../../services/equipos.service';
import { SnackbarService } from '../../services/snackbar.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NumbersOnlyDirective } from '../../directives/numbers-only.directive';
import { LettersOnlyDirective } from '../../directives/letters-only.directive';
import { AlphaNumericDirective } from '../../directives/alpha-numeric.directive';

@Component({
  standalone: true,
  selector: 'app-equipos',
  templateUrl: './equipos.component.html',
  styleUrls: ['./equipos.component.css'],
  imports: [CommonModule, FormsModule, RouterModule,  NumbersOnlyDirective, LettersOnlyDirective, AlphaNumericDirective]
})
export class EquiposComponent {
    // Formatea una fecha ISO a yyyy-MM-dd para el input type="date"
    formatearFecha(fecha: string): string {
      if (!fecha) return '';
      const d = new Date(fecha);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    }
  // Variable para controlar el formulario activo
  formularioActivo: string | null = null;

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
  cargo_y_firma = '';
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

  constructor(public snack: SnackbarService) {
    this.obtenerEquiposRegistrados();
  }

  maxDate(): string {
    return new Date().toISOString().split('T')[0];
}

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
    try {
      const equipos = await equiposService.listarEquipos();
      // Aseguramos que cada equipo tenga el campo codigo_identificacion
      this.equiposRegistrados = equipos.map((equipo: any) => ({
        codigo_identificacion: equipo.codigo_identificacion,
        nombre: equipo.nombre,
        modelo: equipo.modelo,
        marca: equipo.marca,
        fecha_adquisicion: equipo.fecha_adquisicion,
        puesta_en_servicio: equipo.puesta_en_servicio,
        accesorios: equipo.accesorios,
        numero_serie: equipo.numero_serie,
        voltaje: equipo.voltaje,
        frecuencia: equipo.frecuencia
      }));
      console.log('Equipos cargados:', this.equiposRegistrados.length, this.equiposRegistrados);
    } catch (error: any) {
      this.snack.error('Error al obtener equipos registrados');
    }
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
      await equiposService.crearFichaTecnica({
        codigo_identificador: this.codigo_identificador,
        nombre: this.nombre_ficha,
        marca: this.marca_ficha,
        modelo: this.modelo_ficha,
        serie: this.serie_ficha,
        fabricante: this.fabricante,
        fecha_adq: this.fecha_adq,
        uso: this.uso,
        fecha_func: this.fecha_func,
        precio: this.precio,
        accesorios: this.accesorios_ficha,
        manual_ope: this.manual_ope,
        idioma_manual: this.idioma_manual,
        magnitud: this.magnitud,
        resolucion: this.resolucion,
        precision_med: this.precision_med,
        exactitud: this.exactitud_ficha,
        rango_de_medicion: this.rango_de_medicion,
        rango_de_uso: this.rango_de_uso,
        voltaje: this.voltaje_ficha,
        potencia: this.potencia,
        amperaje: this.amperaje,
        frecuencia: this.frecuencia_ficha,
        ancho: this.ancho,
        alto: this.alto,
        peso_kg: this.peso_kg,
        profundidad: this.profundidad,
        temperatura_c: this.temperatura_c,
        humedad_porcentaje: this.humedad_porcentaje,
        limitaciones_e_interferencias: this.limitaciones_e_interferencias,
        otros: this.otros,
        especificaciones_software: this.especificaciones_software,
        proveedor: this.proveedor,
        email: this.email,
        telefono: this.telefono,
        fecha_de_instalacion: this.fecha_de_instalacion,
        alcance_del_servicio: this.alcance_del_servicio,
        garantia: this.garantia,
        observaciones: this.observaciones_ficha,
        recibido_por: this.recibido_por,
        cargo_y_firma: this.cargo_y_firma,
        fecha: this.fecha_ficha
      });
      this.snack.success('Ficha técnica registrada exitosamente');
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
    this.cargo_y_firma = '';
    this.fecha_ficha = '';
    this.limpiarBusqueda();
  }

  async crearIntervalo(event: Event) {
    event.preventDefault();
    
    if (!this.consecutivo_intervalo || !this.equipo_id_intervalo) {
      this.snack.warn('Consecutivo y equipo son obligatorios');
      return;
    }
    
    try {
      await equiposService.crearIntervalo({
        consecutivo: this.consecutivo_intervalo,
        equipo_id: this.equipo_id_intervalo,
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
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar intervalo');
    }
  }

  async crearHistorial(event: Event) {
    event.preventDefault();
    
    if (!this.consecutivo || !this.equipo_id) {
      this.snack.warn('Consecutivo y equipo son obligatorios');
      return;
    }
    
    try {
      await equiposService.crearHistorial({
        consecutivo: this.consecutivo,
        equipo_id: this.equipo_id,
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
    
    try {
      await equiposService.crearEquipo({
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
      });
      this.snack.success('Equipo registrado exitosamente');
      this.resetForm();
      this.obtenerEquiposRegistrados(); // Actualizar lista
    } catch (error: any) {
      this.snack.error(error.message || 'Error al registrar equipo');
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
    } else if (tipo === 'intervalo') {
      this.formularioActivo = tipo;
      // No cargar consecutivo hasta que se seleccione un equipo
      this.consecutivo_intervalo = null;
      this.equipo_id_intervalo = '';
    } else {
      this.formularioActivo = tipo;
    }
  }
}

}