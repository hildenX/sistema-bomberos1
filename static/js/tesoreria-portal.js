(function () {
    const PAGE_SIZE = 10;
    const state = {
        page: 1,
        search: '',
        estado: 'todos',
        selectedAction: null,
        selectedSolicitudId: null,
    };

    const STATUS_META = {
        pendiente: { label: 'Pendiente', className: 'is-pending' },
        observada: { label: 'Observada', className: 'is-observed' },
        aprobada: { label: 'Pagado', className: 'is-paid' },
        rechazada: { label: 'Rechazado', className: 'is-rejected' },
        expirada: { label: 'Expirada', className: 'is-expired' },
    };

    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Error de comunicacion');
        }
        return data;
    }

    function money(value) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0
        }).format(value || 0);
    }

    function fmtDate(value) {
        if (!value) return '-';
        return new Intl.DateTimeFormat('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(`${value}T12:00:00`));
    }

    function fmtDateTime(value) {
        if (!value) return '-';
        return new Intl.DateTimeFormat('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value));
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function renderComprobanteButton(url) {
        const safeUrl = escapeHtml(url);
        return `
            <a href="${safeUrl}" target="_blank" rel="noopener" class="request-download-button" data-tooltip="Comprobante">
                <span class="request-download-wrapper">
                    <span class="request-download-text">Descargar</span>
                    <span class="request-download-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                            <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                        </svg>
                    </span>
                </span>
            </a>
        `;
    }

    function buildUrl() {
        const params = new URLSearchParams();
        params.set('page', String(state.page));
        if (state.estado && state.estado !== 'todos') params.set('estado', state.estado);
        if (state.search) params.set('q', state.search);
        return `/api/portal/tesoreria/solicitudes/?${params.toString()}`;
    }

    function syncQuickFilters() {
        document.querySelectorAll('[data-quick-filter]').forEach((button) => {
            const active = button.getAttribute('data-quick-filter') === state.estado;
            button.classList.toggle('is-active', active);
        });
    }

    function getStatusMeta(item) {
        return STATUS_META[item.estado] || { label: item.estado_label || item.estado, className: '' };
    }

    function renderSummary(summary) {
        document.getElementById('metricPendientes').textContent = summary.pendientes;
        document.getElementById('metricPagados').textContent = summary.pagados;
        document.getElementById('metricTotal').textContent = summary.total;
        document.getElementById('badgePendientes').textContent = summary.pendientes;

        const chip = document.getElementById('chipPendientes');
        if (chip) {
            const hayPendientes = Number(summary.pendientes) > 0;
            chip.textContent = hayPendientes ? 'Alerta' : 'Al día';
            chip.classList.toggle('is-alert', hayPendientes);
            chip.classList.toggle('is-ok', !hayPendientes);
        }
    }

    function renderPagination(pagination) {
        const status = document.getElementById('paginationStatus');
        const controls = document.getElementById('paginationControls');

        if (!pagination.total_items) {
            status.textContent = 'Sin resultados';
            controls.innerHTML = '';
            return;
        }

        status.textContent = `Mostrando ${pagination.start_index}-${pagination.end_index} de ${pagination.total_items} solicitudes`;

        const buttons = [];
        buttons.push(`
            <button class="pager-btn" ${pagination.has_previous ? '' : 'disabled'} data-page="${pagination.page - 1}">
                Anterior
            </button>
        `);

        const windowStart = Math.max(1, pagination.page - 2);
        const windowEnd = Math.min(pagination.total_pages, pagination.page + 2);
        for (let page = windowStart; page <= windowEnd; page += 1) {
            buttons.push(`
                <button class="pager-btn ${page === pagination.page ? 'is-current' : ''}" data-page="${page}">
                    ${page}
                </button>
            `);
        }

        buttons.push(`
            <button class="pager-btn" ${pagination.has_next ? '' : 'disabled'} data-page="${pagination.page + 1}">
                Siguiente
            </button>
        `);

        controls.innerHTML = buttons.join('');
        controls.querySelectorAll('[data-page]').forEach((button) => {
            button.addEventListener('click', () => {
                const nextPage = Number(button.getAttribute('data-page'));
                if (!Number.isNaN(nextPage) && nextPage > 0) {
                    state.page = nextPage;
                    loadSolicitudes();
                }
            });
        });
    }

    const CHECK_ICON = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>';

    const CLOSED_META = {
        aprobada: {
            color: '#15803d',
            title: 'Pago aprobado',
            sub: 'Solicitud verificada y cerrada exitosamente en el sistema de control.',
            icon: CHECK_ICON,
            stamp: CHECK_ICON,
        },
        rechazada: {
            color: '#b91c1c',
            title: 'Pago rechazado',
            sub: 'Solicitud revisada y rechazada. El voluntario fue notificado del motivo.',
            icon: '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>',
            stamp: '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"></path>',
        },
        expirada: {
            color: '#6b7280',
            title: 'Solicitud expirada',
            sub: 'El plazo de gestión venció sin revisión. Cerrada automáticamente.',
            icon: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"></circle><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>',
            stamp: '<path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>',
        },
    };

    function refId(item) {
        return `#TRX-${String(item.id).padStart(4, '0')}`;
    }

    function renderClosedNote(item, meta) {
        const closed = CLOSED_META[item.estado] || {
            color: '#6b7280',
            title: meta.label || 'Solicitud cerrada',
            sub: 'Esta solicitud ya no admite acciones.',
            icon: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"></path>',
            stamp: CHECK_ICON,
        };
        const verifiedDate = fmtDate(item.fecha_pago) !== '-' ? fmtDate(item.fecha_pago) : fmtDate(item.created_at);
        return `
            <div class="verify-panel" style="--mark-color:${closed.color}">
                <span class="verify-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24">${closed.icon}</svg>
                    <span class="verify-stamp"><svg viewBox="0 0 24 24">${closed.stamp}</svg></span>
                </span>
                <p class="verify-title">${escapeHtml(closed.title)}</p>
                <p class="verify-sub">${escapeHtml(closed.sub)}</p>
                <div class="verify-meta">
                    <div class="verify-row"><span>Verificado el</span><strong>${verifiedDate}</strong></div>
                    <div class="verify-row"><span>Ref ID</span><strong>${refId(item)}</strong></div>
                </div>
            </div>
        `;
    }

    function renderSolicitudes(data) {
        const list = document.getElementById('listaSolicitudesPortal');
        const pagination = data.pagination;

        if (!data.solicitudes.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">#</div>
                    <h3>No hay solicitudes para este filtro</h3>
                    <p>Prueba cambiando el estado o el texto de busqueda.</p>
                </div>
            `;
            renderPagination(pagination);
            return;
        }

        list.innerHTML = data.solicitudes.map((item, index) => {
            const meta = getStatusMeta(item);
            const number = pagination.start_index + index;
            const puedeGestionarse = item.estado === 'pendiente' || item.estado === 'observada';

            return `
                <article class="request-card">
                    <div class="request-index">#${number}</div>
                    <div class="request-main">
                        <div class="request-topline">
                            <div>
                                <h3>${escapeHtml(item.nombre_pago)}</h3>
                                <p class="request-subtitle">${escapeHtml(item.voluntario.nombre)} · ${escapeHtml(item.voluntario.rut)}</p>
                            </div>
                            <div class="amount-wrap">
                                <span class="amount-label">Monto</span>
                                <div class="request-amount">${money(item.monto_solicitado)}</div>
                            </div>
                        </div>

                        <div class="request-meta-grid">
                            <div><span>Estado operativo</span><strong class="status-pill ${meta.className}">${meta.label}</strong></div>
                            <div><span>Tipo de gasto</span><strong>${escapeHtml(item.tipo_pago_label || item.tipo_pago)}</strong></div>
                            <div><span>Fecha de pago</span><strong>${fmtDate(item.fecha_pago)}</strong></div>
                            <div><span>Timestamp registro</span><strong>${fmtDateTime(item.created_at)}</strong></div>
                            <div><span>N. comprobante</span><strong>${escapeHtml(item.numero_comprobante || '-')}</strong></div>
                            <div><span>Oficial a cargo</span><strong>${escapeHtml(item.revisada_por || '-')}</strong></div>
                        </div>

                        <div class="request-description">
                            <span>Descripci&oacute;n / Notas</span>
                            <p>${escapeHtml(item.descripcion || 'Sin descripcion adicional.')}</p>
                        </div>

                        ${item.feedback_tesorero ? `
                            <div class="request-feedback">
                                <span>Feedback tesoreria</span>
                                <p>${escapeHtml(item.feedback_tesorero)}</p>
                            </div>
                        ` : ''}

                        <div class="request-links">
                            ${item.comprobante_url ? renderComprobanteButton(item.comprobante_url) : '<span class="muted-link">Sin comprobante adjunto</span>'}
                            ${item.observada_hasta ? `<span class="deadline">Corregir antes de ${fmtDateTime(item.observada_hasta)}</span>` : ''}
                        </div>
                    </div>
                    <div class="request-actions ${puedeGestionarse ? '' : 'is-closed'}">
                        ${puedeGestionarse ? `
                            <p class="request-actions-title">Acciones</p>
                            <button class="primary-btn" data-action="aprobar" data-id="${item.id}">Aprobar</button>
                            <button class="secondary-btn" data-action="observar" data-id="${item.id}">Observar</button>
                            <button class="danger-btn" data-action="rechazar" data-id="${item.id}">Rechazar</button>
                        ` : renderClosedNote(item, meta)}
                    </div>
                </article>
            `;
        }).join('');

        list.querySelectorAll('[data-action]').forEach((button) => {
            button.addEventListener('click', () => {
                const solicitudId = Number(button.getAttribute('data-id'));
                const action = button.getAttribute('data-action');
                if (action === 'aprobar') {
                    accionSolicitudPortal(solicitudId, 'aprobar');
                } else {
                    abrirModalGestionSolicitud(solicitudId, action);
                }
            });
        });

        renderPagination(pagination);
    }

    async function loadSolicitudes() {
        const root = document.getElementById('tesoreriaSolicitudesPortal');
        if (!root) return;

        const list = document.getElementById('listaSolicitudesPortal');
        list.innerHTML = '<div class="loading-state">Cargando solicitudes...</div>';

        try {
            const data = await request(buildUrl());
            renderSummary(data.summary);
            renderSolicitudes(data);
        } catch (error) {
            list.innerHTML = `<div class="empty-state"><h3>No se pudo cargar la bandeja</h3><p>${escapeHtml(error.message)}</p></div>`;
        }
    }

    async function accionSolicitudPortal(id, accion, feedback = '') {
        try {
            await request(`/api/portal/tesoreria/solicitudes/${id}/accion/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion, feedback }),
            });
            await loadSolicitudes();
        } catch (err) {
            alert(err.message);
        }
    }

    function abrirModalGestionSolicitud(id, accion) {
        state.selectedSolicitudId = id;
        state.selectedAction = accion;

        const modal = document.getElementById('modalGestionSolicitud');
        const title = document.getElementById('modalGestionTitulo');
        const helper = document.getElementById('modalGestionHelper');
        const textarea = document.getElementById('modalGestionFeedback');
        const submit = document.getElementById('modalGestionSubmit');

        title.textContent = accion === 'observar' ? 'Observar solicitud' : 'Rechazar solicitud';
        helper.textContent = accion === 'observar'
            ? 'Indica la correccion que debe hacer el voluntario antes de reenviar el comprobante.'
            : 'Indica claramente por que este pago no corresponde o debe ser rechazado.';
        submit.textContent = accion === 'observar' ? 'Guardar observacion' : 'Confirmar rechazo';
        textarea.value = '';
        modal.classList.add('is-open');
        textarea.focus();
    }

    function cerrarModalGestionSolicitud() {
        document.getElementById('modalGestionSolicitud').classList.remove('is-open');
        state.selectedSolicitudId = null;
        state.selectedAction = null;
    }

    async function confirmarModalGestion() {
        const textarea = document.getElementById('modalGestionFeedback');
        const feedback = textarea.value.trim();
        if (!feedback) {
            textarea.focus();
            return;
        }
        await accionSolicitudPortal(state.selectedSolicitudId, state.selectedAction, feedback);
        cerrarModalGestionSolicitud();
    }

    function bindSolicitudesPage() {
        const root = document.getElementById('tesoreriaSolicitudesPortal');
        if (!root) return;

        document.getElementById('buscadorSolicitudes').addEventListener('input', (event) => {
            state.search = event.target.value.trim();
            state.page = 1;
            clearTimeout(window.__portalSearchTimer);
            window.__portalSearchTimer = setTimeout(loadSolicitudes, 280);
        });

        document.getElementById('filtroEstado').addEventListener('change', (event) => {
            state.estado = event.target.value;
            state.page = 1;
            syncQuickFilters();
            loadSolicitudes();
        });

        document.querySelectorAll('[data-quick-filter]').forEach((button) => {
            button.addEventListener('click', () => {
                state.estado = button.getAttribute('data-quick-filter');
                state.page = 1;
                document.getElementById('filtroEstado').value = state.estado;
                syncQuickFilters();
                loadSolicitudes();
            });
        });

        document.getElementById('modalGestionClose').addEventListener('click', cerrarModalGestionSolicitud);
        document.getElementById('modalGestionCancel').addEventListener('click', cerrarModalGestionSolicitud);
        document.getElementById('modalGestionSubmit').addEventListener('click', confirmarModalGestion);
        document.getElementById('modalGestionBackdrop').addEventListener('click', cerrarModalGestionSolicitud);

        syncQuickFilters();
        loadSolicitudes();
    }

    async function loadCredenciales() {
        const root = document.getElementById('tesoreriaCredencialesPortal');
        if (!root) return;

        const data = await request('/api/portal/tesoreria/credenciales/');
        document.getElementById('passwordGenerica').textContent = data.password_generica;
        const list = document.getElementById('listaCredencialesPortal');
        if (!data.credenciales.length) {
            list.innerHTML = '<div class="empty-state">No hay credenciales generadas.</div>';
            return;
        }

        list.innerHTML = `
            <table class="tabla-portal">
                <thead>
                    <tr>
                        <th>Voluntario</th>
                        <th>RUT</th>
                        <th>Usuario</th>
                        <th>Clave inicial</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.credenciales.map((item) => `
                        <tr>
                            <td>${escapeHtml(item.voluntario)}</td>
                            <td>${escapeHtml(item.rut)}</td>
                            <td>${escapeHtml(item.username)}</td>
                            <td>${escapeHtml(item.password_inicial || 'Cambiada')}</td>
                            <td>${item.activo ? 'Activo' : 'Bloqueado'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindSolicitudesPage();
        if (document.getElementById('tesoreriaCredencialesPortal')) {
            await loadCredenciales();
        }
    });
})();
