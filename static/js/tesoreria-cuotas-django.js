/**
 * TESORERÍA - CUOTAS SOCIALES (DJANGO VERSION)
 * Convierte el sistema localStorage de P6P a API REST Django
 * MANTIENE: Misma UI, mismo CSS, mismas funciones
 * CAMBIA: localStorage → fetch() a API Django
 */

const API_BASE = '/api/voluntarios';

// ==================== UTILIDADES ====================

async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
                ...options.headers
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Error ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error en API:', error);
        throw error;
    }
}

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

function calcularCategoriaBombero(fechaIngreso) {
    if (!fechaIngreso) return 'Voluntario';
    
    const fechaIngresoDate = new Date(fechaIngreso);
    const hoy = new Date();
    const añosServicio = (hoy - fechaIngresoDate) / (365.25 * 24 * 60 * 60 * 1000);
    
    if (añosServicio >= 50) return 'Insigne de 50 Años';
    if (añosServicio >= 25) return 'Insigne de 25 Años';
    if (añosServicio >= 20) return 'Honorario del Cuerpo';
    if (añosServicio >= 5) return 'Honorario de Compañía';
    return 'Voluntario';
}

// ==================== SISTEMA DE CUOTAS ====================

const cuotasSistemaDjango = {
    voluntarioActual: null,
    añoActual: new Date().getFullYear(),
    configuracionCuotas: null,
    estadoCuotas: null,
    
    async init() {
        // Obtener ID del voluntario desde URL
        const params = new URLSearchParams(window.location.search);
        const voluntarioId = params.get('id');
        
        if (!voluntarioId) {
            alert('No se especificó un voluntario');
            window.location.href = '/sistema/';
            return;
        }
        
        try {
            // Cargar datos del voluntario
            await this.cargarVoluntario(voluntarioId);
            
            // Cargar configuración de cuotas
            await this.cargarConfiguracion();
            
            // Cargar estado de cuotas del voluntario
            await this.cargarEstadoCuotas(voluntarioId);
            
            // Verificar exenciones
            if (!await this.verificarPuedeAcceder()) {
                return;
            }
            
            // Renderizar interfaz
            this.renderizarDatosVoluntario();
            await this.cargarGridCuotas();
            
            // Calcular saldo compañía
            await this.actualizarSaldoCompania();
            
            // Inicializar formulario
            this.inicializarFormulario();
            
        } catch (error) {
            console.error('Error al inicializar:', error);
            this.mostrarMensaje('Error al cargar datos: ' + error.message, 'error');
        }
    },
    
    async cargarVoluntario(id) {
        const data = await fetchAPI(`${API_BASE}/${id}/`);
        this.voluntarioActual = data;
    },
    
    async cargarConfiguracion() {
        try {
            const data = await fetchAPI(`${API_BASE}/configuracion-cuotas/`);
            this.configuracionCuotas = data.results?.[0] || data;
        } catch (error) {
            console.log('[CUOTAS] Usando configuración por defecto');
            // Valores por defecto si no existe la configuración
            this.configuracionCuotas = {
                precio_cuota_regular: 5000,
                precio_cuota_estudiante: 3000
            };
        }
    },
    
    async cargarEstadoCuotas(voluntarioId) {
        try {
            const data = await fetchAPI(`${API_BASE}/estado-cuotas/?voluntario_id=${voluntarioId}`);
            this.estadoCuotas = data.results?.[0] || null;
        } catch (error) {
            // Si no existe, está OK (no hay estado especial)
            this.estadoCuotas = null;
        }
    },
    
    async verificarPuedeAcceder() {
        const categoria = calcularCategoriaBombero(this.voluntarioActual.fecha_ingreso);
        const estado = this.voluntarioActual.estado_bombero || 'activo';
        
        // Verificar exenciones automáticas
        const categorias_exentas = ['Honorario del Cuerpo', 'Honorario de Compañía', 'Insigne de 25 Años', 'Insigne de 50 Años'];
        if (categorias_exentas.includes(categoria) || estado === 'martir') {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial; background: #f5f5f5;">
                    <h1 style="color: #f44336; font-size: 72px; margin: 0;">❌</h1>
                    <h2 style="color: #333;">Acceso Denegado</h2>
                    <p style="font-size: 20px; color: #666;">Este voluntario es <strong style="color: #f44336;">${categoria}</strong></p>
                    <p style="font-size: 18px; color: #666;">NO debe pagar cuotas sociales.</p>
                    <p style="color: #999; margin-top: 40px;">Redirigiendo en 3 segundos...</p>
                </div>
            `;
            setTimeout(() => window.location.href = '/sistema/', 3000);
            return false;
        }
        
        // Verificar cuotas desactivadas manualmente
        if (this.estadoCuotas && this.estadoCuotas.cuotas_desactivadas) {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial; background: #f5f5f5;">
                    <h1 style="color: #ff9800; font-size: 72px; margin: 0;">🔕</h1>
                    <h2 style="color: #333;">Cuotas Desactivadas</h2>
                    <p style="font-size: 18px; color: #666;">Motivo: ${this.estadoCuotas.motivo_desactivacion || 'Sin especificar'}</p>
                    <p style="color: #999; margin-top: 40px;">Redirigiendo en 3 segundos...</p>
                </div>
            `;
            setTimeout(() => window.location.href = '/sistema/', 3000);
            return false;
        }
        
        return true;
    },
    
    renderizarDatosVoluntario() {
        const v = this.voluntarioActual;
        const categoria = calcularCategoriaBombero(v.fecha_ingreso);
        const esEstudiante = this.estadoCuotas?.es_estudiante || false;
        
        const html = `
            <div class="info-grid">
                <div class="info-item">
                    <strong>Nombre:</strong>
                    <span>${v.nombre_completo || v.nombre + ' ' + v.apellido_paterno}</span>
                </div>
                <div class="info-item">
                    <strong>Clave:</strong>
                    <span>${v.clave_bombero || 'Sin clave'}</span>
                </div>
                <div class="info-item">
                    <strong>RUT:</strong>
                    <span>${v.rut || 'Sin RUT'}</span>
                </div>
                <div class="info-item">
                    <strong>Categoría:</strong>
                    <span>${categoria}</span>
                </div>
                <div class="info-item">
                    <strong>Estado:</strong>
                    <span class="badge badge-${v.estado_bombero === 'activo' ? 'success' : 'warning'}">${v.estado_bombero || 'Activo'}</span>
                </div>
                <div class="info-item">
                    <strong>Tipo Cuota:</strong>
                    <span class="badge badge-${esEstudiante ? 'info' : 'primary'}">${esEstudiante ? 'Estudiante' : 'Regular'}</span>
                </div>
            </div>
        `;
        
        document.getElementById('bomberoDatosCuotas').innerHTML = html;
    },
    
    async cargarGridCuotas() {
        const añoSelect = document.getElementById('añoGrid');
        if (añoSelect) {
            añoSelect.value = this.añoActual;
        }
        
        try {
            // Obtener deuda del voluntario
            const deudaData = await fetchAPI(`${API_BASE}/pagos-cuotas/deuda/${this.voluntarioActual.id}/?anio=${this.añoActual}`);
            
            // Crear set de meses pagados
            const mesesPagados = new Set();
            if (deudaData.meses_pendientes) {
                // Los meses pendientes son los que NO están pagados
                const mesesPendientes = deudaData.meses_pendientes.map(m => m.mes);
                for (let i = 1; i <= 12; i++) {
                    if (!mesesPendientes.includes(i)) {
                        mesesPagados.add(i);
                    }
                }
            }
            
            // Renderizar grid
            this.renderizarGrid(mesesPagados);
            
            // Actualizar resumen
            const mesesPendientes = deudaData.meses_pendientes?.length || 0;
            const montoPendiente = deudaData.deuda || 0;
            
            document.getElementById('resumenMesesPagados').textContent = mesesPagados.size;
            document.getElementById('resumenMesesPendientes').textContent = mesesPendientes;
            document.getElementById('resumenMontoPendiente').textContent = `$${parseFloat(montoPendiente).toLocaleString('es-CL')}`;
            
        } catch (error) {
            console.error('Error al cargar grid:', error);
            this.mostrarMensaje('Error al cargar grid de cuotas', 'error');
        }
    },
    
    renderizarGrid(mesesPagados) {
        const gridContainer = document.getElementById('gridMesesCuotas');
        if (!gridContainer) return;
        
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const mesActual = new Date().getMonth() + 1;
        const añoActualReal = new Date().getFullYear();
        
        let html = '<div class="grid-meses">';
        
        for (let i = 0; i < 12; i++) {
            const mes = i + 1;
            const estaPagado = mesesPagados.has(mes);
            
            // Si es año actual, deshabilitar meses futuros
            let esFuturo = false;
            if (this.añoActual == añoActualReal && mes > mesActual) {
                esFuturo = true;
            }
            
            let clase = '';
            let icono = '';
            let tooltip = '';
            
            if (esFuturo) {
                clase = 'mes-futuro';
                icono = '🕐';
                tooltip = 'Mes futuro';
            } else if (estaPagado) {
                clase = 'mes-pagado';
                icono = '✅';
                tooltip = 'Pagado';
            } else {
                clase = 'mes-pendiente';
                icono = '❌';
                tooltip = 'Pendiente';
            }
            
            html += `
                <div class="mes-item ${clase}" title="${tooltip}">
                    <div class="mes-icono">${icono}</div>
                    <div class="mes-nombre">${meses[i]}</div>
                    <div class="mes-año">${this.añoActual}</div>
                </div>
            `;
        }
        
        html += '</div>';
        gridContainer.innerHTML = html;
    },
    
    inicializarFormulario() {
        const form = document.getElementById('formCuotaSocial');
        if (!form) return;
        
        // Pre-seleccionar tipo de cuota según estado
        const tipoCuotaSelect = document.getElementById('tipoCuota');
        if (this.estadoCuotas?.es_estudiante) {
            tipoCuotaSelect.value = 'estudiante';
        } else {
            tipoCuotaSelect.value = 'regular';
        }
        
        this.cambioTipoCuota();
        
        // Evento submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.registrarPago();
        });
    },
    
    cambioTipoCuota() {
        const tipoCuota = document.getElementById('tipoCuota').value;
        const montoCuotaInput = document.getElementById('montoCuota');
        
        if (!this.configuracionCuotas) return;
        
        if (tipoCuota === 'estudiante') {
            montoCuotaInput.value = this.configuracionCuotas.precio_estudiante || 3000;
        } else if (tipoCuota === 'regular') {
            montoCuotaInput.value = this.configuracionCuotas.precio_regular || 5000;
        }
    },
    
    async registrarPago() {
        const formData = new FormData(document.getElementById('formCuotaSocial'));
        const mes = parseInt(formData.get('mesCuota'));
        const anio = parseInt(formData.get('anioCuota'));
        const monto = parseFloat(formData.get('montoCuota'));
        
        if (!mes || !anio || !monto) {
            this.mostrarMensaje('Complete todos los campos requeridos', 'error');
            return;
        }
        
        try {
            const data = {
                voluntario_id: this.voluntarioActual.id,
                mes: mes,
                anio: anio,
                monto: monto,
                fecha_pago: formData.get('fechaPago') || new Date().toISOString().split('T')[0],
                metodo_pago: formData.get('metodoPago'),
                numero_comprobante: formData.get('numeroComprobante'),
                observaciones: formData.get('observaciones')
            };
            
            await fetchAPI(`${API_BASE}/pagos-cuotas/`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            this.mostrarMensaje('✅ Pago registrado exitosamente', 'success');
            
            // Recargar grid
            await this.cargarGridCuotas();
            await this.actualizarSaldoCompania();
            
            // Limpiar formulario
            document.getElementById('formCuotaSocial').reset();
            this.cambioTipoCuota();
            
        } catch (error) {
            console.error('Error al registrar pago:', error);
            this.mostrarMensaje('Error al registrar pago: ' + error.message, 'error');
        }
    },
    
    async actualizarSaldoCompania() {
        try {
            const data = await fetchAPI(`${API_BASE}/finanzas/saldo-compania/`);
            
            const saldoElement = document.getElementById('saldoCompania');
            if (saldoElement) {
                saldoElement.textContent = `$${parseFloat(data.saldo || 0).toLocaleString('es-CL')}`;
            }
        } catch (error) {
            console.error('Error al actualizar saldo:', error);
        }
    },
    
    async cambiarAño() {
        const añoSelect = document.getElementById('añoGrid');
        this.añoActual = parseInt(añoSelect.value);
        await this.cargarGridCuotas();
    },
    
    mostrarMensaje(texto, tipo = 'info') {
        const mensaje = document.getElementById('mensajeCuotas');
        if (!mensaje) return;
        
        mensaje.textContent = texto;
        mensaje.className = `mensaje-global mensaje-${tipo}`;
        mensaje.style.display = 'block';
        
        setTimeout(() => {
            mensaje.style.display = 'none';
        }, 5000);
    },
    
    volverAlSistema() {
        window.location.href = '/sistema/';
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    cuotasSistemaDjango.init();
});
