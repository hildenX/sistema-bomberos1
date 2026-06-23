// ==================== SISTEMA DE REINTEGRACIÓN - VERSION DJANGO ====================
class SistemaReintegracion {
    constructor() {
        this.bomberoActual = null;
        this.voluntariosElegibles = [];
        this.API_URL = '/api/';
        this.init();
    }

    async init() {
        // Verificar autenticación
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        // Cargar voluntarios elegibles
        await this.cargarVoluntariosElegibles();
        
        // Configurar formulario
        this.configurarFormulario();
        
        // Renderizar lista
        this.renderizarListaElegibles();
    }

    async cargarVoluntariosElegibles() {
        try {
            const response = await fetch(`${this.API_URL}reintegros/elegibles/`, {
                credentials: 'include'
            });

            if (response.ok) {
                this.voluntariosElegibles = await response.json();
                console.log('[REINTEGRO] Voluntarios elegibles:', this.voluntariosElegibles.length);
            } else {
                this.voluntariosElegibles = [];
            }
        } catch (error) {
            console.error('Error al cargar voluntarios elegibles:', error);
            this.voluntariosElegibles = [];
        }
    }

    renderizarListaElegibles() {
        const container = document.getElementById('listaVoluntariosElegibles');
        if (!container) return;

        if (this.voluntariosElegibles.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <p>📋 No hay voluntarios elegibles para reintegro en este momento</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.voluntariosElegibles.map(vol => {
            const estadoBadge = this.obtenerBadgeEstado(vol.estado);
            const elegibilidadBadge = vol.puede_reintegrarse 
                ? '<span style="color: #4caf50; font-weight: 600;">✅ Elegible</span>'
                : '<span style="color: #f44336; font-weight: 600;">❌ No Elegible</span>';
            
            return `
                <div class="voluntario-card ${vol.puede_reintegrarse ? 'elegible' : 'no-elegible'}" 
                     style="border: 2px solid ${vol.puede_reintegrarse ? '#4caf50' : '#ccc'}; 
                            border-radius: 10px; 
                            padding: 15px; 
                            margin-bottom: 15px;
                            background: ${vol.puede_reintegrarse ? 'rgba(76, 175, 80, 0.05)' : 'rgba(0,0,0,0.02)'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <h4 style="margin: 0; color: #333;">${vol.nombre}</h4>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">
                                Clave: ${vol.clave} | ${estadoBadge}
                            </p>
                        </div>
                        ${elegibilidadBadge}
                    </div>
                    
                    <div style="background: white; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                        <p style="margin: 0; font-size: 0.9rem; color: ${vol.puede_reintegrarse ? '#4caf50' : '#f44336'};">
                            ${vol.mensaje}
                        </p>
                    </div>
                    
                    ${vol.puede_reintegrarse ? `
                        <button class="btn btn-primary" 
                                style="width: 100%;"
                                onclick="sistemaReintegracion.seleccionarVoluntario(${vol.id})">
                            🔄 Iniciar Reintegración
                        </button>
                    ` : `
                        <button class="btn btn-secondary" 
                                style="width: 100%; opacity: 0.6; cursor: not-allowed;"
                                disabled>
                            ⏱️ No Disponible Aún
                        </button>
                    `}
                </div>
            `;
        }).join('');
    }

    obtenerBadgeEstado(estado) {
        const badges = {
            'renunciado': '<span style="background: #ff9800; color: white; padding: 3px 8px; border-radius: 5px; font-size: 0.8rem;">🟠 RENUNCIADO</span>',
            'separado': '<span style="background: #ffeb3b; color: #333; padding: 3px 8px; border-radius: 5px; font-size: 0.8rem;">🟡 SEPARADO</span>',
            'expulsado': '<span style="background: #f44336; color: white; padding: 3px 8px; border-radius: 5px; font-size: 0.8rem;">🔴 EXPULSADO</span>'
        };
        return badges[estado] || estado;
    }

    async seleccionarVoluntario(voluntarioId) {
        try {
            // Cargar datos completos del voluntario
            const response = await fetch(`${this.API_URL}voluntarios/${voluntarioId}/`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('No se pudo cargar el voluntario');
            }

            this.bomberoActual = await response.json();
            
            // Mostrar formulario de reintegro
            this.mostrarFormularioReintegro();
            
        } catch (error) {
            console.error('Error al seleccionar voluntario:', error);
            this.mostrarNotificacion('Error al cargar datos del voluntario', 'error');
        }
    }

    mostrarFormularioReintegro() {
        const seccionFormulario = document.getElementById('seccionFormularioReintegro');
        const infoBombero = document.getElementById('infoBomberoSeleccionado');
        
        if (!seccionFormulario || !infoBombero) return;

        // Mostrar información del bombero
        const estadoBadge = this.obtenerBadgeEstado(this.bomberoActual.estadoBombero);
        infoBombero.innerHTML = `
            <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #1976d2;">
                    👤 Voluntario Seleccionado
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <div>
                        <strong>Nombre:</strong><br>
                        ${this.bomberoActual.nombreCompleto}
                    </div>
                    <div>
                        <strong>Clave:</strong><br>
                        ${this.bomberoActual.claveBombero}
                    </div>
                    <div>
                        <strong>RUT:</strong><br>
                        ${this.bomberoActual.rut}
                    </div>
                    <div>
                        <strong>Estado Actual:</strong><br>
                        ${estadoBadge}
                    </div>
                </div>
            </div>
        `;

        // Mostrar formulario
        seccionFormulario.style.display = 'block';
        
        // Scroll al formulario
        seccionFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    configurarFormulario() {
        const form = document.getElementById('formReintegro');
        if (!form) return;

        form.addEventListener('submit', (e) => this.manejarSubmit(e));
    }

    async manejarSubmit(event) {
        event.preventDefault();

        if (!this.bomberoActual) {
            this.mostrarNotificacion('Debe seleccionar un voluntario', 'error');
            return;
        }

        const formData = new FormData(event.target);
        
        const datos = {
            voluntario: this.bomberoActual.id,
            fecha_reintegro: formData.get('fechaReintegro'),
            motivo_reintegro: formData.get('motivoReintegro'),
            oficio_numero: formData.get('oficioNumero'),
            fecha_oficio: formData.get('fechaOficio')
        };

        console.log('[REINTEGRO] Datos del formulario:', datos);

        // Validaciones
        if (!datos.fecha_reintegro || !datos.motivo_reintegro || !datos.oficio_numero || !datos.fecha_oficio) {
            console.error('[REINTEGRO] Faltan campos:',{
                fecha_reintegro: !!datos.fecha_reintegro,
                motivo_reintegro: !!datos.motivo_reintegro,
                oficio_numero: !!datos.oficio_numero,
                fecha_oficio: !!datos.fecha_oficio
            });
            this.mostrarNotificacion('Debe completar todos los campos obligatorios', 'error');
            return;
        }

        await this.guardarReintegro(datos);
    }

    async guardarReintegro(datos) {
        try {
            console.log('[REINTEGRO] Enviando datos:', datos);

            const response = await fetch(`${this.API_URL}reintegros/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(datos)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[REINTEGRO ERROR]', error);
                
                // Mostrar mensaje de error específico
                let errorMsg = 'Error al registrar reintegro';
                if (error.non_field_errors && error.non_field_errors.length > 0) {
                    errorMsg = error.non_field_errors[0];
                } else if (typeof error === 'object') {
                    errorMsg = Object.values(error).flat().join(', ');
                }
                
                throw new Error(errorMsg);
            }

            const reintegroGuardado = await response.json();
            console.log('[REINTEGRO] Guardado exitosamente:', reintegroGuardado);

            this.mostrarNotificacion('✅ Reintegro registrado exitosamente. El voluntario ha sido reactivado.', 'success');

            // Limpiar formulario y recargar
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Error al guardar reintegro:', error);
            this.mostrarNotificacion(`❌ ${error.message}`, 'error');
        }
    }

    getCookie(name) {
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

    mostrarNotificacion(mensaje, tipo = 'info') {
        const notif = document.getElementById('mensajeReintegracion');
        if (!notif) {
            alert(mensaje);
            return;
        }

        notif.textContent = mensaje;
        notif.className = `mensaje-global ${tipo}`;
        notif.style.display = 'block';

        setTimeout(() => {
            notif.style.display = 'none';
        }, 5000);
    }

    volverAlSistema() {
        window.location.href = '/sistema.html';
    }
}

// Inicializar cuando el DOM esté listo
let sistemaReintegracion;
document.addEventListener('DOMContentLoaded', () => {
    sistemaReintegracion = new SistemaReintegracion();
});
