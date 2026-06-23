// ==================== CUENTAS DE LA COMPAÑÍA v1.0 ====================

const API = '/api/voluntarios';

let cuentas = [];   // cuentas bancarias activas

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('inputFechaDeposito').value =
        `${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-${pad(hoy.getDate())}`;
    document.getElementById('inputHoraDeposito').value =
        `${pad(hoy.getHours())}:${pad(hoy.getMinutes())}`;

    cargar();
});

async function cargar() {
    await Promise.all([cargarCuentas(), cargarDepositos(), cargarFondosRifa()]);
}

async function cargarFondosRifa() {
    try {
        const res = await fetch('/api/voluntarios/fondos-rifas-simple/');
        if (!res.ok) return;
        const rifas = await res.json();
        const sec = document.getElementById('seccionFondosRifa');
        const grid = document.getElementById('fondosRifaGrid');
        if (!rifas.length) { sec.style.display = 'none'; return; }
        sec.style.display = '';
        grid.innerHTML = rifas.map(r => `
            <div style="background:white;border-radius:10px;padding:18px;border:1px solid #f3f4f6;box-shadow:0 1px 4px rgba(0,0,0,.06)">
                <div style="font-size:0.85rem;font-weight:700;color:#7f1d1d;margin-bottom:10px">${r.nombre}</div>
                <div style="display:flex;gap:10px">
                    <div style="flex:1;background:#fef2f2;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:1rem;font-weight:700;color:#c41e3a">$${fmt(r.recaudado_transferencia)}</div>
                        <div style="font-size:0.68rem;color:#9ca3af;text-transform:uppercase">Transferencia</div>
                    </div>
                    <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:1rem;font-weight:700;color:#059669">$${fmt(r.recaudado_efectivo)}</div>
                        <div style="font-size:0.68rem;color:#9ca3af;text-transform:uppercase">Efectivo</div>
                    </div>
                    <div style="flex:1;background:#f9fafb;border-radius:8px;padding:10px;text-align:center">
                        <div style="font-size:1rem;font-weight:700;color:#374151">$${fmt(r.total)}</div>
                        <div style="font-size:0.68rem;color:#9ca3af;text-transform:uppercase">Total</div>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (_) {}
}

// ===== CUENTAS =====
async function cargarCuentas() {
    try {
        // Cargamos todas (activas + inactivas) para mostrarlas en la gestión
        const res = await fetch(`${API}/cuentas-bancarias-simple/?activas=0`);
        if (!res.ok) throw new Error('Error al cargar cuentas');
        cuentas = await res.json();

        // Saldo caja
        const resCaja = await fetch(`${API}/caja-simple/`);
        const dataCaja = await resCaja.json();
        const saldoCajaVal = dataCaja.saldo_caja;
        const saldoEl = document.getElementById('saldoCaja');
        saldoEl.textContent = '$' + fmt(saldoCajaVal);
        saldoEl.className = 'cc-card-saldo' + (saldoCajaVal < 0 ? ' negativo' : '');

        // Total General
        const totalCuentas = cuentas.reduce((s, c) => s + c.saldo, 0);
        const totalGeneral = saldoCajaVal + totalCuentas;
        const tgEl = document.getElementById('totalGeneral');
        if (tgEl) {
            tgEl.textContent = '$' + fmt(totalGeneral);
            tgEl.style.color = totalGeneral < 0 ? '#ff9999' : '#fff';
        }

        renderCuentas();
        llenarSelectCuentas();
    } catch (e) {
        notif('Error al cargar cuentas: ' + e.message, 'error');
    }
}

function renderCuentas() {
    const cont = document.getElementById('ccCuentasCards');
    if (!cuentas.length) {
        cont.innerHTML = '<p style="color:#888;font-size:.85rem;padding:8px">No hay cuentas bancarias registradas.</p>';
        return;
    }
    cont.innerHTML = cuentas.map(c => `
        <div class="cc-card${c.activa ? '' : ' desactivada'}" style="margin-bottom:0">
            <div class="cc-card-titulo">${c.tipo_cuenta.charAt(0).toUpperCase() + c.tipo_cuenta.slice(1)} · ${c.banco}</div>
            <div class="cc-card-nombre">${c.nombre}</div>
            <div class="cc-card-sub">
                ${c.rut_titular ? `RUT: ${c.rut_titular}<br>` : ''}
                N°: ${c.numero_cuenta || '—'}
            </div>
            <div class="cc-card-saldo${c.saldo < 0 ? ' negativo' : ''}">$${fmt(c.saldo)}</div>
            <div class="cc-card-actions">
                ${c.activa
                    ? `<button class="btn-cc desact" onclick="desactivarCuenta(${c.id}, '${escHtml(c.nombre)}')">Desactivar</button>`
                    : `<button class="btn-cc react" onclick="reactivarCuenta(${c.id}, '${escHtml(c.nombre)}')">Reactivar</button>`
                }
                ${c.saldo === 0 ? `<button class="btn-cc elim" onclick="eliminarCuenta(${c.id}, '${escHtml(c.nombre)}')">🗑 Eliminar</button>` : ''}
            </div>
        </div>
    `).join('');
}

function llenarSelectCuentas() {
    const sel = document.getElementById('selCuentaDeposito');
    const activas = cuentas.filter(c => c.activa);
    sel.innerHTML = '<option value="">— Seleccionar cuenta —</option>' +
        activas.map(c => `<option value="${c.id}">${c.nombre} (${c.banco})</option>`).join('');
}

async function desactivarCuenta(id, nombre) {
    if (!confirm(`¿Desactivar la cuenta "${nombre}"?\n\nNo aparecerá en los formularios de pago.`)) return;
    try {
        const res = await fetch(`${API}/cuentas-bancarias-simple/${id}/desactivar/`, { method: 'POST' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error');
        notif('✅ ' + d.mensaje, 'success');
        await cargarCuentas();
    } catch (e) {
        notif('❌ ' + e.message, 'error');
    }
}

async function reactivarCuenta(id, nombre) {
    if (!confirm(`¿Reactivar la cuenta "${nombre}"?`)) return;
    try {
        const res = await fetch(`${API}/cuentas-bancarias-simple/${id}/reactivar/`, { method: 'POST' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error');
        notif('✅ ' + d.mensaje, 'success');
        await cargarCuentas();
    } catch (e) {
        notif('❌ ' + e.message, 'error');
    }
}

async function eliminarCuenta(id, nombre) {
    if (!confirm(`¿Eliminar PERMANENTEMENTE la cuenta "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API}/cuentas-bancarias-simple/${id}/eliminar/`, { method: 'POST' });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error');
        notif('✅ ' + d.mensaje, 'success');
        await cargarCuentas();
    } catch (e) {
        notif('❌ ' + e.message, 'error');
    }
}

// ===== DEPÓSITOS =====
async function cargarDepositos() {
    try {
        const res = await fetch(`${API}/depositos-caja-simple/`);
        if (!res.ok) throw new Error('Error al cargar depósitos');
        const depositos = await res.json();
        renderDepositos(depositos);
    } catch (e) {
        notif('Error al cargar depósitos: ' + e.message, 'error');
    }
}

function renderDepositos(depositos) {
    const tbody = document.getElementById('tablaDepositos');
    if (!depositos.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="cc-empty">No hay depósitos registrados.</td></tr>';
        return;
    }
    tbody.innerHTML = depositos.map(d => `
        <tr>
            <td>${fmtFecha(d.fecha)}</td>
            <td>${d.hora ? d.hora.substring(0, 5) : '—'}</td>
            <td>${d.cuenta_destino.nombre}<br><small style="color:#888">${d.cuenta_destino.banco}</small></td>
            <td class="monto">$${fmt(d.monto)}</td>
            <td>${d.numero_comprobante || '—'}</td>
            <td style="max-width:180px;word-break:break-word">${d.observaciones || '—'}</td>
            <td>
                ${d.tiene_comprobante
                    ? `<button class="btn-cc ver-comp" onclick="verComprobante('${d.comprobante_base64}')">Ver</button>`
                    : '—'}
            </td>
        </tr>
    `).join('');
}

// ===== MODAL NUEVA CUENTA =====
function abrirModalCuenta() {
    document.getElementById('formCuenta').reset();
    document.getElementById('modalCuenta').style.display = 'flex';
}

async function guardarCuenta(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        nombre: form.nombre.value.trim(),
        rut_titular: form.rut_titular.value.trim(),
        banco: form.banco.value.trim(),
        numero_cuenta: form.numero_cuenta.value.trim(),
        tipo_cuenta: form.tipo_cuenta.value,
    };
    try {
        const res = await fetch(`${API}/cuentas-bancarias-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error al crear cuenta');
        notif(`✅ Cuenta "${d.nombre}" creada exitosamente`, 'success');
        cerrarModal('modalCuenta');
        await cargarCuentas();
    } catch (e) {
        notif('❌ ' + e.message, 'error');
    }
}

// ===== MODAL DEPÓSITO =====
function abrirModalDeposito() {
    document.getElementById('formDeposito').reset();
    document.getElementById('inputComprobanteB64').value = '';
    document.getElementById('prevComprobante').style.display = 'none';
    document.getElementById('prevComprobantePdf').style.display = 'none';

    // Fecha y hora actual
    const hoy = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('inputFechaDeposito').value =
        `${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-${pad(hoy.getDate())}`;
    document.getElementById('inputHoraDeposito').value =
        `${pad(hoy.getHours())}:${pad(hoy.getMinutes())}`;

    document.getElementById('modalDeposito').style.display = 'flex';
}

function previsualizarComp(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
        const b64 = ev.target.result;
        document.getElementById('inputComprobanteB64').value = b64;

        if (file.type.startsWith('image/')) {
            const img = document.getElementById('prevComprobante');
            img.src = b64;
            img.style.display = 'block';
            document.getElementById('prevComprobantePdf').style.display = 'none';
        } else {
            document.getElementById('prevComprobante').style.display = 'none';
            document.getElementById('prevComprobantePdf').style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

async function guardarDeposito(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        cuenta_destino_id: parseInt(form.cuenta_destino_id.value),
        monto: parseFloat(form.monto.value),
        fecha: form.fecha.value,
        hora: form.hora.value || null,
        numero_comprobante: form.numero_comprobante.value.trim(),
        comprobante_base64: document.getElementById('inputComprobanteB64').value || null,
        observaciones: form.observaciones.value.trim(),
    };

    if (!data.cuenta_destino_id) {
        notif('❌ Selecciona una cuenta destino', 'error');
        return;
    }
    if (!data.monto || data.monto <= 0) {
        notif('❌ Ingresa un monto válido', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/depositos-caja-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error al registrar depósito');
        notif('✅ ' + d.mensaje, 'success');
        cerrarModal('modalDeposito');
        await cargar();
    } catch (e) {
        notif('❌ ' + e.message, 'error');
    }
}

// ===== VER COMPROBANTE =====
function verComprobante(b64) {
    const cont = document.getElementById('contenidoComprobante');
    if (!b64) {
        cont.innerHTML = '<p>Sin comprobante adjunto</p>';
    } else if (b64.startsWith('data:image/') || b64.match(/^data:image/)) {
        cont.innerHTML = `<img id="imgComprobante" src="${b64}" alt="Comprobante">`;
    } else if (b64.includes('pdf')) {
        cont.innerHTML = `
            <p>Comprobante PDF</p>
            <a href="${b64}" download="comprobante.pdf" class="btn-cc guardar" style="display:inline-block;margin-top:8px;text-decoration:none">
                ⬇ Descargar PDF
            </a>`;
    } else {
        // Intentar mostrar como imagen de todas formas
        cont.innerHTML = `<img id="imgComprobante" src="${b64}" alt="Comprobante">`;
    }
    document.getElementById('modalVerComp').style.display = 'flex';
}

// ===== MODALES UTILS =====
function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}
function cerrarModalFondo(e, id) {
    if (e.target.id === id) cerrarModal(id);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        ['modalCuenta', 'modalDeposito', 'modalVerComp'].forEach(cerrarModal);
    }
});

// ===== UTILS =====
function fmt(n) {
    return new Intl.NumberFormat('es-CL').format(Math.round(parseFloat(n) || 0));
}
function fmtFecha(f) {
    if (!f) return '—';
    const [y, m, d] = f.substring(0, 10).split('-');
    return `${d}/${m}/${y}`;
}
function escHtml(s) {
    return String(s).replace(/'/g, "\\'");
}
function notif(msg, tipo) {
    const n = document.getElementById('ccNotif');
    n.innerHTML = msg;
    n.className = tipo;
    n.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tipo !== 'info') setTimeout(() => { n.style.display = 'none'; }, 6000);
}
