// ==================== CARGA AUTOMÁTICA DEL LOGO ====================
// Este script carga el logo para PDFs desde la API y lo guarda en localStorage

(function() {
    console.log('[LOGO PDFs] Verificando logo para PDFs desde API...');
    
    cargarLogoPDFs();
    
    async function cargarLogoPDFs() {
        try {
            // Cargar el logo asignado para PDFs
            const response = await fetch('/api/logos/pdfs/', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const logo = await response.json();
                console.log('[LOGO PDFs] ✅ Logo para PDFs encontrado:', logo.nombre);
                localStorage.setItem('logoCompania', logo.imagen);
                console.log('[LOGO PDFs] Logo guardado en localStorage');
            } else {
                console.warn('[LOGO PDFs] No hay logo asignado para PDFs, cargando logo por defecto...');
                await cargarLogoDesdeStatic();
            }
        } catch (error) {
            console.error('[LOGO PDFs] Error al cargar logo desde API:', error);
            await cargarLogoDesdeStatic();
        }
    }
    
    async function cargarLogoDesdeStatic() {
        try {
            const logoPath = document.querySelector('img[alt="Logo Bomberos"]')?.src;
            
            if (!logoPath) {
                console.warn('[LOGO PDFs] No se encontró imagen del logo en el DOM');
                return;
            }
            
            console.log('[LOGO PDFs] Cargando logo desde:', logoPath);
            
            const response = await fetch(logoPath);
            const blob = await response.blob();
            
            const reader = new FileReader();
            reader.onloadend = function() {
                const base64data = reader.result;
                localStorage.setItem('logoCompania', base64data);
                console.log('[LOGO PDFs] ✅ Logo por defecto guardado en localStorage');
            };
            reader.readAsDataURL(blob);
            
        } catch (error) {
            console.error('[LOGO PDFs] ❌ Error al cargar logo por defecto:', error);
        }
    }
    
    // Función global para actualizar logo
    window.actualizarLogoPDFs = async function() {
        console.log('[LOGO PDFs] Actualizando logo...');
        await cargarLogoPDFs();
    };
    
})();
