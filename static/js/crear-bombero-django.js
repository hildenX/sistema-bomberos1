// Sistema de Creación de Bomberos - VERSION DJANGO
// Migrado desde crear-bombero.js para usar APIs Django

class CrearBomberoSistema {
    constructor() {
        this.fotoNueva = null;
        this.API_URL = '/api/voluntarios/';
        this.init();
    }

    async init() {
        // Verificar autenticación
        const isAuth = await checkAuth();
        if (!isAuth) {
            window.location.href = '/';
            return;
        }
        
        this.mostrarInfoUsuario();
        this.configurarEventos();
        this.establecerFechaActual();
    }

    mostrarInfoUsuario() {
        const userRoleInfo = document.getElementById('userRoleInfo');
        if (currentUser) {
            userRoleInfo.textContent = `${currentUser.role}: ${currentUser.username}`;
        }
        document.getElementById('logoutBtn').addEventListener('click', () => logout());
    }

    configurarEventos() {
        const form = document.getElementById('formCrearBombero');
        if (form) form.addEventListener('submit', (e) => this.manejarSubmit(e));

        // Formatear RUT mientras se escribe
        const rutInput = document.getElementById('rut');
        if (rutInput) {
            rutInput.addEventListener('input', (e) => {
                e.target.value = this.formatearRUT(e.target.value);
            });
        }
    }

    establecerFechaActual() {
        const fechaIngreso = document.getElementById('fechaIngreso');
        if (fechaIngreso) fechaIngreso.value = new Date().toISOString().split('T')[0];
    }

    // Helper para formatear RUT
    formatearRUT(rut) {
        // Limpiar RUT
        rut = rut.replace(/[^0-9kK]/g, '');
        
        if (rut.length <= 1) return rut;
        
        const dv = rut.slice(-1);
        let cuerpo = rut.slice(0, -1);
        
        // Agregar puntos
        cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        return `${cuerpo}-${dv}`;
    }

    previsualizarFoto(input) {
        const preview = document.getElementById('previewFoto');
        
        if (!input.files || !input.files[0]) {
            if (preview) preview.innerHTML = '';
            this.fotoNueva = null;
            return;
        }

        const file = input.files[0];
        
        // Validar tamaño (5MB máximo)
        if (file.size > 5 * 1024 * 1024) {
            this.mostrarNotificacion('La foto no debe superar 5MB', 'error');
            input.value = '';
            if (preview) preview.innerHTML = '';
            this.fotoNueva = null;
            return;
        }

        // Validar que sea imagen
        if (!file.type.startsWith('image/')) {
            this.mostrarNotificacion('Solo se permiten archivos de imagen', 'error');
            input.value = '';
            if (preview) preview.innerHTML = '';
            this.fotoNueva = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.fotoNueva = e.target.result;
            
            // Solo mostrar preview si el elemento existe
            if (preview) {
                preview.style.display = 'block';
                preview.innerHTML = `
                    <div style="text-align: center; margin-top: 10px;">
                        <img src="${e.target.result}" alt="Vista previa" 
                             style="max-width: 150px; max-height: 150px; border-radius: 10px; border: 2px solid #4caf50; object-fit: cover;">
                        <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">✅ Foto cargada - Se guardará al crear</p>
                    </div>
                `;
            }
            
            console.log('[FOTO] Nueva foto cargada correctamente');
        };
        reader.readAsDataURL(file);
    }

    async manejarSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        // Convertir FormData a objeto
        const datos = {};
        formData.forEach((value, key) => {
            datos[key] = value;
        });

        // Validar campos obligatorios
        if (!datos.primerNombre || !datos.primerApellido || !datos.segundoApellido || !datos.rut) {
            this.mostrarNotificacion('Primer nombre, apellidos y RUT son obligatorios', 'error');
            return;
        }

        if (!datos.nombrePrimerPadrino || !datos.nombreSegundoPadrino) {
            this.mostrarNotificacion('Los dos padrinos son obligatorios', 'error');
            return;
        }

        // Preparar datos para enviar a Django
        const voluntarioData = {
            // Nombres (compatibilidad con p6p)
            primerNombre: datos.primerNombre,
            segundoNombre: datos.segundoNombre || '',
            tercerNombre: datos.tercerNombre || '',
            primerApellido: datos.primerApellido,
            segundoApellido: datos.segundoApellido,
            
            // Padrinos
            nombrePrimerPadrino: datos.nombrePrimerPadrino,
            nombreSegundoPadrino: datos.nombreSegundoPadrino,
            
            // Datos personales
            rut: datos.rut,
            fechaNacimiento: datos.fechaNacimiento,
            profesion: datos.profesion || '',
            domicilio: datos.domicilio || '',
            telefono: datos.telefono || '',
            email: datos.email || '',
            grupoSanguineo: datos.grupoSanguineo || '',
            
            // Datos bomberiles
            claveBombero: datos.claveBombero,
            nroRegistro: datos.nroRegistro || '',
            fechaIngreso: datos.fechaIngreso,
            compania: datos.compania || '',
            estadoBombero: datos.estadoBombero || 'activo',
            
            // Campos opcionales
            otrosCuerpos: datos.otrosCuerpos || '',
            companiaOpcional: datos.companiaOpcional || '',
            desde: datos.desde || '',
            hasta: datos.hasta || '',
            
            // Foto (base64)
            foto: this.fotoNueva,
            
            // Campos condicionales según estado
            fechaMartirio: datos.fechaMartirio || null,
            lugarMartirio: datos.lugarMartirio || null,
            circunstanciasMartirio: datos.circunstanciasMartirio || null,
            fechaFallecimiento: datos.fechaFallecimiento || null,
            causaFallecimiento: datos.causaFallecimiento || null,
            fechaSeparacion: datos.fechaSeparacion || null,
            aniosSeparacion: datos.aniosSeparacion ? parseInt(datos.aniosSeparacion) : null,
            fechaFinSeparacion: datos.fechaFinSeparacion || null,
            fechaRenuncia: datos.fechaRenuncia || null,
            motivoRenuncia: datos.motivoRenuncia || null,
            fechaExpulsion: datos.fechaExpulsion || null,
            motivoExpulsion: datos.motivoExpulsion || null,
        };

        try {
            // Enviar a la API Django
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(voluntarioData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Error del servidor:', errorData);
                
                // Mostrar todos los errores
                let mensaje = 'Error al crear voluntario:\n';
                if (errorData.detail) {
                    mensaje += errorData.detail;
                } else if (typeof errorData === 'object') {
                    // Mostrar errores de campos
                    Object.keys(errorData).forEach(campo => {
                        mensaje += `\n- ${campo}: ${errorData[campo]}`;
                    });
                } else {
                    mensaje += 'Error desconocido';
                }
                
                throw new Error(mensaje);
            }

            const result = await response.json();
            
            this.mostrarNotificacion('✅ Bombero registrado exitosamente', 'success');
            
            // Volver al sistema después de 1.5 segundos
            setTimeout(() => this.volver(), 1500);
            
        } catch (error) {
            console.error('❌ Error:', error);
            this.mostrarNotificacion('Error al crear: ' + error.message, 'error');
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

    mostrarNotificacion(mensaje, tipo) {
        // Crear elemento de notificación
        const notif = document.createElement('div');
        notif.className = `notification ${tipo}`;
        notif.textContent = mensaje;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${tipo === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notif);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    limpiarFormulario() {
        document.getElementById('formCrearBombero').reset();
        document.getElementById('previewFoto').innerHTML = '';
        this.fotoNueva = null;
        this.establecerFechaActual();
    }

    volver() {
        window.location.href = '/sistema.html';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.crearBomberoSistema = new CrearBomberoSistema();
});

// Función global para preview de foto (llamada desde HTML)
function previsualizarFoto(input) {
    if (window.crearBomberoSistema) {
        window.crearBomberoSistema.previsualizarFoto(input);
    }
}
