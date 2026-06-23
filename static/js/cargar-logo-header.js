// ==================== CARGA LOGO EN HEADERS DE ASISTENCIAS ====================
// Script para cargar el logo asignado para asistencias en headers

(async function() {
    const logoHeader = document.getElementById('logoHeader');
    if (!logoHeader) return;
    
    try {
        // Cargar logo asignado para Asistencias desde API
        const response = await fetch('/api/logos/asistencias/', { 
            credentials: 'include' 
        });
        
        if (response.ok) {
            const logo = await response.json();
            logoHeader.src = logo.imagen;
            console.log('[LOGO ASISTENCIAS] ✅ Logo cargado:', logo.nombre);
        } else {
            console.log('[LOGO ASISTENCIAS] No hay logo asignado, usando por defecto');
        }
    } catch (error) {
        console.error('[LOGO ASISTENCIAS] Error:', error);
    }
})();
