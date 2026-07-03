// ==================== SIDEBAR DINÁMICO - VERSION DJANGO ====================
// Flag para evitar múltiples inicializaciones
let _sidebarIniciado = false;

// Refresca los logos reales del sistema desde la API (sidebar + PDFs).
// Se llama al iniciar y cada vez que se cambia un contexto en el gestor de logos.
function _logoSrc(logo) {
    if (!logo || !logo.imagen) return '';
    return logo.imagen.startsWith('data:') ? logo.imagen : 'data:image/png;base64,' + logo.imagen;
}
window.refrescarLogosSistema = async function () {
    const sidebarLogo = document.querySelector('.sidebar-logo');
    // --- Logo del SIDEBAR ---
    try {
        const r = await fetch('/api/logos/sidebar/', { credentials: 'include' });
        if (r.ok) {
            const src = _logoSrc(await r.json());
            if (sidebarLogo && src) {
                sidebarLogo.innerHTML = `<img src="${src}" alt="Logo" style="width:70%;height:70%;object-fit:contain;border-radius:8px;margin:auto;">`;
                localStorage.setItem('logoSidebar', src);
            }
        } else if (r.status === 404) {
            if (sidebarLogo) sidebarLogo.innerHTML = '🚒';
            localStorage.removeItem('logoSidebar');
        }
    } catch (e) { /* offline: se queda el cache */ }
    // --- Logo para PDFs (los PDFs leen localStorage 'logoCompania') ---
    try {
        const r = await fetch('/api/logos/pdfs/', { credentials: 'include' });
        if (r.ok) {
            const src = _logoSrc(await r.json());
            if (src) localStorage.setItem('logoCompania', src);
        } else if (r.status === 404) {
            localStorage.removeItem('logoCompania');
        }
    } catch (e) { /* ignore */ }
};

async function initSidebar() {
    // Evitar múltiples inicializaciones
    if (_sidebarIniciado) {
        console.log('[SIDEBAR] ️ Ya está iniciado, ignorando llamada duplicada');
        return;
    }

    console.log('[SIDEBAR] Iniciando...');

    // Obtener usuario desde localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser && !window.currentUser) {
        window.currentUser = JSON.parse(storedUser);
    }

    // Si no hay usuario, mostrar mensaje pero no redirigir
    if (!window.currentUser) {
        console.error('[SIDEBAR] No hay usuario - sidebar sin inicializar');
        return;
    }

    // Marcar como iniciado INMEDIATAMENTE
    _sidebarIniciado = true;

    console.log('[SIDEBAR] Usuario:', window.currentUser.username);

    // APLICAR TEMAS POR ROL
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        if (window.currentUser.role === 'Tesorero') {
            sidebar.classList.add('sidebar-tesorero');
            console.log('[SIDEBAR] Aplicado tema TESORERO (negro)');
        } else if (window.currentUser.role === 'Capitán' || window.currentUser.role === 'Ayudante') {
            sidebar.classList.add('sidebar-capitan');
            console.log('[SIDEBAR] Aplicado tema', window.currentUser.role.toUpperCase(), '(rojo)');
        } else if (window.currentUser.role === 'Secretario') {
            sidebar.classList.add('sidebar-secretario');
            console.log('[SIDEBAR] Aplicado tema SECRETARIO (verde)');
        }
    }

    // Mostrar el logo del sidebar cacheado al toque (evita parpadeo) y luego refrescar desde la API
    const logoSidebarCache = localStorage.getItem('logoSidebar');
    const sidebarLogo = document.querySelector('.sidebar-logo');
    if (logoSidebarCache && sidebarLogo) {
        sidebarLogo.innerHTML = `<img src="${logoSidebarCache}" alt="Logo" style="width: 70%; height: 70%; object-fit: contain; border-radius: 8px; margin: auto;">`;
    }
    // Cargar los logos reales (sidebar + PDFs) desde la API
    window.refrescarLogosSistema();

    // Actualizar info de usuario en sidebar
    const roleElement = document.getElementById('sidebarUserRole');
    const nameElement = document.getElementById('sidebarUserName');

    if (roleElement) roleElement.textContent = window.currentUser.role;
    if (nameElement) nameElement.textContent = `@${window.currentUser.username}`;

    // Generar menú según rol
    const sidebarNav = document.getElementById('sidebarNav');
    if (sidebarNav) {
        sidebarNav.innerHTML = generarMenuSegunRol(window.currentUser.role);
    }

    console.log('[SIDEBAR] Inicializado para:', window.currentUser.role);

    // Actualizar widgets inmediatamente si es Tesorero
    if (window.currentUser.role === 'Tesorero') {
        console.log('[SIDEBAR] Actualizando widgets de Tesorero...');
        setTimeout(() => {
            actualizarSaldoSidebar();
            actualizarDeudoresSidebar();
            actualizarSolicitudesPortalSidebar();
        }, 100);
    }
}

function generarMenuSegunRol(role) {
    const menuItems = [];

    let widgetDeudoresInicial = '';
    let widgetPagosPortalInicial = '';

    if (role === 'Tesorero') {
        widgetDeudoresInicial = `
            <div class="sidebar-widget-deudores-top" onclick="mostrarDeudoresDesdeWidget()"
                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(245, 158, 11, 0.4)'"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(245, 158, 11, 0.2)'"
                 style="cursor: pointer; margin: 15px 12px; padding: 16px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2); transition: all 0.3s; position: relative; transform: translateY(0);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 24px; animation: pulse 2s infinite;">&#128276;</span>
                        <div>
                            <div style="color: #78350f; font-weight: 700; font-size: 0.95rem; margin-bottom: 2px;">Deudores</div>
                            <div style="color: #92400e; font-size: 0.75rem;">Click para ver detalles</div>
                        </div>
                    </div>
                    <div id="sidebarBadgeDeudores" style="background: #ef4444; color: white; font-weight: 700; font-size: 1.1rem; padding: 6px 12px; border-radius: 50%; min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);">0</div>
                </div>
            </div>
        `;

        widgetPagosPortalInicial = `
            <div class="sidebar-widget-deudores-top" onclick="mostrarSolicitudesPortalDesdeWidget()"
                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)'"
                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(59, 130, 246, 0.2)'"
                 style="cursor: pointer; margin: 0 12px 15px; padding: 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 12px; border-left: 4px solid #2563eb; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2); transition: all 0.3s; position: relative; transform: translateY(0);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 24px; animation: pulse 2s infinite;">&#128179;</span>
                        <div>
                            <div style="color: #1e3a8a; font-weight: 700; font-size: 0.95rem; margin-bottom: 2px;">Pagos Portal</div>
                            <div style="color: #1d4ed8; font-size: 0.75rem;">Click para revisar</div>
                        </div>
                    </div>
                    <div id="sidebarBadgeSolicitudesPortal" style="background: #dc2626; color: white; font-weight: 700; font-size: 1.1rem; padding: 6px 12px; border-radius: 50%; min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);">0</div>
                </div>
            </div>
        `;
    }

    if (['Director', 'Secretario', 'Tesorero', 'Capit\u00e1n', 'Ayudante', 'Super Administrador'].includes(role)) {
        menuItems.push({
            titulo: 'GESTI\u00d3N',
            items: [
                { icono: '\u{1F465}', texto: 'Voluntarios', url: '/sistema.html' }
            ]
        });
    }

    if (['Super Administrador'].includes(role)) {
        menuItems[0].items.push(
            { icono: '\u{1F4CB}', texto: 'Cargos', url: '/cargos.html' },
            { icono: '\u2696\uFE0F', texto: 'Sanciones', url: '/listado-sanciones.html' },
            { icono: '\u{1F3C6}', texto: 'Felicitaciones', url: '/felicitaciones.html' }
        );
    }

    if (role !== 'Tesorero') {
        const asistenciaItems = [];

        if (['Capit\u00e1n', 'Ayudante', 'Secretario', 'Super Administrador'].includes(role)) {
            asistenciaItems.push(
                { icono: '\u2705', texto: 'Registrar Asistencia', url: '/tipos-asistencia.html' }
            );
        }

        asistenciaItems.push(
            { icono: '\u{1F4CA}', texto: 'Historial', url: '/historial-asistencias.html' }
        );

        if (['Capit\u00e1n', 'Ayudante', 'Director', 'Super Administrador'].includes(role)) {
            asistenciaItems.push(
                { icono: '\u{1F692}', texto: 'Detalle Emergencias', url: '/historial-emergencias.html' }
            );
        }

        if (['Super Administrador'].includes(role)) {
            asistenciaItems.push(
                { icono: '\u{1F504}', texto: 'Ciclos de Asistencia', url: '/admin-ciclos.html' }
            );
        }

        menuItems.push({
            titulo: 'ASISTENCIA',
            items: asistenciaItems
        });
    }

    if (['Super Administrador'].includes(role)) {
        menuItems.push({
            titulo: 'UNIFORMES',
            items: [
                { icono: '\u{1F455}', texto: 'Gesti\u00f3n de Uniformes', url: '/uniformes.html' }
            ]
        });
    }

    if (['Super Administrador'].includes(role)) {
        menuItems.push({
            titulo: 'ADMINISTRACI\u00d3N',
            items: [
                { icono: '\u{1F4E4}', texto: 'Carga Masiva de Voluntarios', url: '/carga-masiva.html' }
            ]
        });
    }

    if (['Tesorero', 'Super Administrador'].includes(role)) {
        menuItems.push({
            titulo: 'FINANZAS',
            items: [
                { icono: '\u{1F4B0}', texto: 'Finanzas', url: '/finanzas.html' },
                { icono: '\u{1F39F}', texto: 'Rifas', url: '/rifas.html' },
                { icono: '\u{1F3AB}', texto: 'Beneficios', url: '/beneficios.html' },
                { icono: '\u2699\uFE0F', texto: 'Configurar Cuotas', url: '/configurar-cuotas.html' },
                { icono: '\u{1F4C4}', texto: 'Ciclos de Cuotas', url: '/admin-ciclos-cuotas.html' },
                { icono: '\u{1F4CB}', texto: 'Ciclos Beneficios', url: '/admin-ciclos-beneficios.html' }
            ],
            widgetSaldo: role === 'Tesorero'
        });
    }

    if (['Director', 'Secretario', 'Super Administrador', 'Capit\u00e1n', 'Ayudante'].includes(role)) {
        menuItems.push({
            titulo: 'PDF VOLUNTARIOS',
            items: [
                {
                    icono: '\u{1F4C4}',
                    texto: 'PDF Voluntarios (Antig\u00fcedad)',
                    url: '#',
                    onclick: 'generarPDFDesdeMenu()'
                }
            ]
        });
    }

    const configItems = [
        {
            icono: '\u{1F3E2}',
            texto: 'Logo Compa\u00f1\u00eda (PDFs)',
            url: '#',
            onclick: 'abrirModalLogoCompania()'
        }
    ];

    if (['Super Administrador'].includes(role)) {
        configItems.push({
            icono: '\u{1F464}',
            texto: 'Gesti\u00f3n de Usuarios',
            url: '#',
            onclick: 'abrirPanelGestionUsuarios()'
        });
    }

    menuItems.push({
        titulo: 'CONFIGURACI\u00d3N',
        items: configItems
    });

    let html = widgetDeudoresInicial + widgetPagosPortalInicial;
    menuItems.forEach(seccion => {
        html += `
            <div class="sidebar-section">
                <div class="sidebar-section-title">
                    ${seccion.titulo}
                </div>

                ${seccion.widgetSaldo ? `
                    <div class="sidebar-widget-saldo">
                        <div class="widget-label">SALDO COMPA\u00d1\u00cdA</div>
                        <div id="sidebarSaldoCompania" class="widget-value">$0</div>
                    </div>
                ` : ''}

                ${seccion.items.map(item => `
                    <a href="${item.url}"
                       class="sidebar-link"
                       ${item.onclick ? `onclick="${item.onclick}; return false;"` : ''}>
                        <span class="sidebar-icon">${item.icono}</span>
                        <span class="sidebar-text">${item.texto}</span>
                    </a>
                `).join('')}
            </div>
        `;
    });

    return html;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

function generarPDFDesdeMenu() {
    console.log('[PDF] Generando PDF de voluntarios desde sidebar...');
    // Llamar a la misma función que usa el botón del header
    if (typeof sistemaBomberos !== 'undefined' && typeof sistemaBomberos.generarPDFConsultaVoluntarios === 'function') {
        sistemaBomberos.generarPDFConsultaVoluntarios();
    } else {
        console.error('[PDF] La función sistemaBomberos.generarPDFConsultaVoluntarios() no está disponible');
        alert('Error: La función de generación de PDF no está disponible. Asegúrate de que el sistema esté completamente cargado.');
    }
}

// ==================== CONFIGURACIN LOGO COMPAÍA ====================
function abrirModalLogoCompania() {
    // Crear modal con gestor de logos
    const modalHTML = `
        <div id="modalLogoCompania" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; overflow-y: auto; backdrop-filter: blur(5px);">
            <div style="background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%); padding: 35px; border-radius: 20px; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); margin: 20px; border: 1px solid rgba(255,255,255,0.8);">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            
                        </div>
                        <h2 style="margin: 0; color: #1f2937; font-size: 1.7rem; font-weight: 700;">Gestión de Logos</h2>
                    </div>
                    <button onclick="cerrarModalLogoCompania()" style="background: #f3f4f6; border: none; font-size: 1.8rem; cursor: pointer; color: #6b7280; padding: 8px 12px; line-height: 1; border-radius: 8px; transition: all 0.3s; hover: background: #e5e7eb;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">&times;</button>
                </div>
                
                <!-- Info -->
                <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 12px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: start; gap: 12px;">
                        <span style="font-size: 1.3rem;">️</span>
                        <div>
                            <strong style="color: #1e40af; display: block; margin-bottom: 4px;">Contextos de uso:</strong>
                            <p style="color: #1e3a8a; margin: 0; font-size: 0.9em; line-height: 1.5;">
                                 <strong>PDFs:</strong> Documentos oficiales y certificados<br>
                                 <strong>Asistencias:</strong> Headers de formularios de registro<br>
                                 <strong>Sidebar:</strong> Menú lateral del sistema
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Botón para subir -->
                <div style="margin-bottom: 30px; text-align: center;">
                    <button id="btnSubirLogoNuevo" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 16px 32px; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 1.05em; box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4); transition: all 0.3s; transform: translateY(0);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(59, 130, 246, 0.5)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(59, 130, 246, 0.4)'">
                         Subir Nuevo Logo
                    </button>
                    <input type="file" id="inputLogoNuevo" accept="image/*" style="display: none;">
                    <p style="margin-top: 10px; font-size: 0.85em; color: #6b7280;">Formatos: PNG, JPG, SVG  Tamaño máximo: 2MB</p>
                </div>
                
                <!-- Lista de logos -->
                <div id="listaLogos" style="margin-top: 25px;">
                    <div style="text-align: center; padding: 50px; color: #9ca3af;">
                        <div style="font-size: 3.5em; margin-bottom: 15px; animation: pulse 1.5s infinite;">⏳</div>
                        <p style="font-size: 1.1em; font-weight: 500;">Cargando logos...</p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <button onclick="cerrarModalLogoCompania()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 28px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)'">
                         Cerrar
                    </button>
                </div>
            </div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Cargar el script del gestor si no está cargado
    if (typeof GestorLogos === 'undefined') {
        const script = document.createElement('script');
        script.src = '/static/js/gestor-logos.js?v=2.2';
        script.onload = () => {
            window.inicializarGestorLogos();
        };
        document.head.appendChild(script);
    } else {
        window.inicializarGestorLogos();
    }
}

function cerrarModalLogoCompania() {
    const modal = document.getElementById('modalLogoCompania');
    if (modal) {
        modal.remove();
    }
}

function cargarLogoCompania(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validar tamaño (máx 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('️ El archivo es demasiado grande. Máximo 2MB.');
            input.value = '';
            return;
        }
        
        // Validar tipo
        if (!file.type.startsWith('image/')) {
            alert('️ Por favor seleccione una imagen válida.');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            // Guardar en localStorage
            localStorage.setItem('logoCompania', e.target.result);
            
            // Actualizar logo en sidebar
            const sidebarLogo = document.querySelector('.sidebar-logo');
            if (sidebarLogo) {
                sidebarLogo.innerHTML = `<img src="${e.target.result}" alt="Logo" style="width: 70%; height: 70%; object-fit: contain; border-radius: 8px; margin: auto;">`;
            }
            
            // Actualizar preview
            const preview = document.getElementById('previewLogoCompania');
            if (preview) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" alt="Logo">`;
            }
            
            // Mostrar notificación
            mostrarNotificacionModal(' Logo guardado correctamente', 'success');
            
            // Actualizar botones
            setTimeout(() => {
                cerrarModalLogoCompania();
                abrirModalLogoCompania(); // Reabrir para mostrar botón eliminar
            }, 500);
        };
        reader.readAsDataURL(file);
    }
}

function eliminarLogoCompania() {
    if (confirm('¿Está seguro de eliminar el logo de la compañía?')) {
        localStorage.removeItem('logoCompania');
        mostrarNotificacionModal('️ Logo eliminado', 'info');
        
        // Restaurar emoji en sidebar
        const sidebarLogo = document.querySelector('.sidebar-logo');
        if (sidebarLogo) {
            sidebarLogo.innerHTML = '';
        }
        
        // Actualizar preview
        const preview = document.getElementById('previewLogoCompania');
        if (preview) {
            preview.innerHTML = `<span style="color: #9ca3af;">Sin logo configurado</span>`;
        }
        
        setTimeout(() => {
            cerrarModalLogoCompania();
        }, 500);
    }
}

function mostrarNotificacionModal(mensaje, tipo) {
    const color = tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#3b82f6';
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 11000;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notif.textContent = mensaje;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 3000);
}

// ==================== ACTUALIZAR WIDGETS TESORERO ====================

async function actualizarSaldoSidebar() {
    const saldoElement = document.getElementById('sidebarSaldoCompania');
    if (!saldoElement) return;
    
    try {
        console.log('[SIDEBAR]  Consultando saldo...');
        const response = await fetch('/api/movimientos-financieros/', {
            credentials: 'include'
        });
        
        if (!response.ok) throw new Error('API error');
        
        const data = await response.json();
        const movimientos = data.results || [];
        
        let totalIngresos = 0;
        let totalEgresos = 0;
        
        movimientos.forEach(m => {
            const monto = parseFloat(m.monto) || 0;
            if (m.tipo === 'ingreso') totalIngresos += monto;
            else if (m.tipo === 'egreso') totalEgresos += monto;
        });
        
        const saldo = totalIngresos - totalEgresos;
        saldoElement.textContent = `$${saldo.toLocaleString('es-CL')}`;
        
        // Color según saldo
        if (saldo < 0) saldoElement.style.color = '#ef4444';
        else if (saldo === 0) saldoElement.style.color = '#9ca3af';
        else saldoElement.style.color = '#fbbf24';
        
        console.log('[SIDEBAR]  Saldo: $' + saldo.toLocaleString('es-CL'));
    } catch (error) {
        console.error('[SIDEBAR]  Error al actualizar saldo:', error);
        saldoElement.textContent = '$0';
    }
}

async function actualizarDeudoresSidebar() {
    const badgeElement = document.getElementById('sidebarBadgeDeudores');
    if (!badgeElement) return;

    try {
        console.log('[SIDEBAR]  Calculando deudores...');

        const anoActual = new Date().getFullYear();

        // Obtener deudores de cuotas usando el endpoint simplificado
        const urlCuotas = `/api/voluntarios/deudores-cuotas-listado/?anio=${anoActual}`;
        console.log('[SIDEBAR] URL Cuotas:', urlCuotas);
        
        const responseCuotas = await fetch(urlCuotas, {
            credentials: 'include'
        });

        let deudoresCuotas = [];
        if (responseCuotas.ok) {
            const dataCuotas = await responseCuotas.json();
            console.log('[SIDEBAR] Respuesta cuotas:', dataCuotas);
            if (dataCuotas.success) {
                deudoresCuotas = dataCuotas.deudores || [];
            }
            console.log('[SIDEBAR] Deudores de cuotas:', deudoresCuotas.length);
        } else {
            console.error('[SIDEBAR] Error en endpoint cuotas:', responseCuotas.status, responseCuotas.statusText);
        }

        // Obtener deudores de beneficios usando el endpoint simplificado
        const responseBeneficios = await fetch('/api/voluntarios/deudores-beneficios-listado/', {
            credentials: 'include'
        });

        let deudoresBeneficios = [];
        if (responseBeneficios.ok) {
            const dataBeneficios = await responseBeneficios.json();
            if (dataBeneficios.success) {
                deudoresBeneficios = dataBeneficios.deudores || [];
            }
            console.log('[SIDEBAR] Deudores de beneficios:', deudoresBeneficios.length);
        }

        // Guardar en variable global para usar en el modal
        window.datosDeudores = {
            cuotas: {
                cantidad: deudoresCuotas.length,
                datos: deudoresCuotas
            },
            beneficios: {
                cantidad: deudoresBeneficios.length,
                datos: deudoresBeneficios
            }
        };

        // Total de deudores únicos (pueden tener ambos tipos de deuda)
        const voluntariosConCuotas = new Set(deudoresCuotas.map(d => d.id));
        const voluntariosConBeneficios = new Set(deudoresBeneficios.map(d => d.voluntario_id));
        
        const voluntariosUnicos = new Set([...voluntariosConCuotas, ...voluntariosConBeneficios]);
        const totalDeudores = voluntariosUnicos.size;

        badgeElement.textContent = totalDeudores;

        // Cambiar color si hay deudores
        if (totalDeudores > 0) {
            badgeElement.style.animation = 'pulse 2s infinite';
        }

        console.log('[SIDEBAR]  Total deudores únicos:', totalDeudores);
        console.log('[SIDEBAR]  Desglose - Cuotas:', deudoresCuotas.length, '| Beneficios:', deudoresBeneficios.length);
    } catch (error) {
        console.error('[SIDEBAR]  Error al actualizar deudores:', error);
        badgeElement.textContent = '0';
    }
}

async function actualizarSolicitudesPortalSidebar() {
    const badgeElement = document.getElementById('sidebarBadgeSolicitudesPortal');
    if (!badgeElement) return;

    try {
        console.log('[SIDEBAR] Consultando solicitudes portal...');
        const response = await fetch('/api/portal/tesoreria/solicitudes/?estado=pendiente', {
            credentials: 'include'
        });

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        const pendientes = parseInt(data.pendientes || 0, 10);

        badgeElement.textContent = pendientes;
        badgeElement.style.display = pendientes > 0 ? 'flex' : 'none';

        const widget = badgeElement.closest('.sidebar-widget-deudores-top');
        if (widget) {
            if (pendientes > 0) {
                widget.style.borderLeftColor = '#dc2626';
                widget.style.boxShadow = '0 2px 10px rgba(220, 38, 38, 0.25)';
            } else {
                widget.style.borderLeftColor = '#2563eb';
                widget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
            }
        }

        console.log('[SIDEBAR] Solicitudes portal pendientes:', pendientes);
    } catch (error) {
        console.error('[SIDEBAR] Error al actualizar solicitudes portal:', error);
        badgeElement.textContent = '0';
        badgeElement.style.display = 'none';
    }
}

// Función para mostrar deudores desde el widget
function mostrarDeudoresDesdeWidget() {
    console.log('[SIDEBAR] Abriendo vista de deudores...');

    if (!window.datosDeudores) {
        alert('Cargando datos de deudores...');
        return;
    }

    const { cuotas, beneficios } = window.datosDeudores;

    // Crear modal con notificación de deudores
    const modalHTML = `
        <div id="modalDeudores" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
            <div style="background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%); padding: 35px; border-radius: 20px; max-width: 700px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.8);">

                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            
                        </div>
                        <h2 style="margin: 0; color: #1f2937; font-size: 1.7rem; font-weight: 700;">Resumen de Deudores</h2>
                    </div>
                    <button onclick="cerrarModalDeudores()" style="background: #f3f4f6; border: none; font-size: 1.8rem; cursor: pointer; color: #6b7280; padding: 8px 12px; line-height: 1; border-radius: 8px; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">&times;</button>
                </div>

                <!-- Estadísticas -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <!-- Deudores Cuotas -->
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);">
                        <div style="font-size: 0.85rem; color: #78350f; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                             Cuotas Vencidas
                        </div>
                        <div style="font-size: 2.5rem; font-weight: 700; color: #f59e0b;">
                            ${cuotas.cantidad}
                        </div>
                        <div style="font-size: 0.9rem; color: #92400e; margin-top: 4px;">
                            ${cuotas.cantidad === 1 ? 'Deudor' : 'Deudores'}
                        </div>
                    </div>

                    <!-- Deudores Beneficios -->
                    <div style="background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%); padding: 24px; border-radius: 12px; border-left: 4px solid #ec4899; box-shadow: 0 2px 8px rgba(236, 72, 153, 0.2);">
                        <div style="font-size: 0.85rem; color: #831843; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                             Beneficios Pendientes
                        </div>
                        <div style="font-size: 2.5rem; font-weight: 700; color: #ec4899;">
                            ${beneficios.cantidad}
                        </div>
                        <div style="font-size: 0.9rem; color: #9f1239; margin-top: 4px;">
                            ${beneficios.cantidad === 1 ? 'Deudor' : 'Deudores'}
                        </div>
                    </div>
                </div>

                <!-- Botones de acción -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <button onclick="verListadoCuotas()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 14px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(245, 158, 11, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(245, 158, 11, 0.3)'">
                         Ver Deudores de Cuotas
                    </button>
                    <button onclick="verListadoBeneficios()" style="background: linear-gradient(135deg, #ec4899, #db2777); color: white; border: none; padding: 14px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 2px 8px rgba(236, 72, 153, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(236, 72, 153, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(236, 72, 153, 0.3)'">
                         Ver Deudores de Beneficios
                    </button>
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <button onclick="cerrarModalDeudores()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 40px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)'">
                         Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function mostrarSolicitudesPortalDesdeWidget() {
    window.location.href = '/solicitudes-pagos-portal.html';
}

function cerrarModalDeudores() {
    const modal = document.getElementById('modalDeudores');
    if (modal) {
        modal.remove();
    }
}

function verListadoCuotas() {
    const anoActual = new Date().getFullYear();
    cerrarModalDeudores();
    window.open(`/deudores-cuotas.html?anio=${anoActual}`, '_blank');
}

function cerrarListadoCuotas() {
    // Mantenida por compatibilidad  la nueva vista se abre en pestaña aparte
}

async function verListadoBeneficios() {
    console.log('[SIDEBAR] Mostrando listado de deudores de beneficios...');
    
    // Cerrar modal anterior
    cerrarModalDeudores();
    
    try {
        // Obtener deudores desde el endpoint simplificado
        const response = await fetch('/api/voluntarios/deudores-beneficios-listado/', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Error al obtener deudores');
        }
        
        const data = await response.json();
        console.log('[LISTADO BENEFICIOS] Datos:', data);
        
        if (!data.success || data.total === 0) {
            alert(' No hay deudores de beneficios');
            return;
        }
        
        // Crear tabla de deudores
        let tablaHTML = '';
        data.deudores.forEach((deudor, index) => {
            const montoPendiente = parseFloat(deudor.monto_pendiente || 0);
            
            tablaHTML += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px 16px; font-weight: 600; color: #374151;">${index + 1}</td>
                    <td style="padding: 12px 16px; color: #1f2937;">${deudor.voluntario_nombre}</td>
                    <td style="padding: 12px 16px; text-align: center; color: #6b7280;">${deudor.voluntario_clave}</td>
                    <td style="padding: 12px 16px; color: #831843;">${deudor.beneficio_nombre}</td>
                    <td style="padding: 12px 16px; text-align: center; color: #6b7280;">${deudor.tarjetas_asignadas || 0}</td>
                    <td style="padding: 12px 16px; text-align: right; color: #ec4899; font-weight: 700;">$${montoPendiente.toLocaleString('es-CL')}</td>
                </tr>
            `;
        });
        
        const totalDeuda = data.deudores.reduce((sum, d) => sum + parseFloat(d.monto_pendiente || 0), 0);
    
    const modalHTML = `
        <div id="modalListadoBeneficios" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); overflow-y: auto; padding: 20px;">
            <div style="background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%); padding: 35px; border-radius: 20px; max-width: 1000px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.8);">
                
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: linear-gradient(135deg, #ec4899, #db2777); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            
                        </div>
                        <h2 style="margin: 0; color: #1f2937; font-size: 1.7rem; font-weight: 700;">Deudores de Beneficios</h2>
                    </div>
                    <button onclick="cerrarListadoBeneficios()" style="background: #f3f4f6; border: none; font-size: 1.8rem; cursor: pointer; color: #6b7280; padding: 8px 12px; line-height: 1; border-radius: 8px; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">&times;</button>
                </div>
                
                <!-- Resumen -->
                <div style="background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #ec4899;">
                    <div style="display: flex; justify-content: space-around; text-align: center;">
                        <div>
                            <div style="color: #831843; font-size: 0.85rem; font-weight: 600; margin-bottom: 5px;">TOTAL DEUDORES</div>
                            <div style="color: #ec4899; font-size: 2rem; font-weight: 700;">${data.total}</div>
                        </div>
                        <div style="width: 2px; background: rgba(131, 24, 67, 0.2);"></div>
                        <div>
                            <div style="color: #831843; font-size: 0.85rem; font-weight: 600; margin-bottom: 5px;">DEUDA TOTAL</div>
                            <div style="color: #059669; font-size: 2rem; font-weight: 700;">$${totalDeuda.toLocaleString('es-CL')}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Tabla -->
                <div style="overflow-x: auto; max-height: 500px; overflow-y: auto; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <thead style="background: linear-gradient(135deg, #ec4899, #db2777); color: white; position: sticky; top: 0; z-index: 1;">
                            <tr>
                                <th style="padding: 14px 16px; text-align: left; font-weight: 700; font-size: 0.85rem;">#</th>
                                <th style="padding: 14px 16px; text-align: left; font-weight: 700; font-size: 0.85rem;">VOLUNTARIO</th>
                                <th style="padding: 14px 16px; text-align: center; font-weight: 700; font-size: 0.85rem;">CLAVE</th>
                                <th style="padding: 14px 16px; text-align: left; font-weight: 700; font-size: 0.85rem;">BENEFICIO</th>
                                <th style="padding: 14px 16px; text-align: center; font-weight: 700; font-size: 0.85rem;">TARJETAS</th>
                                <th style="padding: 14px 16px; text-align: right; font-weight: 700; font-size: 0.85rem;">DEUDA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tablaHTML}
                        </tbody>
                    </table>
                </div>
                
                <!-- Botón cerrar -->
                <div style="margin-top: 25px; text-align: center;">
                    <button onclick="cerrarListadoBeneficios()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 40px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)'">
                         Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } catch (error) {
        console.error('[LISTADO BENEFICIOS] Error:', error);
        alert('Error al cargar deudores: ' + error.message);
    }
}

function cerrarListadoBeneficios() {
    const modal = document.getElementById('modalListadoBeneficios');
    if (modal) {
        modal.remove();
    }
}

async function generarPDFDeudores() {
    console.log('[PDF] Generando PDF de deudores...');

    if (!window.datosDeudores) {
        alert('No hay datos de deudores disponibles');
        return;
    }

    // Mostrar mensaje de carga
    const btnPDF = event.target;
    btnPDF.textContent = '⏳ Generando PDF...';
    btnPDF.disabled = true;

    try {
        // Obtener datos de voluntarios
        const responseVoluntarios = await fetch('/api/voluntarios/', {
            credentials: 'include'
        });

        if (!responseVoluntarios.ok) {
            throw new Error('Error al obtener voluntarios');
        }

        const voluntariosData = await responseVoluntarios.json();
        const { cuotas, beneficios } = window.datosDeudores;

        // Crear mapas de voluntarios
        const voluntariosMap = {};
        voluntariosData.forEach(v => {
            voluntariosMap[v.id] = v;
        });

        // Preparar datos para el PDF
        const deudoresData = [];

        // Procesar cuotas vencidas - formato Django: {voluntario: {id, nombre_completo, clave_bombero}, monto, meses_pendientes}
        const cuotasPorVoluntario = {};
        cuotas.datos.forEach(deudor => {
            const volId = deudor.voluntario.id;
            if (!cuotasPorVoluntario[volId]) {
                cuotasPorVoluntario[volId] = {
                    monto: 0,
                    cantidad: 0,
                    info: deudor.voluntario
                };
            }
            cuotasPorVoluntario[volId].monto += parseFloat(deudor.monto || 0);
            cuotasPorVoluntario[volId].cantidad += (deudor.meses_pendientes || 0);
        });

        // Procesar beneficios pendientes - formato Django: {voluntario: id, monto_pendiente, ...}
        const beneficiosPorVoluntario = {};
        beneficios.datos.forEach(asignacion => {
            const volId = asignacion.voluntario;
            if (!beneficiosPorVoluntario[volId]) {
                beneficiosPorVoluntario[volId] = {
                    monto: 0,
                    cantidad: 0
                };
            }
            beneficiosPorVoluntario[volId].monto += parseFloat(asignacion.monto_pendiente || 0);
            beneficiosPorVoluntario[volId].cantidad += 1;
        });

        // Combinar todos los voluntarios únicos
        const todosLosVoluntarios = new Set([
            ...Object.keys(cuotasPorVoluntario),
            ...Object.keys(beneficiosPorVoluntario)
        ]);

        todosLosVoluntarios.forEach(voluntarioId => {
            const cuotasVol = cuotasPorVoluntario[voluntarioId];
            const beneficiosVol = beneficiosPorVoluntario[voluntarioId];
            
            // Obtener datos del voluntario
            let nombre, clave;
            if (cuotasVol && cuotasVol.info) {
                nombre = cuotasVol.info.nombre_completo;
                clave = cuotasVol.info.clave_bombero;
            } else {
                const vol = voluntariosMap[voluntarioId];
                if (!vol) return;
                nombre = `${vol.nombre} ${vol.apellido_paterno}`;
                clave = vol.clave_bombero || 'N/A';
            }

            const totalCuotas = cuotasVol ? cuotasVol.monto : 0;
            const cuotasQty = cuotasVol ? cuotasVol.cantidad : 0;
            const totalBeneficios = beneficiosVol ? beneficiosVol.monto : 0;
            const beneficiosQty = beneficiosVol ? beneficiosVol.cantidad : 0;
            const totalDeuda = totalCuotas + totalBeneficios;

            deudoresData.push({
                nombre: nombre,
                clave: clave,
                cuotasQty: cuotasQty,
                cuotasMonto: totalCuotas,
                beneficiosQty: beneficiosQty,
                beneficiosMonto: totalBeneficios,
                totalDeuda: totalDeuda
            });
        });

        // Ordenar por deuda total (mayor a menor)
        deudoresData.sort((a, b) => b.totalDeuda - a.totalDeuda);

        // Generar PDF usando jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('REPORTE DE DEUDORES', 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        const fechaActual = new Date().toLocaleDateString('es-CL');
        doc.text(`Fecha: ${fechaActual}`, 105, 28, { align: 'center' });

        // Resumen
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('RESUMEN:', 14, 40);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Deudores con cuotas vencidas: ${cuotas.cantidad}`, 20, 47);
        doc.text(`Deudores con beneficios pendientes: ${beneficios.cantidad}`, 20, 53);
        doc.text(`Total deudores únicos: ${deudoresData.length}`, 20, 59);

        // Tabla de deudores
        doc.autoTable({
            startY: 65,
            head: [['Nombre', 'Clave', 'Cuotas', 'Beneficios', 'Total Deuda']],
            body: deudoresData.map(d => [
                d.nombre,
                d.clave,
                `${d.cuotasQty} ($${d.cuotasMonto.toLocaleString('es-CL')})`,
                `${d.beneficiosQty} ($${d.beneficiosMonto.toLocaleString('es-CL')})`,
                `$${d.totalDeuda.toLocaleString('es-CL')}`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 25 },
                2: { cellWidth: 35 },
                3: { cellWidth: 35 },
                4: { cellWidth: 35, fontStyle: 'bold' }
            }
        });

        // Guardar PDF
        doc.save(`Reporte_Deudores_${new Date().toISOString().split('T')[0]}.pdf`);

        btnPDF.textContent = ' PDF Generado';
        setTimeout(() => {
            btnPDF.textContent = ' Generar PDF';
            btnPDF.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('[PDF] Error:', error);
        alert('Error al generar PDF: ' + error.message);
        btnPDF.textContent = ' Generar PDF';
        btnPDF.disabled = false;
    }
}

// Inicializar cuando el DOM esté listo - UNA SOLA VEZ
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initSidebar();
    });
} else {
    // Si ya está cargado, ejecutar inmediatamente
    initSidebar();
}

// Actualizar widgets cada 30 segundos (solo si ya está iniciado)
setInterval(() => {
    if (_sidebarIniciado && window.currentUser?.role === 'Tesorero') {
        actualizarSaldoSidebar();
        actualizarDeudoresSidebar();
    }
}, 30000);

// ==================== GESTIN DE USUARIOS (SUPER ADMIN) ====================

async function abrirPanelGestionUsuarios() {
    console.log('[ADMIN] Abriendo panel de gestión de usuarios...');

    // Crear modal con loader
    const modalHTML = `
        <div id="modalGestionUsuarios" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); overflow-y: auto; padding: 20px;">
            <div style="background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%); padding: 35px; border-radius: 20px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.8);">

                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                            
                        </div>
                        <h2 style="margin: 0; color: #1f2937; font-size: 1.7rem; font-weight: 700;">Gestión de Usuarios</h2>
                    </div>
                    <button onclick="cerrarPanelGestionUsuarios()" style="background: #f3f4f6; border: none; font-size: 1.8rem; cursor: pointer; color: #6b7280; padding: 8px 12px; line-height: 1; border-radius: 8px; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">&times;</button>
                </div>

                <!-- Loader -->
                <div id="loaderUsuarios" style="text-align: center; padding: 50px;">
                    <div style="font-size: 3.5em; margin-bottom: 15px; animation: pulse 1.5s infinite;">⏳</div>
                    <p style="font-size: 1.1em; font-weight: 500; color: #6b7280;">Cargando usuarios...</p>
                </div>

                <!-- Lista de usuarios (se llenará con JS) -->
                <div id="listaUsuarios" style="display: none;"></div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Cargar usuarios
    try {
        const response = await fetch('/api/auth/users/', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error al obtener usuarios');
        }

        const usuarios = await response.json();
        console.log('[ADMIN] Usuarios obtenidos:', usuarios);

        // Ocultar loader
        document.getElementById('loaderUsuarios').style.display = 'none';

        // Mostrar lista
        const listaUsuarios = document.getElementById('listaUsuarios');
        listaUsuarios.style.display = 'block';

        let htmlUsuarios = '';
        usuarios.forEach((user, index) => {
            const roleColor = {
                'Super Administrador': '#3b82f6',
                'Director': '#8b5cf6',
                'Secretario': '#10b981',
                'Tesorero': '#1f2937',
                'Capitán': '#dc2626',
                'Ayudante': '#f59e0b'
            }[user.role] || '#6b7280';

            htmlUsuarios += `
                <div style="background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 15px; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.2)'" onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${roleColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.2rem;">
                                    ${user.username.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style="font-weight: 700; font-size: 1.1rem; color: #1f2937;">@${user.username}</div>
                                    <div style="display: inline-block; background: ${roleColor}; color: white; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; margin-top: 4px;">${user.role}</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <button onclick="cambiarPasswordUsuario('${user.username}', '${user.role}')" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95em; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(245, 158, 11, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(245, 158, 11, 0.3)'">
                                 Cambiar Contraseña
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        listaUsuarios.innerHTML = htmlUsuarios;

    } catch (error) {
        console.error('[ADMIN] Error:', error);
        document.getElementById('loaderUsuarios').innerHTML = `
            <div style="text-align: center; padding: 30px;">
                <div style="font-size: 3em; margin-bottom: 15px;"></div>
                <p style="color: #ef4444; font-weight: 600;">Error al cargar usuarios</p>
                <p style="color: #6b7280; font-size: 0.9em;">${error.message}</p>
            </div>
        `;
    }
}

function cerrarPanelGestionUsuarios() {
    const modal = document.getElementById('modalGestionUsuarios');
    if (modal) {
        modal.remove();
    }
}

function cambiarPasswordUsuario(username, role) {
    console.log('[ADMIN] Cambiar password de:', username);

    // Crear modal para cambiar contraseña
    const modalHTML = `
        <div id="modalCambiarPassword" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
            <div style="background: white; padding: 35px; border-radius: 20px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">

                <!-- Header -->
                <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #e5e7eb;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 12px;">
                        
                    </div>
                    <h2 style="margin: 0; color: #1f2937; font-size: 1.6rem; font-weight: 700;">Cambiar Contraseña</h2>
                    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 0.95rem;">Usuario: <strong>@${username}</strong> (${role})</p>
                </div>

                <!-- Formulario -->
                <div style="margin-bottom: 25px;">
                    <label style="display: block; color: #374151; font-weight: 600; margin-bottom: 8px; font-size: 0.95rem;">Nueva Contraseña:</label>
                    <input type="password" id="inputNuevaPassword" placeholder="Escribe la nueva contraseña" style="width: 100%; padding: 12px 15px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; transition: all 0.3s; box-sizing: border-box;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">

                    <label style="display: block; color: #374151; font-weight: 600; margin: 15px 0 8px 0; font-size: 0.95rem;">Confirmar Contraseña:</label>
                    <input type="password" id="inputConfirmarPassword" placeholder="Confirma la nueva contraseña" style="width: 100%; padding: 12px 15px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; transition: all 0.3s; box-sizing: border-box;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">

                    <div id="errorPassword" style="display: none; background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-top: 15px; color: #991b1b; font-size: 0.9rem; font-weight: 500;"></div>
                </div>

                <!-- Botones -->
                <div style="display: flex; gap: 12px;">
                    <button onclick="cerrarModalCambiarPassword()" style="flex: 1; background: #f3f4f6; color: #6b7280; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                        Cancelar
                    </button>
                    <button onclick="confirmarCambioPassword('${username}')" style="flex: 1; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1em; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)'">
                         Cambiar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Focus en el primer input
    setTimeout(() => document.getElementById('inputNuevaPassword').focus(), 100);
}

function cerrarModalCambiarPassword() {
    const modal = document.getElementById('modalCambiarPassword');
    if (modal) {
        modal.remove();
    }
}

async function confirmarCambioPassword(username) {
    const password1 = document.getElementById('inputNuevaPassword').value;
    const password2 = document.getElementById('inputConfirmarPassword').value;
    const errorDiv = document.getElementById('errorPassword');

    // Validaciones
    if (!password1 || !password2) {
        errorDiv.textContent = 'Por favor completa ambos campos';
        errorDiv.style.display = 'block';
        return;
    }

    if (password1 !== password2) {
        errorDiv.textContent = 'Las contraseñas no coinciden';
        errorDiv.style.display = 'block';
        return;
    }

    if (password1.length < 4) {
        errorDiv.textContent = 'La contraseña debe tener al menos 4 caracteres';
        errorDiv.style.display = 'block';
        return;
    }

    // Ocultar error
    errorDiv.style.display = 'none';

    // Deshabilitar botón mientras se procesa
    const btnCambiar = event.target;
    const textoOriginal = btnCambiar.textContent;
    btnCambiar.textContent = '⏳ Cambiando...';
    btnCambiar.disabled = true;

    try {
        console.log('[ADMIN] Cambiando contraseña para:', username);

        // Llamar al endpoint de Django
        const response = await fetch('/api/auth/change-password/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: username,
                new_password: password1
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // xito
            alert(` Contraseña de @${username} cambiada correctamente\n\nNueva contraseña: ${password1}\n\n️ Guarda esta contraseña en un lugar seguro`);

            // Cerrar modales
            cerrarModalCambiarPassword();
            cerrarPanelGestionUsuarios();
        } else {
            // Error del servidor
            errorDiv.textContent = data.error || 'Error al cambiar contraseña';
            errorDiv.style.display = 'block';
            btnCambiar.textContent = textoOriginal;
            btnCambiar.disabled = false;
        }
    } catch (error) {
        console.error('[ADMIN] Error al cambiar contraseña:', error);
        errorDiv.textContent = 'Error de conexión con el servidor';
        errorDiv.style.display = 'block';
        btnCambiar.textContent = textoOriginal;
        btnCambiar.disabled = false;
    }
}

// Exportar funciones globales
window.abrirPanelGestionUsuarios = abrirPanelGestionUsuarios;
window.cerrarPanelGestionUsuarios = cerrarPanelGestionUsuarios;
window.cambiarPasswordUsuario = cambiarPasswordUsuario;
window.cerrarModalCambiarPassword = cerrarModalCambiarPassword;
window.confirmarCambioPassword = confirmarCambioPassword;
window.mostrarDeudoresDesdeWidget = mostrarDeudoresDesdeWidget;
window.mostrarSolicitudesPortalDesdeWidget = mostrarSolicitudesPortalDesdeWidget;
window.cerrarModalDeudores = cerrarModalDeudores;
window.verListadoCuotas = verListadoCuotas;
window.cerrarListadoCuotas = cerrarListadoCuotas;
window.verListadoBeneficios = verListadoBeneficios;
window.cerrarListadoBeneficios = cerrarListadoBeneficios;
window.generarPDFDeudores = generarPDFDeudores;

