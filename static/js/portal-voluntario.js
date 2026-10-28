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

    function precioUnitarioBeneficio(item) {
        return item.tipo_pago_beneficio === 'extra'
            ? item.precio_tarjeta_extra
            : item.precio_por_tarjeta;
    }

    // El monto de un beneficio siempre se deriva de la cantidad de tarjetas
    // por su precio unitario: el backend exige que coincidan exactamente.
    function recalcularBeneficio(item) {
        item.monto = item.cantidad * precioUnitarioBeneficio(item);
    }

    function controlesBeneficio(item) {
        if (item.tipo_pago !== 'beneficio') return '';
        const maxAttr = item.tipo_pago_beneficio === 'normal' && item.tarjetas_disponibles > 0
            ? `max="${item.tarjetas_disponibles}"`
            : '';
        return `
            <div class="carrito-controles">
                <label>Tipo de venta
                    <select data-cart-tipo="${item.clave}">
                        <option value="normal" ${item.tipo_pago_beneficio === 'normal' ? 'selected' : ''}>Tarjetas asignadas</option>
                        <option value="extra" ${item.tipo_pago_beneficio === 'extra' ? 'selected' : ''}>Tarjetas extra</option>
                    </select>
                </label>
                <label>Cantidad de tarjetas
                    <input type="number" min="1" step="1" ${maxAttr} value="${item.cantidad}" data-cart-cantidad="${item.clave}">
                </label>
                <span class="carrito-precio">${money(precioUnitarioBeneficio(item))} por tarjeta</span>
            </div>
        `;
    }

    function renderCarrito() {
        const vacio = document.getElementById('carritoVacio');
        const itemsDiv = document.getElementById('carritoItems');
        const totalDiv = document.getElementById('carritoTotal');
        const form = document.getElementById('solicitudForm');

        renderDeudas();
        renderResumen();
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
            <div class="pv-item">
                <div class="pv-item-top">
                    <span>${escapeHtml(item.nombre_pago)}</span>
                    <b>${money(item.monto)}</b>
                    <button type="button" class="pv-quitar" onclick="quitarDelCarrito('${item.clave}')" aria-label="Quitar ${escapeHtml(item.nombre_pago)}">×</button>
                </div>
                ${controlesBeneficio(item)}
            </div>
        `).join('');

        itemsDiv.querySelectorAll('[data-cart-cantidad]').forEach((input) => {
            input.addEventListener('change', () => {
                actualizarCantidadCarrito(input.getAttribute('data-cart-cantidad'), input.value);
            });
        });

        itemsDiv.querySelectorAll('[data-cart-tipo]').forEach((select) => {
            select.addEventListener('change', () => {
                actualizarTipoBeneficioCarrito(select.getAttribute('data-cart-tipo'), select.value);
            });
        });

        const total = carrito.reduce((sum, item) => sum + item.monto, 0);
        totalDiv.style.display = 'block';
        totalDiv.innerHTML = `<span>Total a transferir</span><b>${money(total)}</b>`;

        if (!document.getElementById('fecha_pago').value) {
            document.getElementById('fecha_pago').value = new Date().toISOString().slice(0, 10);
        }
    }

    function agregarAlCarrito(item) {
        if (carrito.some((existing) => existing.clave === item.clave)) return;
        carrito.push(item);
        renderCarrito();
    }

    function limitarCantidadBeneficio(item, cantidad) {
        let valor = parseInt(cantidad, 10);
        if (!Number.isFinite(valor) || valor < 1) valor = 1;
        if (item.tipo_pago_beneficio === 'normal' && item.tarjetas_disponibles > 0) {
            valor = Math.min(valor, item.tarjetas_disponibles);
        }
        return valor;
    }

    function actualizarCantidadCarrito(clave, valor) {
        const item = carrito.find((existing) => existing.clave === clave);
        if (!item || item.tipo_pago !== 'beneficio') return;
        item.cantidad = limitarCantidadBeneficio(item, valor);
        recalcularBeneficio(item);
        renderCarrito();
    }

    function actualizarTipoBeneficioCarrito(clave, valor) {
        const item = carrito.find((existing) => existing.clave === clave);
        if (!item || item.tipo_pago !== 'beneficio') return;
        item.tipo_pago_beneficio = valor === 'extra' ? 'extra' : 'normal';
        item.cantidad = limitarCantidadBeneficio(item, item.cantidad);
        recalcularBeneficio(item);
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

        window.agregarBeneficioCarrito = (id) => {
            const beneficio = (dashboardCache.beneficios || []).find((b) => b.asignacion_id === id);
            if (!beneficio) return;

            const hayDisponibles = beneficio.tarjetas_disponibles > 0;
            const item = {
                clave: claveItem('beneficio', id),
                tipo_pago: 'beneficio',
                nombre_pago: beneficio.nombre,
                monto: 0,
                asignacion_beneficio_id: id,
                tipo_pago_beneficio: hayDisponibles ? 'normal' : 'extra',
                cantidad: hayDisponibles ? beneficio.tarjetas_disponibles : 1,
                precio_por_tarjeta: beneficio.precio_por_tarjeta,
                precio_tarjeta_extra: beneficio.precio_tarjeta_extra,
                tarjetas_disponibles: beneficio.tarjetas_disponibles,
            };
            recalcularBeneficio(item);
            agregarAlCarrito(item);
        };

        window.agregarRifaCarrito = (id) => {
            const rifa = (dashboardCache.rifas || []).find((r) => r.asignacion_id === id);
            if (!rifa) return;

            agregarAlCarrito({
                clave: claveItem('rifa', id),
                tipo_pago: 'rifa',
                nombre_pago: rifa.nombre,
                monto: rifa.monto_pendiente,
                asignacion_rifa_id: id,
            });
        };

        window.agregarAniversarioCarrito = (id) => {
            const a = ((dashboardCache || {}).aniversario || []).find((x) => x.cuota_aniversario_id === id);
            if (!a) return;
            agregarAlCarrito({
                clave: claveItem('aniversario', id),
                tipo_pago: 'aniversario',
                nombre_pago: a.nombre,
                monto: a.monto,
                cuota_aniversario_id: id,
            });
        };

        window.agregarTodoCarrito = () => {
            const d = dashboardCache || {};
            (d.aniversario || []).forEach((a) => window.agregarAniversarioCarrito(a.cuota_aniversario_id));
            ((d.cuotas && d.cuotas.pendientes) || []).forEach((c) => agregarAlCarrito({
                clave: claveItem('cuota', `${c.anio}-${c.mes}`), tipo_pago: 'cuota',
                nombre_pago: `Cuota ${String(c.mes).padStart(2, '0')}/${c.anio}`, monto: c.monto, cuota_mes: c.mes, cuota_anio: c.anio,
            }));
            (d.beneficios || []).forEach((b) => window.agregarBeneficioCarrito(b.asignacion_id));
            (d.rifas || []).filter((r) => r.puede_pagar).forEach((r) => window.agregarRifaCarrito(r.asignacion_id));
            document.getElementById('solicitudFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        window.cerrarSesionPortal = async () => {
            await request('/api/portal/auth/logout/', { method: 'POST' });
            window.location.href = '/portal/';
        };
    }


    function escapeHtml(v) {
        return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const capital = (t) => t ? t[0].toUpperCase() + t.slice(1) : '';
    const enCarrito = (clave) => carrito.some((i) => i.clave === clave);

    function deudasTotales() {
        const d = dashboardCache || {};
        const cuotas = ((d.cuotas && d.cuotas.pendientes) || []).reduce((s, c) => s + Number(c.monto || 0), 0);
        const beneficios = (d.beneficios || []).reduce((s, b) => s + Number(b.monto_pendiente || 0), 0);
        const rifas = (d.rifas || []).reduce((s, r) => s + Number(r.monto_pendiente || 0), 0);
        const aniversario = (d.aniversario || []).reduce((s, a) => s + Number(a.monto || 0), 0);
        return { cuotas, beneficios, rifas, aniversario, total: cuotas + beneficios + rifas + aniversario };
    }

    function renderResumen() {
        const cont = document.getElementById('pvResumen');
        if (!cont || !dashboardCache) return;
        const t = deudasTotales();
        if (!t.total) {
            cont.className = 'pv-resumen is-ok';
            cont.innerHTML = '<div><span class="pv-resumen-lbl">Estás al día</span><b>$0</b></div><p>No tienes cuotas, beneficios, rifas ni cuota de aniversario pendientes.</p>';
            return;
        }
        const partes = [['Cuotas', t.cuotas], ['Aniversario', t.aniversario], ['Beneficios', t.beneficios], ['Rifas', t.rifas]].filter(([, m]) => m > 0);
        const todoAgregado = carrito.length && carrito.reduce((s, i) => s + i.monto, 0) >= t.total;
        cont.className = 'pv-resumen';
        cont.innerHTML = `
            <div><span class="pv-resumen-lbl">Total que debes</span><b>${money(t.total)}</b></div>
            <ul>${partes.map(([n, m]) => `<li><span>${n}</span>${money(m)}</li>`).join('')}</ul>
            ${todoAgregado ? '<span class="pv-agregado">Todo en tu pago ✓</span>' : '<button type="button" class="pv-btn is-pri" onclick="agregarTodoCarrito()">Pagar todo</button>'}`;
    }

    function botonAgregar(clave, onclick) {
        return enCarrito(clave)
            ? '<span class="pv-agregado">En tu pago ✓</span>'
            : `<button type="button" class="pv-btn is-sec" onclick="${onclick}">Agregar</button>`;
    }

    function renderDeudas() {
        const cont = document.getElementById('pvDeudas');
        if (!cont || !dashboardCache) return;
        const d = dashboardCache;
        const bloques = [];
        const cuotas = (d.cuotas && d.cuotas.pendientes) || [];
        if (cuotas.length) {
            bloques.push('<h3>Cuotas sociales</h3>' + cuotas.map((c) => `
                <div class="pv-deuda">
                    <div><b>${capital(MESES[c.mes - 1])} ${c.anio}</b></div>
                    <span class="pv-monto">${money(c.monto)}</span>
                    ${botonAgregar(claveItem('cuota', `${c.anio}-${c.mes}`), `agregarCuotaCarrito(${c.mes}, ${c.anio}, ${c.monto})`)}
                </div>`).join(''));
        }
        if ((d.aniversario || []).length) {
            bloques.push('<h3>Cuota de aniversario</h3>' + d.aniversario.map((a) => `
                <div class="pv-deuda">
                    <div><b>Aniversario ${a.anio}</b><small>Pago único acordado en asamblea</small></div>
                    <span class="pv-monto">${money(a.monto)}</span>
                    ${botonAgregar(claveItem('aniversario', a.cuota_aniversario_id), `agregarAniversarioCarrito(${a.cuota_aniversario_id})`)}
                </div>`).join(''));
        }
        if ((d.beneficios || []).length) {
            bloques.push('<h3>Beneficios</h3>' + d.beneficios.map((b) => `
                <div class="pv-deuda">
                    <div><b>${escapeHtml(capital(b.nombre))}</b><small>${b.tarjetas_disponibles} tarjeta${b.tarjetas_disponibles === 1 ? '' : 's'} por pagar · ${money(b.precio_por_tarjeta)} c/u</small></div>
                    <span class="pv-monto">${money(b.monto_pendiente)}</span>
                    ${botonAgregar(claveItem('beneficio', b.asignacion_id), `agregarBeneficioCarrito(${b.asignacion_id})`)}
                </div>`).join(''));
        }
        if ((d.rifas || []).length) {
            bloques.push('<h3>Rifas</h3>' + d.rifas.map((r) => `
                <div class="pv-deuda">
                    <div><b>${escapeHtml(capital(r.nombre))}</b>${r.puede_pagar ? '' : '<small>Retira los talonarios antes de pagar</small>'}</div>
                    <span class="pv-monto">${money(r.monto_pendiente)}</span>
                    ${r.puede_pagar ? botonAgregar(claveItem('rifa', r.asignacion_id), `agregarRifaCarrito(${r.asignacion_id})`) : '<span></span>'}
                </div>`).join(''));
        }
        cont.innerHTML = bloques.length ? bloques.join('') : '<div class="pv-vacio">No tienes nada pendiente. ¡Gracias por estar al día!</div>';
    }

    function resumirItems(items) {
        const cuotas = items.filter((i) => i.tipo_pago === 'cuota' && i.cuota_mes)
            .sort((a, b) => (a.cuota_anio - b.cuota_anio) || (a.cuota_mes - b.cuota_mes));
        const otros = items.filter((i) => !(i.tipo_pago === 'cuota' && i.cuota_mes)).map((i) => i.nombre_pago);
        if (!cuotas.length) return otros;
        const anio = cuotas[0].cuota_anio;
        const meses = cuotas.map((c) => c.cuota_mes);
        const seguidos = cuotas.every((c, i) => c.cuota_anio === anio && (i === 0 || c.cuota_mes === meses[i - 1] + 1));
        const txt = meses.length === 1 ? `Cuota ${MESES[meses[0] - 1]} ${anio}`
            : seguidos ? `Cuotas ${MESES[meses[0] - 1]} a ${MESES[meses[meses.length - 1] - 1]} ${anio}`
                : `${meses.length} cuotas`;
        return [txt, ...otros];
    }

    const ESTADO_PV = {
        pendiente: ['En revisión', 'is-pendiente', 'Tesorería revisará tu comprobante pronto.'],
        observada: ['Requiere corrección', 'is-observada', ''],
        aprobada: ['Aprobado', 'is-aprobada', 'Tu pago quedó registrado.'],
        rechazada: ['Rechazado', 'is-rechazada', ''],
        expirada: ['Vencido', 'is-expirada', 'No se corrigió a tiempo. Puedes enviar un pago nuevo.'],
    };

    function renderHistorial(grupos) {
        const cont = document.getElementById('solicitudesHistorial');
        if (!grupos.length) { cont.innerHTML = '<div class="pv-vacio">Aún no has enviado pagos por el portal.</div>'; return; }
        cont.innerHTML = grupos.map((g) => {
            const [label, clase, ayuda] = ESTADO_PV[g.estado] || [g.estado_label, '', ''];
            const f = g.fecha_pago ? new Date(`${g.fecha_pago}T12:00:00`).toLocaleDateString('es-CL') : '';
            return `
                <article class="pv-sol">
                    <div class="pv-sol-top">
                        <div><b>${escapeHtml(capital(resumirItems(g.items).join(' · ')))}</b><small>Transferencia del ${f}</small></div>
                        <div class="pv-sol-der"><span class="pv-pill ${clase}">${label}</span><b>${money(g.monto_total)}</b></div>
                    </div>
                    ${g.feedback_tesorero ? `<p class="pv-sol-msg"><span>Tesorería te dice:</span>${escapeHtml(g.feedback_tesorero)}</p>` : (ayuda ? `<p class="pv-sol-ayuda">${ayuda}</p>` : '')}
                    ${g.observada_hasta && g.estado === 'observada' ? `<p class="pv-sol-ayuda">Corrige antes del ${new Date(g.observada_hasta).toLocaleString('es-CL')}.</p>` : ''}
                </article>`;
        }).join('');
    }

    async function loadDashboard() {
        const auth = await request('/api/portal/auth/check/');
        if (!auth.authenticated) {
            window.location.href = '/portal/';
            return;
        }

        const data = await request('/api/portal/dashboard/');
        dashboardCache = data.dashboard;
        const vol = data.dashboard.usuario.voluntario;
        document.getElementById('portalNombre').textContent = vol.nombre;
        document.getElementById('portalIdent').textContent = [vol.clave ? `Clave ${vol.clave}` : '', vol.rut ? `RUN ${vol.rut}` : '', `Usuario ${data.dashboard.usuario.username}`].filter(Boolean).join(' · ');
        document.getElementById('portalAvisoClave').hidden = !data.dashboard.usuario.must_change_password;

        renderHistorial(data.dashboard.grupos_solicitud || []);

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

    async function initCambiarClave() {
        const form = document.getElementById('passwordForm');
        if (!form || document.getElementById('portalPanel')) return;

        const auth = await request('/api/portal/auth/check/');
        if (!auth.authenticated) {
            window.location.href = '/portal/';
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const msg = document.getElementById('passwordMsg');
            msg.className = 'form-msg';
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
                msg.className = 'form-msg form-ok';
                msg.textContent = 'Contraseña actualizada. Volviendo al panel...';
                setTimeout(() => { window.location.href = '/portal/panel/'; }, 1200);
            } catch (err) {
                msg.className = 'form-msg form-error';
                msg.textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initLogin();
        initPanel();
        initCambiarClave();
    });
})();
