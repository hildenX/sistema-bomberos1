// ==================== CONFIGURACIÓN DE PRECIOS DE CUOTAS ====================
const API_BASE = '/api/voluntarios';

class ConfiguracionCuotas {
    constructor() {
        this.init();
    }

    async init() {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }

        // Verificar permisos (solo Tesorero)
        const permisos = getUserPermissions();
        if (!permisos || !permisos.canEditFinanzas) {
            Utils.mostrarNotificacion('No tiene permisos para configurar cuotas', 'error');
            setTimeout(() => window.location.href = 'sistema.html', 2000);
            return;
        }

        await this.cargarConfiguracionActual();
        this.configurarEventos();
        this.actualizarVistaPrevia();
    }

    async cargarConfiguracionActual() {
        try {
            const response = await fetch(`${API_BASE}/configuracion-cuotas-simple/`);
            if (response.ok) {
                const config = await response.json();
                document.getElementById('precioRegular').value = parseFloat(config.precio_regular);
                document.getElementById('precioEstudiante').value = parseFloat(config.precio_estudiante);
                console.log('[CONFIG] Configuración cargada desde DB:', config);
            }
        } catch (error) {
            console.error('[CONFIG] Error cargando configuración:', error);
            // Valores por defecto
            document.getElementById('precioRegular').value = 5000;
            document.getElementById('precioEstudiante').value = 3000;
        }
    }

    configurarEventos() {
        document.getElementById('formConfigCuotas').addEventListener('submit', (e) => {
            this.guardarConfiguracion(e);
        });

        // Actualizar vista previa en tiempo real
        document.getElementById('precioRegular').addEventListener('input', () => {
            this.actualizarVistaPrevia();
        });

        document.getElementById('precioEstudiante').addEventListener('input', () => {
            this.actualizarVistaPrevia();
        });
    }

    actualizarVistaPrevia() {
        const precioRegular = parseInt(document.getElementById('precioRegular').value) || 5000;
        const precioEstudiante = parseInt(document.getElementById('precioEstudiante').value) || 3000;

        const formatearPrecio = (precio) => {
            return new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0
            }).format(precio);
        };

        document.getElementById('previewRegular').textContent = 
            `Cuota Regular - ${formatearPrecio(precioRegular)}`;
        
        document.getElementById('previewEstudiante').textContent = 
            `Cuota Estudiante - ${formatearPrecio(precioEstudiante)}`;
    }

    async guardarConfiguracion(event) {
        event.preventDefault();

        const precioRegular = parseInt(document.getElementById('precioRegular').value);
        const precioEstudiante = parseInt(document.getElementById('precioEstudiante').value);

        if (precioRegular < 1000) {
            Utils.mostrarNotificacion('El precio regular debe ser al menos $1.000', 'warning');
            return;
        }

        if (precioEstudiante < 0) {
            Utils.mostrarNotificacion('El precio estudiante no puede ser negativo', 'warning');
            return;
        }

        const confirmacionMsg = `¿Está seguro de cambiar los precios de las cuotas?<br><br>` +
            `<strong>Cuota Regular:</strong> $${precioRegular.toLocaleString('es-CL')}<br>` +
            `<strong>Cuota Estudiante:</strong> $${precioEstudiante.toLocaleString('es-CL')}<br><br>` +
            `Los nuevos precios se aplicarán a partir de ahora.`;

        const confirmado = await Utils.confirmarAccion(confirmacionMsg);

        if (confirmado) {
            try {
                const response = await fetch(`${API_BASE}/configuracion-cuotas-simple/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        precio_regular: precioRegular,
                        precio_estudiante: precioEstudiante
                    })
                });

                if (!response.ok) {
                    throw new Error('Error al guardar configuración');
                }

                const result = await response.json();
                console.log('[CONFIG] Configuración guardada:', result);

                Utils.mostrarNotificacion('✅ Configuración de cuotas guardada exitosamente', 'success');
                setTimeout(() => window.location.href = 'sistema.html', 2000);
                
            } catch (error) {
                console.error('[CONFIG] Error:', error);
                Utils.mostrarNotificacion('❌ Error al guardar la configuración', 'error');
            }
        }
    }
}

// Inicializar cuando cargue la página
window.addEventListener('DOMContentLoaded', () => {
    new ConfiguracionCuotas();
});
