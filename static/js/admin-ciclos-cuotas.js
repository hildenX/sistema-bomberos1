// ==================== ADMIN CICLOS DE CUOTAS ====================

const API_BASE = '/api/voluntarios/ciclos-cuotas-simple';

// Estado global
let ciclos = [];
let cicloActivo = null;

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    cargarCiclos();
});

// ==================== FUNCIONES PRINCIPALES ====================

async function cargarCiclos() {
    try {
        const response = await fetch(`${API_BASE}/`);
        if (!response.ok) throw new Error('Error al cargar ciclos');
        
        ciclos = await response.json();
        
        // Buscar ciclo activo
        cicloActivo = ciclos.find(c => c.activo);
        
        renderizarCiclos();
        
        if (cicloActivo) {
            cargarEstadisticasCicloActivo(cicloActivo.id);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar los ciclos', 'error');
    }
}

function renderizarCiclos() {
    const container = document.getElementById('listaCiclos');
    
    if (ciclos.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning">
                No hay ciclos registrados. Crea el primer ciclo para comenzar.
            </div>
        `;
        return;
    }
    
    container.innerHTML = ciclos.map(ciclo => `
        <div class="ciclo-card ${ciclo.cerrado ? 'cerrado' : ''}">
            <div class="ciclo-header">
                <div class="ciclo-nombre">Ciclo ${ciclo.anio}</div>
                <div class="badges">
                    ${ciclo.activo ? '<span class="badge badge-activo">ACTIVO</span>' : '<span class="badge badge-inactivo">INACTIVO</span>'}
                    ${ciclo.cerrado ? '<span class="badge badge-cerrado">CERRADO</span>' : ''}
                </div>
            </div>
            
            <div class="ciclo-info">
                <div class="info-item">
                    <div class="info-label">📅 Fecha Inicio</div>
                    <div class="info-value">${formatearFecha(ciclo.fecha_inicio)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">📅 Fecha Fin</div>
                    <div class="info-value">${formatearFecha(ciclo.fecha_fin)}</div>
                </div>
            </div>
            
            ${ciclo.observaciones ? `<p style="margin: 15px 0; color: #666;"><strong>Observaciones:</strong> ${ciclo.observaciones}</p>` : ''}
            
            <div class="ciclo-actions">
                ${!ciclo.activo && !ciclo.cerrado ? 
                    `<button class="btn btn-success" onclick="activarCiclo(${ciclo.id})">
                        ✓ Activar Ciclo
                    </button>` : ''}
                
                ${!ciclo.cerrado ? 
                    `<button class="btn btn-danger" onclick="cerrarCiclo(${ciclo.id})">
                        🔒 Cerrar Ciclo
                    </button>` : 
                    `<button class="btn btn-secondary" onclick="reabrirCiclo(${ciclo.id})">
                        🔓 Reabrir Ciclo
                    </button>`}
                
                <button class="btn btn-primary" onclick="verEstadisticas(${ciclo.id})">
                    📊 Ver Estadísticas
                </button>
            </div>
        </div>
    `).join('');
}

async function cargarEstadisticasCicloActivo(cicloId) {
    try {
        const response = await fetch(`${API_BASE}/${cicloId}/estadisticas/`);
        if (!response.ok) throw new Error('Error al cargar estadísticas');
        
        const stats = await response.json();
        
        // Mostrar dashboard
        document.getElementById('dashboardActivo').style.display = 'block';
        document.getElementById('cicloActivoAnio').textContent = stats.ciclo.anio;
        document.getElementById('statTotalPagos').textContent = stats.total_pagos;
        document.getElementById('statTotalRecaudado').textContent = formatearMonto(stats.total_recaudado);
        document.getElementById('statVoluntariosPagaron').textContent = 
            `${stats.voluntarios_que_pagaron} / ${stats.voluntarios_activos}`;
        document.getElementById('statPorcentaje').textContent = `${stats.porcentaje_cumplimiento}%`;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== ACCIONES DE CICLOS ====================

async function activarCiclo(cicloId) {
    if (!confirm('¿Activar este ciclo? Los demás ciclos se desactivarán automáticamente.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/${cicloId}/activar/`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al activar ciclo');
        }
        
        mostrarAlerta('Ciclo activado exitosamente', 'success');
        await cargarCiclos();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al activar ciclo: ' + error.message, 'error');
    }
}

async function cerrarCiclo(cicloId) {
    if (!confirm('¿Cerrar este ciclo? No se podrán registrar más pagos para este año. Esta acción es reversible.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/${cicloId}/cerrar/`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al cerrar ciclo');
        }
        
        mostrarAlerta('Ciclo cerrado exitosamente', 'success');
        await cargarCiclos();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cerrar ciclo: ' + error.message, 'error');
    }
}

async function reabrirCiclo(cicloId) {
    if (!confirm('¿Reabrir este ciclo? Se permitirán nuevamente registrar pagos para este año.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/${cicloId}/reabrir/`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al reabrir ciclo');
        }
        
        mostrarAlerta('Ciclo reabierto exitosamente', 'success');
        await cargarCiclos();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al reabrir ciclo: ' + error.message, 'error');
    }
}

async function verEstadisticas(cicloId) {
    try {
        const response = await fetch(`${API_BASE}/${cicloId}/estadisticas/`);
        if (!response.ok) throw new Error('Error al cargar estadísticas');
        
        const stats = await response.json();
        
        const mensaje = `
            <div style="text-align: left;">
                <h3 style="color: #c41e3a; margin-bottom: 15px;">Estadísticas Ciclo ${stats.ciclo.anio}</h3>
                
                <p><strong>Total de Pagos:</strong> ${stats.total_pagos}</p>
                <p><strong>Total Recaudado:</strong> ${formatearMonto(stats.total_recaudado)}</p>
                <p><strong>Voluntarios que Pagaron:</strong> ${stats.voluntarios_que_pagaron}</p>
                <p><strong>Voluntarios Activos:</strong> ${stats.voluntarios_activos}</p>
                <p><strong>Porcentaje de Cumplimiento:</strong> ${stats.porcentaje_cumplimiento}%</p>
                
                <div style="margin-top: 20px; padding: 15px; background: ${
                    stats.porcentaje_cumplimiento >= 80 ? '#d4edda' : 
                    stats.porcentaje_cumplimiento >= 50 ? '#fff3cd' : '#f8d7da'
                }; border-radius: 8px;">
                    <strong>Estado:</strong> ${
                        stats.porcentaje_cumplimiento >= 80 ? '✅ Excelente' : 
                        stats.porcentaje_cumplimiento >= 50 ? '⚠️ Regular' : '❌ Bajo'
                    }
                </div>
            </div>
        `;
        
        mostrarAlerta(mensaje, 'info');
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar estadísticas: ' + error.message, 'error');
    }
}

// ==================== MODAL ====================

async function abrirModalNuevoCiclo() {
    const anioActual = new Date().getFullYear();

    document.getElementById('modalTitulo').textContent = 'Crear Nuevo Ciclo';
    document.getElementById('formCiclo').reset();

    // Valores por defecto
    document.getElementById('anio').value = anioActual + 1;
    document.getElementById('fecha_inicio').value = `${anioActual + 1}-01-01`;
    document.getElementById('fecha_fin').value = `${anioActual + 1}-12-31`;
    document.getElementById('activo').checked = false;

    // Pre-llenar precios desde el ciclo activo o configuración
    if (cicloActivo) {
        document.getElementById('precio_cuota_regular').value = cicloActivo.precio_cuota_regular;
        document.getElementById('precio_cuota_estudiante').value = cicloActivo.precio_cuota_estudiante;
    } else {
        try {
            const response = await fetch('/api/voluntarios/configuracion-cuotas-simple/');
            if (response.ok) {
                const config = await response.json();
                document.getElementById('precio_cuota_regular').value = parseFloat(config.precio_regular);
                document.getElementById('precio_cuota_estudiante').value = parseFloat(config.precio_estudiante);
            }
        } catch (error) {
            document.getElementById('precio_cuota_regular').value = 5000;
            document.getElementById('precio_cuota_estudiante').value = 3000;
        }
    }

    document.getElementById('modalCiclo').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalCiclo').classList.remove('active');
}

async function guardarCiclo(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    
    const data = {
        anio: parseInt(formData.get('anio')),
        fecha_inicio: formData.get('fecha_inicio'),
        fecha_fin: formData.get('fecha_fin'),
        observaciones: formData.get('observaciones'),
        activo: formData.get('activo') === 'on',
        precio_cuota_regular: parseFloat(formData.get('precio_cuota_regular')),
        precio_cuota_estudiante: parseFloat(formData.get('precio_cuota_estudiante'))
    };
    
    try {
        const response = await fetch(`${API_BASE}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al crear ciclo');
        }
        
        mostrarAlerta('Ciclo creado exitosamente', 'success');
        cerrarModal();
        await cargarCiclos();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al crear ciclo: ' + error.message, 'error');
    }
}

// ==================== UTILIDADES ====================

function formatearMonto(monto) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
    }).format(monto);
}

function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
}

function mostrarAlerta(mensaje, tipo) {
    const container = document.getElementById('alertContainer');
    
    const tipoClase = tipo === 'success' ? 'alert-success' : 
                     tipo === 'error' ? 'alert-error' :
                     tipo === 'info' ? 'alert-warning' : 'alert-warning';
    
    container.innerHTML = `
        <div class="alert ${tipoClase}">
            ${mensaje}
        </div>
    `;
    
    // Auto-ocultar después de 5 segundos (excepto para info)
    if (tipo !== 'info') {
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    } else {
        // Para info (estadísticas), agregar botón para cerrar
        container.innerHTML += `
            <button onclick="document.getElementById('alertContainer').innerHTML=''" 
                    style="margin-top: 10px; padding: 8px 16px; background: #757575; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Cerrar
            </button>
        `;
    }
    
    // Scroll al top para ver la alerta
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        cerrarModal();
    }
});

// Cerrar modal al hacer click fuera
document.getElementById('modalCiclo').addEventListener('click', (e) => {
    if (e.target.id === 'modalCiclo') {
        cerrarModal();
    }
});
