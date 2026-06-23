(function () {
    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Error de comunicación');
        }
        return data;
    }

    async function initLogin() {
        const form = document.getElementById('portalLoginForm');
        if (!form) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const error = document.getElementById('portalLoginError');
            error.textContent = '';
            try {
                await request('/api/portal/auth/login/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: form.username.value,
                        password: form.password.value,
                    })
                });
                window.location.href = '/portal/panel/';
            } catch (err) {
                error.textContent = err.message;
            }
        });
    }

    function renderList(containerId, items, htmlEmpty, renderer) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!items.length) {
            container.innerHTML = htmlEmpty;
            return;
        }
        container.innerHTML = items.map(renderer).join('');
    }

    function money(value) {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);
    }

    let dashboardCache = null;
    let editSolicitudId = null;

    function openForm(config) {
        editSolicitudId = config.editSolicitudId || null;
        document.getElementById('solicitudTitulo').textContent = config.title;
        document.getElementById('tipo_pago').value = config.tipo_pago;
        document.getElementById('nombre_pago').value = config.nombre_pago || '';
        document.getElementById('monto_solicitado').value = config.monto_solicitado || '';
        document.getElementById('fecha_pago').value = config.fecha_pago || new Date().toISOString().slice(0, 10);
        document.getElementById('descripcion').value = config.descripcion || '';
        document.getElementById('numero_comprobante').value = config.numero_comprobante || '';
        document.getElementById('cuota_mes').value = config.cuota_mes || '';
        document.getElementById('cuota_anio').value = config.cuota_anio || '';
        document.getElementById('asignacion_beneficio_id').value = config.asignacion_beneficio_id || '';
        document.getElementById('asignacion_rifa_id').value = config.asignacion_rifa_id || '';
        document.getElementById('tipo_pago_beneficio').value = config.tipo_pago_beneficio || 'normal';
        document.getElementById('cantidad').value = config.cantidad || 1;
        document.getElementById('tipoBloqueCuota').style.display = config.tipo_pago === 'cuota' ? 'block' : 'none';
        document.getElementById('tipoBloqueBeneficio').style.display = config.tipo_pago === 'beneficio' ? 'block' : 'none';
        document.getElementById('tipoBloqueRifa').style.display = config.tipo_pago === 'rifa' ? 'block' : 'none';
        document.getElementById('solicitudFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function bindDashboardActions() {
        window.prepararCuotaPortal = (mes, anio, monto) => {
            openForm({
                title: `Solicitar pago cuota ${String(mes).padStart(2, '0')}/${anio}`,
                tipo_pago: 'cuota',
                nombre_pago: `Cuota ${String(mes).padStart(2, '0')}/${anio}`,
                monto_solicitado: monto,
                cuota_mes: mes,
                cuota_anio: anio,
            });
        };

        window.prepararBeneficioPortal = (id, nombre, montoPendiente, precioNormal, precioExtra, disponibles) => {
            openForm({
                title: `Solicitar pago beneficio ${nombre}`,
                tipo_pago: 'beneficio',
                nombre_pago: nombre,
                monto_solicitado: precioNormal,
                asignacion_beneficio_id: id,
                cantidad: 1,
                tipo_pago_beneficio: 'normal',
            });
            const cantidadInput = document.getElementById('cantidad');
            const tipoPagoBeneficio = document.getElementById('tipo_pago_beneficio');
            const montoInput = document.getElementById('monto_solicitado');

            function recalc() {
                const qty = Math.max(parseInt(cantidadInput.value || '1', 10), 1);
                const tipo = tipoPagoBeneficio.value;
                const precio = tipo === 'extra' ? precioExtra : precioNormal;
                if (tipo === 'normal' && qty > disponibles) {
                    cantidadInput.value = disponibles;
                }
                montoInput.value = (Math.max(parseInt(cantidadInput.value || '1', 10), 1) * precio).toString();
            }

            cantidadInput.onchange = recalc;
            tipoPagoBeneficio.onchange = recalc;
        };

        window.prepararRifaPortal = (id, nombre, montoPendiente) => {
            openForm({
                title: `Solicitar pago rifa ${nombre}`,
                tipo_pago: 'rifa',
                nombre_pago: nombre,
                monto_solicitado: montoPendiente,
                asignacion_rifa_id: id,
            });
        };

        window.editarSolicitudPortal = async (solicitudId) => {
            const solicitud = dashboardCache.solicitudes.find((item) => item.id === solicitudId);
            if (!solicitud) return;
            openForm({
                editSolicitudId: solicitud.id,
                title: `Corregir solicitud #${solicitud.id}`,
                ...solicitud,
            });
        };

        window.cerrarSesionPortal = async () => {
            await request('/api/portal/auth/logout/', { method: 'POST' });
            window.location.href = '/portal/';
        };
    }

    async function loadDashboard() {
        const auth = await request('/api/portal/auth/check/');
        if (!auth.authenticated) {
            window.location.href = '/portal/';
            return;
        }

        const data = await request('/api/portal/dashboard/');
        dashboardCache = data.dashboard;
        document.getElementById('portalNombre').textContent = data.dashboard.usuario.voluntario.nombre;
        document.getElementById('portalRut').textContent = data.dashboard.usuario.voluntario.rut;
        document.getElementById('portalUsuario').textContent = data.dashboard.usuario.username;
        document.getElementById('portalAvisoClave').textContent = data.dashboard.usuario.must_change_password
            ? `Clave inicial activa: ${data.dashboard.password_inicial}. Cámbiala apenas ingreses.`
            : '';

        renderList('cuotasPendientes', data.dashboard.cuotas.pendientes, '<div class="empty-state">No hay cuotas pendientes del ciclo activo.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Monto pendiente: ${money(item.monto)}</p>
                </div>
                <button class="primary-btn" onclick="prepararCuotaPortal(${item.mes}, ${item.anio}, ${item.monto})">Solicitar pago</button>
            </article>
        `);

        renderList('beneficiosPendientes', data.dashboard.beneficios, '<div class="empty-state">No hay beneficios pendientes.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Pendiente: ${money(item.monto_pendiente)} · Tarjetas disponibles: ${item.tarjetas_disponibles}</p>
                </div>
                <button class="primary-btn" onclick="prepararBeneficioPortal(${item.asignacion_id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.monto_pendiente}, ${item.precio_por_tarjeta}, ${item.precio_tarjeta_extra}, ${item.tarjetas_disponibles})">Solicitar pago</button>
            </article>
        `);

        renderList('rifasPendientes', data.dashboard.rifas, '<div class="empty-state">No hay rifas activas pendientes.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Pendiente: ${money(item.monto_pendiente)} · Estado: ${item.estado}</p>
                </div>
                ${item.puede_pagar ? `<button class="primary-btn" onclick="prepararRifaPortal(${item.asignacion_id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.monto_pendiente})">Solicitar pago</button>` : `<span class="pill warning">Retira los talonarios antes de pagar</span>`}
            </article>
        `);

        renderList('solicitudesHistorial', data.dashboard.solicitudes, '<div class="empty-state">Todavía no envías solicitudes.</div>', (item) => `
            <article class="request-card">
                <div>
                    <h4>${item.nombre_pago}</h4>
                    <p>${item.tipo_pago} · ${money(item.monto_solicitado)} · ${item.estado}</p>
                    <p>${item.feedback_tesorero || ''}</p>
                    ${item.observada_hasta ? `<p>Debes corregir antes de ${new Date(item.observada_hasta).toLocaleString('es-CL')}</p>` : ''}
                </div>
                ${(item.estado === 'observada' || item.estado === 'expirada') ? `<button class="secondary-btn" onclick="editarSolicitudPortal(${item.id})">Corregir</button>` : ''}
            </article>
        `);

        const cuentaSelect = document.getElementById('cuenta_bancaria_destino_id');
        cuentaSelect.innerHTML = '<option value="">Seleccione cuenta destino</option>' + data.dashboard.cuentas_bancarias.map((item) =>
            `<option value="${item.id}">${item.nombre} · ${item.banco} · ${item.numero_cuenta || 'sin número'}</option>`
        ).join('');
    }

    async function initPanel() {
        const panel = document.getElementById('portalPanel');
        if (!panel) return;

        bindDashboardActions();
        await loadDashboard();

        document.getElementById('solicitudForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const error = document.getElementById('solicitudError');
            const ok = document.getElementById('solicitudOk');
            error.textContent = '';
            ok.textContent = '';

            const formData = new FormData(form);
            const endpoint = editSolicitudId ? `/api/portal/solicitudes/${editSolicitudId}/` : '/api/portal/solicitudes/';
            const method = 'POST';

            try {
                await request(endpoint, {
                    method,
                    body: formData,
                });
                ok.textContent = editSolicitudId ? 'Solicitud corregida y reenviada.' : 'Solicitud enviada correctamente.';
                form.reset();
                editSolicitudId = null;
                await loadDashboard();
            } catch (err) {
                error.textContent = err.message;
            }
        });

        document.getElementById('passwordForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const msg = document.getElementById('passwordMsg');
            msg.textContent = '';
            try {
                await request('/api/portal/auth/change-password/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        current_password: form.current_password.value,
                        new_password: form.new_password.value,
                    })
                });
                msg.textContent = 'Contraseña actualizada.';
                form.reset();
                await loadDashboard();
            } catch (err) {
                msg.textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initLogin();
        initPanel();
    });
})();
