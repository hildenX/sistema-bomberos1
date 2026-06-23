// Sistema de Edición de Bomberos - VERSION DJANGO
// Migrado desde editar-bombero.js para usar APIs Django

class EditarBomberoSistema {
    constructor() {
        this.bomberoActual = null;
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
        await this.cargarBombero();
    }

    mostrarInfoUsuario() {
        const userRoleInfo = document.getElementById('userRoleInfo');
        if (currentUser) {
            userRoleInfo.textContent = `${currentUser.role}: ${currentUser.username}`;
        }
        document.getElementById('logoutBtn').addEventListener('click', () => logout());
    }

    configurarEventos() {
        const form = document.getElementById('formEditarBombero');
        if (form) form.addEventListener('submit', (e) => this.manejarSubmit(e));

        // Formatear RUT mientras se escribe
        const rutInput = document.getElementById('rut');
        if (rutInput) {
            rutInput.addEventListener('input', (e) => {
                e.target.value = this.formatearRUT(e.target.value);
            });
        }
    }

    // Helper para formatear RUT
    formatearRUT(rut) {
        rut = rut.replace(/[^0-9kK]/g, '');
        if (rut.length <= 1) return rut;
        const dv = rut.slice(-1);
        let cuerpo = rut.slice(0, -1);
        cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${cuerpo}-${dv}`;
    }

    async cargarBombero() {
        // Obtener ID del voluntario desde localStorage temporal
        const bomberoId = localStorage.getItem('bomberoEditarActual');
        
        if (!bomberoId) {
            this.mostrarNotificacion('No se ha seleccionado ningún bombero para editar', 'error');
            setTimeout(() => this.volver(), 2000);
            return;
        }

        try {
            // Llamar a la API para obtener el voluntario
            const response = await fetch(`${this.API_URL}${bomberoId}/`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Bombero no encontrado');
            }

            this.bomberoActual = await response.json();
            this.mostrarInfoActual();
            this.llenarFormulario();

        } catch (error) {
            console.error('Error al cargar bombero:', error);
            this.mostrarNotificacion('Bombero no encontrado', 'error');
            setTimeout(() => this.volver(), 2000);
        }
    }

    mostrarInfoActual() {
        const contenedor = document.getElementById('infoBomberoActual');
        
        // Calcular edad y antigüedad (usar datos del backend)
        const edad = this.bomberoActual.edad || this.calcularEdad(this.bomberoActual.fechaNacimiento);
        const antiguedad = this.bomberoActual.antiguedad || { años: 0, meses: 0 };

        contenedor.innerHTML = `
            <div><strong>Nombre:</strong> ${this.bomberoActual.primerNombre} ${this.bomberoActual.primerApellido}</div>
            <div><strong>Clave:</strong> ${this.bomberoActual.claveBombero}</div>
            <div><strong>RUT:</strong> ${this.bomberoActual.rut}</div>
            <div><strong>Edad:</strong> ${edad} años</div>
            <div><strong>Compañía:</strong> ${this.bomberoActual.compania || 'No especificada'}</div>
            <div><strong>Antigüedad:</strong> ${antiguedad.años || 0} años, ${antiguedad.meses || 0} meses</div>
        `;

        const fotoPreview = document.getElementById('fotoActualPreview');
        if (this.bomberoActual.foto) {
            fotoPreview.innerHTML = `
                <p style="font-weight: 600; color: #666; margin-bottom: 10px;">📸 Foto Actual:</p>
                <img src="${this.bomberoActual.foto}" alt="Foto actual" style="max-width: 200px; border-radius: 10px;">
            `;
        } else {
            fotoPreview.innerHTML = `<p style="color: #999;">Sin foto registrada</p>`;
        }
    }

    calcularEdad(fechaNacimiento) {
        if (!fechaNacimiento) return 0;
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    }

    llenarFormulario() {
        document.getElementById('idBombero').value = this.bomberoActual.id;
        document.getElementById('claveBombero').value = this.bomberoActual.claveBombero || '';
        
        // Campos de nombre
        document.getElementById('primerNombre').value = this.bomberoActual.primerNombre || '';
        document.getElementById('segundoNombre').value = this.bomberoActual.segundoNombre || '';
        document.getElementById('tercerNombre').value = this.bomberoActual.tercerNombre || '';
        document.getElementById('primerApellido').value = this.bomberoActual.primerApellido || '';
        document.getElementById('segundoApellido').value = this.bomberoActual.segundoApellido || '';
        
        // Padrinos
        document.getElementById('nombrePrimerPadrino').value = this.bomberoActual.nombrePrimerPadrino || '';
        document.getElementById('nombreSegundoPadrino').value = this.bomberoActual.nombreSegundoPadrino || '';
        
        // Resto de campos
        document.getElementById('fechaNacimiento').value = this.bomberoActual.fechaNacimiento || '';
        document.getElementById('rut').value = this.bomberoActual.rut || '';
        document.getElementById('profesion').value = this.bomberoActual.profesion || '';
        document.getElementById('domicilio').value = this.bomberoActual.domicilio || '';
        document.getElementById('nroRegistro').value = this.bomberoActual.nroRegistro || '';
        document.getElementById('fechaIngreso').value = this.bomberoActual.fechaIngreso || '';
        document.getElementById('compania').value = this.bomberoActual.compania || '';
        document.getElementById('grupoSanguineo').value = this.bomberoActual.grupoSanguineo || '';
        document.getElementById('estadoBombero').value = this.bomberoActual.estadoBombero || 'activo';
        // FORZAR que el select de estado NO esté deshabilitado (permitir cambiar desde cualquier estado)
        document.getElementById('estadoBombero').disabled = false;
        document.getElementById('telefono').value = this.bomberoActual.telefono || '';
        document.getElementById('email').value = this.bomberoActual.email || '';
        document.getElementById('otrosCuerpos').value = this.bomberoActual.otrosCuerpos || '';
        document.getElementById('companiaOpcional').value = this.bomberoActual.companiaOpcional || '';
        document.getElementById('desde').value = this.bomberoActual.desde || '';
        document.getElementById('hasta').value = this.bomberoActual.hasta || '';
        
        // Campos condicionales según estado
        const estadoBombero = this.bomberoActual.estadoBombero || 'activo';
        
        if (estadoBombero === 'martir') {
            document.getElementById('fechaMartirio').value = this.bomberoActual.fechaMartirio || '';
            document.getElementById('lugarMartirio').value = this.bomberoActual.lugarMartirio || '';
            document.getElementById('circunstanciasMartirio').value = this.bomberoActual.circunstanciasMartirio || '';
        }
        
        if (estadoBombero === 'fallecido') {
            document.getElementById('fechaFallecimiento').value = this.bomberoActual.fechaFallecimiento || '';
            document.getElementById('causaFallecimiento').value = this.bomberoActual.causaFallecimiento || '';
        }
        
        if (estadoBombero === 'separado') {
            document.getElementById('fechaSeparacion').value = this.bomberoActual.fechaSeparacion || '';
            document.getElementById('aniosSeparacion').value = this.bomberoActual.aniosSeparacion || '';
            document.getElementById('fechaFinSeparacion').value = this.bomberoActual.fechaFinSeparacion || '';
        }
        
        if (estadoBombero === 'renunciado') {
            document.getElementById('fechaRenuncia').value = this.bomberoActual.fechaRenuncia || '';
            document.getElementById('motivoRenuncia').value = this.bomberoActual.motivoRenuncia || '';
        }
        
        if (estadoBombero === 'expulsado') {
            document.getElementById('fechaExpulsion').value = this.bomberoActual.fechaExpulsion || '';
            document.getElementById('motivoExpulsion').value = this.bomberoActual.motivoExpulsion || '';
        }
        
        // Llamar a función global para mostrar campos correctos
        if (typeof mostrarCamposEstado === 'function') {
            mostrarCamposEstado();
        }
    }

    previsualizarFoto(input) {
        const preview = document.getElementById('previewFoto');
        
        if (!input.files || !input.files[0]) {
            if (preview) preview.innerHTML = '';
            this.fotoNueva = null;
            return;
        }

        const file = input.files[0];
        
        if (file.size > 5 * 1024 * 1024) {
            this.mostrarNotificacion('La foto no debe superar 5MB', 'error');
            input.value = '';
            if (preview) preview.innerHTML = '';
            this.fotoNueva = null;
            return;
        }

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
                        <p style="font-weight: 600; color: #ff9800; margin-bottom: 10px;">📸 Nueva Foto (Vista Previa):</p>
                        <img src="${e.target.result}" alt="Vista previa" 
                             style="max-width: 200px; max-height: 200px; border-radius: 10px; border: 3px solid #ff9800; object-fit: cover;">
                        <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">✅ Nueva foto cargada - Se guardará al actualizar</p>
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
        
        const datos = {};
        formData.forEach((value, key) => {
            datos[key] = value;
        });

        // Validaciones
        if (!datos.primerNombre || !datos.primerApellido || !datos.segundoApellido || !datos.rut) {
            this.mostrarNotificacion('Primer nombre, apellidos y RUT son obligatorios', 'error');
            return;
        }

        if (!datos.nombrePrimerPadrino || !datos.nombreSegundoPadrino) {
            this.mostrarNotificacion('Los dos padrinos son obligatorios', 'error');
            return;
        }

        // Preparar datos para Django (misma estructura que crear)
        const voluntarioData = {
            primerNombre: datos.primerNombre,
            segundoNombre: datos.segundoNombre || '',
            tercerNombre: datos.tercerNombre || '',
            primerApellido: datos.primerApellido,
            segundoApellido: datos.segundoApellido,
            nombrePrimerPadrino: datos.nombrePrimerPadrino,
            nombreSegundoPadrino: datos.nombreSegundoPadrino,
            rut: datos.rut,
            fechaNacimiento: datos.fechaNacimiento,
            profesion: datos.profesion || '',
            domicilio: datos.domicilio || '',
            telefono: datos.telefono || '',
            email: datos.email || '',
            grupoSanguineo: datos.grupoSanguineo || '',
            claveBombero: datos.claveBombero,
            nroRegistro: datos.nroRegistro || '',
            fechaIngreso: datos.fechaIngreso,
            compania: datos.compania || '',
            estadoBombero: datos.estadoBombero || 'activo',
            otrosCuerpos: datos.otrosCuerpos || '',
            companiaOpcional: datos.companiaOpcional || '',
            desde: datos.desde || '',
            hasta: datos.hasta || '',
            // NO incluir foto aquí - se agrega después solo si existe
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
        
        // Solo agregar foto si hay una nueva Y es base64 válido
        if (this.fotoNueva && this.fotoNueva.startsWith('data:image')) {
            voluntarioData.foto = this.fotoNueva;
            console.log('[EDITAR] Incluyendo nueva foto');
        } else {
            console.log('[EDITAR] Sin foto nueva - se mantendrá la actual');
        }

        console.log('[EDITAR] Enviando datos:', {
            ...voluntarioData,
            foto: voluntarioData.foto ? '(base64 imagen)' : 'SIN FOTO'
        });

        try {
            const response = await fetch(`${this.API_URL}${this.bomberoActual.id}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(voluntarioData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[ERROR SERVIDOR]', errorData);
                
                // Mostrar todos los errores de validación
                let errorMsg = 'Error al actualizar voluntario:\n';
                if (errorData.detail) {
                    errorMsg += errorData.detail;
                } else {
                    // Si hay errores de campo específicos
                    for (const [field, errors] of Object.entries(errorData)) {
                        errorMsg += `\n- ${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`;
                    }
                }
                
                throw new Error(errorMsg);
            }

            const result = await response.json();
            
            this.mostrarNotificacion('✅ Bombero actualizado exitosamente', 'success');
            setTimeout(() => this.volver(), 1500);
            
        } catch (error) {
            console.error('❌ Error:', error);
            this.mostrarNotificacion('Error al actualizar: ' + error.message, 'error');
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
        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }

    volver() {
        localStorage.removeItem('bomberoEditarActual');
        window.location.href = '/sistema.html';
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.editarBomberoSistema = new EditarBomberoSistema();
});

// Función global para preview de foto
function previsualizarFoto(input) {
    if (window.editarBomberoSistema) {
        window.editarBomberoSistema.previsualizarFoto(input);
    }
}
