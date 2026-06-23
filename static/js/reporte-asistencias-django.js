// ==================== REPORTE DE ASISTENCIAS INDIVIDUAL - DJANGO ====================
console.log('🚀 [REPORTE ASIST] Cargando reporte-asistencias-django.js v7.0 - ESTADÍSTICAS POR CICLO');

class ReporteAsistenciasIndividual {
    constructor() {
        this.bomberoId = localStorage.getItem('bomberoIdReporte');
        this.bombero = null;
        this.asistencias = [];
        this.todosLosEventos = [];
        this.cargo = null;
        this.init();
    }
    
    async init() {
        if (!this.bomberoId) {
            alert('No se ha seleccionado un bombero');
            window.history.back();
            return;
        }
        
        await this.cargarDatos();
        this.configurarFechas();
    }
    
    async cargarDatos() {
        try {
            // Cargar bombero desde API
            const bomberoResponse = await fetch(`/api/voluntarios/${this.bomberoId}/`, {
                credentials: 'include'
            });
            
            if (!bomberoResponse.ok) {
                throw new Error('Bombero no encontrado');
            }
            
            this.bombero = await bomberoResponse.json();
            console.log('✅ Bombero cargado:', this.bombero);
            
            // Cargar cargo actual
            await this.cargarCargoActual();
            
            // Render info del bombero
            this.renderizarInfoBombero();
            
        } catch (error) {
            console.error('❌ Error al cargar datos:', error);
            alert('Error al cargar datos del bombero');
            window.history.back();
        }
    }
    
    async cargarCargoActual() {
        try {
            // El filtro en el backend es 'voluntario'
            let response = await fetch(`/api/cargos/?voluntario=${this.bomberoId}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const cargos = await response.json();
                const cargosArray = Array.isArray(cargos) ? cargos : (cargos.results || []);
                
                console.log('[CARGOS API] Total cargos:', cargosArray.length);
                console.log('[CARGOS API] Datos:', cargosArray);
                
                // Buscar cargo vigente
                const hoy = new Date();
                this.cargo = cargosArray.find(c => {
                    const inicio = c.fecha_inicio_cargo ? new Date(c.fecha_inicio_cargo) : null;
                    const fin = c.fecha_fin_cargo ? new Date(c.fecha_fin_cargo) : null;
                    
                    if (inicio && inicio > hoy) return false;
                    if (fin && fin < hoy) return false;
                    return true;
                });
                
                console.log('[CARGO VIGENTE]', this.cargo || 'Sin cargo vigente');
            } else {
                const errorText = await response.text();
                console.warn('Error al cargar cargos:', response.status, errorText);
            }
        } catch (error) {
            console.error('❌ Error al cargar cargo:', error);
        }
    }
    
    configurarFechas() {
        const hoy = new Date();
        const primerDia = new Date(hoy.getFullYear(), 0, 1);
        
        document.getElementById('fechaDesde').valueAsDate = primerDia;
        document.getElementById('fechaHasta').valueAsDate = hoy;
    }
    
    obtenerNombreCompleto() {
        const partes = [];
        // La API retorna en camelCase
        if (this.bombero.primerNombre) partes.push(this.bombero.primerNombre);
        if (this.bombero.segundoNombre) partes.push(this.bombero.segundoNombre);
        if (this.bombero.primerApellido) partes.push(this.bombero.primerApellido);
        if (this.bombero.segundoApellido) partes.push(this.bombero.segundoApellido);
        return partes.length > 0 ? partes.join(' ').toUpperCase() : 'SIN NOMBRE';
    }
    
    obtenerCargoTexto() {
        if (!this.cargo) return 'Sin cargo vigente';
        return this.cargo.nombre_cargo || this.cargo.tipo_cargo || 'Sin especificar';
    }
    
    esOficial() {
        if (!this.cargo) return false;
        const cargosOficiales = ['Capitán', 'Teniente Primero', 'Teniente Segundo', 'Ayudante'];
        return cargosOficiales.includes(this.cargo.tipo_cargo);
    }
    
    renderizarInfoBombero() {
        const nombre = this.obtenerNombreCompleto();
        const cargoTexto = this.obtenerCargoTexto();
        const esOficial = this.esOficial();
        
        // La API retorna en camelCase
        const clave = this.bombero.claveBombero || 'N/A';
        const rut = this.bombero.rut || 'N/A';
        
        console.log('[INFO BOMBERO]', {
            bombero: this.bombero,
            nombre,
            clave,
            rut,
            cargo: cargoTexto,
            esOficial
        });
        
        const infoElement = document.getElementById('infoBombero');
        if (!infoElement) {
            console.error('❌ Elemento infoBombero no encontrado');
            return;
        }
        
        infoElement.innerHTML = `
            <h2>${nombre}</h2>
            <p><strong>Clave:</strong> ${clave} | <strong>RUT:</strong> ${rut}</p>
            <p><strong>Cargo Actual:</strong> ${cargoTexto} ${esOficial ? '<span style="color: #10b981; font-weight: bold;">• Oficial de Compañía</span>' : ''}</p>
            ${esOficial ? '<p style="color: #6b7280; font-size: 0.9em;"><em>Los oficiales de compañía cuentan los directorios en sus asistencias.</em></p>' : ''}
        `;
    }
    
    async filtrarAsistencias() {
        const tipoReporte = document.getElementById('tipoReporte').value;
        let fechaDesde, fechaHasta;
        
        if (tipoReporte === 'mensual') {
            // Mes específico
            const mesSeleccionado = parseInt(document.getElementById('mesEspecifico').value);
            const anioSeleccionado = parseInt(document.getElementById('anioMensual').value);
            fechaDesde = new Date(anioSeleccionado, mesSeleccionado, 1);
            fechaHasta = new Date(anioSeleccionado, mesSeleccionado + 1, 0); // Último día del mes
        } else if (tipoReporte === 'ciclo') {
            // Ciclo completo
            const cicloId = document.getElementById('cicloSeleccionado').value;
            if (!cicloId) {
                alert('No hay ciclos disponibles');
                return null;
            }
            const ciclo = ciclosAsistencias.obtenerTodosCiclos().find(c => c.id === cicloId);
            if (!ciclo) {
                alert('Ciclo no encontrado');
                return null;
            }
            fechaDesde = new Date(ciclo.fechaInicio);
            fechaHasta = new Date(ciclo.fechaFin);
        } else {
            // Rango de fechas libre
            fechaDesde = new Date(document.getElementById('fechaDesde').value);
            fechaHasta = new Date(document.getElementById('fechaHasta').value);
            
            if (!fechaDesde || !fechaHasta) {
                alert('Por favor seleccione el rango de fechas');
                return null;
            }
            
            if (fechaDesde > fechaHasta) {
                alert('La fecha desde debe ser menor que la fecha hasta');
                return null;
            }
        }
        
        try {
            // Cargar asistencias del voluntario en el período
            const detallesResponse = await fetch(`/api/detalles-asistencia/?voluntario=${this.bomberoId}`, {
                credentials: 'include'
            });
            
            if (!detallesResponse.ok) {
                throw new Error('Error al cargar asistencias');
            }
            
            const detalles = await detallesResponse.json();
            const detallesArray = Array.isArray(detalles) ? detalles : (detalles.results || []);
            
            // Cargar eventos para obtener la info completa
            const eventosResponse = await fetch('/api/eventos-asistencia/', {
                credentials: 'include'
            });
            
            if (!eventosResponse.ok) {
                throw new Error('Error al cargar eventos');
            }
            
            const eventos = await eventosResponse.json();
            const eventosArray = Array.isArray(eventos) ? eventos : (eventos.results || []);
            this.todosLosEventos = eventosArray;
            
            // Filtrar por rango de fechas
            const asistenciasFiltradas = detallesArray.filter(detalle => {
                const evento = eventosArray.find(e => e.id === detalle.evento);
                if (!evento) return false;
                
                const fechaEvento = new Date(evento.fecha);
                return fechaEvento >= fechaDesde && fechaEvento <= fechaHasta;
            });
            
            // Enriquecer con info del evento
            return asistenciasFiltradas.map(detalle => {
                const evento = eventosArray.find(e => e.id === detalle.evento);
                return {
                    ...detalle,
                    eventoData: evento
                };
            });
            
        } catch (error) {
            console.error('Error al filtrar asistencias:', error);
            alert('Error al cargar las asistencias');
            return null;
        }
    }
    
    agruparPorMes(asistencias) {
        const grupos = {};
        
        asistencias.forEach(a => {
            const fecha = new Date(a.eventoData.fecha);
            const mes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            
            if (!grupos[mes]) {
                grupos[mes] = {
                    emergencia: [],
                    asamblea: [],
                    ejercicios: [],
                    citaciones: [],
                    directorio: [],
                    otras: []
                };
            }
            
            const tipo = a.eventoData.tipo || 'otras';
            if (grupos[mes][tipo]) {
                grupos[mes][tipo].push(a);
            }
        });
        
        return grupos;
    }
    
    calcularResumen(asistencias) {
        const resumen = {
            emergencia: 0,
            asamblea: 0,
            ejercicios: 0,
            citaciones: 0,
            directorio: 0,
            otras: 0
        };
        
        asistencias.forEach(a => {
            const tipo = a.eventoData.tipo || 'otras';
            if (resumen[tipo] !== undefined) {
                resumen[tipo]++;
            }
        });
        
        return resumen;
    }
    
    async calcularPorcentajeAsistencia(fechaDesde, fechaHasta) {
        try {
            // Verificar si es oficial
            const esOficial = this.cargo && ['Capitán', 'Teniente Primero', 'Teniente Segundo', 'Ayudante'].includes(this.cargo.tipo_cargo);
            
            // Obtener todos los eventos del período
            const eventosEnPeriodo = this.todosLosEventos.filter(e => {
                const fechaEvento = new Date(e.fecha);
                const desde = new Date(fechaDesde);
                const hasta = new Date(fechaHasta);
                
                // Si no es oficial, excluir directorios
                if (!esOficial && e.tipo === 'directorio') {
                    return false;
                }
                
                // Excluir eventos que no suman ranking (como directorio para no oficiales)
                if (!esOficial && e.suma_ranking === false) {
                    return false;
                }
                
                return fechaEvento >= desde && fechaEvento <= hasta;
            });
            
            const totalEventos = eventosEnPeriodo.length;
            
            // Obtener asistencias del voluntario
            const asistenciasVoluntario = await this.filtrarAsistencias();
            let totalAsistencias = 0;
            
            if (asistenciasVoluntario) {
                totalAsistencias = asistenciasVoluntario.filter(a => {
                    // Si no es oficial, no contar directorios
                    if (!esOficial && a.eventoData.tipo === 'directorio') {
                        return false;
                    }
                    return true;
                }).length;
            }
            
            const porcentaje = totalEventos > 0 ? (totalAsistencias / totalEventos * 100).toFixed(2) : 0;
            
            return {
                totalEventos,
                totalAsistencias,
                porcentaje,
                esOficial
            };
            
        } catch (error) {
            console.error('Error al calcular porcentaje:', error);
            return { totalEventos: 0, totalAsistencias: 0, porcentaje: 0, esOficial: false };
        }
    }
}

// Variable global
let reporte;
let ciclosAsistencias;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[REPORTE] 🚀 Iniciando sistema de reportes...');
    
    // Inicializar sistema de ciclos
    ciclosAsistencias = new CiclosAsistencias();
    console.log('[REPORTE] ✅ Sistema de ciclos inicializado');
    
    reporte = new ReporteAsistenciasIndividual();
    console.log('[REPORTE] ✅ Clase de reporte inicializada');
    
    // Llenar selectores de año (últimos 10 años)
    llenarSelectoresAnio();
    
    // Llenar selector de ciclos
    console.log('[REPORTE] Intentando llenar selector de ciclos...');
    llenarSelectorCiclos();
    
    // Seleccionar mes actual por defecto
    const mesActual = new Date().getMonth();
    const mesSelect = document.getElementById('mesEspecifico');
    if (mesSelect) {
        mesSelect.value = mesActual;
        console.log('[REPORTE] ✅ Mes actual pre-seleccionado:', mesActual);
    }
    
    console.log('[REPORTE] 🎉 Sistema de reportes completamente inicializado');
});

// ==================== LLENAR SELECTORES DE AÑO ====================
function llenarSelectoresAnio() {
    const anioActual = new Date().getFullYear();
    const anios = [];
    
    // Generar últimos 10 años
    for (let i = 0; i < 10; i++) {
        anios.push(anioActual - i);
    }
    
    // Llenar selector para mes específico (si existe)
    const anioMensualSelect = document.getElementById('anioMensual');
    if (anioMensualSelect) {
        anios.forEach(anio => {
            const option = document.createElement('option');
            option.value = anio;
            option.textContent = anio;
            if (anio === anioActual) option.selected = true;
            anioMensualSelect.appendChild(option);
        });
        console.log('[REPORTE] ✅ Selector de año mensual poblado');
    } else {
        console.warn('[REPORTE] ⚠️ No se encontró selector anioMensual');
    }
}

// ==================== LLENAR SELECTOR DE CICLOS ====================
function llenarSelectorCiclos() {
    const select = document.getElementById('cicloSeleccionado');
    if (!select) {
        console.error('[REPORTE] No se encontró el selector de ciclos');
        return;
    }
    
    if (!ciclosAsistencias) {
        console.error('[REPORTE] ciclosAsistencias no está inicializado');
        select.innerHTML = '<option value="">Error: Sistema de ciclos no disponible</option>';
        return;
    }
    
    const ciclos = ciclosAsistencias.obtenerTodosCiclos();
    const cicloActivo = ciclosAsistencias.obtenerCicloActivo();
    
    console.log('[REPORTE] Ciclos encontrados:', ciclos.length);
    console.log('[REPORTE] Ciclo activo:', cicloActivo ? cicloActivo.nombre : 'Ninguno');
    
    select.innerHTML = '';
    
    if (ciclos.length === 0) {
        select.innerHTML = '<option value="">No hay ciclos - Ve a Admin Ciclos para crear uno</option>';
        console.warn('[REPORTE] No hay ciclos creados');
        return;
    }
    
    // Agregar opción por defecto
    const optionDefault = document.createElement('option');
    optionDefault.value = '';
    optionDefault.textContent = '-- Selecciona un Ciclo --';
    select.appendChild(optionDefault);
    
    // Agregar ciclo activo primero
    if (cicloActivo) {
        const option = document.createElement('option');
        option.value = cicloActivo.id;
        option.textContent = `🔥 ${cicloActivo.nombre} (ACTIVO)`;
        option.selected = true;
        select.appendChild(option);
        console.log('[REPORTE] Agregado ciclo activo:', cicloActivo.nombre);
    }
    
    // Agregar ciclos cerrados
    const ciclosCerrados = ciclos.filter(c => c.estado === 'cerrado');
    console.log('[REPORTE] Ciclos cerrados:', ciclosCerrados.length);
    
    ciclosCerrados.forEach(ciclo => {
        const option = document.createElement('option');
        option.value = ciclo.id;
        option.textContent = `📁 ${ciclo.nombre} (Cerrado)`;
        select.appendChild(option);
        console.log('[REPORTE] Agregado ciclo cerrado:', ciclo.nombre);
    });
    
    console.log(`[REPORTE] ✅ Selector poblado con ${select.options.length} opciones`);
}

// ==================== TOGGLE SELECTOR DE MES/AÑO/CICLO ====================
function toggleSelectorMes() {
    const tipoReporte = document.getElementById('tipoReporte').value;
    const selectorMesContainer = document.getElementById('selectorMesContainer');
    const selectorCicloContainer = document.getElementById('selectorCicloContainer');
    const fechasContainer = document.querySelectorAll('.form-row')[0];
    
    // Ocultar todos primero
    selectorMesContainer.style.display = 'none';
    selectorCicloContainer.style.display = 'none';
    
    if (tipoReporte === 'mensual') {
        // Mostrar selector de mes + año
        selectorMesContainer.style.display = 'flex';
        fechasContainer.querySelector('#fechaDesde').parentElement.style.display = 'none';
        fechasContainer.querySelector('#fechaHasta').parentElement.style.display = 'none';
    } else if (tipoReporte === 'ciclo') {
        // Mostrar selector de ciclo
        selectorCicloContainer.style.display = 'flex';
        fechasContainer.querySelector('#fechaDesde').parentElement.style.display = 'none';
        fechasContainer.querySelector('#fechaHasta').parentElement.style.display = 'none';
    } else {
        // Rango libre: mostrar fechas
        fechasContainer.querySelector('#fechaDesde').parentElement.style.display = 'block';
        fechasContainer.querySelector('#fechaHasta').parentElement.style.display = 'block';
    }
}

// ==================== FUNCIONES GLOBALES ====================
async function verVistaPrevia() {
    const asistencias = await reporte.filtrarAsistencias();
    if (!asistencias) return;
    
    const tipoReporte = document.getElementById('tipoReporte').value;
    const preview = document.getElementById('preview');
    const content = document.getElementById('previewContent');
    
    // Obtener fechas según el tipo de reporte (igual que generarReporte)
    let fechaDesde, fechaHasta, nombrePeriodo;
    
    if (tipoReporte === 'mensual') {
        const mesSeleccionado = parseInt(document.getElementById('mesEspecifico').value);
        const anioSeleccionado = parseInt(document.getElementById('anioMensual').value);
        fechaDesde = new Date(anioSeleccionado, mesSeleccionado, 1);
        fechaHasta = new Date(anioSeleccionado, mesSeleccionado + 1, 0);
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        nombrePeriodo = `${meses[mesSeleccionado]} ${anioSeleccionado}`;
    } else if (tipoReporte === 'ciclo') {
        const cicloId = document.getElementById('cicloSeleccionado').value;
        if (!cicloId) {
            alert('Selecciona un ciclo');
            return;
        }
        const ciclo = ciclosAsistencias.obtenerTodosCiclos().find(c => c.id === cicloId);
        if (!ciclo) {
            alert('Ciclo no encontrado');
            return;
        }
        fechaDesde = new Date(ciclo.fechaInicio);
        fechaHasta = new Date(ciclo.fechaFin);
        nombrePeriodo = ciclo.nombre;
    } else {
        fechaDesde = new Date(document.getElementById('fechaDesde').value);
        fechaHasta = new Date(document.getElementById('fechaHasta').value);
        nombrePeriodo = `${fechaDesde.getDate()}-${fechaDesde.getMonth() + 1}-${fechaDesde.getFullYear()} al ${fechaHasta.getDate()}-${fechaHasta.getMonth() + 1}-${fechaHasta.getFullYear()}`;
    }
    
    // Calcular porcentaje con las fechas correctas
    const estadisticas = await reporte.calcularPorcentajeAsistencia(fechaDesde, fechaHasta);
    
    preview.style.display = 'block';
    
    let html = '';
    
    // Determinar texto según tipo de reporte
    let textoTotalEventos;
    if (tipoReporte === 'ciclo') {
        textoTotalEventos = `Total de Eventos del Ciclo (${nombrePeriodo}):`;
    } else if (tipoReporte === 'mensual') {
        textoTotalEventos = `Total de Eventos del Mes (${nombrePeriodo}):`;
    } else {
        textoTotalEventos = `Total de Eventos del Período:`;
    }
    
    // Mostrar estadísticas primero
    html += `
        <div class="mes-grupo" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px; padding: 20px; border-radius: 10px;">
            <h4 style="color: white; margin-top: 0;">📊 ESTADÍSTICAS DEL PERÍODO</h4>
            <h5 style="color: rgba(255,255,255,0.9); font-size: 1em; margin: 10px 0; font-weight: normal;">📅 ${nombrePeriodo}</h5>
            <div class="stat-line" style="color: white; padding: 8px 0;">
                <span>${textoTotalEventos}</span>
                <span style="font-weight: bold; font-size: 1.2em;">${estadisticas.totalEventos}</span>
            </div>
            <div class="stat-line" style="color: white; padding: 8px 0;">
                <span>Asistencias del Voluntario:</span>
                <span style="font-weight: bold; font-size: 1.2em;">${estadisticas.totalAsistencias}</span>
            </div>
            <div class="stat-line total-line" style="color: white; border-top: 2px solid rgba(255,255,255,0.3); margin-top: 10px; padding-top: 15px;">
                <span style="font-size: 1.2em;">% DE ASISTENCIA:</span>
                <span style="font-size: 1.8em; font-weight: bold;">${estadisticas.porcentaje}%</span>
            </div>
            ${!estadisticas.esOficial ? '<p style="font-size: 0.85em; margin-top: 10px; margin-bottom: 0; opacity: 0.9;">* No se cuentan directorios (solo para oficiales)</p>' : ''}
        </div>
    `;
    
    if (tipoReporte === 'mensual') {
        const grupos = reporte.agruparPorMes(asistencias);
        
        for (const [mes, datos] of Object.entries(grupos)) {
            const total = datos.emergencia.length + datos.asamblea.length + 
                          datos.ejercicios.length + datos.citaciones.length + 
                          datos.directorio.length + datos.otras.length;
            
            html += `
                <div class="mes-grupo">
                    <h4>📅 ${mes.toUpperCase()}</h4>
                    <div class="stat-line">
                        <span>🚨 Emergencias:</span>
                        <span>${datos.emergencia.length}</span>
                    </div>
                    <div class="stat-line">
                        <span>🏛️ Asambleas:</span>
                        <span>${datos.asamblea.length}</span>
                    </div>
                    <div class="stat-line">
                        <span>💪 Ejercicios:</span>
                        <span>${datos.ejercicios.length}</span>
                    </div>
                    <div class="stat-line">
                        <span>📞 Citaciones:</span>
                        <span>${datos.citaciones.length}</span>
                    </div>
                    <div class="stat-line">
                        <span>👔 Directorio:</span>
                        <span>${datos.directorio.length}</span>
                    </div>
                    <div class="stat-line">
                        <span>📋 Otras:</span>
                        <span>${datos.otras.length}</span>
                    </div>
                    <div class="stat-line total-line">
                        <span>TOTAL:</span>
                        <span>${total} asistencias</span>
                    </div>
                </div>
            `;
        }
    } else {
        const resumen = reporte.calcularResumen(asistencias);
        const total = Object.values(resumen).reduce((a, b) => a + b, 0);
        
        html += `
            <div class="mes-grupo">
                <h4>📊 RESUMEN GENERAL</h4>
                <div class="stat-line">
                    <span>🚨 Total Emergencias:</span>
                    <span>${resumen.emergencia}</span>
                </div>
                <div class="stat-line">
                    <span>🏛️ Total Asambleas:</span>
                    <span>${resumen.asamblea}</span>
                </div>
                <div class="stat-line">
                    <span>💪 Total Ejercicios:</span>
                    <span>${resumen.ejercicios}</span>
                </div>
                <div class="stat-line">
                    <span>📞 Total Citaciones:</span>
                    <span>${resumen.citaciones}</span>
                </div>
                <div class="stat-line">
                    <span>👔 Total Directorio:</span>
                    <span>${resumen.directorio}</span>
                </div>
                <div class="stat-line">
                    <span>📋 Total Otras:</span>
                    <span>${resumen.otras}</span>
                </div>
                <div class="stat-line total-line">
                    <span>TOTAL GENERAL:</span>
                    <span>${total} asistencias</span>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

async function generarReporte() {
    const asistencias = await reporte.filtrarAsistencias();
    if (!asistencias) return;
    
    const tipoReporte = document.getElementById('tipoReporte').value;
    let fechaDesde, fechaHasta, nombrePeriodo;
    
    // Determinar fechas según el tipo de reporte
    if (tipoReporte === 'mensual') {
        const mesSeleccionado = parseInt(document.getElementById('mesEspecifico').value);
        const anioSeleccionado = parseInt(document.getElementById('anioMensual').value);
        fechaDesde = new Date(anioSeleccionado, mesSeleccionado, 1);
        fechaHasta = new Date(anioSeleccionado, mesSeleccionado + 1, 0);
    } else if (tipoReporte === 'ciclo') {
        const cicloId = document.getElementById('cicloSeleccionado').value;
        const ciclo = ciclosAsistencias.obtenerTodosCiclos().find(c => c.id === cicloId);
        if (!ciclo) {
            alert('Ciclo no encontrado');
            return;
        }
        fechaDesde = new Date(ciclo.fechaInicio);
        fechaHasta = new Date(ciclo.fechaFin);
        nombrePeriodo = ciclo.nombre;
    } else {
        fechaDesde = new Date(document.getElementById('fechaDesde').value);
        fechaHasta = new Date(document.getElementById('fechaHasta').value);
    }
    
    // Calcular porcentaje de asistencia
    const estadisticas = await reporte.calcularPorcentajeAsistencia(fechaDesde, fechaHasta);
    
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            alert('❌ Error: Librería jsPDF no cargada');
            return;
        }
        
        const doc = new jsPDF();
        const pageWidth = 210;
        const margin = 20;
        
        // Colores (igual al ejemplo)
        const rojoHeader = [196, 30, 58];
        const rojoTexto = [196, 30, 58];
        const grisClaro = [245, 245, 245];
        
        let y = 0;
        
        // ==================== HEADER ROJO ====================
        doc.setFillColor(...rojoHeader);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Logo
        const logoCompania = localStorage.getItem('logoCompania');
        if (logoCompania) {
            try {
                doc.addImage(logoCompania, 'PNG', 15, 5, 30, 30);
            } catch (e) {
                console.log('Logo no disponible');
            }
        }
        
        // Título header
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('REPORTE DE ASISTENCIAS', 105, 17, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text('Voluntario Individual', 105, 25, { align: 'center' });
        
        doc.setFontSize(9);
        const hoy = new Date();
        const fechaGeneracion = `${hoy.getDate()}-${hoy.getMonth() + 1}-${hoy.getFullYear()}`;
        doc.text(`Generado: ${fechaGeneracion}`, 105, 32, { align: 'center' });
        
        y = 50;
        
        // ==================== INFO VOLUNTARIO (CON BORDE ROJO) ====================
        const nombreCompleto = reporte.obtenerNombreCompleto();
        const cargoTexto = reporte.obtenerCargoTexto();
        const clave = reporte.bombero.claveBombero || 'N/A'; // camelCase
        const rut = reporte.bombero.rut || 'N/A';
        
        // Borde rojo más alto para incluir porcentaje
        doc.setDrawColor(...rojoTexto);
        doc.setLineWidth(1);
        doc.rect(margin, y, pageWidth - (margin * 2), 38);
        
        // Nombre en rojo
        y += 10;
        doc.setTextColor(...rojoTexto);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(nombreCompleto, margin + 5, y);
        
        // Info en gris
        y += 8;
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Clave: ${clave}`, margin + 5, y);
        doc.text(`RUT: ${rut}`, 90, y);
        doc.text(`Cargo: ${cargoTexto}`, 140, y);
        
        // Período
        y += 7;
        doc.setFontSize(8);
        let periodoTexto;
        if (tipoReporte === 'mensual') {
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const mesNombre = meses[fechaDesde.getMonth()];
            periodoTexto = `Período: ${mesNombre} ${fechaDesde.getFullYear()}`;
        } else if (tipoReporte === 'ciclo') {
            periodoTexto = `Período: ${nombrePeriodo}`;
        } else {
            periodoTexto = `Período: ${fechaDesde.getDate()}-${fechaDesde.getMonth() + 1}-${fechaDesde.getFullYear()} al ${fechaHasta.getDate()}-${fechaHasta.getMonth() + 1}-${fechaHasta.getFullYear()}`;
        }
        doc.text(periodoTexto, margin + 5, y);
        
        // Porcentaje de asistencia
        y += 6;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...rojoTexto);
        doc.text(`% ASISTENCIA: ${estadisticas.porcentaje}%`, margin + 5, y);
        doc.setTextColor(80, 80, 80);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        doc.text(`(${estadisticas.totalAsistencias} de ${estadisticas.totalEventos} eventos)`, margin + 60, y);
        
        y += 12;
        
        // ==================== DETALLE MENSUAL ====================
        if (tipoReporte === 'mensual') {
            const grupos = reporte.agruparPorMes(asistencias);
            
            // Título sección
            doc.setFillColor(...grisClaro);
            doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
            
            doc.setTextColor(...rojoTexto);
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('DETALLE MENSUAL', margin + 3, y + 5.5);
            
            y += 12;
            
            // Por cada mes
            for (const [mes, datos] of Object.entries(grupos)) {
                const totalMes = datos.emergencia.length + datos.asamblea.length + 
                                datos.ejercicios.length + datos.citaciones.length + 
                                datos.directorio.length + datos.otras.length;
                
                // Nombre del mes
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text(mes.toUpperCase(), margin + 5, y);
                y += 7;
                
                // Detalle
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.text('Emergencias', margin + 10, y);
                doc.text(datos.emergencia.length.toString(), pageWidth - margin - 10, y, { align: 'right' });
                y += 5;
                
                doc.text('Asambleas', margin + 10, y);
                doc.text(datos.asamblea.length.toString(), pageWidth - margin - 10, y, { align: 'right' });
                y += 5;
                
                doc.text('Ejercicios', margin + 10, y);
                doc.text(datos.ejercicios.length.toString(), pageWidth - margin - 10, y, { align: 'right' });
                y += 5;
                
                doc.text('Citaciones', margin + 10, y);
                doc.text(datos.citaciones.length.toString(), pageWidth - margin - 10, y, { align: 'right' });
                y += 5;
                
                doc.text('Directorio', margin + 10, y);
                doc.text(datos.directorio.length.toString(), pageWidth - margin - 10, y, { align: 'right' });
                y += 5;
                
                doc.text('Otras', margin + 10, y);
                doc.text(datos.otras.length.toString(), pageWidth - margin - 10, y, { align: 'right' });
                y += 7;
                
                // Total mes en rojo
                doc.setTextColor(...rojoTexto);
                doc.setFont(undefined, 'bold');
                doc.text('TOTAL MES:', margin + 10, y);
                doc.text(`${totalMes} asistencias`, pageWidth - margin - 10, y, { align: 'right' });
                
                y += 10;
            }
        }
        
        // ==================== RESUMEN GENERAL ====================
        const resumen = reporte.calcularResumen(asistencias);
        const totalGeneral = Object.values(resumen).reduce((a, b) => a + b, 0);
        
        // Título sección con fondo rojo
        doc.setFillColor(...rojoHeader);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('RESUMEN GENERAL DEL PERÍODO', 105, y + 5.5, { align: 'center' });
        
        y += 15;
        
        // Items con colores
        const colores = {
            emergencia: [255, 59, 48],
            asamblea: [52, 199, 89],
            ejercicios: [0, 122, 255],
            citaciones: [255, 204, 0],
            directorio: [175, 82, 222],
            otras: [142, 142, 147]
        };
        
        const items = [
            ['Total Emergencias', resumen.emergencia, colores.emergencia],
            ['Total Asambleas', resumen.asamblea, colores.asamblea],
            ['Total Ejercicios', resumen.ejercicios, colores.ejercicios],
            ['Total Citaciones', resumen.citaciones, colores.citaciones],
            ['Total Directorio', resumen.directorio, colores.directorio],
            ['Total Otras', resumen.otras, colores.otras]
        ];
        
        items.forEach(([label, cant, color]) => {
            // Línea de color
            doc.setFillColor(...color);
            doc.rect(margin + 5, y - 3, 3, 5, 'F');
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(label, margin + 12, y);
            
            doc.setFont(undefined, 'bold');
            doc.text(cant.toString(), pageWidth - margin - 10, y, { align: 'right' });
            
            y += 6;
        });
        
        y += 5;
        
        // Total general en caja roja
        doc.setFillColor(255, 240, 240);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 10, 'F');
        
        doc.setDrawColor(...rojoTexto);
        doc.setLineWidth(0.5);
        doc.rect(margin, y - 5, pageWidth - (margin * 2), 10);
        
        doc.setTextColor(...rojoTexto);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL GENERAL:', margin + 5, y + 2);
        doc.setFontSize(14);
        doc.text(`${totalGeneral} ASISTENCIAS`, pageWidth - margin - 10, y + 2, { align: 'right' });
        
        // ==================== GUARDAR ====================
        const nombreArchivo = `Asistencias_${nombreCompleto.replace(/ /g, '_')}_${fechaGeneracion}.pdf`;
        doc.save(nombreArchivo);
        
        alert('✅ PDF generado exitosamente');
        
    } catch (error) {
        console.error('❌ Error al generar PDF:', error);
        alert('❌ Error: ' + error.message);
    }
}
