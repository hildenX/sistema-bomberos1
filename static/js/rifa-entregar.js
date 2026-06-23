/* rifa-entregar.js â€” Entrega de talonarios v2.1 */
'use strict';

const API = '/api/voluntarios';
const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const el  = id => document.getElementById(id);

let rifa              = null;
let asignaciones      = [];
let asignacionActiva  = null;
let asignacionPagar   = null;
let asignacionLiberar = null;
let modoEntrega       = 'rango';
let esExtra           = false;
let cuentasBancarias  = [];

const params = new URLSearchParams(window.location.search);
const rifaId = params.get('id');

// ---------------------------------------------------------------------------
// Cuentas bancarias
// ---------------------------------------------------------------------------
async function cargarCuentasBancarias() {
    try {
        const res = await fetch(`${API}/cuentas-bancarias-simple/`);
        if (!res.ok) return;
        cuentasBancarias = await res.json();
        const opts = '<option value="">â€” Seleccionar â€”</option>' +
            cuentasBancarias.filter(c => c.activa)
                .map(c => `<option value="${c.id}">${c.nombre} (${c.banco})</option>`).join('');
        el('pagarCuenta').innerHTML = opts;
    } catch (_) {}
}

// ---------------------------------------------------------------------------
// NotificaciÃ³n
// ---------------------------------------------------------------------------
function mostrarNotif(msg, tipo = 'ok') {
    const n = el('reNotif');
    n.innerHTML = `<span>${tipo === 'ok' ? 'âœ…' : 'âŒ'}</span> ${msg}`;
    n.className = `re-notif ${tipo}`;
    n.style.display = 'flex';
    setTimeout(() => { n.style.display = 'none'; }, 5000);
}

// ---------------------------------------------------------------------------
// Carga inicial
// ---------------------------------------------------------------------------
async function cargarRifa() {
    if (!rifaId) {
        el('tablaWrap').innerHTML = '<div class="loading">No se especificÃ³ una rifa</div>';
        return;
    }
    try {
        const resp = await fetch(`${API}/rifas-simple/${rifaId}/`);
        const data = await resp.json();
        if (!resp.ok) { el('tablaWrap').innerHTML = `<div class="loading">${data.error}</div>`; return; }

        rifa         = data;
        asignaciones = data.asignaciones || [];

        el('rifaTitulo').textContent    = rifa.nombre;
        el('rifaSubtitulo').textContent = `${clp(rifa.precio_numero)} por nÃºmero Â· ${rifa.numeros_por_talonario} nÃºmeros/talonario Â· Cierre: ${new Date(rifa.fecha_cierre + 'T12:00:00').toLocaleDateString('es-CL')}`;

        actualizarStats();
        actualizarRecaudado();
        renderTabla();
    } catch (e) {
        el('tablaWrap').innerHTML = '<div class="loading">Error al cargar rifa</div>';
    }
}

function actualizarStats() {
    el('spTotal').textContent      = asignaciones.length;
    el('spNoRetirada').textContent = asignaciones.filter(a => a.estado === 'no_retirada').length;
    el('spRetirada').textContent   = asignaciones.filter(a => a.estado === 'retirada').length;
    el('spPagada').textContent     = asignaciones.filter(a => a.estado === 'pagada').length;
    el('spLiberada').textContent   = asignaciones.filter(a => a.estado === 'liberada').length;
}

function actualizarRecaudado() {
    const s = rifa.stats || {};
    const transf = s.recaudado_transferencia || 0;
    const efec   = s.recaudado_efectivo || 0;

    // Recalcular desde pagos locales para reflejar pagos nuevos sin recargar
    let localTransf = 0, localEfec = 0;
    asignaciones.forEach(a => {
        (a.pagos || []).forEach(p => {
            if (p.metodo_pago === 'transferencia') localTransf += Number(p.monto);
            else localEfec += Number(p.monto);
        });
    });
    const lt = localTransf || transf;
    const le = localEfec   || efec;

    el('recTransf').textContent = clp(lt);
    el('recEfec').textContent   = clp(le);
    el('recTotal').textContent  = clp(lt + le);
    el('reRecaudado').style.display = 'flex';
}

// ---------------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------------
function renderTabla() {
    const filtro = el('filtroEstado').value;
    const buscar = (el('buscarVol').value || '').toLowerCase().trim();
    let lista = filtro ? asignaciones.filter(a => a.estado === filtro) : asignaciones;
    if (buscar) {
        lista = lista.filter(a =>
            a.voluntario_nombre.toLowerCase().includes(buscar) ||
            (a.voluntario_clave || '').toLowerCase().includes(buscar)
        );
    }

    el('reCount').textContent = `Mostrando ${lista.length} de ${asignaciones.length}`;

    if (!lista.length) {
        el('tablaWrap').innerHTML = `
            <div class="re-table-wrap">
                <div class="empty-state">
                    <div class="icon">ðŸ”</div>
                    <h3>Sin resultados</h3>
                    <p>No hay asignaciones que coincidan con los filtros</p>
                </div>
            </div>`;
        return;
    }

    const filas = lista.map(a => {
        const numeros = a.numeros || [];
        const numerosStr = numeros.length
            ? `<div class="nums-chips">${numeros.map(r => `<span class="nums-chip">${r.desde}â€“${r.hasta}</span>`).join('')}</div>`
            : '<span style="color:#9ca3af;font-size:0.78rem">Sin asignar</span>';

        const pct = a.monto_total > 0 ? Math.round(a.monto_pagado / a.monto_total * 100) : 0;
        const montoHtml = `
            <div class="pago-total">${clp(a.monto_total)}</div>
            ${a.monto_pagado > 0 ? `
            <div class="pago-bar-track"><div class="pago-bar-fill" style="width:${pct}%"></div></div>
            <div class="pago-monto-txt">${clp(a.monto_pagado)} pagado (${pct}%)</div>` : ''}`;

        const sinPagos = !a.pagos || a.pagos.length === 0;
        let acciones = '';
        if (a.estado === 'no_retirada') {
            acciones = `<button class="btn-re primary sm" onclick="abrirModalEntregar(${a.id})">ðŸ“¦ Entregar</button>`;
        } else if (a.estado === 'retirada') {
            acciones  = `<button class="btn-re secondary sm" onclick="verNumeros(${a.id})">ðŸ‘ Ver</button>`;
            if (sinPagos) {
                acciones += ` <button class="btn-re success sm" onclick="abrirModalPagar(${a.id}, false)">ðŸ’° Pagar</button>`;
            }
            acciones += ` <button class="btn-re warning sm" onclick="abrirModalLiberar(${a.id})">ðŸ”“ Liberar</button>`;
        } else if (a.estado === 'pagada') {
            acciones  = numeros.length ? `<button class="btn-re secondary sm" onclick="verNumeros(${a.id})">ðŸ‘ Ver</button>` : '';
            acciones += ` <button class="btn-re warning sm" onclick="abrirModalPagar(${a.id}, true)">ðŸ’°+ Extra</button>`;
        } else if (a.estado === 'liberada') {
            acciones = numeros.length ? `<button class="btn-re secondary sm" onclick="verNumeros(${a.id})">ðŸ‘ Ver</button>` : '';
        }

        return `
        <tr>
            <td>
                <div class="vol-nombre">${a.voluntario_nombre}</div>
                <div class="vol-clave">${a.voluntario_clave || 'â€”'}</div>
            </td>
            <td style="text-align:center;white-space:nowrap">
                <strong>${a.antiguedad}</strong><span style="font-size:.74rem;color:#9ca3af"> aÃ±os</span>
            </td>
            <td style="text-align:center;font-weight:600;color:#374151">${a.talonarios_asignados}</td>
            <td>${numerosStr}</td>
            <td>${montoHtml}</td>
            <td><span class="badge ${a.estado}">${estadoLabel(a.estado)}</span></td>
            <td style="white-space:nowrap">${acciones}</td>
        </tr>`;
    }).join('');

    el('tablaWrap').innerHTML = `
        <div class="re-table-wrap">
            <table class="re-table">
                <thead>
                    <tr>
                        <th>Voluntario</th>
                        <th style="text-align:center">AntigÃ¼edad</th>
                        <th style="text-align:center">Talonarios</th>
                        <th>NÃºmeros</th>
                        <th>Monto / Pago</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}

function estadoLabel(e) {
    return { no_retirada: 'Sin Retirar', retirada: 'Retirada', pagada: 'Pagada', liberada: 'Liberada' }[e] || e;
}

// ---------------------------------------------------------------------------
// Ver nÃºmeros â€” modal
// ---------------------------------------------------------------------------
function verNumeros(asigId) {
    const a = asignaciones.find(x => x.id === asigId);
    if (!a) return;
    const numeros = a.numeros || [];
    el('verNumsSubtitulo').textContent = a.voluntario_nombre;
    if (!numeros.length) {
        el('verNumsContenido').innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px 0">Sin nÃºmeros asignados</p>';
    } else {
        const total = numeros.reduce((s, r) => s + (r.hasta - r.desde + 1), 0);
        el('verNumsContenido').innerHTML = `
            <p style="font-size:0.82rem;color:#6b7280;margin:0 0 14px">
                <strong>${numeros.length}</strong> rango(s) Â· <strong>${total}</strong> nÃºmeros en total
            </p>
            <div class="nums-grid">
                ${numeros.map(r => `<span class="num-rango-tag">${r.desde} &ndash; ${r.hasta}</span>`).join('')}
            </div>`;
    }
    el('modalVerNums').style.display = 'flex';
}

// ---------------------------------------------------------------------------
// Modal Entregar
// ---------------------------------------------------------------------------
function abrirModalEntregar(asigId) {
    asignacionActiva = asignaciones.find(a => a.id === asigId);
    if (!asignacionActiva) return;
    const esperado = asignacionActiva.talonarios_asignados * rifa.numeros_por_talonario;
    el('infoVolModal').innerHTML = `
        <div class="info-nombre">${asignacionActiva.voluntario_nombre}</div>
        <div class="info-row">
            <span>Clave: <strong>${asignacionActiva.voluntario_clave || 'â€”'}</strong></span>
            <span>AntigÃ¼edad: <strong>${asignacionActiva.antiguedad} aÃ±os</strong></span>
            <span>Talonarios: <strong>${asignacionActiva.talonarios_asignados}</strong></span>
        </div>
        <div class="info-row">
            <span>NÃºmeros esperados: <strong>${esperado}</strong></span>
            <span>Monto: <strong>${clp(asignacionActiva.monto_total)}</strong></span>
        </div>`;
    el('rangosLista').innerHTML = '';
    el('numsIndividuales').value = '';
    el('contadorIndividual').textContent = '';
    el('contadorRangos').textContent = '';
    el('errorRangos').style.display = 'none';
    setModo('rango');
    agregarRango();
    actualizarContadorRangos();
    el('modalEntregar').style.display = 'flex';
}

function cerrarModalEntregar() {
    el('modalEntregar').style.display = 'none';
    asignacionActiva = null;
}

// ---------------------------------------------------------------------------
// Modo rango / individual
// ---------------------------------------------------------------------------
function setModo(modo) {
    modoEntrega = modo;
    el('tabModoRango').classList.toggle('activa', modo === 'rango');
    el('tabModoIndividual').classList.toggle('activa', modo === 'individual');
    el('panelRango').classList.toggle('activo', modo === 'rango');
    el('panelIndividual').classList.toggle('activo', modo === 'individual');
    el('errorRangos').style.display = 'none';
}

el('numsIndividuales').addEventListener('input', function() {
    const nums = parsearIndividuales(this.value);
    const esperado = asignacionActiva ? asignacionActiva.talonarios_asignados * rifa.numeros_por_talonario : 0;
    if (nums.length > 0) {
        const ok    = nums.length === esperado;
        const color = ok ? '#059669' : '#d97706';
        el('contadorIndividual').innerHTML = `<span style="color:${color};font-weight:700">${nums.length}</span> nÃºmero(s) ingresado(s) ${esperado ? `Â· se esperan <strong>${esperado}</strong>` : ''}`;
    } else {
        el('contadorIndividual').textContent = '';
    }
});

function agregarRango() {
    const div = document.createElement('div');
    div.className = 'rango-row';
    div.innerHTML = `
        <input type="number" placeholder="Desde" min="1" class="rango-desde" oninput="actualizarContadorRangos()">
        <span style="color:#9ca3af;padding:0 2px">â€”</span>
        <input type="number" placeholder="Hasta" min="1" class="rango-hasta" oninput="actualizarContadorRangos()">
        <button class="btn-rm" onclick="this.parentElement.remove(); actualizarContadorRangos()">âœ•</button>`;
    el('rangosLista').appendChild(div);
}

function actualizarContadorRangos() {
    if (!asignacionActiva || !rifa) return;
    const esperado = asignacionActiva.talonarios_asignados * rifa.numeros_por_talonario;
    const rangos   = obtenerRangos();
    let total = 0;
    let validos = true;
    for (const r of rangos) {
        if (r.desde > 0 && r.hasta >= r.desde) total += r.hasta - r.desde + 1;
        else if (r.desde > 0 || r.hasta > 0) { validos = false; }
    }
    if (total === 0 && rangos.length === 0) {
        el('contadorRangos').textContent = '';
        return;
    }
    const ok    = total === esperado && validos;
    const color = ok ? '#059669' : (total > esperado ? '#dc2626' : '#d97706');
    el('contadorRangos').innerHTML = `<span style="color:${color};font-weight:700">${total}</span> nÃºmero(s) Â· se esperan <strong>${esperado}</strong>`;
}

function obtenerRangos() {
    const rangos = [];
    el('rangosLista').querySelectorAll('.rango-row').forEach(fila => {
        const desde = parseInt(fila.querySelector('.rango-desde').value);
        const hasta = parseInt(fila.querySelector('.rango-hasta').value);
        if (desde && hasta) rangos.push({ desde, hasta });
    });
    return rangos;
}

function parsearIndividuales(texto) {
    return [...new Set(
        texto.split(/[\s,;]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
    )].sort((a, b) => a - b);
}

function numerosARangos(nums) {
    if (!nums.length) return [];
    const rangos = [];
    let inicio = nums[0], fin = nums[0];
    for (let i = 1; i < nums.length; i++) {
        if (nums[i] === fin + 1) { fin = nums[i]; }
        else { rangos.push({ desde: inicio, hasta: fin }); inicio = fin = nums[i]; }
    }
    rangos.push({ desde: inicio, hasta: fin });
    return rangos;
}

function obtenerNumerosFinales() {
    if (modoEntrega === 'rango') return obtenerRangos();
    return numerosARangos(parsearIndividuales(el('numsIndividuales').value));
}

function validarNumerosFinales(rangos) {
    if (!rangos.length) return 'Debes ingresar al menos un nÃºmero o rango';
    for (const r of rangos) {
        if (r.desde < 1) return `Los nÃºmeros deben ser mayores a 0`;
        if (r.desde > r.hasta) return `Rango invÃ¡lido: ${r.desde}â€“${r.hasta}`;
    }
    // Validar solapamiento entre rangos
    for (let i = 0; i < rangos.length; i++) {
        for (let j = i + 1; j < rangos.length; j++) {
            if (rangos[i].desde <= rangos[j].hasta && rangos[j].desde <= rangos[i].hasta)
                return `Los rangos ${rangos[i].desde}â€“${rangos[i].hasta} y ${rangos[j].desde}â€“${rangos[j].hasta} se solapan`;
        }
    }
    // Validar total de nÃºmeros
    if (asignacionActiva && rifa) {
        const esperado   = asignacionActiva.talonarios_asignados * rifa.numeros_por_talonario;
        const ingresados = rangos.reduce((s, r) => s + (r.hasta - r.desde + 1), 0);
        if (ingresados !== esperado) {
            return `La cantidad de nÃºmeros no coincide: se ingresaron ${ingresados} pero se esperan ${esperado} (${asignacionActiva.talonarios_asignados} talonarios Ã— ${rifa.numeros_por_talonario} nÃºmeros)`;
        }
    }
    return null;
}

async function guardarEntrega() {
    const rangos = obtenerNumerosFinales();
    const error  = validarNumerosFinales(rangos);
    if (error) { el('errorRangos').textContent = error; el('errorRangos').style.display = 'block'; return; }
    el('errorRangos').style.display = 'none';

    const btn = document.querySelector('#modalEntregar .modal-footer .btn-re.primary');
    setLoading(btn, true, 'âœ… Confirmar Entrega');

    try {
        const resp = await fetch(`${API}/asignar-numeros-rifa/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asignacion_id: asignacionActiva.id, numeros: rangos }),
        });
        const data = await resp.json();
        if (!resp.ok) { el('errorRangos').textContent = data.error || 'Error al guardar'; el('errorRangos').style.display = 'block'; return; }

        const idx = asignaciones.findIndex(a => a.id === data.asignacion_id);
        if (idx >= 0) { asignaciones[idx].estado = data.estado; asignaciones[idx].numeros = data.numeros; }

        cerrarModalEntregar();
        mostrarNotif(`Talonarios entregados a ${asignacionActiva.voluntario_nombre}`);
        actualizarStats();
        renderTabla();
    } catch (_) {
        el('errorRangos').textContent = 'Error de conexiÃ³n';
        el('errorRangos').style.display = 'block';
    } finally {
        setLoading(btn, false, 'âœ… Confirmar Entrega');
    }
}

// ---------------------------------------------------------------------------
// Utilidad: botÃ³n cargando
// ---------------------------------------------------------------------------
function setLoading(btn, loading, textoOriginal) {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Guardando...' : textoOriginal;
    btn.style.opacity = loading ? '0.7' : '';
}

// ---------------------------------------------------------------------------
// Modal Pagar
// ---------------------------------------------------------------------------
function abrirModalPagar(asigId, extra = false) {
    asignacionPagar = asignaciones.find(a => a.id === asigId);
    if (!asignacionPagar) return;
    esExtra = extra;

    const numeros = (asignacionPagar.numeros || []).map(r => `${r.desde}â€“${r.hasta}`).join(', ') || 'â€”';
    const pagos   = asignacionPagar.pagos || [];
    const pct     = asignacionPagar.monto_total > 0
        ? Math.round(asignacionPagar.monto_pagado / asignacionPagar.monto_total * 100) : 0;

    el('modalPagar').querySelector('h3').textContent = extra ? 'ðŸ’°+ Pago Extra de Rifa' : 'ðŸ’° Registrar Pago';
    el('modalPagar').querySelector('.modal-header p').textContent = extra
        ? 'Pago adicional por nÃºmeros vendidos extra'
        : 'Pago de talonarios asignados';

    el('infoVolPagar').innerHTML = `
        <div class="info-nombre">${asignacionPagar.voluntario_nombre}</div>
        <div class="info-row">
            <span>Talonarios: <strong>${asignacionPagar.talonarios_asignados}</strong></span>
            <span>NÃºmeros: <strong>${numeros}</strong></span>
        </div>
        <div class="info-montos">
            <div class="info-monto-box">
                <div class="info-monto-val">${clp(asignacionPagar.monto_total)}</div>
                <div class="info-monto-lbl">Total</div>
            </div>
            <div class="info-monto-box pagado">
                <div class="info-monto-val">${clp(asignacionPagar.monto_pagado)}</div>
                <div class="info-monto-lbl">Pagado (${pct}%)</div>
            </div>
            <div class="info-monto-box pendiente">
                <div class="info-monto-val">${clp(asignacionPagar.monto_pendiente)}</div>
                <div class="info-monto-lbl">Pendiente</div>
            </div>
        </div>`;

    el('historialPagosRifa').innerHTML = pagos.length === 0 ? '' : `
        <div class="section-sep">Pagos anteriores</div>
        <table class="hist-table" style="margin-bottom:4px">
            <thead><tr>
                <th>Fecha</th><th>Monto</th><th>MÃ©todo</th><th>Comprobante</th>
            </tr></thead>
            <tbody>${pagos.map(p => `
                <tr>
                    <td>${fmtFecha(p.fecha_pago)}</td>
                    <td style="font-weight:600">${clp(p.monto)}</td>
                    <td><span class="metodo-badge ${p.metodo_pago}">${p.metodo_pago}</span></td>
                    <td style="color:#9ca3af">
                        ${p.comprobante_url
                            ? `<a href="${p.comprobante_url}" target="_blank" rel="noopener">Descargar</a>`
                            : p.comprobante_base64
                                ? `<a href="${p.comprobante_base64}" download="comprobante-rifa-${p.id}">Descargar</a>`
                                : (p.numero_comprobante || '—')}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;

    // Para pago regular: predeterminar todos los talonarios asignados
    el('pagarTalonarios').value     = esExtra ? '' : (asignacionPagar.talonarios_asignados || '');
    el('pagarTalonarios').max       = esExtra ? '' : (asignacionPagar.talonarios_asignados || '');
    el('pagarFormula').style.display = 'none';
    el('pagarMonto').value           = '';
    calcularMontoPago();
    el('pagarFecha').value           = new Date().toISOString().split('T')[0];
    el('pagarMetodo').value          = 'efectivo';
    el('pagarCuentaGrupo').style.display      = 'none';
    el('pagarComprobanteGrupo').style.display  = 'none';
    el('pagarComprobante').value    = '';
    el('pagarArchivoB64').value     = '';
    el('pagarObs').value            = '';
    el('prevComp').style.display    = 'none';
    el('prevCompPdf').style.display = 'none';
    el('errorPagar').style.display  = 'none';
    el('modalPagar').style.display  = 'flex';
}

function fmtFecha(f) {
    if (!f) return 'â€”';
    const [y, m, d] = f.substring(0, 10).split('-');
    return `${d}/${m}/${y}`;
}

function calcularMontoPago() {
    const talonarios = parseInt(el('pagarTalonarios').value) || 0;
    if (!rifa || talonarios <= 0) {
        el('pagarMonto').value = '';
        el('pagarFormula').style.display = 'none';
        return;
    }
    const monto = talonarios * rifa.numeros_por_talonario * rifa.precio_numero;
    el('pagarMonto').value = Math.round(monto);
    el('pagarFormula').textContent = `${talonarios} talonario(s) Ã— ${rifa.numeros_por_talonario} nÃºms Ã— ${clp(rifa.precio_numero)} = ${clp(monto)}`;
    el('pagarFormula').style.display = 'block';
}

function cerrarModalPagar() {
    el('modalPagar').style.display = 'none';
    asignacionPagar = null;
}

function togglePagarCuenta() {
    const esTransf = el('pagarMetodo').value === 'transferencia';
    el('pagarCuentaGrupo').style.display      = esTransf ? '' : 'none';
    el('pagarComprobanteGrupo').style.display  = esTransf ? '' : 'none';
}

function previsualizarComp(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        el('pagarArchivoB64').value = e.target.result;
        if (file.type === 'application/pdf') {
            el('prevComp').style.display = 'none';
            el('prevCompPdf').style.display = 'block';
        } else {
            el('prevComp').src = e.target.result;
            el('prevComp').style.display = 'block';
            el('prevCompPdf').style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
}

async function guardarPago() {
    const talonarios = parseInt(el('pagarTalonarios').value);
    const monto      = parseFloat(el('pagarMonto').value);
    const metodo     = el('pagarMetodo').value;
    const cuentaId   = el('pagarCuenta').value;

    const showErr = msg => { el('errorPagar').textContent = msg; el('errorPagar').style.display = 'block'; };

    if (!talonarios || talonarios < 1) { showErr('Ingresa la cantidad de talonarios a pagar'); return; }
    if (!esExtra && asignacionPagar && talonarios > asignacionPagar.talonarios_asignados) {
        showErr(`Solo se pueden pagar hasta ${asignacionPagar.talonarios_asignados} talonarios asignados`); return;
    }
    if (!monto || monto <= 0) { showErr('El monto no se pudo calcular'); return; }
    if (metodo === 'transferencia' && !cuentaId) { showErr('Selecciona la cuenta bancaria'); return; }
    el('errorPagar').style.display = 'none';

    const btn = document.querySelector('#modalPagar .modal-footer .btn-re.primary');
    setLoading(btn, true, 'ðŸ’° Registrar Pago');

    const body = {
        asignacion_id:     asignacionPagar.id,
        monto,
        fecha_pago:        el('pagarFecha').value,
        metodo_pago:       metodo,
        cuenta_bancaria_id: cuentaId ? parseInt(cuentaId) : null,
        numero_comprobante: el('pagarComprobante').value,
        comprobante_base64: el('pagarArchivoB64').value || null,
        observaciones:     el('pagarObs').value,
        es_extra:          esExtra,
    };

    try {
        const resp = await fetch(`${API}/pagar-rifa-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (!resp.ok) { showErr(data.error || 'Error al registrar pago'); return; }

        const idx = asignaciones.findIndex(a => a.id === asignacionPagar.id);
        if (idx >= 0) {
            asignaciones[idx].estado           = data.estado;
            asignaciones[idx].monto_pagado     = data.monto_pagado;
            asignaciones[idx].monto_pendiente  = data.monto_pendiente;
            if (!asignaciones[idx].pagos) asignaciones[idx].pagos = [];
            asignaciones[idx].pagos.unshift({
                fecha_pago: body.fecha_pago, monto: body.monto,
                metodo_pago: body.metodo_pago, numero_comprobante: body.numero_comprobante || '',
            });
        }

        cerrarModalPagar();
        mostrarNotif(`Pago de ${clp(monto)} registrado para ${asignacionPagar.voluntario_nombre}`);
        actualizarStats();
        actualizarRecaudado();
        renderTabla();
    } catch (_) {
        showErr('Error de conexiÃ³n');
    } finally {
        setLoading(btn, false, 'ðŸ’° Registrar Pago');
    }
}

// ---------------------------------------------------------------------------
// Modal Liberar
// ---------------------------------------------------------------------------
function abrirModalLiberar(asigId) {
    asignacionLiberar = asignaciones.find(a => a.id === asigId);
    if (!asignacionLiberar) return;
    el('infoVolLiberar').innerHTML = `
        <div class="info-nombre">${asignacionLiberar.voluntario_nombre}</div>
        <div class="info-row">
            <span>Talonarios asignados: <strong>${asignacionLiberar.talonarios_asignados}</strong></span>
            <span>Monto total: <strong>${clp(asignacionLiberar.monto_total)}</strong></span>
        </div>`;
    el('liberarCantidad').value     = '';
    el('liberarCantidad').max       = asignacionLiberar.talonarios_asignados;
    el('liberarMotivo').value       = '';
    el('liberarAutorizado').value   = '';
    el('errorLiberar').style.display = 'none';
    el('modalLiberar').style.display = 'flex';
}

function cerrarModalLiberar() {
    el('modalLiberar').style.display = 'none';
    asignacionLiberar = null;
}

async function guardarLiberacion() {
    const cantidad   = parseInt(el('liberarCantidad').value);
    const motivo     = el('liberarMotivo').value.trim();
    const autorizado = el('liberarAutorizado').value.trim();

    const showErr = msg => { el('errorLiberar').textContent = msg; el('errorLiberar').style.display = 'block'; };

    if (!cantidad || cantidad < 1) { showErr('Ingresa la cantidad de talonarios'); return; }
    if (asignacionLiberar && cantidad > asignacionLiberar.talonarios_asignados) {
        showErr(`No puedes liberar mÃ¡s de ${asignacionLiberar.talonarios_asignados} talonarios asignados`); return;
    }
    if (!motivo) { showErr('Ingresa el motivo'); return; }
    el('errorLiberar').style.display = 'none';

    const btn = document.querySelector('#modalLiberar .modal-footer .btn-re.danger');
    setLoading(btn, true, 'ðŸ”“ Confirmar LiberaciÃ³n');

    try {
        const resp = await fetch(`${API}/liberar-rifa-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                asignacion_id: asignacionLiberar.id,
                cantidad_talonarios: cantidad,
                motivo, autorizado_por: autorizado,
            }),
        });
        const data = await resp.json();
        if (!resp.ok) { showErr(data.error || 'Error al liberar'); return; }

        const idx = asignaciones.findIndex(a => a.id === asignacionLiberar.id);
        if (idx >= 0) {
            asignaciones[idx].estado      = data.estado;
            asignaciones[idx].monto_total = asignaciones[idx].monto_total - data.monto_liberado;
        }

        cerrarModalLiberar();
        mostrarNotif(`${cantidad} talonario(s) liberado(s) para ${asignacionLiberar.voluntario_nombre}`);
        actualizarStats();
        renderTabla();
    } catch (_) {
        showErr('Error de conexiÃ³n');
    } finally {
        setLoading(btn, false, 'ðŸ”“ Confirmar LiberaciÃ³n');
    }
}

// ---------------------------------------------------------------------------
// Cerrar modales con ESC o click fuera
// ---------------------------------------------------------------------------
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    cerrarModalEntregar();
    cerrarModalPagar();
    cerrarModalLiberar();
    el('modalVerNums').style.display = 'none';
});

document.addEventListener('click', e => {
    if (e.target === el('modalEntregar')) cerrarModalEntregar();
    if (e.target === el('modalPagar'))    cerrarModalPagar();
    if (e.target === el('modalLiberar'))  cerrarModalLiberar();
    if (e.target === el('modalVerNums'))  el('modalVerNums').style.display = 'none';
});

// Init
cargarCuentasBancarias();
cargarRifa();

