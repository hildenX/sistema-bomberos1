// ============================================================
// GESTOR DE LOGOS - carga/sube/elimina logos de la compañía
// Reconstruido: el modal (sidebar-django.js) espera window.inicializarGestorLogos()
// API: /api/logos/ (LogoCompaniaViewSet)
// ============================================================

(function () {
    const API_LOGOS = '/api/logos/';

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === name + '=') {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function headersJSON() {
        return {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        };
    }

    async function cargarLista() {
        const cont = document.getElementById('listaLogos');
        if (!cont) return;
        try {
            const resp = await fetch(API_LOGOS, { credentials: 'include' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            const logos = data.results || data;
            renderLista(logos);
        } catch (e) {
            cont.innerHTML = `<div style="text-align:center; padding:40px; color:#ef4444;">
                <div style="font-size:2.5em; margin-bottom:10px;">⚠️</div>
                <p style="font-weight:600;">No se pudieron cargar los logos</p>
                <p style="font-size:.85em; color:#9ca3af;">${e.message}</p>
            </div>`;
        }
    }

    function renderLista(logos) {
        const cont = document.getElementById('listaLogos');
        if (!cont) return;

        if (!logos || logos.length === 0) {
            cont.innerHTML = `<div style="text-align:center; padding:40px; color:#9ca3af;">
                <div style="font-size:3em; margin-bottom:10px;">🖼️</div>
                <p style="font-weight:500;">Todavía no hay logos cargados</p>
                <p style="font-size:.85em;">Subí uno con el botón de arriba.</p>
            </div>`;
            return;
        }

        cont.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:18px;">
            ${logos.map(logoCard).join('')}
        </div>`;
    }

    function chip(id, campo, activo, label) {
        return `<label style="display:flex; align-items:center; gap:6px; font-size:.82em; color:#374151; cursor:pointer;">
            <input type="checkbox" ${activo ? 'checked' : ''} onchange="window.__toggleLogoContexto(${id}, '${campo}', this.checked)">
            ${label}
        </label>`;
    }

    function logoCard(l) {
        const img = l.imagen && l.imagen.startsWith('data:') ? l.imagen : (l.imagen ? 'data:image/png;base64,' + l.imagen : '');
        return `<div style="border:1px solid #e5e7eb; border-radius:14px; padding:14px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.06);">
            <div style="height:110px; display:flex; align-items:center; justify-content:center; background:#f9fafb; border-radius:10px; margin-bottom:10px; overflow:hidden;">
                ${img ? `<img src="${img}" style="max-width:100%; max-height:100%; object-fit:contain;">` : '<span style="color:#9ca3af;">sin imagen</span>'}
            </div>
            <div style="font-weight:700; color:#1f2937; margin-bottom:8px; font-size:.95em; word-break:break-word;">${l.nombre || 'Logo'}</div>
            <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:12px;">
                ${chip(l.id, 'usar_en_pdfs', l.usar_en_pdfs, '📄 PDFs')}
                ${chip(l.id, 'usar_en_asistencias', l.usar_en_asistencias, '📋 Asistencias')}
                ${chip(l.id, 'usar_en_sidebar', l.usar_en_sidebar, '📱 Sidebar')}
            </div>
            <button onclick="window.__eliminarLogo(${l.id})" style="width:100%; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:8px; border-radius:8px; cursor:pointer; font-weight:600; font-size:.85em;">🗑️ Eliminar</button>
        </div>`;
    }

    window.__toggleLogoContexto = async function (id, campo, valor) {
        try {
            const resp = await fetch(API_LOGOS + id + '/', {
                method: 'PATCH',
                headers: headersJSON(),
                credentials: 'include',
                body: JSON.stringify({ [campo]: valor })
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            if (typeof mostrarNotificacionModal === 'function') mostrarNotificacionModal('Actualizado ✅', 'success');
            cargarLista();
            if (window.refrescarLogosSistema) window.refrescarLogosSistema();
        } catch (e) {
            alert('No se pudo actualizar: ' + e.message);
            cargarLista();
        }
    };

    window.__eliminarLogo = async function (id) {
        if (!confirm('¿Eliminar este logo?')) return;
        try {
            const resp = await fetch(API_LOGOS + id + '/', {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include'
            });
            if (!resp.ok && resp.status !== 204) throw new Error('HTTP ' + resp.status);
            cargarLista();
            if (window.refrescarLogosSistema) window.refrescarLogosSistema();
        } catch (e) {
            alert('No se pudo eliminar: ' + e.message);
        }
    };

    function subirArchivo(file) {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { alert('El archivo supera los 2MB.'); return; }
        if (!file.type.startsWith('image/')) { alert('Seleccioná una imagen válida.'); return; }

        const nombre = prompt('Nombre del logo (ej: Logo Oficial):', file.name.replace(/\.[^.]+$/, ''));
        if (nombre === null) return;

        const reader = new FileReader();
        reader.onload = async function (e) {
            const cont = document.getElementById('listaLogos');
            if (cont) cont.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;">Subiendo…</div>';
            try {
                const resp = await fetch(API_LOGOS, {
                    method: 'POST',
                    headers: headersJSON(),
                    credentials: 'include',
                    body: JSON.stringify({
                        nombre: nombre || 'Logo',
                        imagen: e.target.result,
                        usar_en_pdfs: false,
                        usar_en_asistencias: false,
                        usar_en_sidebar: false
                    })
                });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                cargarLista();
                if (window.refrescarLogosSistema) window.refrescarLogosSistema();
            } catch (err) {
                alert('No se pudo subir el logo: ' + err.message);
                cargarLista();
            }
        };
        reader.readAsDataURL(file);
    }

    window.inicializarGestorLogos = function () {
        const btn = document.getElementById('btnSubirLogoNuevo');
        const input = document.getElementById('inputLogoNuevo');
        if (btn && input) {
            btn.onclick = () => input.click();
            input.onchange = () => { subirArchivo(input.files[0]); input.value = ''; };
        }
        cargarLista();
    };

    // Marcador para que sidebar-django.js no recargue el script
    window.GestorLogos = { version: '1.0', reload: cargarLista };
})();
