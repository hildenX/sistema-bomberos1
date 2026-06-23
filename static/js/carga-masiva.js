// ==================== CARGA MASIVA DE VOLUNTARIOS ====================
// Sistema para importar voluntarios desde Excel

let archivoSeleccionado = null;

// Eventos de drag & drop
document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    document.getElementById('fileInput').files = files;
                    handleFileSelect({ target: { files: files } });
                } else {
                    alert('⚠️ Por favor selecciona un archivo Excel (.xlsx o .xls)');
                }
            }
        });
    }
});

// Descargar plantilla Excel
async function descargarPlantilla() {
    console.log('[CARGA MASIVA] Descargando plantilla...');
    
    try {
        const response = await fetch('/api/voluntarios/descargar-plantilla-masiva/', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Error al descargar plantilla');
        }
        
        // Descargar archivo
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Bomberos.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('[CARGA MASIVA] ✅ Plantilla descargada');
        Utils.mostrarNotificacion('✅ Plantilla descargada correctamente', 'success');
        
    } catch (error) {
        console.error('[CARGA MASIVA] Error:', error);
        Utils.mostrarNotificacion('❌ Error al descargar plantilla', 'error');
    }
}

// Manejar selección de archivo
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Validar extensión
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('⚠️ Por favor selecciona un archivo Excel (.xlsx o .xls)');
        return;
    }
    
    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('⚠️ El archivo es demasiado grande. Máximo 10MB');
        return;
    }
    
    archivoSeleccionado = file;
    
    // Mostrar nombre del archivo
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('selectedFile').style.display = 'block';
    
    console.log('[CARGA MASIVA] Archivo seleccionado:', file.name, '(' + (file.size / 1024).toFixed(2) + ' KB)');
}

// Procesar archivo
async function procesarArchivo() {
    if (!archivoSeleccionado) {
        Utils.mostrarNotificacion('⚠️ Por favor selecciona un archivo', 'error');
        return;
    }
    
    console.log('[CARGA MASIVA] Procesando archivo...');
    
    // Mostrar barra de progreso
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('resultContainer').style.display = 'none';
    document.getElementById('resultContainer').innerHTML = '';
    
    updateProgress(10, 'Subiendo archivo...');
    
    try {
        // Crear FormData
        const formData = new FormData();
        formData.append('archivo', archivoSeleccionado);
        
        updateProgress(30, 'Validando datos...');
        
        // Enviar archivo al servidor
        const response = await fetch('/api/voluntarios/importar-masiva/', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        updateProgress(60, 'Procesando...');
        
        const data = await response.json();
        
        updateProgress(100, 'Finalizado');
        
        // Mostrar resultados
        setTimeout(() => {
            mostrarResultados(data, response.ok);
        }, 500);
        
    } catch (error) {
        console.error('[CARGA MASIVA] Error:', error);
        updateProgress(0, '');
        document.getElementById('progressContainer').style.display = 'none';
        Utils.mostrarNotificacion('❌ Error al procesar archivo', 'error');
    }
}

// Actualizar barra de progreso
function updateProgress(percent, text) {
    const fill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    fill.style.width = percent + '%';
    fill.textContent = percent + '%';
    progressText.textContent = text;
}

// Mostrar resultados
function mostrarResultados(data, success) {
    const container = document.getElementById('resultContainer');
    container.style.display = 'block';
    document.getElementById('progressContainer').style.display = 'none';
    
    let html = '';
    
    if (success && data.success) {
        // ÉXITO
        html = `
            <div class="result-success">
                <h3>🎉 Importación Exitosa</h3>
                <p style="color: #065f46; margin-bottom: 15px; font-size: 1.1rem;">
                    ${data.mensaje || 'Los voluntarios han sido importados correctamente'}
                </p>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Procesados</div>
                        <div class="stat-value" style="color: #3b82f6;">${data.total_procesados || 0}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Importados Correctamente</div>
                        <div class="stat-value" style="color: #10b981;">${data.exitosos || 0}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Con Errores</div>
                        <div class="stat-value" style="color: #ef4444;">${data.errores?.length || 0}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Tiempo Transcurrido</div>
                        <div class="stat-value" style="color: #6b7280; font-size: 1.3rem;">${data.tiempo || '-'}</div>
                    </div>
                </div>
                
                ${data.errores && data.errores.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <h4 style="color: #991b1b;">⚠️ Registros con Errores:</h4>
                        <div class="error-list">
                            ${data.errores.map((err, i) => `
                                <div class="error-item">
                                    <strong>Fila ${err.fila || i+2}:</strong> ${err.error || err.mensaje || err}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="window.location.href='sistema.html'" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 12px 30px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                        📋 Ver Voluntarios Importados
                    </button>
                    <button onclick="location.reload()" style="background: #f3f4f6; color: #1f2937; padding: 12px 30px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-left: 10px;">
                        🔄 Nueva Carga
                    </button>
                </div>
            </div>
        `;
        
        Utils.mostrarNotificacion(`✅ ${data.exitosos} voluntarios importados correctamente`, 'success');
        
    } else {
        // ERROR
        html = `
            <div class="result-error">
                <h3>❌ Error en la Importación</h3>
                <p style="color: #991b1b; margin-bottom: 15px; font-size: 1.1rem;">
                    ${data.error || data.mensaje || 'No se pudo completar la importación'}
                </p>
                
                ${data.errores && data.errores.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <h4 style="color: #991b1b;">Errores Encontrados:</h4>
                        <div class="error-list">
                            ${data.errores.map((err, i) => `
                                <div class="error-item">
                                    ${typeof err === 'string' ? err : `<strong>Fila ${err.fila || i+2}:</strong> ${err.error || err.mensaje}`}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="location.reload()" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 12px 30px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                        🔄 Intentar de Nuevo
                    </button>
                </div>
            </div>
        `;
        
        Utils.mostrarNotificacion('❌ Error al importar voluntarios', 'error');
    }
    
    container.innerHTML = html;
}

// Exportar funciones globales
window.descargarPlantilla = descargarPlantilla;
window.handleFileSelect = handleFileSelect;
window.procesarArchivo = procesarArchivo;
