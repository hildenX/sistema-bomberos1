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
    let carrito = [];

    function claveItem(tipo, ref) {
        return `${tipo}:${ref}`;
    }

    function renderCarrito() {
        const vacio = document.getElementById('carritoVacio');
        const itemsDiv = document.getElementById('carritoItems');
        const totalDiv = document.getElementById('carritoTotal');
        const form = document.getElementById('solicitudForm');

        if (!carrito.length) {
            vacio.style.display = 'block';
            itemsDiv.innerHTML = '';
            totalDiv.style.display = 'none';
            form.style.display = 'none';
            return;
        }

        vacio.style.display = 'none';
        form.style.display = 'grid';

        itemsDiv.innerHTML = carrito.map((item) => `
            <article class="request-card">
                <div>
                    <h4>${item.nombre_pago}</h4>
                    <p>${money(item.monto)}</p>
                </div>
                <button class="danger-btn" onclick="quitarDelCarrito('${item.clave}')">Quitar</button>
            </article>
        `).join('');

        const total = carrito.reduce((sum, item) => sum + item.monto, 0);
        totalDiv.style.display = 'block';
        totalDiv.textContent = `Total a pagar: ${money(total)}`;

        if (!document.getElementById('fecha_pago').value) {
            document.getElementById('fecha_pago').value = new Date().toISOString().slice(0, 10);
        }
    }

    function agregarAlCarrito(item) {
        if (carrito.some((existing) => existing.clave === item.clave)) return;
        carrito.push(item);
        renderCarrito();
    }

    function bindDashboardActions() {
        window.quitarDelCarrito = (clave) => {
            carrito = carrito.filter((item) => item.clave !== clave);
            renderCarrito();
        };

        window.agregarCuotaCarrito = (mes, anio, monto) => {
            agregarAlCarrito({
                clave: claveItem('cuota', `${anio}-${mes}`),
                tipo_pago: 'cuota',
                nombre_pago: `Cuota ${String(mes).padStart(2, '0')}/${anio}`,
                monto,
                cuota_mes: mes,
                cuota_anio: anio,
            });

            const atrasadas = (dashboardCache.cuotas.pendientes || [])
                .filter((c) => (c.anio < anio) || (c.anio === anio && c.mes < mes));
            if (atrasadas.length) {
                atrasadas.forEach((c) => agregarAlCarrito({
                    clave: claveItem('cuota', `${c.anio}-${c.mes}`),
                    tipo_pago: 'cuota',
                    nombre_pago: `Cuota ${String(c.mes).padStart(2, '0')}/${c.anio}`,
                    monto: c.monto,
                    cuota_mes: c.mes,
                    cuota_anio: c.anio,
                }));
                const ok = document.getElementById('solicitudOk');
                const nombres = atrasadas.map((c) => `${String(c.mes).padStart(2, '0')}/${c.anio}`).join(', ');
                ok.textContent = `Se agregaron también las cuotas atrasadas: ${nombres}.`;
            }
        };

        window.agregarBeneficioCarrito = (id, nombre, montoPendiente) => {
            agregarAlCarrito({
                clave: claveItem('beneficio', id),
                tipo_pago: 'beneficio',
                nombre_pago: nombre,
                monto: montoPendiente,
                asignacion_beneficio_id: id,
                tipo_pago_beneficio: 'normal',
                cantidad: 1,
            });
        };

        window.agregarRifaCarrito = (id, nombre, montoPendiente) => {
            agregarAlCarrito({
                clave: claveItem('rifa', id),
                tipo_pago: 'rifa',
                nombre_pago: nombre,
                monto: montoPendiente,
                asignacion_rifa_id: id,
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
                <button class="primary-btn" onclick="agregarCuotaCarrito(${item.mes}, ${item.anio}, ${item.monto})">Agregar al carrito</button>
            </article>
        `);

        renderList('beneficiosPendientes', data.dashboard.beneficios, '<div class="empty-state">No hay beneficios pendientes.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Pendiente: ${money(item.monto_pendiente)} · Tarjetas disponibles: ${item.tarjetas_disponibles}</p>
                </div>
                <button class="primary-btn" onclick="agregarBeneficioCarrito(${item.asignacion_id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.monto_pendiente})">Agregar al carrito</button>
            </article>
        `);

        renderList('rifasPendientes', data.dashboard.rifas, '<div class="empty-state">No hay rifas activas pendientes.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Pendiente: ${money(item.monto_pendiente)} · Estado: ${item.estado}</p>
                </div>
                ${item.puede_pagar ? `<button class="primary-btn" onclick="agregarRifaCarrito(${item.asignacion_id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.monto_pendiente})">Agregar al carrito</button>` : `<span class="pill warning">Retira los talonarios antes de pagar</span>`}
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

        renderCarrito();
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

            if (!carrito.length) {
                error.textContent = 'Agrega al menos un item al carrito.';
                return;
            }

            const formData = new FormData(form);
            formData.set('items', JSON.stringify(carrito));

            try {
                await request('/api/portal/solicitudes/grupo/', {
                    method: 'POST',
                    body: formData,
                });
                ok.textContent = 'Solicitud enviada correctamente.';
                form.reset();
                carrito = [];
                renderCarrito();
                await loadDashboard();
            } catch (err) {
                error.textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initLogin();
        initPanel();
    });
})();
