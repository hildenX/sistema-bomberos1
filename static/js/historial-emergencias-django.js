// ==================== HISTORIAL DE EMERGENCIAS - DJANGO ====================
console.log('🚨 [EMERGENCIAS] Cargando historial-emergencias-django.js v4.0 - PARTICIPANTES + CLAVES MEJORADAS');

class HistorialEmergenciasDjango {
    constructor() {
        this.emergencias = [];
        this.init();
    }
    
    async init() {
        console.log('[EMERGENCIAS] Iniciando...');
        
        if (!await checkAuth()) {
            window.location.href = '/';
            return;
        }
        
        await this.cargarEmergencias();
        this.renderizarTabla();
        this.calcularEstadisticas();
        this.setupFiltros();
        
        console.log('[EMERGENCIAS] ✅ Sistema inicializado');
    }
    
    async cargarEmergencias() {
        try {
            const response = await fetch('/api/eventos-asistencia/?tipo=emergencia', {
                credentials: 'include'
            });
            
            const data = await response.json();
            const eventos = Array.isArray(data) ? data : (data.results || []);
            
            // Cargar detalles de asistencia para cada emergencia
            const responseDetalles = await fetch('/api/detalles-asistencia/', {
                credentials: 'include'
            });
            const dataDetalles = await responseDetalles.json();
            const detalles = Array.isArray(dataDetalles) ? dataDetalles : (dataDetalles.results || []);
            
            // Mapear emergencias con sus asistentes
            this.emergencias = eventos.map(evento => {
                const asistentes = detalles.filter(d => d.evento === evento.id);
                return {
                    ...evento,
                    asistentes: asistentes
                };
            });
            
            console.log('[EMERGENCIAS] Total cargadas:', this.emergencias.length);
        } catch (error) {
            console.error('[EMERGENCIAS] Error cargando:', error);
            alert('Error al cargar las emergencias');
        }
    }
    
    renderizarTabla(filtradas = null) {
        const emergencias = filtradas || this.emergencias;
        const tbody = document.getElementById('tablaBody');
        
        if (emergencias.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #999;">
                        No hay emergencias registradas
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordenar por fecha descendente
        emergencias.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        tbody.innerHTML = emergencias.map(emergencia => {
            const stats = this.calcularStats(emergencia);
            const fechaFormateada = new Date(emergencia.fecha).toLocaleDateString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            const claveTexto = emergencia.clave_emergencia 
                ? `<span class="badge-clave" title="${this.obtenerDescripcionClave(emergencia.clave_emergencia)}">${emergencia.clave_emergencia}</span>`
                : '<span style="color: #999; font-size: 0.85em;">Sin clave</span>';
            
            return `
                <tr>
                    <td><strong>${fechaFormateada}</strong></td>
                    <td>${claveTexto}</td>
                    <td>${stats.oficiales}</td>
                    <td>${stats.insignes}</td>
                    <td>${stats.honorarios}</td>
                    <td>${stats.voluntarios}</td>
                    <td>${stats.participantes}</td>
                    <td>${stats.canjes}</td>
                    <td><strong>${stats.total}</strong></td>
                    <td>
                        <button class="btn-ver-detalle" onclick="historial.verDetalle(${emergencia.id})">
                            👁️ Ver Detalle
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    calcularStats(emergencia) {
        const asistentes = emergencia.asistentes || [];
        
        return {
            oficiales: asistentes.filter(a => a.categoria === 'compania' || a.categoria === 'comandancia').length,
            insignes: asistentes.filter(a => a.categoria === 'insigne').length,
            honorarios: asistentes.filter(a => a.categoria === 'honorarioCuerpo' || a.categoria === 'honorarioCia').length,
            voluntarios: asistentes.filter(a => a.categoria === 'voluntario').length,
            participantes: asistentes.filter(a => a.categoria === 'participante').length,
            canjes: asistentes.filter(a => a.categoria === 'canje').length,
            total: asistentes.length
        };
    }
    
    calcularEstadisticas() {
        const totalEmergencias = this.emergencias.length;
        const totalAsistentes = this.emergencias.reduce((sum, e) => sum + (e.asistentes?.length || 0), 0);
        const promedio = totalEmergencias > 0 ? Math.round(totalAsistentes / totalEmergencias) : 0;
        
        document.getElementById('totalEmergencias').textContent = totalEmergencias;
        document.getElementById('totalAsistentes').textContent = totalAsistentes;
        document.getElementById('promedioAsistencia').textContent = promedio;
    }
    
    setupFiltros() {
        this.inicializarSelectorClaves();
        
        const fechaDesde = document.getElementById('fechaDesde');
        const fechaHasta = document.getElementById('fechaHasta');
        const buscar = document.getElementById('buscar');
        const filtroClave = document.getElementById('filtroClave');
        
        const aplicarFiltros = () => {
            let filtradas = [...this.emergencias];
            
            if (fechaDesde.value) {
                filtradas = filtradas.filter(e => new Date(e.fecha) >= new Date(fechaDesde.value));
            }
            
            if (fechaHasta.value) {
                filtradas = filtradas.filter(e => new Date(e.fecha) <= new Date(fechaHasta.value));
            }
            
            if (filtroClave.value) {
                filtradas = filtradas.filter(e => {
                    if (!e.clave_emergencia) return false;
                    return this.perteneceAGrupo(e.clave_emergencia, filtroClave.value);
                });
            }
            
            if (buscar.value) {
                const termino = buscar.value.toLowerCase();
                filtradas = filtradas.filter(e => {
                    const direccion = (e.direccion || '').toLowerCase();
                    return direccion.includes(termino);
                });
            }
            
            this.renderizarTabla(filtradas);
        };
        
        fechaDesde.addEventListener('change', aplicarFiltros);
        fechaHasta.addEventListener('change', aplicarFiltros);
        filtroClave.addEventListener('change', aplicarFiltros);
        buscar.addEventListener('input', aplicarFiltros);
    }
    
    inicializarSelectorClaves() {
        const selector = document.getElementById('filtroClave');
        if (!selector) {
            console.error('[EMERGENCIAS] ❌ No se encontró selector filtroClave');
            return;
        }
        
        selector.innerHTML = '<option value="">Todas las claves</option>';
        
        if (typeof obtenerClavesSeleccionables !== 'function') {
            console.warn('[EMERGENCIAS] ⚠️ obtenerClavesSeleccionables no está disponible');
            
            // Fallback: usar CLAVES_RADIALES directamente
            if (typeof CLAVES_RADIALES !== 'undefined') {
                Object.entries(CLAVES_RADIALES).forEach(([clave, datos]) => {
                    const option = document.createElement('option');
                    option.value = clave;
                    option.textContent = `${clave} - ${datos.nombre}`;
                    selector.appendChild(option);
                    
                    // Agregar subclaves si existen
                    if (datos.subclaves) {
                        Object.entries(datos.subclaves).forEach(([subclave, descripcion]) => {
                            const subOption = document.createElement('option');
                            subOption.value = subclave;
                            subOption.textContent = `  ${subclave} - ${descripcion}`;
                            selector.appendChild(subOption);
                        });
                    }
                });
            }
        } else {
            // Usar la función proporcionada por claves-radiales.js
            const claves = obtenerClavesSeleccionables();
            console.log('[EMERGENCIAS] 📻 Claves seleccionables:', claves.length);
            
            claves.forEach(clave => {
                const option = document.createElement('option');
                option.value = clave.value;
                option.textContent = clave.text;
                if (clave.esSubclave) {
                    option.style.paddingLeft = '20px';
                }
                selector.appendChild(option);
            });
        }
        
        console.log('[EMERGENCIAS] 📻 Filtro de claves inicializado con', selector.options.length - 1, 'opciones');
    }
    
    perteneceAGrupo(claveEmergencia, clavePadre) {
        if (!claveEmergencia) return false;
        return claveEmergencia === clavePadre || claveEmergencia.startsWith(clavePadre + '-');
    }
    
    obtenerDescripcionClave(clave) {
        if (typeof CLAVES_RADIALES === 'undefined') return clave;
        return CLAVES_RADIALES[clave]?.nombre || clave;
    }
    
    verDetalle(emergenciaId) {
        localStorage.setItem('emergenciaDetalleId', emergenciaId);
        window.location.href = 'detalle-asistencia.html';
    }
}

// Inicializar
let historial;
document.addEventListener('DOMContentLoaded', () => {
    historial = new HistorialEmergenciasDjango();
});
