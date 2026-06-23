// ==================== SISTEMA DE ASISTENCIAS EMERGENCIAS - DJANGO ====================
console.log('🚀 [ASISTENCIAS] Cargando asistencias-emergencias-django.js');

class SistemaAsistenciasEmergencias {
    constructor() {
        this.bomberos = [];
        this.cargosVigentes = {};
        this.asistentesSeleccionados = new Set();
        this.catalogoExternos = {
            participantes: {},  // Catálogo global (para datalist)
            canjes: {}
        };
        this.externosSeleccionados = {
            participantes: {},  // Seleccionados para ESTA asistencia
            canjes: {}
        };
        this.init();
    }

    async init() {
        console.log('[ASISTENCIAS] Iniciando sistema de emergencias...');
        
        // Verificar autenticación
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        await this.cargarDatos();
        this.inicializarFechaHora();
        this.renderizarVoluntarios();
        this.cargarListasExternos();
        
        console.log('[ASISTENCIAS] ✅ Sistema inicializado');
    }

    async cargarDatos() {
        try {
            // Cargar voluntarios
            const response = await fetch('/api/voluntarios/lista-activos-simple/');

            if (!response.ok) throw new Error('Error al cargar voluntarios');

            const data = await response.json();
            this.bomberos = Array.isArray(data) ? data : (data.results || []);
            
            // Filtrar: activos Y mártires (para asistencias)
            this.bomberos = this.bomberos.filter(b => {
                const estado = b.estado_bombero || b.estadoBombero || 'activo';
                return estado === 'activo' || estado === 'martir';
            });

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

        console.log('[ASISTENCIAS] Cargos vigentes cargados:', Object.keys(this.cargosVigentes).length);
    }

    inicializarFechaHora() {
        const fechaInput = document.getElementById('fechaEmergencia');
        const horaInput = document.getElementById('horaInicio');

        if (fechaInput && horaInput) {
            const ahora = new Date();
            fechaInput.valueAsDate = ahora;
            horaInput.value = ahora.toTimeString().slice(0, 5);
        }
    }

    renderizarVoluntarios() {
        console.log('[ASISTENCIAS] Renderizando voluntarios...');

        // Clasificar voluntarios
        const clasificados = this.clasificarVoluntarios();

        console.log('[ASISTENCIAS] Clasificados:', {
            martires: clasificados.martires.length,
            comandancia: clasificados.comandancia.length,
            compania: clasificados.compania.length,
            confianza: clasificados.confianza.length,
            insignes: clasificados.insignes.length,
            honorariosCuerpo: clasificados.honorariosCuerpo.length,
            honorariosCia: clasificados.honorariosCia.length,
            voluntarios: clasificados.voluntarios.length
        });

        // Renderizar cada categoría
        this.renderizarCategoria('listaMartires', clasificados.martires);
        this.renderizarCategoria('listaGenerales', clasificados.comandancia);
        this.renderizarCategoria('listaCompania', clasificados.compania);
        this.renderizarCategoria('listaCargosConfianza', clasificados.confianza);
        this.renderizarCategoria('listaInsignes', clasificados.insignes);
        this.renderizarCategoria('listaHonorariosCuerpo', clasificados.honorariosCuerpo);
        this.renderizarCategoria('listaHonorariosCia', clasificados.honorariosCia);
        this.renderizarCategoria('listaVoluntarios', clasificados.voluntarios);

        this.actualizarEstadisticas();
    }

    clasificarVoluntarios() {
        const clasificados = {
            martires: [],
            comandancia: [],
            compania: [],
            confianza: [],
            insignes: [],
            honorariosCuerpo: [],
            honorariosCia: [],
            voluntarios: []
        };

        for (const bombero of this.bomberos) {
            const cargo = this.cargosVigentes[bombero.id];
            const categoria = Utils.calcularCategoriaBombero(bombero);

            // Clasificar según estado y categoría
            if ((bombero.estado_bombero || bombero.estadoBombero) === 'martir') {
                clasificados.martires.push({ bombero, cargo });
            } else if (cargo && this.esCargoComandancia(cargo.nombre_cargo)) {
                clasificados.comandancia.push({ bombero, cargo });
            } else if (cargo && this.esCargoOficialCompania(cargo.nombre_cargo)) {
                clasificados.compania.push({ bombero, cargo });
            } else if (cargo && this.esCargoConfianza(cargo.nombre_cargo)) {
                clasificados.confianza.push({ bombero, cargo });
            } else if (categoria.categoria === 'Voluntario Insigne') {
                clasificados.insignes.push({ bombero, cargo });
            } else if (categoria.categoria === 'V.H. del Cuerpo') {
                clasificados.honorariosCuerpo.push({ bombero, cargo });
            } else if (categoria.categoria === 'V.H. de Compañía') {
                clasificados.honorariosCia.push({ bombero, cargo });
            } else {
                clasificados.voluntarios.push({ bombero, cargo });
            }
        }

        return clasificados;
    }

    renderizarCategoria(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<p class="no-data">No hay voluntarios en esta categoría</p>';
            return;
        }

        // Detectar si es la lista de mártires
        const esMartires = containerId === 'listaMartires';

        let html = '';
        items.forEach(({ bombero, cargo }) => {
            const nombreCompleto = this.obtenerNombreCompleto(bombero);
            const clave = bombero.clave_bombero || bombero.claveBombero || 'N/A';
            const cargoTexto = cargo ? cargo.nombre_cargo : '';

            // Automarcar mártires
            const checked = esMartires ? 'checked' : '';

            html += `
                <label class="voluntario-item">
                    <input type="checkbox" 
                           data-id="${bombero.id}"
                           data-nombre="${nombreCompleto}"
                           data-clave="${clave}"
                           data-cargo="${cargoTexto}"
                           data-categoria="${this.obtenerCategoriaTexto(bombero, cargo)}"
                           ${checked}
                           onchange="asistencias.onCheckboxChange()">
                    <span class="voluntario-nombre">${nombreCompleto}</span>
                    ${cargo ? `<span class="voluntario-cargo">${cargo.nombre_cargo}</span>` : ''}
                </label>
            `;
        });

        container.innerHTML = html;
        
        // Actualizar estadísticas después de renderizar (para contar los mártires automarcados)
        if (esMartires) {
            setTimeout(() => this.actualizarEstadisticas(), 0);
        }
    }

    obtenerNombreCompleto(bombero) {
        if (bombero.nombre_completo) return bombero.nombre_completo;
        
        const nombre = bombero.nombre || bombero.primerNombre || '';
        const segundo = bombero.segundoNombre || '';
        const tercero = bombero.tercerNombre || '';
        const paterno = bombero.apellido_paterno || bombero.primerApellido || '';
        const materno = bombero.apellido_materno || bombero.segundoApellido || '';
        
        return `${nombre} ${segundo} ${tercero} ${paterno} ${materno}`.replace(/\s+/g, ' ').trim();
    }

    obtenerCategoriaTexto(bombero, cargo) {
        if ((bombero.estado_bombero || bombero.estadoBombero) === 'martir') return 'Mártir';
        if (cargo) {
            if (this.esCargoComandancia(cargo.nombre_cargo)) return 'Comandancia';
            if (this.esCargoOficialCompania(cargo.nombre_cargo)) return 'Oficial Compañía';
            if (this.esCargoConfianza(cargo.nombre_cargo)) return 'Confianza';
        }
        
        const categoria = Utils.calcularCategoriaBombero(bombero);
        return categoria.categoria;
    }

    esCargoComandancia(nombreCargo) {
        const cargos = ['Superintendente', 'Comandante 1', 'Comandante 2', 'Comandante 3',
                       'Intendente General', 'Tesorero General', 'Secretario General', 'Ayudante General'];
        return cargos.includes(nombreCargo);
    }

    esCargoOficialCompania(nombreCargo) {
        const cargos = ['Capitán', 'Director', 'Secretario', 'Tesorero', 'Capellán', 'Intendente',
                       'Teniente Primero', 'Teniente Segundo', 'Teniente Tercero', 'Teniente Cuarto'];
        return cargos.includes(nombreCargo);
    }

    esCargoConfianza(nombreCargo) {
        const cargos = ['Jefe de Máquinas', 'Maquinista 1°', 'Maquinista 2°', 'Maquinista 3°',
                       'Ayudante', 'Ayudante 1°', 'Ayudante 2°', 'Ayudante 3°'];
        return cargos.includes(nombreCargo);
    }

    onCheckboxChange() {
        this.actualizarEstadisticas();
    }

    seleccionarTodos(categoria) {
        const containerMap = {
            'martir': 'listaMartires',
            'comandancia': 'listaGenerales',
            'compania': 'listaCompania',
            'confianza': 'listaCargosConfianza',
            'insigne': 'listaInsignes',
            'honorarioCuerpo': 'listaHonorariosCuerpo',
            'honorarioCia': 'listaHonorariosCia',
            'voluntario': 'listaVoluntarios'
        };

        const containerId = containerMap[categoria];
        if (!containerId) return;

        const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
        checkboxes.forEach(cb => cb.checked = true);
        this.actualizarEstadisticas();
    }

    deseleccionarTodos(categoria) {
        const containerMap = {
            'martir': 'listaMartires',
            'comandancia': 'listaGenerales',
            'compania': 'listaCompania',
            'confianza': 'listaCargosConfianza',
            'insigne': 'listaInsignes',
            'honorarioCuerpo': 'listaHonorariosCuerpo',
            'honorarioCia': 'listaHonorariosCia',
            'voluntario': 'listaVoluntarios'
        };

        const containerId = containerMap[categoria];
        if (!containerId) return;

        const checkboxes = document.querySelectorAll(`#${containerId} input[type="checkbox"]`);
        checkboxes.forEach(cb => cb.checked = false);
        this.actualizarEstadisticas();
    }

    actualizarEstadisticas() {
        const checkboxes = document.querySelectorAll('.voluntarios-container input[type="checkbox"]:checked');
        
        let stats = {
            total: 0,
            comandancia: 0,
            compania: 0,
            confianza: 0,
            voluntarios: 0
        };

        checkboxes.forEach(cb => {
            stats.total++;
            const cargo = cb.dataset.cargo;
            
            if (this.esCargoComandancia(cargo)) {
                stats.comandancia++;
            } else if (this.esCargoOficialCompania(cargo)) {
                stats.compania++;
            } else if (this.esCargoConfianza(cargo)) {
                stats.confianza++;
            } else {
                stats.voluntarios++;
            }
        });

        // Actualizar UI
        const totalPersonas = this.bomberos.length;
        const porcentaje = totalPersonas > 0 ? Math.round((stats.total / totalPersonas) * 100) : 0;

        document.getElementById('totalPersonas').textContent = totalPersonas;
        document.getElementById('asistentesSeleccionados').textContent = stats.total;
        document.getElementById('porcentajeAsistencia').textContent = porcentaje + '%';

        // Resumen detallado
        document.getElementById('resumenTotal').textContent = stats.total;
        document.getElementById('resumenOficiales').textContent = stats.comandancia + stats.compania;
        document.getElementById('resumenComandancia').textContent = stats.comandancia;
        document.getElementById('resumenCompania').textContent = stats.compania;
        document.getElementById('resumenConfianza').textContent = stats.confianza;
        document.getElementById('resumenVoluntarios').textContent = stats.voluntarios;
    }

    async cargarListasExternos() {
        try {
            // Cargar catálogo de externos desde API
            const response = await fetch('/api/externos/', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const externos = Array.isArray(data) ? data : (data.results || []);
                
                console.log('[ASISTENCIAS] Externos cargados:', externos.length);
                
                // Limpiar catálogos
                this.catalogoExternos.participantes = {};
                this.catalogoExternos.canjes = {};
                
                // Separar por tipo
                externos.forEach(ext => {
                    if (ext.tipo === 'participante') {
                        this.catalogoExternos.participantes[ext.id] = {
                            id: ext.id,
                            nombre: ext.nombre_completo,
                            totalAsistencias: ext.total_asistencias || 0
                        };
                    } else if (ext.tipo === 'canje') {
                        this.catalogoExternos.canjes[ext.id] = {
                            id: ext.id,
                            nombre: ext.nombre_completo,
                            compania: ext.compania_origen || '',
                            totalAsistencias: ext.total_asistencias || 0
                        };
                    }
                });
            }
        } catch (error) {
            console.error('[ASISTENCIAS] Error cargando externos:', error);
        }

        // Llenar datalists
        this.actualizarDatalistExternos();
        
        // NO renderizar en las listas (solo datalist para autocompletado)
    }

    actualizarDatalistExternos() {
        const listaParticipantes = document.getElementById('listaParticipantes');
        const listaCanjes = document.getElementById('listaCanjes');

        if (listaParticipantes) {
            listaParticipantes.innerHTML = Object.values(this.catalogoExternos.participantes)
                .map(p => `<option value="${p.nombre}">`)
                .join('');
        }

        if (listaCanjes) {
            listaCanjes.innerHTML = Object.values(this.catalogoExternos.canjes)
                .map(c => `<option value="${c.nombre}">`)
                .join('');
        }
    }

    async agregarParticipante() {
        const input = document.getElementById('inputParticipante');
        const nombre = input.value.trim();

        if (!nombre) {
            Utils.mostrarNotificacion('Ingrese el nombre del participante', 'error');
            return;
        }

        try {
            // Verificar si ya existe en el catálogo global
            let externoId = null;
            for (const [id, ext] of Object.entries(this.catalogoExternos.participantes)) {
                if (ext.nombre.toLowerCase() === nombre.toLowerCase()) {
                    externoId = id;
                    break;
                }
            }

            // Si no existe, guardarlo en BD
            if (!externoId) {
                const response = await fetch('/api/externos/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        nombre_completo: nombre,
                        tipo: 'participante'
                    })
                });

                if (response.ok) {
                    const externo = await response.json();
                    externoId = externo.id;
                    
                    // Agregar al catálogo global
                    this.catalogoExternos.participantes[externoId] = {
                        id: externoId,
                        nombre: externo.nombre_completo,
                        totalAsistencias: 0
                    };
                    
                    this.actualizarDatalistExternos();
                } else {
                    throw new Error('Error al guardar en BD');
                }
            }

            // Agregar a seleccionados para esta asistencia
            this.externosSeleccionados.participantes[externoId] = {
                id: externoId,
                nombre: nombre
            };
            
            this.renderizarParticipantes();
            input.value = '';
            
        } catch (error) {
            console.error('Error:', error);
            Utils.mostrarNotificacion('Error al agregar participante', 'error');
        }
    }

    async agregarCanje() {
        const input = document.getElementById('inputCanje');
        const texto = input.value.trim();

        if (!texto) {
            Utils.mostrarNotificacion('Ingrese el nombre y compañía del canje', 'error');
            return;
        }

        try {
            // Verificar si ya existe en el catálogo global
            let externoId = null;
            for (const [id, ext] of Object.entries(this.catalogoExternos.canjes)) {
                if (ext.nombre.toLowerCase() === texto.toLowerCase()) {
                    externoId = id;
                    break;
                }
            }

            // Si no existe, guardarlo en BD
            if (!externoId) {
                const response = await fetch('/api/externos/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        nombre_completo: texto,
                        tipo: 'canje'
                    })
                });

                if (response.ok) {
                    const externo = await response.json();
                    externoId = externo.id;
                    
                    // Agregar al catálogo global
                    this.catalogoExternos.canjes[externoId] = {
                        id: externoId,
                        nombre: externo.nombre_completo,
                        compania: '',
                        totalAsistencias: 0
                    };
                    
                    this.actualizarDatalistExternos();
                } else {
                    throw new Error('Error al guardar en BD');
                }
            }

            // Agregar a seleccionados para esta asistencia
            this.externosSeleccionados.canjes[externoId] = {
                id: externoId,
                nombre: texto
            };
            
            this.renderizarCanjes();
            input.value = '';
            
        } catch (error) {
            console.error('Error:', error);
            Utils.mostrarNotificacion('Error al agregar canje', 'error');
        }
    }

    renderizarParticipantes() {
        const container = document.getElementById('participantesSeleccionados');
        if (!container) return;

        const items = Object.values(this.externosSeleccionados.participantes);
        
        if (items.length === 0) {
            container.innerHTML = '<p class="no-data">Sin participantes agregados</p>';
            return;
        }

        container.innerHTML = items.map(p => `
            <div class="externo-item">
                <span>${p.nombre}</span>
                <button onclick="asistencias.eliminarParticipante(${p.id})" class="btn-eliminar">×</button>
            </div>
        `).join('');
    }

    renderizarCanjes() {
        const container = document.getElementById('canjesSeleccionados');
        if (!container) return;

        const items = Object.values(this.externosSeleccionados.canjes);
        
        if (items.length === 0) {
            container.innerHTML = '<p class="no-data">Sin canjes agregados</p>';
            return;
        }

        container.innerHTML = items.map(c => `
            <div class="externo-item">
                <span>${c.nombre}</span>
                <button onclick="asistencias.eliminarCanje(${c.id})" class="btn-eliminar">×</button>
            </div>
        `).join('');
    }

    eliminarParticipante(id) {
        delete this.externosSeleccionados.participantes[id];
        this.renderizarParticipantes();
    }

    eliminarCanje(id) {
        delete this.externosSeleccionados.canjes[id];
        this.renderizarCanjes();
    }

    async guardarRegistro() {
        try {
            // Validaciones
            const fecha = document.getElementById('fechaEmergencia').value;
            const horaInicio = document.getElementById('horaInicio').value;
            const horaTermino = document.getElementById('horaTermino').value;
            const direccion = document.getElementById('direccionEmergencia').value;

            if (!fecha || !horaInicio || !horaTermino || !direccion) {
                Utils.mostrarNotificacion('Complete todos los campos obligatorios', 'error');
                return;
            }

            const checkboxes = document.querySelectorAll('.voluntarios-container input[type="checkbox"]:checked');
            
            if (checkboxes.length === 0) {
                Utils.mostrarNotificacion('Debe seleccionar al menos un asistente', 'error');
                return;
            }

            console.log('[ASISTENCIAS] Guardando registro...');

            // Preparar datos del evento
            const claveEmergencia = document.getElementById('claveEmergencia')?.value || '';
            console.log('[ASISTENCIAS] 🔑 Clave seleccionada:', claveEmergencia);
            console.log('[ASISTENCIAS] 🔑 Selector existe:', document.getElementById('claveEmergencia') !== null);
            
            const observaciones = document.getElementById('observaciones')?.value || '';
            
            const eventoData = {
                id_evento: Date.now(),
                tipo: 'emergencia',
                fecha: fecha,
                hora_inicio: horaInicio,
                hora_termino: horaTermino,
                direccion: direccion,
                clave_emergencia: claveEmergencia,
                descripcion: `Emergencia en ${direccion}`,
                total_asistentes: checkboxes.length,
                oficiales_comandancia: 0,
                oficiales_compania: 0,
                cargos_confianza: 0,
                voluntarios: 0,
                participantes: Object.keys(this.externosSeleccionados.participantes).length,
                canjes: Object.keys(this.externosSeleccionados.canjes).length,
                porcentaje_asistencia: 0,
                observaciones: observaciones
            };

            // Contar por categoría
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
            
            // Calcular totales
            eventoData.total_oficiales = eventoData.oficiales_comandancia + eventoData.oficiales_compania;
            eventoData.total_asistentes = checkboxes.length + eventoData.participantes + eventoData.canjes;

            console.log('[ASISTENCIAS] 📤 Datos a enviar:', eventoData);
            console.log('[ASISTENCIAS] 🔑 Clave en eventoData:', eventoData.clave_emergencia);

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
                const errorText = await responseEvento.text();
                console.error('[ASISTENCIAS] ❌ Error del servidor:', errorText);
                throw new Error('Error al guardar evento');
            }

            const eventoGuardado = await responseEvento.json();
            console.log('[ASISTENCIAS] ✅ Evento guardado:', eventoGuardado);
            console.log('[ASISTENCIAS] 🔑 Clave guardada en BD:', eventoGuardado.clave_emergencia);

            // Guardar detalles
            for (const cb of checkboxes) {
                const detalle = {
                    evento: eventoGuardado.id,
                    voluntario: parseInt(cb.dataset.id),
                    nombre_completo: cb.dataset.nombre,
                    clave_bombero: cb.dataset.clave,
                    categoria: cb.dataset.categoria,
                    cargo: cb.dataset.cargo || null,
                    es_externo: false
                };

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
            for (const externo of Object.values(this.externosSeleccionados.participantes)) {
                await fetch('/api/detalles-asistencia/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        evento: eventoGuardado.id,
                        nombre_completo: externo.nombre,
                        categoria: 'Externo',
                        es_externo: true,
                        tipo_externo: 'participante'
                    })
                });
            }

            // Guardar canjes
            for (const canje of Object.values(this.externosSeleccionados.canjes)) {
                await fetch('/api/detalles-asistencia/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        evento: eventoGuardado.id,
                        nombre_completo: canje.nombre,
                        categoria: 'Canje',
                        es_externo: true,
                        tipo_externo: 'canje'
                    })
                });
            }

            Utils.mostrarNotificacion('✅ Asistencia registrada exitosamente', 'success');
            
            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = '/historial-asistencias.html';
            }, 2000);

        } catch (error) {
            console.error('[ASISTENCIAS] Error:', error);
            Utils.mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        }
    }
}

// Instancia global
let asistencias;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    asistencias = new SistemaAsistenciasEmergencias();
});
