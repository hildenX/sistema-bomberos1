// ==================== SISTEMA DE DIRECTORIO - DJANGO ====================
// Solo para oficiales y cargos de confianza
console.log('🚀 [DIRECTORIO] Cargando asistencias-directorio-django.js');

class SistemaDirectorio {
    constructor() {
        this.bomberos = [];
        this.cargosVigentes = {};
        this.editId = new URLSearchParams(window.location.search).get('editar');
        this.voluntariosSeleccionadosPrevios = [];
        this.contadorTemas = 0;
        this.timersCorrector = new WeakMap();
        this.sugerenciasPorElemento = new WeakMap();
        this.init();
    }

    async init() {
        console.log('[DIRECTORIO] Iniciando sistema...');

        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        await this.cargarDatos();

        if (this.editId) {
            await this.cargarEventoParaEditar();
        } else {
            this.inicializarFechaHora();
            await this.sugerirNumeroActa();
            this.agregarTema();
        }

        this.renderizarOficiales();

        if (this.editId) {
            this.marcarSeleccionPrevia();
            this.actualizarEstadisticas();
        }

        console.log('[DIRECTORIO]  Sistema inicializado');
    }

    // ==================== CORRECTOR ORTOGRÁFICO (LanguageTool) ====================

    onCambioTextoCorrector(textareaEl) {
        clearTimeout(this.timersCorrector.get(textareaEl));
        const contenedor = textareaEl.nextElementSibling;
        const estadoEl = contenedor?.querySelector('.redaccion-estado');
        if (estadoEl) estadoEl.textContent = 'Revisando redacción...';
        this.timersCorrector.set(textareaEl, setTimeout(() => this.revisarRedaccionElemento(textareaEl), 1200));
    }

    async revisarRedaccionElemento(textareaEl) {
        const contenedor = textareaEl.nextElementSibling;
        const estadoEl = contenedor?.querySelector('.redaccion-estado');
        const listaEl = contenedor?.querySelector('.lista-sugerencias');
        if (!estadoEl || !listaEl) return;

        const texto = textareaEl.value;
        if (!texto.trim()) {
            estadoEl.textContent = '';
            listaEl.innerHTML = '';
            this.sugerenciasPorElemento.set(textareaEl, []);
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
            const matches = data.matches || [];
            this.sugerenciasPorElemento.set(textareaEl, matches);

            if (matches.length === 0) {
                estadoEl.textContent = 'Sin observaciones de redacción.';
                listaEl.innerHTML = '';
                return;
            }

            estadoEl.textContent = `${matches.length} observación(es) de redacción:`;
            listaEl.innerHTML = matches.map((m, idx) => {
                const original = texto.substring(m.offset, m.offset + m.length);
                const sugerencias = (m.replacements || []).slice(0, 3);
                return `
                    <div class="sugerencia-item">
                        <div class="sugerencia-mensaje">${this.escapeHtml(m.message)}: <span class="sugerencia-original">${this.escapeHtml(original)}</span></div>
                        <div class="sugerencia-botones">
                            ${sugerencias.map((s) => `<button type="button" class="btn-sugerencia" onclick="directorioSistema.aplicarSugerenciaElemento(this, ${idx}, '${this.escapeAttr(s.value)}')">${this.escapeHtml(s.value)}</button>`).join('')}
                            <button type="button" class="btn-ignorar-sugerencia" onclick="directorioSistema.ignorarSugerenciaElemento(this)">Ignorar</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('[DIRECTORIO] Error revisando redacción:', error);
            estadoEl.textContent = 'No se pudo revisar la redacción en este momento (el corrector externo no respondió).';
        }
    }

    aplicarSugerenciaElemento(botonEl, idx, reemplazo) {
        const contenedor = botonEl.closest('.corrector-wrap');
        const textareaEl = contenedor?.previousElementSibling;
        if (!textareaEl) return;

        const matches = this.sugerenciasPorElemento.get(textareaEl) || [];
        const match = matches[idx];
        if (!match) return;

        const texto = textareaEl.value;
        textareaEl.value = texto.substring(0, match.offset) + reemplazo + texto.substring(match.offset + match.length);

        clearTimeout(this.timersCorrector.get(textareaEl));
        this.revisarRedaccionElemento(textareaEl);
    }

    ignorarSugerenciaElemento(botonEl) {
        const item = botonEl.closest('.sugerencia-item');
        const listaEl = botonEl.closest('.lista-sugerencias');
        if (item) item.remove();

        const estadoEl = listaEl?.previousElementSibling;
        const restantes = listaEl?.querySelectorAll('.sugerencia-item').length || 0;
        if (estadoEl) {
            estadoEl.textContent = restantes > 0
                ? `${restantes} observación(es) de redacción:`
                : 'Sin observaciones de redacción.';
        }
    }

    escapeHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto || '';
        return div.innerHTML;
    }

    escapeAttr(texto) {
        return (texto || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    agregarTema(titulo = '', contenido = '') {
        this.contadorTemas++;
        const id = this.contadorTemas;
        const contenedor = document.getElementById('listaTemas');
        if (!contenedor) return;

        const div = document.createElement('div');
        div.className = 'tema-item';
        div.dataset.temaId = id;
        div.innerHTML = `
            <div class="tema-item-header">
                <strong>Tema ${contenedor.children.length + 1}</strong>
                <button type="button" class="btn-quitar-tema" onclick="directorioSistema.quitarTema(${id})">✕ Quitar</button>
            </div>
            <input type="text" class="tema-titulo" placeholder="Título del tema">
            <textarea class="tema-contenido" spellcheck="true" lang="es" placeholder="Detalle / acuerdo tomado..." oninput="directorioSistema.onCambioTextoCorrector(this)"></textarea>
            <div class="corrector-wrap">
                <div class="redaccion-estado"></div>
                <div class="lista-sugerencias"></div>
            </div>
        `;
        div.querySelector('.tema-titulo').value = titulo;
        div.querySelector('.tema-contenido').value = contenido;
        contenedor.appendChild(div);
    }

    quitarTema(id) {
        const div = document.querySelector(`.tema-item[data-tema-id="${id}"]`);
        if (div) div.remove();
        this.renumerarTemas();
    }

    renumerarTemas() {
        const items = document.querySelectorAll('#listaTemas .tema-item');
        items.forEach((item, index) => {
            const titulo = item.querySelector('.tema-item-header strong');
            if (titulo) titulo.textContent = `Tema ${index + 1}`;
        });
    }

    obtenerTemas() {
        const items = document.querySelectorAll('#listaTemas .tema-item');
        const temas = [];
        items.forEach(item => {
            const titulo = item.querySelector('.tema-titulo')?.value.trim() || '';
            const contenido = item.querySelector('.tema-contenido')?.value.trim() || '';
            if (titulo || contenido) {
                temas.push({ titulo, contenido });
            }
        });
        return temas;
    }

    async sugerirNumeroActa() {
        try {
            const anioActual = new Date().getFullYear();
            const resp = await fetch(`/api/eventos-asistencia/?tipo=directorio`, { credentials: 'include' });
            if (!resp.ok) return;
            const data = await resp.json();
            const eventos = Array.isArray(data) ? data : (data.results || []);

            let maxNumero = 0;
            eventos.forEach(ev => {
                if (!ev.numero_acta) return;
                const match = ev.numero_acta.match(/^(\d+)\/(\d{4})$/);
                if (match && parseInt(match[2]) === anioActual) {
                    maxNumero = Math.max(maxNumero, parseInt(match[1]));
                }
            });

            const siguienteNumero = String(maxNumero + 1).padStart(3, '0');
            const input = document.getElementById('numeroActa');
            if (input) input.value = `${siguienteNumero}/${anioActual}`;
        } catch (error) {
            console.error('[DIRECTORIO] No se pudo sugerir el número de acta:', error);
        }
    }

    async cargarEventoParaEditar() {
        try {
            const respEvento = await fetch(`/api/eventos-asistencia/${this.editId}/`, {
                credentials: 'include'
            });
            if (!respEvento.ok) throw new Error('No se pudo cargar el evento');
            const evento = await respEvento.json();

            const fechaInput = document.getElementById('fechaDirectorio');
            const horaInicioInput = document.getElementById('horaInicio');
            const horaTerminoInput = document.getElementById('horaTermino');
            const observacionesInput = document.getElementById('observaciones');
            const numeroActaInput = document.getElementById('numeroActa');

            if (fechaInput && evento.fecha) fechaInput.value = evento.fecha;
            if (horaInicioInput && evento.hora_inicio) horaInicioInput.value = evento.hora_inicio.slice(0, 5);
            if (horaTerminoInput && evento.hora_termino) horaTerminoInput.value = evento.hora_termino.slice(0, 5);
            if (observacionesInput) observacionesInput.value = evento.observaciones || '';
            if (numeroActaInput) numeroActaInput.value = evento.numero_acta || '';

            const temas = Array.isArray(evento.temas) ? evento.temas : [];
            if (temas.length > 0) {
                temas.forEach(t => this.agregarTema(t.titulo || '', t.contenido || ''));
            } else {
                this.agregarTema();
            }

            const respDetalles = await fetch(`/api/detalles-asistencia/?evento=${this.editId}`, {
                credentials: 'include'
            });
            if (respDetalles.ok) {
                const dataDetalles = await respDetalles.json();
                const detalles = Array.isArray(dataDetalles) ? dataDetalles : (dataDetalles.results || []);
                this.voluntariosSeleccionadosPrevios = detalles.map(d => d.voluntario).filter(id => id !== null && id !== undefined);
            }

            const btnGuardar = document.querySelector('.btn-success.btn-lg');
            if (btnGuardar) btnGuardar.textContent = ' Guardar Cambios';
            const titulo = document.querySelector('.asistencias-header h2');
            if (titulo) titulo.textContent = titulo.textContent.replace('REGISTRO DE DIRECTORIO', 'EDITAR DIRECTORIO');
        } catch (error) {
            console.error('[DIRECTORIO] Error cargando evento para editar:', error);
            Utils.mostrarNotificacion('No se pudo cargar la información del directorio a editar', 'error');
        }
    }

    marcarSeleccionPrevia() {
        if (!this.voluntariosSeleccionadosPrevios.length) return;
        const checkboxes = document.querySelectorAll('.voluntarios-lista input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const id = parseInt(cb.dataset.id);
            if (this.voluntariosSeleccionadosPrevios.includes(id)) cb.checked = true;
        });
    }

    async cargarDatos() {
        try {
            const response = await fetch('/api/voluntarios/lista-activos-simple/');

            if (response.ok) {
                const data = await response.json();
                this.bomberos = Array.isArray(data) ? data : (data.results || []);
                console.log('[DIRECTORIO] Voluntarios cargados:', this.bomberos.length);
            }

            const responseCargos = await fetch('/api/cargos/?vigente=true', {
                credentials: 'include'
            });

            if (responseCargos.ok) {
                const dataCargos = await responseCargos.json();
                const cargos = Array.isArray(dataCargos) ? dataCargos : (dataCargos.results || []);
                
                cargos.forEach(cargo => {
                    this.cargosVigentes[cargo.voluntario] = cargo;
                });
                
                console.log('[DIRECTORIO] Cargos vigentes cargados:', Object.keys(this.cargosVigentes).length);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    inicializarFechaHora() {
        const fechaInput = document.getElementById('fechaDirectorio');
        const horaInicioInput = document.getElementById('horaInicio');
        
        if (fechaInput) {
            fechaInput.valueAsDate = new Date();
        }
        
        if (horaInicioInput) {
            const ahora = new Date();
            horaInicioInput.value = ahora.toTimeString().slice(0, 5);
        }
    }

    renderizarOficiales() {
        console.log('[DIRECTORIO] Renderizando oficiales...');
        
        const oficialesCompania = [];
        const cargosConfianza = [];

        for (const bombero of this.bomberos) {
            const cargo = this.cargosVigentes[bombero.id];
            if (!cargo) continue;

            if (this.esCargoOficialCompania(cargo.nombre_cargo)) {
                oficialesCompania.push({ bombero, cargo });
            } else if (this.esCargoConfianza(cargo.nombre_cargo)) {
                cargosConfianza.push({ bombero, cargo });
            }
        }

        const comparar = (a, b) => this.obtenerNombreCompleto(a.bombero).localeCompare(
            this.obtenerNombreCompleto(b.bombero), 'es', { sensitivity: 'base' }
        );
        oficialesCompania.sort(comparar);
        cargosConfianza.sort(comparar);

        console.log('[DIRECTORIO] Oficiales de Compañía:', oficialesCompania.length);
        console.log('[DIRECTORIO] Cargos de Confianza:', cargosConfianza.length);

        this.renderizarCategoria('listaCompania', oficialesCompania);
        this.renderizarCategoria('listaCargosConfianza', cargosConfianza);

        this.actualizarEstadisticas();
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

    renderizarCategoria(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = '<p class="no-data">No hay oficiales con cargos vigentes en esta categoría</p>';
            return;
        }

        let html = '';
        items.forEach(({ bombero, cargo }) => {
            const nombreCompleto = this.obtenerNombreCompleto(bombero);
            const clave = bombero.clave_bombero || bombero.claveBombero || 'N/A';

            html += `
                <label class="voluntario-item">
                    <input type="checkbox" 
                           data-id="${bombero.id}"
                           data-nombre="${nombreCompleto}"
                           data-clave="${clave}"
                           data-cargo="${cargo.nombre_cargo}"
                           onchange="directorioSistema.onCheckboxChange()">
                    <span class="voluntario-nombre">${nombreCompleto}</span>
                    <span class="voluntario-cargo">${cargo.nombre_cargo}</span>
                </label>
            `;
        });

        container.innerHTML = html;
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

    onCheckboxChange() {
        this.actualizarEstadisticas();
    }

    seleccionarTodos(categoria) {
        const containerMap = {
            'compania': 'listaCompania',
            'confianza': 'listaCargosConfianza'
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
            'compania': 'listaCompania',
            'confianza': 'listaCargosConfianza'
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
        const totalOficiales = document.querySelectorAll('.voluntarios-lista input[type="checkbox"]').length;
        const asistentes = checkboxes.length;
        const porcentaje = totalOficiales > 0 ? ((asistentes / totalOficiales) * 100).toFixed(1) : 0;

        document.getElementById('totalPersonas').textContent = totalOficiales;
        document.getElementById('asistentesSeleccionados').textContent = asistentes;
        document.getElementById('porcentajeAsistencia').textContent = `${porcentaje}%`;

        // Resumen
        let compania = 0;
        let confianza = 0;

        checkboxes.forEach(cb => {
            const cargo = cb.dataset.cargo;
            if (this.esCargoOficialCompania(cargo)) {
                compania++;
            } else if (this.esCargoConfianza(cargo)) {
                confianza++;
            }
        });

        document.getElementById('resumenTotal').textContent = asistentes;
        document.getElementById('resumenCompania').textContent = compania;
        document.getElementById('resumenConfianza').textContent = confianza;
    }

    async guardarRegistro() {
        try {
            console.log('[DIRECTORIO] Guardando registro...');

            const checkboxes = document.querySelectorAll('.voluntarios-lista input[type="checkbox"]:checked');
            
            if (checkboxes.length === 0) {
                Utils.mostrarNotificacion('Debe seleccionar al menos un asistente', 'error');
                return;
            }

            const fecha = document.getElementById('fechaDirectorio')?.value;
            const horaInicio = document.getElementById('horaInicio')?.value;
            const horaTermino = document.getElementById('horaTermino')?.value;
            const observaciones = document.getElementById('observaciones')?.value || '';
            const numeroActa = document.getElementById('numeroActa')?.value || '';

            if (!fecha || !horaInicio || !horaTermino) {
                Utils.mostrarNotificacion('Complete todos los campos obligatorios', 'error');
                return;
            }

            const eventoData = {
                tipo: 'directorio',
                fecha: fecha,
                hora_inicio: horaInicio,
                hora_termino: horaTermino,
                descripcion: 'Reunión de Directorio de Compañía',
                total_asistentes: checkboxes.length,
                oficiales_comandancia: 0,
                oficiales_compania: 0,
                cargos_confianza: 0,
                voluntarios: 0,
                participantes: 0,
                canjes: 0,
                porcentaje_asistencia: 0,
                observaciones: observaciones,
                numero_acta: numeroActa,
                temas: this.obtenerTemas(),
                suma_ranking: false  // ← IMPORTANTE: NO SUMA PARA RANKING
            };

            if (!this.editId) {
                eventoData.id_evento = Date.now();
            }

            // Contar por categoría
            checkboxes.forEach(cb => {
                const cargo = cb.dataset.cargo;
                if (this.esCargoOficialCompania(cargo)) {
                    eventoData.oficiales_compania++;
                } else if (this.esCargoConfianza(cargo)) {
                    eventoData.cargos_confianza++;
                }
            });

            eventoData.total_oficiales = eventoData.oficiales_compania;

            console.log('[DIRECTORIO] 📤 Datos a enviar:', eventoData);

            // Guardar evento (crear o actualizar según corresponda)
            const url = this.editId ? `/api/eventos-asistencia/${this.editId}/` : '/api/eventos-asistencia/';
            const metodo = this.editId ? 'PATCH' : 'POST';

            const responseEvento = await fetch(url, {
                method: metodo,
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
            console.log('[DIRECTORIO]  Evento guardado:', eventoGuardado);

            // Si estamos editando, borrar los detalles previos antes de crear los nuevos
            if (this.editId) {
                const respDetallesPrevios = await fetch(`/api/detalles-asistencia/?evento=${this.editId}`, {
                    credentials: 'include'
                });
                if (respDetallesPrevios.ok) {
                    const dataPrevios = await respDetallesPrevios.json();
                    const detallesPrevios = Array.isArray(dataPrevios) ? dataPrevios : (dataPrevios.results || []);
                    for (const detallePrevio of detallesPrevios) {
                        await fetch(`/api/detalles-asistencia/${detallePrevio.id}/`, {
                            method: 'DELETE',
                            headers: { 'X-CSRFToken': getCookie('csrftoken') },
                            credentials: 'include'
                        });
                    }
                }
            }

            // Guardar detalles
            for (const cb of checkboxes) {
                const detalle = {
                    evento: eventoGuardado.id,
                    voluntario: parseInt(cb.dataset.id),
                    nombre_completo: cb.dataset.nombre,
                    clave_bombero: cb.dataset.clave,
                    categoria: 'Oficial',
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

            const mensaje = this.editId ? ' Directorio actualizado exitosamente' : ' Asistencia de directorio registrada exitosamente';
            Utils.mostrarNotificacion(mensaje, 'success');

            setTimeout(() => {
                window.location.href = '/historial-asistencias.html';
            }, 1500);

        } catch (error) {
            console.error('Error:', error);
            Utils.mostrarNotificacion('Error al guardar el registro', 'error');
        }
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

// Inicializar
let directorioSistema;
window.addEventListener('load', function() {
    directorioSistema = new SistemaDirectorio();
});

async function guardarDirectorio() {
    if (directorioSistema) {
        await directorioSistema.guardarRegistro();
    }
}
