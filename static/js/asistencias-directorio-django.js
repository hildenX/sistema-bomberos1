// ==================== SISTEMA DE DIRECTORIO - DJANGO ====================
// Solo para oficiales y cargos de confianza
console.log('🚀 [DIRECTORIO] Cargando asistencias-directorio-django.js');

class SistemaDirectorio {
    constructor() {
        this.bomberos = [];
        this.cargosVigentes = {};
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
        this.inicializarFechaHora();
        this.renderizarOficiales();
        
        console.log('[DIRECTORIO] ✅ Sistema inicializado');
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

            if (!fecha || !horaInicio || !horaTermino) {
                Utils.mostrarNotificacion('Complete todos los campos obligatorios', 'error');
                return;
            }

            const eventoData = {
                id_evento: Date.now(),
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
                suma_ranking: false  // ← IMPORTANTE: NO SUMA PARA RANKING
            };

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
            console.log('[DIRECTORIO] ✅ Evento guardado:', eventoGuardado);

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

            Utils.mostrarNotificacion('✅ Asistencia de directorio registrada exitosamente', 'success');
            
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
