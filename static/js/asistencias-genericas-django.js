// ==================== SISTEMA DE ASISTENCIAS GENÉRICAS - DJANGO ====================
// Para: Asamblea, Ejercicios, Citaciones, Otras, Directorio
console.log('🚀 [ASISTENCIAS GENÉRICAS] Cargando...');

class SistemaAsistenciasGenericas {
    constructor(tipo) {
        this.tipo = tipo; // 'asamblea', 'ejercicios', 'citaciones', 'otras', 'directorio'
        this.bomberos = [];
        this.cargosVigentes = {};
        this.asistentesSeleccionados = new Set();
        this.externosSeleccionados = {
            participantes: {},
            canjes: {}
        };
        this.catalogoExternos = {
            participantes: {},
            canjes: {}
        };
        this.init();
    }

    async init() {
        console.log(`[${this.tipo.toUpperCase()}] Iniciando sistema...`);
        
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        await this.cargarDatos();
        this.inicializarFechaHora();
        this.renderizarVoluntarios();
        this.cargarListasExternos();
        
        console.log(`[${this.tipo.toUpperCase()}] ✅ Sistema inicializado`);
    }

    async cargarDatos() {
        try {
            // Cargar voluntarios
            const response = await fetch('/api/voluntarios/lista-activos-simple/');

            if (response.ok) {
                const data = await response.json();
                this.bomberos = Array.isArray(data) ? data : (data.results || []);
                console.log(`[${this.tipo.toUpperCase()}] Voluntarios cargados:`, this.bomberos.length);
            }

            // Cargar cargos vigentes
            const responseCargos = await fetch('/api/cargos/?vigente=true', {
                credentials: 'include'
            });

            if (responseCargos.ok) {
                const dataCargos = await responseCargos.json();
                const cargos = Array.isArray(dataCargos) ? dataCargos : (dataCargos.results || []);
                
                cargos.forEach(cargo => {
                    this.cargosVigentes[cargo.voluntario] = cargo;
                });
                
                console.log(`[${this.tipo.toUpperCase()}] Cargos vigentes cargados:`, Object.keys(this.cargosVigentes).length);
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
        }
    }

    inicializarFechaHora() {
        const fechaInput = document.querySelector('input[type="date"]');
        const horaInicioInput = document.getElementById('horaInicio');
        
        if (fechaInput) {
            const hoy = new Date();
            fechaInput.valueAsDate = hoy;
        }
        
        if (horaInicioInput) {
            const ahora = new Date();
            horaInicioInput.value = ahora.toTimeString().slice(0, 5);
        }
    }

    renderizarVoluntarios() {
        console.log(`[${this.tipo.toUpperCase()}] Renderizando voluntarios...`);
        const clasificados = this.clasificarVoluntarios();
        
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

        const esMartires = containerId === 'listaMartires';

        let html = '';
        items.forEach(({ bombero, cargo }) => {
            const nombreCompleto = this.obtenerNombreCompleto(bombero);
            const clave = bombero.clave_bombero || bombero.claveBombero || 'N/A';
            const cargoTexto = cargo ? cargo.nombre_cargo : '';
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
                           onchange="${this.tipo}Sistema.onCheckboxChange()">
                    <span class="voluntario-nombre">${nombreCompleto}</span>
                    ${cargo ? `<span class="voluntario-cargo">${cargo.nombre_cargo}</span>` : ''}
                </label>
            `;
        });

        container.innerHTML = html;
        
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
            'generales': 'listaGenerales',
            'compania': 'listaCompania',
            'confianza': 'listaCargosConfianza',
            'insignes': 'listaInsignes',
            'honorariosCuerpo': 'listaHonorariosCuerpo',
            'honorariosCia': 'listaHonorariosCia',
            'voluntarios': 'listaVoluntarios'
        };

        const containerId = containerMap[categoria];
        if (!containerId) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.actualizarEstadisticas();
    }

    deseleccionarTodos(categoria) {
        const containerMap = {
            'martir': 'listaMartires',
            'generales': 'listaGenerales',
            'compania': 'listaCompania',
            'confianza': 'listaCargosConfianza',
            'insignes': 'listaInsignes',
            'honorariosCuerpo': 'listaHonorariosCuerpo',
            'honorariosCia': 'listaHonorariosCia',
            'voluntarios': 'listaVoluntarios'
        };

        const containerId = containerMap[categoria];
        if (!containerId) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.actualizarEstadisticas();
    }

    actualizarEstadisticas() {
        const checkboxes = document.querySelectorAll('.voluntarios-lista input[type="checkbox"]:checked');
        const totalPersonas = this.bomberos.length;
        const asistentes = checkboxes.length;
        const porcentaje = totalPersonas > 0 ? ((asistentes / totalPersonas) * 100).toFixed(1) : 0;

        document.getElementById('totalPersonas').textContent = totalPersonas;
        document.getElementById('asistentesSeleccionados').textContent = asistentes;
        document.getElementById('porcentajeAsistencia').textContent = `${porcentaje}%`;

        // Actualizar resumen por categoría
        const stats = this.contarPorCategoria(checkboxes);
        this.actualizarResumen(stats);
    }

    contarPorCategoria(checkboxes) {
        const stats = {
            comandancia: 0,
            compania: 0,
            confianza: 0,
            voluntarios: 0
        };

        checkboxes.forEach(cb => {
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

        return stats;
    }

    actualizarResumen(stats) {
        document.getElementById('resumenOficiales').textContent = stats.comandancia + stats.compania;
        document.getElementById('resumenComandancia').textContent = stats.comandancia;
        document.getElementById('resumenCompania').textContent = stats.compania;
        document.getElementById('resumenConfianza').textContent = stats.confianza;
        document.getElementById('resumenVoluntarios').textContent = stats.voluntarios;
    }

    async cargarListasExternos() {
        try {
            const response = await fetch('/api/externos/', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const externos = Array.isArray(data) ? data : (data.results || []);
                
                this.catalogoExternos.participantes = {};
                this.catalogoExternos.canjes = {};
                
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
                            totalAsistencias: ext.total_asistencias || 0
                        };
                    }
                });
            }
        } catch (error) {
            console.error(`[${this.tipo.toUpperCase()}] Error cargando externos:`, error);
        }

        this.actualizarDatalistExternos();
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
        const nombre = input?.value?.trim();
        
        if (!nombre) {
            Utils.mostrarNotificacion('Ingrese un nombre', 'error');
            return;
        }

        // Buscar en catálogo
        let existente = Object.values(this.catalogoExternos.participantes).find(p => 
            p.nombre.toLowerCase() === nombre.toLowerCase()
        );

        // Si no existe, crear nuevo
        if (!existente) {
            try {
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
                    existente = {
                        id: externo.id,
                        nombre: externo.nombre_completo,
                        totalAsistencias: 0
                    };
                    this.catalogoExternos.participantes[externo.id] = existente;
                    this.actualizarDatalistExternos();
                }
            } catch (error) {
                console.error('Error creando participante:', error);
                Utils.mostrarNotificacion('Error al agregar participante', 'error');
                return;
            }
        }

        // Agregar a seleccionados
        this.externosSeleccionados.participantes[existente.id] = existente;
        console.log('[EXTERNOS] Participante agregado:', existente);
        console.log('[EXTERNOS] Total participantes:', Object.keys(this.externosSeleccionados.participantes).length);
        this.renderizarParticipantes();
        input.value = '';
        this.actualizarEstadisticas();
    }

    async agregarCanje() {
        const input = document.getElementById('inputCanje');
        const nombre = input?.value?.trim();
        
        if (!nombre) {
            Utils.mostrarNotificacion('Ingrese un nombre', 'error');
            return;
        }

        // Buscar en catálogo
        let existente = Object.values(this.catalogoExternos.canjes).find(c => 
            c.nombre.toLowerCase() === nombre.toLowerCase()
        );

        // Si no existe, crear nuevo
        if (!existente) {
            try {
                const response = await fetch('/api/externos/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        nombre_completo: nombre,
                        tipo: 'canje'
                    })
                });

                if (response.ok) {
                    const externo = await response.json();
                    existente = {
                        id: externo.id,
                        nombre: externo.nombre_completo,
                        totalAsistencias: 0
                    };
                    this.catalogoExternos.canjes[externo.id] = existente;
                    this.actualizarDatalistExternos();
                }
            } catch (error) {
                console.error('Error creando canje:', error);
                Utils.mostrarNotificacion('Error al agregar canje', 'error');
                return;
            }
        }

        // Agregar a seleccionados
        this.externosSeleccionados.canjes[existente.id] = existente;
        console.log('[EXTERNOS] Canje agregado:', existente);
        console.log('[EXTERNOS] Total canjes:', Object.keys(this.externosSeleccionados.canjes).length);
        this.renderizarCanjes();
        input.value = '';
        this.actualizarEstadisticas();
    }

    renderizarParticipantes() {
        const container = document.getElementById('participantesSeleccionados');
        if (!container) {
            console.warn('[EXTERNOS] Contenedor participantesSeleccionados no encontrado');
            return;
        }

        const participantes = Object.values(this.externosSeleccionados.participantes);
        
        if (participantes.length === 0) {
            container.innerHTML = '<p class="no-data">No hay participantes seleccionados</p>';
            return;
        }

        container.innerHTML = participantes.map(p => `
            <div class="externo-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 8px;">
                <span style="font-weight: 500;">🤝 ${p.nombre}</span>
                <button type="button" class="btn-eliminar" onclick="${this.tipo}Sistema.eliminarParticipante(${p.id})" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
        `).join('');
    }

    renderizarCanjes() {
        const container = document.getElementById('canjesSeleccionados');
        if (!container) {
            console.warn('[EXTERNOS] Contenedor canjesSeleccionados no encontrado');
            return;
        }

        const canjes = Object.values(this.externosSeleccionados.canjes);
        
        if (canjes.length === 0) {
            container.innerHTML = '<p class="no-data">No hay canjes seleccionados</p>';
            return;
        }

        container.innerHTML = canjes.map(c => `
            <div class="externo-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 8px;">
                <span style="font-weight: 500;">🔄 ${c.nombre}</span>
                <button type="button" class="btn-eliminar" onclick="${this.tipo}Sistema.eliminarCanje(${c.id})" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
        `).join('');
    }

    eliminarParticipante(id) {
        delete this.externosSeleccionados.participantes[id];
        this.renderizarParticipantes();
        this.actualizarEstadisticas();
    }

    eliminarCanje(id) {
        delete this.externosSeleccionados.canjes[id];
        this.renderizarCanjes();
        this.actualizarEstadisticas();
    }

    async guardarRegistro() {
        try {
            console.log(`[${this.tipo.toUpperCase()}] Guardando registro...`);

            // Obtener checkboxes seleccionados
            const checkboxes = document.querySelectorAll('.voluntarios-lista input[type="checkbox"]:checked');
            
            if (checkboxes.length === 0) {
                Utils.mostrarNotificacion('Debe seleccionar al menos un asistente', 'error');
                return;
            }

            // Obtener datos específicos del tipo
            const datosEspecificos = this.obtenerDatosEspecificos();
            if (!datosEspecificos) return;

            const eventoData = {
                id_evento: Date.now(),
                tipo: this.tipo,
                fecha: datosEspecificos.fecha,
                descripcion: datosEspecificos.descripcion,
                total_asistentes: checkboxes.length,
                oficiales_comandancia: 0,
                oficiales_compania: 0,
                cargos_confianza: 0,
                voluntarios: 0,
                participantes: Object.keys(this.externosSeleccionados.participantes).length,
                canjes: Object.keys(this.externosSeleccionados.canjes).length,
                porcentaje_asistencia: 0,
                ...datosEspecificos.camposExtra
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
            
            eventoData.total_oficiales = eventoData.oficiales_comandancia + eventoData.oficiales_compania;
            eventoData.total_asistentes = checkboxes.length + eventoData.participantes + eventoData.canjes;

            console.log(`[${this.tipo.toUpperCase()}] 📤 Datos a enviar:`, eventoData);

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
                throw new Error('Error al guardar evento');
            }

            const eventoGuardado = await responseEvento.json();
            console.log(`[${this.tipo.toUpperCase()}] ✅ Evento guardado:`, eventoGuardado);

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
            
            setTimeout(() => {
                window.location.href = '/historial-asistencias.html';
            }, 1500);

        } catch (error) {
            console.error('Error:', error);
            Utils.mostrarNotificacion('Error al guardar el registro', 'error');
        }
    }

    obtenerDatosEspecificos() {
        // Implementar según el tipo
        const fecha = document.querySelector('input[type="date"]')?.value;
        const horaInicio = document.getElementById('horaInicio')?.value;
        const horaTermino = document.getElementById('horaTermino')?.value;

        if (!fecha || !horaInicio || !horaTermino) {
            Utils.mostrarNotificacion('Complete todos los campos obligatorios', 'error');
            return null;
        }

        let descripcion = '';
        let camposExtra = {
            hora_inicio: horaInicio,
            hora_termino: horaTermino
        };

        switch(this.tipo) {
            case 'asamblea':
                const tipoAsamblea = document.getElementById('tipoAsamblea')?.value;
                if (!tipoAsamblea) {
                    Utils.mostrarNotificacion('Seleccione el tipo de asamblea', 'error');
                    return null;
                }
                descripcion = `Asamblea ${tipoAsamblea}`;
                camposExtra.tipo_asamblea = tipoAsamblea;
                break;
                
            case 'ejercicios':
                const tipoEjercicio = document.getElementById('tipoEjercicio')?.value;
                if (!tipoEjercicio) {
                    Utils.mostrarNotificacion('Seleccione el tipo de ejercicio', 'error');
                    return null;
                }
                descripcion = `Ejercicio de ${tipoEjercicio}`;
                camposExtra.tipo_ejercicio = tipoEjercicio;
                break;
                
            case 'citaciones':
                const nombreCitacion = document.getElementById('nombreCitacion')?.value;
                if (!nombreCitacion) {
                    Utils.mostrarNotificacion('Ingrese el nombre de la citación', 'error');
                    return null;
                }
                descripcion = `Citación: ${nombreCitacion}`;
                camposExtra.nombre_citacion = nombreCitacion;
                break;
                
            case 'otras':
                const motivoOtras = document.getElementById('motivoOtras')?.value;
                if (!motivoOtras) {
                    Utils.mostrarNotificacion('Ingrese el motivo', 'error');
                    return null;
                }
                descripcion = `Otras: ${motivoOtras}`;
                camposExtra.motivo_otras = motivoOtras;
                break;
                
            case 'directorio':
                descripcion = 'Reunión de Directorio';
                break;
        }

        return {
            fecha,
            descripcion,
            camposExtra
        };
    }
}

// Helper para cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
