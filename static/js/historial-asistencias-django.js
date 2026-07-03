// ==================== HISTORIAL ASISTENCIAS DJANGO ====================
console.log('🚀 Historial v18.0 - Sin Cierre Automático');

class HistorialAsistencias {
    constructor() {
        this.asistencias = [];
        this.cicloActivo = null;
        this.filtroTipo = 'todas';
        this.filtroTop = 10;
        this.filtroClave = '';
        this.filtroAsamblea = '';
        this.filtroEjercicio = '';
        this.ciclosAsistencias = new CiclosAsistencias();
        this.init();
    }

    async init() {
        console.log('Iniciando historial...');
        
        if (!await checkAuth()) {
            window.location.href = '/';
            return;
        }

        await this.cargarDatos();
        this.configurarEventos();
        this.cargarCicloActivo();
        this.inicializarFiltroClave();
        this.mostrarOcultarFiltroClave();
        this.renderizar();
        
        console.log('[HISTORIAL] ✅ Sistema inicializado');
    }

    async cargarDatos() {
        try {
            const response = await fetch('/api/eventos-asistencia/', {
                credentials: 'include'
            });

            const data = await response.json();
            const eventos = Array.isArray(data) ? data : (data.results || []);
            
            this.asistencias = eventos.map(e => {
                const asistencia = {
                    id: e.id,
                    tipo: e.tipo,
                    fecha: e.fecha,
                    descripcion: e.descripcion,
                    clave_emergencia: e.clave_emergencia || '',
                    direccion: e.direccion || '',
                    tipo_asamblea: e.tipo_asamblea || '',
                    tipo_ejercicio: e.tipo_ejercicio || '',
                    totalAsistentes: e.total_asistentes,
                    oficialesComandancia: e.oficiales_comandancia,
                    oficialesCompania: e.oficiales_compania,
                    totalOficiales: (e.oficiales_comandancia || 0) + (e.oficiales_compania || 0),
                    cargosConfianza: e.cargos_confianza,
                    voluntarios: e.voluntarios,
                    participantes: e.participantes,
                    canjes: e.canjes,
                    observaciones: e.observaciones || '',
                    registradoPorNombre: e.registrado_por_nombre || ''
                };
                
                // Debug para emergencias
                if (e.tipo === 'emergencia') {
                    console.log('[CARGA] Emergencia cargada:', {
                        id: e.id,
                        descripcion: e.descripcion,
                        clave: e.clave_emergencia,
                        clave_mapeada: asistencia.clave_emergencia
                    });
                }
                
                return asistencia;
            });
            
            console.log('[CARGA] Total asistencias cargadas:', this.asistencias.length);
            console.log('[CARGA] Emergencias con clave:', this.asistencias.filter(a => a.tipo === 'emergencia' && a.clave_emergencia).length);
        } catch (error) {
            console.error('Error:', error);
            this.asistencias = [];
        }
    }

    configurarEventos() {
        const filtroAno = document.getElementById('filtroAno');
        if (filtroAno) {
            filtroAno.addEventListener('change', (e) => {
                this.filtroAno = parseInt(e.target.value);
                this.renderizar();
            });
        }

        const filtroTipo = document.getElementById('filtroTipo');
        if (filtroTipo) {
            filtroTipo.addEventListener('change', (e) => {
                this.filtroTipo = e.target.value;
                this.mostrarOcultarFiltroClave();
                this.renderizar();
            });
        }

        const filtroTop = document.getElementById('filtroTop');
        if (filtroTop) {
            filtroTop.addEventListener('change', (e) => {
                this.filtroTop = parseInt(e.target.value);
                this.renderizar();
            });
        }

        const filtroClave = document.getElementById('filtroClave');
        if (filtroClave) {
            filtroClave.addEventListener('change', (e) => {
                this.filtroClave = e.target.value;
                this.renderizar();
            });
        }

        const filtroAsamblea = document.getElementById('filtroAsamblea');
        if (filtroAsamblea) {
            filtroAsamblea.addEventListener('change', (e) => {
                this.filtroAsamblea = e.target.value;
                this.renderizar();
            });
        }

        const filtroEjercicio = document.getElementById('filtroEjercicio');
        if (filtroEjercicio) {
            filtroEjercicio.addEventListener('change', (e) => {
                this.filtroEjercicio = e.target.value;
                this.renderizar();
            });
        }
    }

    mostrarOcultarFiltroClave() {
        const grupoFiltroClave = document.getElementById('grupoFiltroClave');
        const grupoFiltroAsamblea = document.getElementById('grupoFiltroAsamblea');
        const grupoFiltroEjercicio = document.getElementById('grupoFiltroEjercicio');
        
        // Ocultar todos
        if (grupoFiltroClave) grupoFiltroClave.style.display = 'none';
        if (grupoFiltroAsamblea) grupoFiltroAsamblea.style.display = 'none';
        if (grupoFiltroEjercicio) grupoFiltroEjercicio.style.display = 'none';
        
        // Mostrar el correcto según el tipo
        if (this.filtroTipo === 'emergencia' && grupoFiltroClave) {
            grupoFiltroClave.style.display = 'flex';
        } else if (this.filtroTipo === 'asamblea' && grupoFiltroAsamblea) {
            grupoFiltroAsamblea.style.display = 'flex';
        } else if (this.filtroTipo === 'ejercicios' && grupoFiltroEjercicio) {
            grupoFiltroEjercicio.style.display = 'flex';
        }
        
        // Reset filtros
        this.filtroClave = '';
        this.filtroAsamblea = '';
        this.filtroEjercicio = '';
    }

    inicializarFiltroClave() {
        const select = document.getElementById('filtroClave');
        if (!select) return;

        select.innerHTML = '<option value="">Todas las claves</option>';
        
        // Cargar SOLO claves PADRE (10-0, 10-1, etc.) sin subclaves
        if (typeof CLAVES_RADIALES !== 'undefined') {
            Object.entries(CLAVES_RADIALES).forEach(([clave, datos]) => {
                const option = document.createElement('option');
                option.value = clave;
                option.textContent = `${clave} - ${datos.nombre}`;
                select.appendChild(option);
            });
        }
    }

    cargarCicloActivo() {
        this.cicloActivo = this.ciclosAsistencias.obtenerCicloActivo();
        
        const infoCiclo = document.getElementById('infoCicloActivo');
        if (infoCiclo) {
            if (this.cicloActivo) {
                infoCiclo.innerHTML = `
                    <div style="padding: 15px; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
                            <span style="font-size: 1.5rem;">🔥</span>
                            <h3 style="margin: 0; font-size: 1.3rem;">${this.cicloActivo.nombre}</h3>
                            <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">ACTIVO</span>
                        </div>
                        <div style="font-size: 0.9rem; opacity: 0.95;">
                            📅 ${this.ciclosAsistencias.formatearFecha(this.cicloActivo.fechaInicio)} → ${this.ciclosAsistencias.formatearFecha(this.cicloActivo.fechaFin)}
                        </div>
                    </div>
                `;
            } else {
                infoCiclo.innerHTML = `
                    <div style="padding: 15px; background: #fee2e2; color: #dc2626; border-radius: 12px; margin-bottom: 20px; border: 2px dashed #fca5a5;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.5rem;">⚠️</span>
                            <div>
                                <h3 style="margin: 0 0 5px 0; font-size: 1.2rem;">No hay ciclo activo</h3>
                                <p style="margin: 0; font-size: 0.9rem;">Ve a <a href="/admin-ciclos.html" style="color: #dc2626; font-weight: 600; text-decoration: underline;">Ciclos de Asistencia</a> para crear uno.</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }

    renderizar() {
        this.renderizarAsistencias();
        this.renderizarRanking();
    }

    renderizarAsistencias() {
        const container = document.getElementById('asistenciasLista');
        const contador = document.getElementById('asistenciasContador');
        
        if (!container) return;

        console.log('[RENDER] Iniciando renderizado...');
        console.log('[RENDER] Total asistencias en memoria:', this.asistencias.length);
        console.log('[RENDER] Filtros activos:', {
            ciclo: this.cicloActivo ? this.cicloActivo.nombre : 'Sin ciclo',
            tipo: this.filtroTipo,
            clave: this.filtroClave,
            asamblea: this.filtroAsamblea,
            ejercicio: this.filtroEjercicio
        });

        let asistenciasFiltradas = this.asistencias.filter(a => {
            // Filtrar por ciclo activo
            if (this.cicloActivo && a.fecha) {
                const fechaEvento = new Date(a.fecha);
                const fechaInicio = new Date(this.cicloActivo.fechaInicio);
                const fechaFin = new Date(this.cicloActivo.fechaFin);
                
                if (fechaEvento < fechaInicio || fechaEvento > fechaFin) return false;
            } else if (!this.cicloActivo) {
                // Si no hay ciclo activo, no mostrar nada
                return false;
            }
            
            // Filtrar por tipo
            if (this.filtroTipo !== 'todas' && a.tipo !== this.filtroTipo) return false;
            
            // Filtrar por clave radial (SOLO si el filtro está activo Y es emergencia)
            if (this.filtroClave && this.filtroClave !== '' && a.tipo === 'emergencia') {
                console.log(`[FILTRO] Filtro activo: ${this.filtroClave}, evaluando emergencia con clave:`, a.clave_emergencia);
                
                // Si el filtro está activo, la emergencia DEBE tener clave
                if (!a.clave_emergencia || a.clave_emergencia === '') {
                    console.log('[FILTRO] ❌ Emergencia sin clave, excluida');
                    return false;
                }
                // Verificar si la clave empieza con el filtro seleccionado
                if (!a.clave_emergencia.startsWith(this.filtroClave)) {
                    console.log(`[FILTRO] ❌ ${a.clave_emergencia} no empieza con ${this.filtroClave}, excluida`);
                    return false;
                }
                console.log(`[FILTRO] ✅ ${a.clave_emergencia} coincide con ${this.filtroClave}, incluida`);
            }
            
            // Filtrar por tipo de asamblea
            if (this.filtroAsamblea && this.filtroAsamblea !== '' && a.tipo === 'asamblea') {
                if (a.tipo_asamblea !== this.filtroAsamblea) {
                    console.log(`[FILTRO] ❌ Asamblea ${a.tipo_asamblea} no coincide con filtro ${this.filtroAsamblea}`);
                    return false;
                }
            }
            
            // Filtrar por tipo de ejercicio
            if (this.filtroEjercicio && this.filtroEjercicio !== '' && a.tipo === 'ejercicios') {
                if (a.tipo_ejercicio !== this.filtroEjercicio) {
                    console.log(`[FILTRO] ❌ Ejercicio ${a.tipo_ejercicio} no coincide con filtro ${this.filtroEjercicio}`);
                    return false;
                }
            }
            
            return true;
        });

        console.log('[RENDER] Asistencias después de filtrar:', asistenciasFiltradas.length);
        
        asistenciasFiltradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (contador) {
            contador.textContent = `${asistenciasFiltradas.length} registros`;
        }

        if (asistenciasFiltradas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #999;">
                    <div style="font-size: 4rem;">📋</div>
                    <h3>No hay asistencias registradas</h3>
                    <button onclick="window.location.href='/tipos-asistencia.html'" 
                            style="margin-top: 20px; padding: 12px 24px; background: #c41e3a; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        ✏️ Registrar Primera Asistencia
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = asistenciasFiltradas.slice(0, 20).map(a => this.renderizarCard(a)).join('');
    }

    renderizarCard(asistencia) {
        const iconos = {
            'emergencia': '🚨',
            'asamblea': '🏛️',
            'ejercicios': '💪',
            'citaciones': '📞',
            'otras': '📋',
            'directorio': '📋'
        };
        const icono = iconos[asistencia.tipo] || '📋';
        const fecha = this.formatearFecha(asistencia.fecha);
        
        // Mostrar info específica del tipo
        let infoEspecificaHTML = '';
        
        if (asistencia.tipo === 'emergencia') {
            console.log('[TARJETA] Emergencia detectada, clave:', asistencia.clave_emergencia);
            
            if (asistencia.clave_emergencia && asistencia.clave_emergencia !== '') {
                const descripcionClave = typeof obtenerDescripcionClave !== 'undefined' 
                    ? obtenerDescripcionClave(asistencia.clave_emergencia) 
                    : asistencia.clave_emergencia;
                
                console.log('[TARJETA] Mostrando clave:', asistencia.clave_emergencia, 'Descripción:', descripcionClave);
                
                infoEspecificaHTML = `
                    <div class="info-item-full" style="background: #fff3cd; padding: 8px; border-radius: 6px; border-left: 4px solid #ffc107; margin-bottom: 10px;">
                        <div class="info-item-label" style="font-weight: 600; margin-bottom: 4px;">📻 Clave Radial:</div>
                        <div class="info-item-value" style="font-size: 0.95rem;"><strong>${asistencia.clave_emergencia}</strong> - ${descripcionClave}</div>
                    </div>
                `;
            } else {
                console.log('[TARJETA] ⚠️ Emergencia sin clave guardada');
            }
        } else if (asistencia.tipo === 'asamblea' && asistencia.tipo_asamblea) {
            const tipoAsamblea = asistencia.tipo_asamblea === 'ordinaria' ? '📋 Ordinaria' : '⚡ Extraordinaria';
            infoEspecificaHTML = `
                <div class="info-item-full" style="background: #e3f2fd; padding: 8px; border-radius: 6px; border-left: 4px solid #2196f3; margin-bottom: 10px;">
                    <div class="info-item-label" style="font-weight: 600; margin-bottom: 4px;">🏛️ Tipo de Asamblea:</div>
                    <div class="info-item-value" style="font-size: 0.95rem;"><strong>${tipoAsamblea}</strong></div>
                </div>
            `;
        } else if (asistencia.tipo === 'ejercicios' && asistencia.tipo_ejercicio) {
            const tipoEjercicio = asistencia.tipo_ejercicio === 'compania' ? '🏢 Compañía' : '🏛️ Cuerpo';
            infoEspecificaHTML = `
                <div class="info-item-full" style="background: #f3e5f5; padding: 8px; border-radius: 6px; border-left: 4px solid #9c27b0; margin-bottom: 10px;">
                    <div class="info-item-label" style="font-weight: 600; margin-bottom: 4px;">💪 Tipo de Ejercicio:</div>
                    <div class="info-item-value" style="font-size: 0.95rem;"><strong>${tipoEjercicio}</strong></div>
                </div>
            `;
        }
        
        return `
            <div class="asistencia-card" onclick='verDetalleAsistencia(${JSON.stringify(asistencia).replace(/'/g, "&#39;")})' style="cursor: pointer;">
                <div class="asistencia-card-header">
                    <div class="asistencia-fecha">${icono} ${fecha}</div>
                    <div class="asistencia-tipo-badge ${asistencia.tipo}">${asistencia.tipo.toUpperCase()}</div>
                </div>
                <div class="asistencia-body">
                    ${infoEspecificaHTML}
                    <div class="info-item">
                        <div class="info-item-label">Total Asistentes:</div>
                        <div class="info-item-value">${asistencia.totalAsistentes || 0}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-label">Oficiales:</div>
                        <div class="info-item-value">${asistencia.totalOficiales || 0} (Cmd: ${asistencia.oficialesComandancia || 0}, Cía: ${asistencia.oficialesCompania || 0})</div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-label">Voluntarios:</div>
                        <div class="info-item-value">${asistencia.voluntarios || 0}</div>
                    </div>
                    ${asistencia.descripcion ? `
                        <div class="info-item-full">
                            <div class="info-item-label">📝 Descripción:</div>
                            <div class="info-item-value">${asistencia.descripcion}</div>
                        </div>
                    ` : ''}
                </div>
                <button class="btn-ver-detalle" onclick='event.stopPropagation(); verDetalleAsistencia(${JSON.stringify(asistencia).replace(/'/g, "&#39;")})'>
                    🔍 Ver Detalle Completo
                </button>
                ${(this.puedeGestionar(asistencia) && (this.puedeEditar() || this.puedeEliminar())) ? `
                <div class="asistencia-acciones" style="display:flex; gap:8px; margin-top:8px;">
                    ${(this.puedeEditar() && asistencia.tipo !== 'emergencia') ? `<button onclick='event.stopPropagation(); editarAsistencia("${asistencia.tipo}", ${asistencia.id})' style="flex:1; background:#fff; color:#f57c00; border:2px solid #f57c00; padding:8px; border-radius:8px; font-weight:700; cursor:pointer;">✏️ Editar</button>` : ''}
                    ${this.puedeEliminar() ? `<button onclick='event.stopPropagation(); eliminarAsistencia(${asistencia.id})' style="flex:1; background:#fff; color:#dc2626; border:2px solid #dc2626; padding:8px; border-radius:8px; font-weight:700; cursor:pointer;">🗑️ Eliminar</button>` : ''}
                </div>` : ''}
            </div>
        `;
    }

    puedeEditar() {
        return !!(window.currentUser && window.currentUser.permissions &&
                  window.currentUser.permissions.asistencias &&
                  window.currentUser.permissions.asistencias.edit);
    }

    puedeEliminar() {
        return !!(window.currentUser && window.currentUser.permissions &&
                  window.currentUser.permissions.asistencias &&
                  window.currentUser.permissions.asistencias.delete);
    }

    // El Secretario solo puede editar/eliminar las asistencias que él registró.
    // Los demás roles (Director, Super Admin) pueden gestionar todas.
    puedeGestionar(asistencia) {
        if (window.currentUser && window.currentUser.role === 'Secretario') {
            return asistencia.registradoPorNombre === window.currentUser.username;
        }
        return true;
    }

    async renderizarRanking() {
        const container = document.getElementById('rankingLista');
        const titulo = document.getElementById('rankingTitulo');
        
        if (!container) return;

        // ✅ PRIMERO: Verificar si hay ciclo activo
        if (!this.cicloActivo) {
            console.log('[RANKING] ⚠️ No hay ciclo activo - Ranking vacío');
            if (titulo) {
                titulo.textContent = '🏆 TOP 3';
            }
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">⚠️</div>
                    <h3 style="color: #dc2626; margin: 0 0 10px 0;">Sin Ranking Disponible</h3>
                    <p style="margin: 0; font-size: 0.9rem;">No hay ciclo activo. El ranking se genera cuando hay un ciclo en curso.</p>
                </div>
            `;
            return;
        }

        try {
            // Cargar eventos para filtrar solo los que suman ranking
            const responseEventos = await fetch('/api/eventos-asistencia/', {
                credentials: 'include'
            });
            const dataEventos = await responseEventos.json();
            const eventos = Array.isArray(dataEventos) ? dataEventos : (dataEventos.results || []);
            
            const eventosValidos = new Set();
            eventos.forEach(e => {
                if (e.suma_ranking !== false) {
                    eventosValidos.add(e.id);
                }
            });
            
            console.log('[RANKING] Total eventos:', eventos.length);
            console.log('[RANKING] Eventos que suman:', eventosValidos.size);
            console.log('[RANKING] Ciclo activo:', this.cicloActivo.nombre);
            
            // Cargar todos los detalles de asistencia
            const response = await fetch(`/api/detalles-asistencia/`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            let detalles = Array.isArray(data) ? data : (data.results || []);
            
            // FILTRAR: Solo detalles de eventos que suman para ranking
            detalles = detalles.filter(d => eventosValidos.has(d.evento));
            
            // FILTRAR: Solo detalles dentro del ciclo activo
            if (this.cicloActivo) {
                const fechaInicio = new Date(this.cicloActivo.fechaInicio);
                const fechaFin = new Date(this.cicloActivo.fechaFin);
                
                // Obtener fechas de los eventos
                const eventosFechas = {};
                eventos.forEach(e => {
                    eventosFechas[e.id] = new Date(e.fecha);
                });
                
                detalles = detalles.filter(d => {
                    const fechaEvento = eventosFechas[d.evento];
                    return fechaEvento && fechaEvento >= fechaInicio && fechaEvento <= fechaFin;
                });
            }
            
            console.log('[RANKING] Detalles después de filtrar por ranking y ciclo:', detalles.length);
            
            // Contar asistencias por persona (voluntarios y externos)
            const conteo = {};
            
            for (const detalle of detalles) {
                let key, persona;
                
                if (detalle.es_externo) {
                    key = 'ext_' + detalle.nombre_completo;
                    persona = {
                        id: key,
                        nombre: detalle.nombre_completo,
                        clave: detalle.tipo_externo === 'participante' ? 'Participante' : 'Canje',
                        tipo: detalle.tipo_externo,
                        icono: detalle.tipo_externo === 'participante' ? '🤝' : '🔄',
                        total: 0
                    };
                } else if (detalle.voluntario) {
                    // EXCLUIR MÁRTIRES DEL RANKING
                    if (detalle.estado === 'martir') {
                        console.log('[RANKING] Excluyendo mártir:', detalle.nombre_completo);
                        continue;
                    }
                    
                    key = 'vol_' + detalle.voluntario;
                    persona = {
                        id: key,
                        nombre: detalle.nombre_completo,
                        clave: detalle.clave_bombero || 'N/A',
                        tipo: 'voluntario',
                        icono: '👨‍🚒',
                        total: 0
                    };
                }
                
                if (key) {
                    if (!conteo[key]) {
                        conteo[key] = persona;
                    }
                    conteo[key].total++;
                }
            }
            
            // Convertir a array y ordenar
            const ranking = Object.values(conteo)
                .sort((a, b) => b.total - a.total)
                .slice(0, this.filtroTop);
            
            // Actualizar título
            if (titulo) {
                titulo.textContent = `🏆 TOP ${Math.min(this.filtroTop, ranking.length)}`;
            }
            
            if (ranking.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No hay datos de ranking</div>';
                return;
            }
            
            container.innerHTML = ranking.map((v, index) => `
                <div class="ranking-item">
                    <div class="ranking-position">${index + 1}</div>
                    <div class="ranking-info">
                        <div class="ranking-nombre">${v.icono} ${v.nombre}</div>
                        <div class="ranking-clave">${v.clave}</div>
                    </div>
                    <div class="ranking-asistencias">${v.total}</div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error cargando ranking:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Error al cargar ranking</div>';
        }
    }

    formatearFecha(fecha) {
        if (!fecha) return 'Fecha no disponible';
        try {
            // Fecha-only 'YYYY-MM-DD': construir en hora LOCAL para no correr un día por UTC
            let date;
            const m = typeof fecha === 'string' && fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) {
                date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
            } else {
                date = new Date(fecha);
            }
            return date.toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return fecha;
        }
    }
}

async function verDetalleAsistencia(asistencia) {
    const modal = document.getElementById('modalDetalles');
    const modalBody = document.getElementById('modalBody');
    const modalTitulo = document.getElementById('modalTitulo');
    
    const titulosDetalle = {
        emergencia: '🚨 Detalles de Emergencia',
        asamblea: '🏛️ Detalles de Asamblea',
        ejercicios: '💪 Detalles de Ejercicios',
        citaciones: '📋 Detalles de la Citación',
        otras: '📌 Detalles de la Actividad',
        directorio: '🏛️ Detalles del Directorio'
    };
    modalTitulo.textContent = titulosDetalle[asistencia.tipo] || '📋 Detalles de Asistencia';
    modalBody.innerHTML = '<div style="text-align:center; padding:40px;"><p>Cargando...</p></div>';
    modal.style.display = 'block';
    
    try {
        // Cargar evento completo con asistentes
        const response = await fetch(`/api/eventos-asistencia/${asistencia.id}/`, {
            credentials: 'include'
        });
        const evento = await response.json();
        
        // Cargar detalles de asistentes
        const responseDetalles = await fetch(`/api/detalles-asistencia/?evento=${asistencia.id}`, {
            credentials: 'include'
        });
        const dataDetalles = await responseDetalles.json();
        const asistentes = Array.isArray(dataDetalles) ? dataDetalles : (dataDetalles.results || []);
        
        let html = '<div class="detalle-section">';
        html += '<h4>📅 Información General</h4>';
        
        html += `
            <div class="detalle-row">
                <div class="detalle-label">Fecha:</div>
                <div class="detalle-valor">${new Date(evento.fecha).toLocaleDateString('es-CL', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</div>
            </div>
        `;
        
        if (evento.clave_emergencia) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">Clave Emergencia:</div>
                    <div class="detalle-valor"><strong>${evento.clave_emergencia}</strong></div>
                </div>
            `;
        }
        
        if (evento.direccion) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">Dirección:</div>
                    <div class="detalle-valor">${evento.direccion}</div>
                </div>
            `;
        }
        
        if (evento.descripcion) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">Descripción:</div>
                    <div class="detalle-valor">${evento.descripcion}</div>
                </div>
            `;
        }
        
        if (evento.observaciones) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">Observaciones:</div>
                    <div class="detalle-valor">${evento.observaciones}</div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Estadísticas
        html += '<div class="detalle-section">';
        html += '<h4>📊 Estadísticas de Asistencia</h4>';
        html += `
            <div class="detalle-row">
                <div class="detalle-label">Total Asistentes:</div>
                <div class="detalle-valor"><strong style="color: #c41e3a; font-size: 1.2rem;">${evento.total_asistentes || 0}</strong></div>
            </div>
            <div class="detalle-row">
                <div class="detalle-label">⭐ Oficiales Comandancia:</div>
                <div class="detalle-valor">${evento.oficiales_comandancia || 0}</div>
            </div>
            <div class="detalle-row">
                <div class="detalle-label">👔 Oficiales Compañía:</div>
                <div class="detalle-valor">${evento.oficiales_compania || 0}</div>
            </div>
            <div class="detalle-row">
                <div class="detalle-label">Total Oficiales:</div>
                <div class="detalle-valor"><strong>${evento.total_oficiales || 0}</strong></div>
            </div>
            <div class="detalle-row">
                <div class="detalle-label">🔧 Cargos de Confianza:</div>
                <div class="detalle-valor">${evento.cargos_confianza || 0}</div>
            </div>
            <div class="detalle-row">
                <div class="detalle-label">🔰 Voluntarios:</div>
                <div class="detalle-valor">${evento.voluntarios || 0}</div>
            </div>
        `;
        
        if (evento.participantes > 0 || evento.canjes > 0) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">👥 Voluntarios Externos:</div>
                    <div class="detalle-valor">
                        🤝 Participantes: ${evento.participantes || 0}<br>
                        🔄 Canjes: ${evento.canjes || 0}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Lista de asistentes
        if (asistentes.length > 0) {
            html += '<div class="detalle-section">';
            html += `<h4>👥 Lista de Asistentes (${asistentes.length})</h4>`;
            html += '<div class="asistentes-lista">';
            
            asistentes.forEach((a, index) => {
                html += `
                    <div class="asistente-item">
                        <div class="asistente-nombre">${index + 1}. ${a.nombre_completo}</div>
                        <div class="asistente-info">
                            ${a.clave_bombero ? `🆔 ${a.clave_bombero}` : ''}
                            ${a.categoria ? `<br>📌 ${a.categoria}` : ''}
                            ${a.cargo ? `<br>⭐ ${a.cargo}` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // Información de registro
        html += '<div class="detalle-section">';
        html += '<h4>ℹ️ Información de Registro</h4>';
        
        if (evento.registrado_por_nombre) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">Registrado por:</div>
                    <div class="detalle-valor">${evento.registrado_por_nombre}</div>
                </div>
            `;
        }
        
        if (evento.fecha_registro) {
            html += `
                <div class="detalle-row">
                    <div class="detalle-label">Fecha de registro:</div>
                    <div class="detalle-valor">${new Date(evento.fecha_registro).toLocaleString('es-CL')}</div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Mapa si hay dirección
        if (evento.direccion && evento.direccion.trim() !== '') {
            console.log('[DETALLE] Mostrando mapa para dirección:', evento.direccion);
            
            html += '<div class="detalle-section">';
            html += '<h4>🗺️ Ubicación en el Mapa</h4>';
            
            let direccionMapa = evento.direccion;
            if (!direccionMapa.toLowerCase().includes('puerto montt')) {
                direccionMapa += ', Puerto Montt, Chile';
            } else if (!direccionMapa.toLowerCase().includes('chile')) {
                direccionMapa += ', Chile';
            }
            
            const urlMapa = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(direccionMapa)}&zoom=16`;
            
            html += `
                <div style="width: 100%; height: 350px; border-radius: 10px; overflow: hidden; margin-top: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <iframe 
                        src="${urlMapa}"
                        width="100%"
                        height="100%"
                        style="border:0;"
                        allowfullscreen=""
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade">
                    </iframe>
                </div>
                <div style="margin-top: 10px; text-align: center;">
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionMapa)}" 
                       target="_blank" 
                       style="color: #4285f4; text-decoration: none; font-weight: 600;">
                        📍 Abrir en Google Maps
                    </a>
                </div>
            `;
            
            html += '</div>';
        } else {
            console.log('[DETALLE] No se muestra mapa - dirección vacía o no definida');
        }
        
        modalBody.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando detalle:', error);
        modalBody.innerHTML = '<div style="text-align:center; padding:40px; color:#c41e3a;"><p>Error al cargar detalles</p></div>';
    }
}

function cerrarModal() {
    document.getElementById('modalDetalles').style.display = 'none';
}

function _getCookieHist(name) {
    let v = null;
    if (document.cookie) {
        document.cookie.split(';').forEach(c => {
            c = c.trim();
            if (c.startsWith(name + '=')) v = decodeURIComponent(c.substring(name.length + 1));
        });
    }
    return v;
}

// Ir a la página de registro en modo edición
function editarAsistencia(tipo, id) {
    const paginas = {
        emergencia: 'registro-asistencia.html',
        asamblea: 'registro-asamblea.html',
        ejercicios: 'registro-ejercicios.html',
        citaciones: 'registro-citaciones.html',
        otras: 'registro-otras.html',
        directorio: 'registro-directorio.html'
    };
    const pag = paginas[tipo];
    if (!pag) { alert('Este tipo de asistencia no se puede editar.'); return; }
    window.location.href = `/${pag}?editar=${id}`;
}

// Eliminar una asistencia (con confirmación)
async function eliminarAsistencia(id) {
    if (!confirm('¿Eliminar esta asistencia? Esta acción no se puede deshacer.')) return;
    try {
        const resp = await fetch(`/api/eventos-asistencia/${id}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': _getCookieHist('csrftoken') },
            credentials: 'include'
        });
        if (!resp.ok && resp.status !== 204) throw new Error('HTTP ' + resp.status);
        if (window.Utils) Utils.mostrarNotificacion('Asistencia eliminada ✅', 'success');
        setTimeout(() => location.reload(), 600);
    } catch (e) {
        alert('No se pudo eliminar: ' + e.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.historialAsistencias = new HistorialAsistencias();
    window.historialApp = window.historialAsistencias;
    
    window.onclick = function(event) {
        const modal = document.getElementById('modalDetalles');
        if (event.target == modal) {
            cerrarModal();
        }
    };
});
