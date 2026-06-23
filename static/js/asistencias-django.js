// ==================== SISTEMA DE ASISTENCIAS DJANGO ====================
console.log('🚀 Cargando asistencias-django.js');

class SistemaAsistencias {
    constructor() {
        this.bomberos = [];
        this.cargosVigentes = {};
        this.eventoActual = null;
        this.asistentesSeleccionados = new Set();
        this.externosSeleccionados = [];
        this.canjesSeleccionados = [];
        this.init();
    }

    async init() {
        console.log('[ASISTENCIAS] Iniciando sistema...');
        
        // Verificar autenticación
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        await this.cargarDatos();
        this.configurarEventos();
        this.inicializarFechaHora();
        
        console.log('[ASISTENCIAS] ✅ Sistema inicializado');
    }

    async cargarDatos() {
        try {
            // Cargar voluntarios
            const response = await fetch('/api/voluntarios/', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error al cargar voluntarios');

            const data = await response.json();
            this.bomberos = Array.isArray(data) ? data : (data.results || []);
            
            // Filtrar solo activos
            this.bomberos = this.bomberos.filter(b => 
                (b.estado_bombero || b.estadoBombero || 'activo') === 'activo'
            );

            console.log('[ASISTENCIAS] Voluntarios cargados:', this.bomberos.length);

            // Cargar cargos vigentes
            await this.cargarCargosVigentes();

        } catch (error) {
            console.error('[ASISTENCIAS] Error al cargar datos:', error);
            Utils.mostrarNotificacion('Error al cargar datos', 'error');
        }
    }

    async cargarCargosVigentes() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        for (const bombero of this.bomberos) {
            try {
                const response = await fetch(`/api/cargos/?voluntario=${bombero.id}`, {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    const cargos = Array.isArray(data) ? data : (data.results || []);

                    if (cargos.length > 0) {
                        const vigentes = cargos.filter(c => {
                            if (!c.fecha_fin) return true;
                            const fechaFin = new Date(c.fecha_fin);
                            fechaFin.setHours(0, 0, 0, 0);
                            return fechaFin >= hoy;
                        });

                        if (vigentes.length > 0) {
                            const masReciente = vigentes.sort((a, b) => {
                                const fechaA = new Date(a.fecha_inicio || a.anio);
                                const fechaB = new Date(b.fecha_inicio || b.anio);
                                return fechaB - fechaA;
                            })[0];

                            this.cargosVigentes[bombero.id] = masReciente;
                        }
                    }
                }
            } catch (error) {
                console.error(`[ASISTENCIAS] Error cargando cargo para ${bombero.id}:`, error);
            }
        }

        console.log('[ASISTENCIAS] Cargos vigentes:', Object.keys(this.cargosVigentes).length);
    }

    configurarEventos() {
        // Evento: cambio de tipo
        const selectTipo = document.getElementById('tipoEvento');
        if (selectTipo) {
            selectTipo.addEventListener('change', () => this.onTipoEventoChange());
        }

        // Form submit
        const form = document.getElementById('formAsistencia');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarAsistencia();
            });
        }

        // Botones de externos/canjes
        const btnAgregarExterno = document.getElementById('btnAgregarExterno');
        if (btnAgregarExterno) {
            btnAgregarExterno.addEventListener('click', () => this.mostrarModalExterno());
        }

        const btnAgregarCanje = document.getElementById('btnAgregarCanje');
        if (btnAgregarCanje) {
            btnAgregarCanje.addEventListener('click', () => this.mostrarModalCanje());
        }
    }

    mostrarModalExterno() {
        const nombre = prompt('Nombre del participante externo:');
        if (nombre && nombre.trim()) {
            this.externosSeleccionados.push({
                id: Date.now(),
                nombre: nombre.trim(),
                tipo: 'participante'
            });
            this.renderizarExternos();
            this.actualizarEstadisticas();
        }
    }

    mostrarModalCanje() {
        const nombre = prompt('Nombre del canje:');
        if (!nombre || !nombre.trim()) return;

        const compania = prompt('Compañía:');
        if (!compania || !compania.trim()) return;

        this.canjesSeleccionados.push({
            id: Date.now(),
            nombre: nombre.trim(),
            compania: compania.trim(),
            tipo: 'canje'
        });
        this.renderizarCanjes();
        this.actualizarEstadisticas();
    }

    renderizarExternos() {
        const container = document.getElementById('listaExternos');
        if (!container) return;

        container.innerHTML = '';

        this.externosSeleccionados.forEach((externo, index) => {
            const div = document.createElement('div');
            div.className = 'item-externo';
            div.innerHTML = `
                <span>${externo.nombre}</span>
                <button onclick="sistemaAsistencias.eliminarExterno(${index})" class="btn-eliminar-mini">
                    ❌
                </button>
            `;
            container.appendChild(div);
        });
    }

    renderizarCanjes() {
        const container = document.getElementById('listaCanjes');
        if (!container) return;

        container.innerHTML = '';

        this.canjesSeleccionados.forEach((canje, index) => {
            const div = document.createElement('div');
            div.className = 'item-canje';
            div.innerHTML = `
                <span>${canje.nombre} <small>(${canje.compania})</small></span>
                <button onclick="sistemaAsistencias.eliminarCanje(${index})" class="btn-eliminar-mini">
                    ❌
                </button>
            `;
            container.appendChild(div);
        });
    }

    eliminarExterno(index) {
        this.externosSeleccionados.splice(index, 1);
        this.renderizarExternos();
        this.actualizarEstadisticas();
    }

    eliminarCanje(index) {
        this.canjesSeleccionados.splice(index, 1);
        this.renderizarCanjes();
        this.actualizarEstadisticas();
    }

    inicializarFechaHora() {
        const fechaInput = document.getElementById('fechaEvento');
        const horaInput = document.getElementById('horaEvento');

        if (fechaInput && horaInput) {
            const ahora = new Date();
            fechaInput.valueAsDate = ahora;
            horaInput.value = ahora.toTimeString().slice(0, 5);
        }
    }

    onTipoEventoChange() {
        const tipo = document.getElementById('tipoEvento').value;
        console.log('[ASISTENCIAS] Tipo cambiado a:', tipo);

        if (!tipo) {
            document.getElementById('listaVoluntarios').innerHTML = `
                <p style="text-align: center; color: #999; padding: 40px;">
                    Seleccione un tipo de evento para ver la lista de voluntarios
                </p>
            `;
            return;
        }

        // Renderizar lista de voluntarios según tipo
        this.renderizarListaVoluntarios(tipo);
    }

    renderizarListaVoluntarios(tipo) {
        const container = document.getElementById('listaVoluntarios');
        if (!container) {
            console.error('[ASISTENCIAS] No se encontró contenedor listaVoluntarios');
            return;
        }

        container.innerHTML = '';

        // Clasificar voluntarios
        const clasificados = this.clasificarVoluntarios(tipo);

        console.log('[ASISTENCIAS] Voluntarios clasificados:', {
            comandancia: clasificados.comandancia.length,
            oficialesCompania: clasificados.oficialesCompania.length,
            cargosConfianza: clasificados.cargosConfianza.length,
            voluntarios: clasificados.voluntarios.length
        });

        // Si es Directorio, solo mostrar oficiales compañía y confianza
        if (tipo === 'directorio') {
            this.renderizarSeccion(container, '👔 Oficiales de Compañía', clasificados.oficialesCompania);
            this.renderizarSeccion(container, '🔧 Cargos de Confianza', clasificados.cargosConfianza);
        } else {
            // Otras asistencias: mostrar todos
            this.renderizarSeccion(container, '⭐ Comandancia', clasificados.comandancia);
            this.renderizarSeccion(container, '👔 Oficiales de Compañía', clasificados.oficialesCompania);
            this.renderizarSeccion(container, '🔧 Cargos de Confianza', clasificados.cargosConfianza);
            this.renderizarSeccion(container, '👥 Voluntarios', clasificados.voluntarios);
        }

        // Si no hay ningún voluntario
        if (container.innerHTML.trim() === '') {
            container.innerHTML = `
                <p style="text-align: center; color: #999; padding: 40px;">
                    No hay voluntarios activos disponibles
                </p>
            `;
        }

        this.actualizarEstadisticas();
    }

    clasificarVoluntarios(tipo) {
        console.log('[ASISTENCIAS] Clasificando', this.bomberos.length, 'voluntarios...');
        console.log('[ASISTENCIAS] Cargos vigentes disponibles:', Object.keys(this.cargosVigentes).length);
        
        const clasificados = {
            comandancia: [],
            oficialesCompania: [],
            cargosConfianza: [],
            voluntarios: []
        };

        for (const bombero of this.bomberos) {
            const cargo = this.cargosVigentes[bombero.id];

            if (cargo) {
                console.log(`[ASISTENCIAS] ${bombero.nombre || 'N/A'} tiene cargo: ${cargo.nombre_cargo}`);
                
                if (this.esCargoComandancia(cargo.nombre_cargo)) {
                    clasificados.comandancia.push({ bombero, cargo });
                } else if (this.esCargoOficialCompania(cargo.nombre_cargo)) {
                    clasificados.oficialesCompania.push({ bombero, cargo });
                } else if (this.esCargoConfianza(cargo.nombre_cargo)) {
                    clasificados.cargosConfianza.push({ bombero, cargo });
                } else {
                    clasificados.voluntarios.push({ bombero, cargo: null });
                }
            } else {
                clasificados.voluntarios.push({ bombero, cargo: null });
            }
        }

        return clasificados;
    }

    renderizarSeccion(container, titulo, items) {
        if (items.length === 0) return;

        const seccion = document.createElement('div');
        seccion.className = 'seccion-voluntarios';
        seccion.innerHTML = `<h4 style="color: #c8102e; margin: 15px 0 10px 0; font-size: 16px;">${titulo}</h4>`;

        const lista = document.createElement('div');
        lista.className = 'lista-checkboxes';

        items.forEach(({ bombero, cargo }) => {
            const checkbox = document.createElement('label');
            checkbox.className = 'checkbox-voluntario';
            checkbox.innerHTML = `
                <input type="checkbox" 
                       data-id="${bombero.id}" 
                       data-nombre="${this.obtenerNombreCompleto(bombero)}"
                       data-clave="${bombero.clave_bombero || bombero.claveBombero || 'N/A'}"
                       data-cargo="${cargo ? cargo.nombre_cargo : ''}"
                       data-anio-cargo="${cargo ? cargo.anio : ''}"
                       ${this.asistentesSeleccionados.has(bombero.id) ? 'checked' : ''}>
                <span>${this.obtenerNombreCompleto(bombero)} 
                      ${cargo ? `<small style="color: #666;">(${cargo.nombre_cargo})</small>` : ''}
                </span>
            `;

            checkbox.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.asistentesSeleccionados.add(bombero.id);
                } else {
                    this.asistentesSeleccionados.delete(bombero.id);
                }
                this.actualizarEstadisticas();
            });

            lista.appendChild(checkbox);
        });

        seccion.appendChild(lista);
        container.appendChild(seccion);
    }

    obtenerNombreCompleto(bombero) {
        const nombre = bombero.nombre || bombero.primerNombre || '';
        const segundo = bombero.segundoNombre || '';
        const tercero = bombero.tercerNombre || '';
        const paterno = bombero.apellido_paterno || bombero.primerApellido || '';
        const materno = bombero.apellido_materno || bombero.segundoApellido || '';
        
        return `${nombre} ${segundo} ${tercero} ${paterno} ${materno}`.replace(/\s+/g, ' ').trim();
    }

    esCargoComandancia(nombreCargo) {
        const cargosComandancia = [
            'Superintendente',
            'Comandante 1', 'Comandante 2', 'Comandante 3',
            'Intendente General',
            'Tesorero General',
            'Secretario General',
            'Ayudante General'
        ];
        return cargosComandancia.includes(nombreCargo);
    }

    esCargoOficialCompania(nombreCargo) {
        const cargosOficialidad = [
            'Capitán', 'Director', 'Secretario', 'Tesorero',
            'Capellán', 'Intendente',
            'Teniente Primero', 'Teniente Segundo', 'Teniente Tercero', 'Teniente Cuarto'
        ];
        return cargosOficialidad.includes(nombreCargo);
    }

    esCargoConfianza(nombreCargo) {
        const cargosConfianza = [
            'Jefe de Máquinas',
            'Maquinista 1°', 'Maquinista 2°', 'Maquinista 3°',
            'Ayudante', 'Ayudante 1°', 'Ayudante 2°', 'Ayudante 3°'
        ];
        return cargosConfianza.includes(nombreCargo);
    }

    actualizarEstadisticas() {
        const total = this.asistentesSeleccionados.size + this.externosSeleccionados.length + this.canjesSeleccionados.length;
        
        const spanTotal = document.getElementById('totalAsistentes');
        if (spanTotal) {
            spanTotal.textContent = total;
        }
    }

    async guardarAsistencia() {
        try {
            const tipo = document.getElementById('tipoEvento').value;
            const fecha = document.getElementById('fechaEvento').value;
            const descripcion = document.getElementById('descripcionEvento').value;
            const observaciones = document.getElementById('observacionesEvento').value;

            if (!tipo || !fecha || !descripcion) {
                Utils.mostrarNotificacion('Complete los campos obligatorios', 'error');
                return;
            }

            if (this.asistentesSeleccionados.size === 0) {
                Utils.mostrarNotificacion('Debe seleccionar al menos un asistente', 'error');
                return;
            }

            console.log('[ASISTENCIAS] Guardando evento...');

            // Generar ID único para el evento
            const idEvento = Date.now();

            // Preparar datos del evento
            const eventoData = {
                id_evento: idEvento,
                tipo: tipo,
                fecha: fecha,
                descripcion: descripcion,
                total_asistentes: this.asistentesSeleccionados.size,
                oficiales_comandancia: 0,
                oficiales_compania: 0,
                cargos_confianza: 0,
                voluntarios: 0,
                participantes: this.externosSeleccionados.length,
                canjes: this.canjesSeleccionados.length,
                porcentaje_asistencia: 0,
                observaciones: observaciones || ''
            };

            // Contar por categoría
            const checkboxes = document.querySelectorAll('#listaVoluntarios input[type="checkbox"]:checked');
            checkboxes.forEach(cb => {
                const cargo = cb.dataset.cargo;
                if (this.esCargoComandancia(cargo)) {
                    eventoData.oficiales_comandancia++;
                } else if (this.esCargoOficialCompania(cargo)) {
                    eventoData.oficiales_compania++;
                } else if (this.esCargoConfianza(cargo)) {
                    eventoData.cargos_confianza++;
                } else {
                    eventoData.voluntarios++;
                }
            });

            // Guardar evento
            const responseEvento = await fetch('/api/eventos-asistencia/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(eventoData)
            });

            if (!responseEvento.ok) {
                const errorData = await responseEvento.json();
                throw new Error(errorData.detail || 'Error al guardar evento');
            }

            const eventoGuardado = await responseEvento.json();
            console.log('[ASISTENCIAS] Evento guardado:', eventoGuardado);

            // Guardar detalles de asistentes
            const detalles = [];
            checkboxes.forEach(cb => {
                detalles.push({
                    evento: eventoGuardado.id,
                    voluntario: parseInt(cb.dataset.id),
                    nombre_completo: cb.dataset.nombre,
                    clave_bombero: cb.dataset.clave,
                    categoria: this.obtenerCategoria(cb.dataset.cargo),
                    cargo: cb.dataset.cargo || null,
                    anio_cargo: cb.dataset.anioCargo ? parseInt(cb.dataset.anioCargo) : null,
                    es_externo: false
                });
            });

            // Guardar cada detalle
            for (const detalle of detalles) {
                await fetch('/api/detalles-asistencia/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify(detalle)
                });
            }

            // Guardar externos
            for (const externo of this.externosSeleccionados) {
                const detalleExterno = {
                    evento: eventoGuardado.id,
                    nombre_completo: externo.nombre,
                    categoria: 'Externo',
                    es_externo: true,
                    tipo_externo: 'participante'
                };

                await fetch('/api/detalles-asistencia/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify(detalleExterno)
                });
            }

            // Guardar canjes
            for (const canje of this.canjesSeleccionados) {
                const detalleCanje = {
                    evento: eventoGuardado.id,
                    nombre_completo: `${canje.nombre} (${canje.compania})`,
                    categoria: 'Canje',
                    es_externo: true,
                    tipo_externo: 'canje'
                };

                await fetch('/api/detalles-asistencia/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify(detalleCanje)
                });
            }

            Utils.mostrarNotificacion('✅ Asistencia registrada exitosamente', 'success');
            this.limpiarFormulario();

        } catch (error) {
            console.error('[ASISTENCIAS] Error:', error);
            Utils.mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        }
    }

    obtenerCategoria(cargo) {
        if (!cargo) return 'Voluntario';
        if (this.esCargoComandancia(cargo)) return 'Comandancia';
        if (this.esCargoOficialCompania(cargo)) return 'Oficial Compañía';
        if (this.esCargoConfianza(cargo)) return 'Confianza';
        return 'Voluntario';
    }

    limpiarFormulario() {
        document.getElementById('formAsistencia').reset();
        this.asistentesSeleccionados.clear();
        this.externosSeleccionados = [];
        this.canjesSeleccionados = [];
        this.inicializarFechaHora();
        this.renderizarListaVoluntarios(document.getElementById('tipoEvento').value);
    }
}

// Instancia global
let sistemaAsistencias;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    sistemaAsistencias = new SistemaAsistencias();
});
