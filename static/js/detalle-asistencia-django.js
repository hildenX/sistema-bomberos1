// ==================== DETALLE DE ASISTENCIA - DJANGO ====================
console.log(' [DETALLE] Cargando detalle-asistencia-django.js v10.0 - HORAS SIEMPRE VISIBLES');

class DetalleAsistenciaDjango {
    constructor() {
        this.evento = null;
        this.detalles = [];
        this.timerRevision = null;
        this.sugerenciasActuales = [];
        this.init();
    }
    
    async init() {
        console.log('[DETALLE] Iniciando...');
        
        if (!await checkAuth()) {
            window.location.href = '/';
            return;
        }
        
        const eventoId = localStorage.getItem('emergenciaDetalleId');

        if (!eventoId) {
            alert('No se especificó un evento');
            window.history.back();
            return;
        }

        this.eventoId = eventoId;
        
        // Mostrar mensaje de carga
        document.getElementById('contenidoAsistentes').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3em;"></div>
                <p style="color: #667eea; font-size: 1.2em; margin-top: 10px;">Cargando asistentes...</p>
            </div>
        `;
        
        await this.cargarEvento(eventoId);
        await this.cargarDetalles(eventoId);
        this.renderizar();
        
        console.log('[DETALLE]  Sistema inicializado');
    }
    
    async cargarEvento(eventoId) {
        try {
            const response = await fetch(`/api/eventos-asistencia/${eventoId}/`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Evento no encontrado');
            }
            
            this.evento = await response.json();
            console.log('[DETALLE] Evento cargado:', this.evento);
        } catch (error) {
            console.error('[DETALLE] Error cargando evento:', error);
            alert('Error al cargar el evento');
            window.history.back();
        }
    }
    
    async cargarDetalles(eventoId) {
        try {
            console.log('[DETALLE]  Buscando asistentes para evento:', eventoId);
            const response = await fetch(`/api/detalles-asistencia/?evento=${eventoId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.detalles = Array.isArray(data) ? data : (data.results || []);
            
            console.log('[DETALLE]  Detalles cargados:', this.detalles.length);
            console.log('[DETALLE]  Datos completos:', this.detalles);
            
            if (this.detalles.length === 0) {
                console.warn('[DETALLE]  No se encontraron asistentes para este evento');
            }
        } catch (error) {
            console.error('[DETALLE]  Error cargando detalles:', error);
            this.detalles = [];
        }
    }
    
    renderizar() {
        this.renderizarInfo();
        this.renderizarAsistentes();
    }
    
    renderizarInfo() {
        const fecha = new Date(this.evento.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        // Título
        let titulo = ' ';
        const tipoMap = {
            'emergencia': '🚨 Emergencia',
            'asamblea': '🏛️ Asamblea',
            'ejercicios': '💪 Ejercicio',
            'citaciones': ' Citación',
            'directorio': ' Directorio de Cía',
            'otras': ' Otra Actividad'
        };
        titulo = tipoMap[this.evento.tipo] || ' Asistencia';

        document.getElementById('tituloAsistencia').innerHTML = titulo;

        const btnEditar = document.getElementById('btnEditarActa');
        if (btnEditar) {
            const tiposConActa = ['asamblea', 'directorio', 'ejercicios', 'citaciones', 'otras'];
            btnEditar.style.display = tiposConActa.includes(this.evento.tipo) ? 'inline-block' : 'none';
        }
        
        //  CÓDIGO DE PRUEBA - VER TODOS LOS CAMPOS DEL EVENTO
        console.log('═══════════════════════════════════════════');
        console.log(' CÓDIGO DE PRUEBA - CAMPOS DEL EVENTO:');
        console.log('═══════════════════════════════════════════');
        console.log(' Evento completo:', this.evento);
        console.log('⏰ hora_inicio:', this.evento.hora_inicio);
        console.log('🏁 hora_termino:', this.evento.hora_termino);
        console.log('⏰ hora_emergencia:', this.evento.hora_emergencia);
        console.log(' fecha:', this.evento.fecha);
        console.log(' Todas las claves del objeto:', Object.keys(this.evento));
        console.log('═══════════════════════════════════════════');
        
        // Info principal - SOLO MOSTRAR FECHA (las horas no están guardadas en BD)
        let html = `
            <div class="info-row">
                <div class="info-label"> Fecha:</div>
                <div class="info-value">${fechaFormateada}</div>
            </div>
        `;
        
        // MOSTRAR HORAS - SIEMPRE
        const horaInicio = this.evento.hora_inicio || this.evento.hora_emergencia || null;
        const horaTermino = this.evento.hora_termino || null;
        
        console.log('[DETALLE] ⏰ Horas - Inicio:', horaInicio, 'Término:', horaTermino);
        
        html += `
            <div class="info-row">
                <div class="info-label">⏰ Hora Inicio:</div>
                <div class="info-value"><strong>${horaInicio || 'No registrada'}</strong></div>
                <div class="info-label">🏁 Hora Término:</div>
                <div class="info-value"><strong>${horaTermino || 'No registrada'}</strong></div>
            </div>
        `;
        
        // Duración solo si hay AMBAS horas
        if (horaInicio && horaTermino) {
            html += `
                <div class="info-row">
                    <div class="info-label">⏱️ Duración:</div>
                    <div class="info-value"><strong>${this.calcularDuracion(horaInicio, horaTermino)}</strong></div>
                </div>
            `;
        }
        
        // Info adicional según tipo - EMERGENCIAS
        if (this.evento.tipo === 'emergencia') {
            if (this.evento.clave_emergencia) {
                const descripcionClave = this.obtenerDescripcionClave(this.evento.clave_emergencia);
                
                html += `
                    <div class="info-row">
                        <div class="info-label">📻 Clave Radial:</div>
                        <div class="info-value">
                            <strong>${this.evento.clave_emergencia}</strong>
                            <div class="info-value-small">${descripcionClave}</div>
                        </div>
                        <div class="info-label"> Total Asistentes:</div>
                        <div class="info-value"><strong>${this.detalles.length} personas</strong></div>
                    </div>
                `;
            } else {
                html += `
                    <div class="info-row">
                        <div class="info-label"> Total Asistentes:</div>
                        <div class="info-value">${this.detalles.length} personas</div>
                    </div>
                `;
            }
            
            // Dirección
            if (this.evento.direccion) {
                html += `
                    <div class="info-row full-width">
                        <div class="info-label"> Dirección:</div>
                        <div class="info-value">${this.evento.direccion}</div>
                    </div>
                `;
            }
            
            // Observaciones
            if (this.evento.observaciones) {
                html += `
                    <div class="info-row full-width">
                        <div class="info-label"> Observaciones:</div>
                        <div class="info-value">${this.evento.observaciones}</div>
                    </div>
                `;
            }
        } else {
            // Para otros tipos de asistencia
            html += `
                <div class="info-row">
                    <div class="info-label"> Total Asistentes:</div>
                    <div class="info-value">${this.detalles.length} personas</div>
                </div>
            `;
            
            if (this.evento.descripcion || this.evento.observaciones) {
                html += `
                    <div class="info-row full-width">
                        <div class="info-label"> Descripción:</div>
                        <div class="info-value">${this.evento.descripcion || this.evento.observaciones || ''}</div>
                    </div>
                `;
            }
        }
        
        document.getElementById('infoPrincipal').innerHTML = html;
    }
    
    async renderizarAsistentes() {
        console.log('[DETALLE] Renderizando asistentes, total:', this.detalles.length);
        console.log('[DETALLE] Detalles:', this.detalles);
        
        if (this.detalles.length === 0) {
            document.getElementById('contenidoAsistentes').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999; background: #f8f9fa; border-radius: 10px;">
                    <p style="font-size: 1.2em; margin: 0;">😔 No hay asistentes registrados en este evento</p>
                </div>
            `;
            return;
        }
        
        // Cargar datos de voluntarios para mostrar nombres completos
        const voluntariosMap = await this.cargarVoluntarios();
        console.log('[DETALLE] Voluntarios cargados:', Object.keys(voluntariosMap).length);
        
        // Agrupar por categoría
        const categorias = {
            'compania': { titulo: 'Oficial de Compañía', lista: [] },
            'comandancia': { titulo: 'Oficial de Comandancia', lista: [] },
            'insigne': { titulo: 'Voluntario Insigne', lista: [] },
            'honorarioCuerpo': { titulo: 'Voluntario Honorario del Cuerpo', lista: [] },
            'honorarioCia': { titulo: 'Voluntario Honorario de la Compañía', lista: [] },
            'voluntario': { titulo: 'Voluntario Activo', lista: [] },
            'participante': { titulo: 'Participante Externo', lista: [] },
            'externo': { titulo: 'Participante Externo', lista: [] },
            'canje': { titulo: 'Canje', lista: [] },
            'martir': { titulo: 'Mártir', lista: [] }
        };
        
        this.detalles.forEach(detalle => {
            let cat = detalle.categoria || 'voluntario';
            console.log('[DETALLE] 🏷️ Detalle:', detalle.id, 'Categoría original:', cat);
            
            // Normalizar categoría: convertir a minúsculas y eliminar espacios
            cat = cat.toLowerCase().trim();
            
            // Mapear categorías alternativas
            const mapeo = {
                'externo': 'externo',
                'participante': 'externo',
                'martir': 'martir',
                'mártir': 'martir'
            };
            
            if (mapeo[cat]) {
                cat = mapeo[cat];
                console.log('[DETALLE]  Categoría mapeada a:', cat);
            }
            
            if (categorias[cat]) {
                // Agregar info del voluntario si existe
                if (detalle.voluntario && voluntariosMap[detalle.voluntario]) {
                    detalle.voluntarioInfo = voluntariosMap[detalle.voluntario];
                }
                categorias[cat].lista.push(detalle);
                console.log('[DETALLE]  Agregado a grupo:', categorias[cat].titulo);
            } else {
                console.warn('[DETALLE]  Categoría no reconocida:', cat, 'para detalle:', detalle);
            }
        });
        
        // Log de categorías con asistentes
        Object.entries(categorias).forEach(([key, grupo]) => {
            if (grupo.lista.length > 0) {
                console.log(`[DETALLE]  ${grupo.titulo}: ${grupo.lista.length} asistentes`);
            }
        });
        
        let html = '';
        console.log('[DETALLE] 🎨 Generando HTML...');
        
        Object.values(categorias).forEach(grupo => {
            if (grupo.lista.length === 0) return;
            
            html += `
                <div class="categoria-grupo">
                    <div class="categoria-titulo">${grupo.titulo} (${grupo.lista.length})</div>
                    <div class="asistentes-lista">
            `;
            
            grupo.lista.forEach(detalle => {
                let nombre = '';
                let clave = '';
                let cargo = '';
                
                // Log para debugging
                console.log('[DETALLE]  Procesando detalle:', detalle);
                
                // Prioridad 1: nombre_completo (viene directo de la BD)
                if (detalle.nombre_completo && detalle.nombre_completo !== 'undefined undefined') {
                    nombre = detalle.nombre_completo;
                    clave = detalle.clave_bombero || '';
                    console.log('[DETALLE]  Usando nombre_completo:', nombre);
                }
                // Prioridad 2: voluntarioInfo (del JOIN)
                else if (detalle.voluntarioInfo && detalle.voluntarioInfo.nombre) {
                    nombre = `${detalle.voluntarioInfo.nombre} ${detalle.voluntarioInfo.apellido_paterno} ${detalle.voluntarioInfo.apellido_materno || ''}`.trim();
                    clave = detalle.voluntarioInfo.clave_bombero;
                    console.log('[DETALLE]  Usando voluntarioInfo:', nombre);
                } 
                // Prioridad 3: voluntario_externo (nombre directo)
                else if (detalle.voluntario_externo) {
                    nombre = detalle.voluntario_externo;
                    clave = detalle.clave_bombero || '';
                    console.log('[DETALLE]  Usando voluntario_externo:', nombre);
                }
                // Prioridad 4: voluntario_externo_nombre
                else if (detalle.voluntario_externo_nombre) {
                    nombre = detalle.voluntario_externo_nombre;
                    clave = detalle.clave_externa || '';
                    console.log('[DETALLE]  Usando voluntario_externo_nombre:', nombre);
                } 
                // Último recurso
                else {
                    nombre = `ID: ${detalle.id}`;
                    console.error('[DETALLE]  No se pudo obtener nombre. Detalle:', detalle);
                }
                
                // Validar que nombre no sea "undefined undefined"
                if (!nombre || nombre.includes('undefined')) {
                    nombre = `ID: ${detalle.id}`;
                    console.error('[DETALLE]  Nombre contiene undefined, usando ID');
                }
                
                html += `
                    <div class="asistente-item">
                        <div class="asistente-nombre">${nombre || 'Sin nombre'}</div>
                        ${cargo ? `<div class="asistente-cargo">Cargo: ${cargo}</div>` : ''}
                        ${clave ? `<div class="asistente-cargo">Clave: ${clave}</div>` : ''}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        if (html.trim() === '') {
            console.error('[DETALLE]  HTML vacío! No se generó ningún asistente.');
            document.getElementById('contenidoAsistentes').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c; background: #fff5f5; border-radius: 10px;">
                    <p style="font-size: 1.2em; margin: 0;"> Error: No se pudieron renderizar los asistentes</p>
                    <p style="margin: 10px 0 0 0;">Revisa la consola (F12) para más detalles</p>
                </div>
            `;
        } else {
            console.log('[DETALLE]  HTML generado, longitud:', html.length, 'caracteres');
            document.getElementById('contenidoAsistentes').innerHTML = html;
            console.log('[DETALLE]  HTML insertado en el DOM');
        }
    }
    
    async cargarVoluntarios() {
        try {
            const voluntariosIds = [...new Set(this.detalles
                .filter(d => d.voluntario)
                .map(d => d.voluntario))];
            
            if (voluntariosIds.length === 0) return {};
            
            const response = await fetch('/api/voluntarios/', {
                credentials: 'include'
            });
            const data = await response.json();
            const voluntarios = Array.isArray(data) ? data : (data.results || []);
            
            const map = {};
            voluntarios.forEach(v => {
                map[v.id] = v;
            });
            
            return map;
        } catch (error) {
            console.error('[DETALLE] Error cargando voluntarios:', error);
            return {};
        }
    }
    
    obtenerDescripcionClave(clave) {
        if (typeof CLAVES_RADIALES === 'undefined') return clave;
        return CLAVES_RADIALES[clave]?.nombre || clave;
    }
    
    calcularDuracion(horaInicio, horaTermino) {
        if (!horaInicio || !horaTermino || horaInicio === 'N/A' || horaTermino === 'N/A') {
            return 'N/A';
        }
        
        try {
            // Convertir "HH:MM:SS" o "HH:MM" a minutos
            const [h1, m1] = horaInicio.split(':').map(Number);
            const [h2, m2] = horaTermino.split(':').map(Number);
            
            let minutos1 = h1 * 60 + m1;
            let minutos2 = h2 * 60 + m2;
            
            // Si hora término es menor, asumimos que cruzó medianoche
            if (minutos2 < minutos1) {
                minutos2 += 24 * 60; // Agregar 24 horas
            }
            
            const duracionMinutos = minutos2 - minutos1;
            const horas = Math.floor(duracionMinutos / 60);
            const minutos = duracionMinutos % 60;
            
            if (horas === 0) {
                return `${minutos} min`;
            } else if (minutos === 0) {
                return `${horas}h`;
            } else {
                return `${horas}h ${minutos}min`;
            }
        } catch (error) {
            console.error('[DETALLE] Error calculando duración:', error);
            return 'N/A';
        }
    }

    // ==================== EDITAR ACTA ====================

    abrirModalEditar() {
        const textoActual = this.evento.descripcion || this.evento.observaciones || '';
        document.getElementById('textareaDescripcion').value = textoActual;
        document.getElementById('listaSugerencias').innerHTML = '';
        document.getElementById('redaccionEstado').textContent = '';
        this.sugerenciasActuales = [];
        document.getElementById('modalEditarActa').style.display = 'flex';
    }

    cerrarModalEditar() {
        document.getElementById('modalEditarActa').style.display = 'none';
        clearTimeout(this.timerRevision);
    }

    onCambioTexto() {
        clearTimeout(this.timerRevision);
        document.getElementById('redaccionEstado').textContent = 'Revisando redacción...';
        this.timerRevision = setTimeout(() => this.revisarRedaccion(), 1200);
    }

    async revisarRedaccion() {
        const texto = document.getElementById('textareaDescripcion').value;
        const estadoEl = document.getElementById('redaccionEstado');
        const listaEl = document.getElementById('listaSugerencias');

        if (!texto.trim()) {
            estadoEl.textContent = '';
            listaEl.innerHTML = '';
            this.sugerenciasActuales = [];
            return;
        }

        try {
            const params = new URLSearchParams({ text: texto, language: 'es' });
            const response = await fetch('https://api.languagetool.org/v2/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });

            if (!response.ok) throw new Error('No se pudo revisar la redacción');

            const data = await response.json();
            this.sugerenciasActuales = data.matches || [];

            if (this.sugerenciasActuales.length === 0) {
                estadoEl.textContent = 'Sin observaciones de redacción.';
                listaEl.innerHTML = '';
                return;
            }

            estadoEl.textContent = `${this.sugerenciasActuales.length} observación(es) de redacción:`;
            listaEl.innerHTML = this.sugerenciasActuales.map((m, idx) => {
                const original = texto.substring(m.offset, m.offset + m.length);
                const sugerencias = (m.replacements || []).slice(0, 3);
                return `
                    <div class="sugerencia-item">
                        <div class="sugerencia-mensaje">${this.escapeHtml(m.message)}: <span class="sugerencia-original">${this.escapeHtml(original)}</span></div>
                        <div class="sugerencia-botones">
                            ${sugerencias.map((s) => `<button type="button" class="btn-sugerencia" onclick="detalleSistema.aplicarSugerencia(${idx}, '${this.escapeAttr(s.value)}')">${this.escapeHtml(s.value)}</button>`).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('[DETALLE] Error revisando redacción:', error);
            estadoEl.textContent = 'No se pudo revisar la redacción en este momento (el corrector externo no respondió).';
        }
    }

    aplicarSugerencia(idx, reemplazo) {
        const match = this.sugerenciasActuales[idx];
        if (!match) return;

        const textarea = document.getElementById('textareaDescripcion');
        const texto = textarea.value;
        textarea.value = texto.substring(0, match.offset) + reemplazo + texto.substring(match.offset + match.length);

        clearTimeout(this.timerRevision);
        this.revisarRedaccion();
    }

    formatearTexto(texto) {
        let resultado = texto.trim().replace(/\s+/g, ' ');
        if (!resultado) return resultado;

        // Mayúscula al inicio y después de cada punto seguido
        resultado = resultado.replace(/(^\s*\w|[.!?]\s+\w)/g, (letra) => letra.toUpperCase());

        // Punto final si no termina con signo de puntuación
        if (!/[.!?]$/.test(resultado)) {
            resultado += '.';
        }

        return resultado;
    }

    async guardarDescripcion() {
        const textoOriginal = document.getElementById('textareaDescripcion').value;
        const textoFormateado = this.formatearTexto(textoOriginal);

        try {
            const response = await fetch(`/api/eventos-asistencia/${this.eventoId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'include',
                body: JSON.stringify({ descripcion: textoFormateado }),
            });

            if (!response.ok) throw new Error('Error al guardar el acta');

            this.evento.descripcion = textoFormateado;
            this.cerrarModalEditar();
            this.renderizarInfo();
        } catch (error) {
            console.error('[DETALLE] Error guardando descripción:', error);
            alert('No se pudo guardar el acta. Intenta nuevamente.');
        }
    }

    escapeHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto || '';
        return div.innerHTML;
    }

    escapeAttr(texto) {
        return (texto || '').replace(/'/g, "\\'");
    }
}

// Inicializar
let detalleSistema;
document.addEventListener('DOMContentLoaded', () => {
    detalleSistema = new DetalleAsistenciaDjango();
});
