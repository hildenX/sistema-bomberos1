// ==================== CARGA LOGO EN HEADERS DE ASISTENCIAS ====================
// Carga el logo marcado como "Asistencias" desde la API en el header.
// Soporta ids #logoHeader y #logoAsistencias. Si no hay logo (o falla),
// oculta la imagen para no mostrar el ícono de imagen rota.

(async function () {
    const targets = ['logoHeader', 'logoAsistencias']
        .map(id => document.getElementById(id))
        .filter(Boolean);
    if (targets.length === 0) return;

    // Si la imagen por defecto no existe (images/logo.png), evitar el ícono roto
    targets.forEach(el => { el.onerror = () => { el.style.display = 'none'; }; });

    const setSrc = (src) => targets.forEach(el => { el.src = src; el.style.display = ''; });
    const hide = () => targets.forEach(el => { el.style.display = 'none'; });

    try {
        const response = await fetch('/api/logos/asistencias/', { credentials: 'include' });
        if (response.ok) {
            const logo = await response.json();
            const img = logo.imagen && logo.imagen.startsWith('data:')
                ? logo.imagen
                : (logo.imagen ? 'data:image/png;base64,' + logo.imagen : '');
            if (img) { setSrc(img); console.log('[LOGO ASISTENCIAS] ✅', logo.nombre); }
            else hide();
        } else {
            console.log('[LOGO ASISTENCIAS] Sin logo asignado');
            hide();
        }
    } catch (error) {
        console.error('[LOGO ASISTENCIAS] Error:', error);
        hide();
    }
})();
