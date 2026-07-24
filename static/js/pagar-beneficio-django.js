// ==================== PAGAR BENEFICIO v2.0 ====================
const API_BASE = '/api/voluntarios';

let voluntario = null;
let asignaciones = [];
let pagos = [];
let asignacionActual = null;
let logoBase64 = null;

// Paginación
const POR_PAGINA = 10;
let paginaPagos = 1;
let paginaLiberaciones = 1;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    await cargarLogo();
    await Promise.all([cargarVoluntario(), cargarCuentasBancarias()]);
    if (voluntario) {
        await Promise.all([cargarAsignaciones(), cargarPagos(), cargarRifaActiva()]);
        renderResumen();
        inicializarFiltroBeneficios();
        renderBeneficios();
        renderHistorial();
        inicializarFiltroAnios();
        renderHistorialLiberaciones();
    }
    // Listeners de formularios
    el('formPagar').addEventListener('submit', manejarPago);
    el('formExtra').addEventListener('submit', manejarVentaExtra);
    el('formLiberar').addEventListener('submit', manejarLiberar);
});

async function cargarCuentasBancarias() {
    try {
        const res = await fetch(`${API_BASE}/cuentas-bancarias-simple/`);
        if (!res.ok) return;
        const cuentas = await res.json();
        const opts = '<option value="">— Seleccionar cuenta —</option>' +
            cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.banco})</option>`).join('');
        const selPagar = el('pagarCuenta');
        const selExtra = el('extraCuenta');
        if (selPagar) selPagar.innerHTML = opts;
        if (selExtra) selExtra.innerHTML = opts;
        const selRifa = el('rifaPagarCuenta');
        if (selRifa) selRifa.innerHTML = opts;
    } catch (_) {}
}

// ===== LOGO =====
async function cargarLogo() {
    try {
        const res = await fetch(`${API_BASE}/logo-simple/`);
        if (res.ok) {
            const d = await res.json();
            if (d.tiene_logo) logoBase64 = d.logo;
        }
    } catch (e) {}
}

// ===== VOLUNTARIO =====
async function cargarVoluntario() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        notif('No se especificó el voluntario', 'error');
        setTimeout(() => window.location.href = '/sistema.html', 2000);
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/${id}/`);
        if (!res.ok) throw new Error('Voluntario no encontrado');
        voluntario = await res.json();
        renderVoluntario();
    } catch (e) {
        notif('Error: ' + e.message, 'error');
        setTimeout(() => window.location.href = '/sistema.html', 2000);
    }
}

function renderVoluntario() {
    const nombre = voluntario.nombreCompleto ||
        `${voluntario.primerNombre || ''} ${voluntario.primerApellido || ''}`.trim() || 'Sin nombre';
    const clave = voluntario.claveBombero || voluntario.clave_bombero || 'N/A';
    const run   = voluntario.rut || 'N/A';
    const cia   = voluntario.compania || 'Sexta Compañía De Bomberos de Puerto Montt';

    el('volInfo').innerHTML = `
        <div class="pb-vol-item"><span class="label">Nombre</span><span class="value">${nombre}</span></div>
        <div class="pb-vol-item"><span class="label">Clave</span><span class="value">${clave}</span></div>
        <div class="pb-vol-item"><span class="label">RUN</span><span class="value">${run}</span></div>
        <div class="pb-vol-item"><span class="label">Compañía</span><span class="value">${cia}</span></div>
    `;
}

// ===== ASIGNACIONES =====
async function cargarAsignaciones() {
    try {
        const res = await fetch(`${API_BASE}/${voluntario.id}/beneficios-asignados-simple/`);
        if (res.ok) asignaciones = await res.json();
    } catch (e) {
        notif('Error al cargar beneficios', 'error');
    }
}

// ===== PAGOS =====
async function cargarPagos() {
    try {
        const res = await fetch(`${API_BASE}/pagos-beneficios/?voluntario_id=${voluntario.id}`);
        if (res.ok) pagos = await res.json();
    } catch (e) {}
}

// ===== RESUMEN HEADER =====
function renderResumen() {
    const pendientes = asignaciones.filter(a => a.estado_pago !== 'completo' && a.estado_pago !== 'liberado').length;
    const deuda = asignaciones.reduce((s, a) => s + parseFloat(a.monto_pendiente || 0), 0);
    el('statPendientes').textContent = pendientes;
    el('statDeuda').textContent = '$' + fmt(deuda);
}

// ===== FILTRO BENEFICIOS POR AÑO =====
function inicializarFiltroBeneficios() {
    const anios = [...new Set(asignaciones.map(a => (a.fecha_evento || '').substring(0, 4)))].filter(Boolean).sort().reverse();
    const sel = el('filtroAnioBenef');
    while (sel.options.length > 1) sel.remove(1);
    anios.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        sel.appendChild(opt);
    });
    // Default: seleccionar el año más reciente
    if (anios.length > 0) sel.value = anios[0];
}

function filtrarBeneficios() { renderBeneficios(); }

function getAsignacionesFiltradas() {
    const anio = el('filtroAnioBenef')?.value || '';
    if (!anio) return asignaciones;
    return asignaciones.filter(a => (a.fecha_evento || '').startsWith(anio));
}

// ===== RENDER BENEFICIOS =====
function renderBeneficios() {
    const c = el('listaBeneficios');
    const filtradas = getAsignacionesFiltradas();
    if (!asignaciones.length) {
        c.innerHTML = `<div class="pb-empty">No hay beneficios asignados a este voluntario</div>`;
        return;
    }
    if (!filtradas.length) {
        const anio = el('filtroAnioBenef')?.value || '';
        c.innerHTML = `<div class="pb-empty">No hay beneficios para el año ${anio}</div>`;
        return;
    }
    c.innerHTML = filtradas.map(renderBcard).join('');
}

function renderBcard(a) {
    const estadoClass = a.estado_pago || 'pendiente';
    const estadoTexto = { pendiente: 'Pendiente', parcial: 'Parcial', completo: 'Completo', liberado: 'Liberado' }[a.estado_pago] || a.estado_pago;

    const btnPagar = (a.tarjetas_disponibles > 0 && a.estado_pago !== 'completo' && a.estado_pago !== 'liberado') ? `
        <button class="btn-action pagar" onclick="abrirModalPagar(${a.id})">PAGAR</button>
    ` : '';

    const btnExtra = a.estado_pago !== 'liberado' ? `
        <button class="btn-action extra" onclick="abrirModalExtra(${a.id})">VENTA EXTRA</button>
    ` : '';

    const btnLiberar = (a.tarjetas_disponibles > 0 && a.estado_pago !== 'completo' && a.estado_pago !== 'liberado') ? `
        <button class="btn-action liberar" onclick="abrirModalLiberar(${a.id})">LIBERAR</button>
    ` : '';

    const filaExtra = a.tarjetas_extras_vendidas > 0 ? `
        <div class="pb-monto-row">
            <span class="pb-monto-label">Extra vendido:</span>
            <span class="pb-monto-val naranja">$${fmt(a.tarjetas_extras_vendidas * (a.precio_tarjeta_extra || a.precio_tarjeta))}</span>
        </div>
    ` : '';

    return `
        <div class="pb-bcard ${estadoClass}">
            <div class="pb-bcard-top">
                <div>
                    <h4 class="pb-bcard-name">${a.beneficio_nombre}</h4>
                    <div class="pb-bcard-meta">
                        <span>Evento: ${fmtFecha(a.fecha_evento)}</span>
                        <span>$${fmt(a.precio_tarjeta)}/tarjeta</span>
                    </div>
                </div>
                <span class="pb-estado-badge ${estadoClass}">${estadoTexto}</span>
            </div>
            <div class="pb-tarjetas-grid">
                <div class="pb-tstat">
                    <div class="pb-tstat-val">${a.tarjetas_asignadas}</div>
                    <div class="pb-tstat-lbl">Asignadas</div>
                </div>
                <div class="pb-tstat vendidas">
                    <div class="pb-tstat-val">${a.tarjetas_vendidas}</div>
                    <div class="pb-tstat-lbl">Vendidas</div>
                </div>
                <div class="pb-tstat extras">
                    <div class="pb-tstat-val">${a.tarjetas_extras_vendidas}</div>
                    <div class="pb-tstat-lbl">Extras</div>
                </div>
                <div class="pb-tstat disponibles">
                    <div class="pb-tstat-val">${a.tarjetas_disponibles}</div>
                    <div class="pb-tstat-lbl">Disponibles</div>
                </div>
            </div>
            <div class="pb-montos">
                <div class="pb-monto-row">
                    <span class="pb-monto-label">Total:</span>
                    <span class="pb-monto-val">$${fmt(a.monto_total)}</span>
                </div>
                <div class="pb-monto-row">
                    <span class="pb-monto-label">Pagado:</span>
                    <span class="pb-monto-val verde">$${fmt(a.monto_pagado)}</span>
                </div>
                ${filaExtra}
                <div class="pb-monto-row">
                    <span class="pb-monto-label">Pendiente:</span>
                    <span class="pb-monto-val rojo">$${fmt(a.monto_pendiente)}</span>
                </div>
            </div>
            <div class="pb-bcard-actions">
                ${btnPagar}${btnExtra}${btnLiberar}
            </div>
        </div>
    `;
}

// ===== HISTORIAL =====
function inicializarFiltroAnios() {
    // Años de pagos
    const anios = [...new Set(pagos.map(p => (p.fecha_pago || '').substring(0, 4)))].filter(Boolean).sort().reverse();
    const sel = el('filtroAnioHistorial');
    while (sel.options.length > 1) sel.remove(1);
    anios.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; sel.appendChild(o); });

    // Beneficios únicos de pagos
    const benefs = [...new Set(pagos.map(p => p.beneficio_nombre).filter(Boolean))].sort();
    const selB = el('filtroBeneficioHistorial');
    while (selB.options.length > 1) selB.remove(1);
    benefs.forEach(b => { const o = document.createElement('option'); o.value = b; o.textContent = b; selB.appendChild(o); });

    // Años de liberaciones
    const todasLib = [];
    asignaciones.forEach(a => (a.historial_liberaciones || []).forEach(h => todasLib.push(h)));
    const aniosLib = [...new Set(todasLib.map(h => (h.fecha || '').substring(0, 4)))].filter(Boolean).sort().reverse();
    const selLA = el('filtroAnioLib');
    while (selLA.options.length > 1) selLA.remove(1);
    aniosLib.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; selLA.appendChild(o); });

    // Beneficios únicos de liberaciones
    const benefsLib = [...new Set(asignaciones.map(a => a.beneficio_nombre).filter(Boolean))].sort();
    const selLB = el('filtroBeneficioLib');
    while (selLB.options.length > 1) selLB.remove(1);
    benefsLib.forEach(b => { const o = document.createElement('option'); o.value = b; o.textContent = b; selLB.appendChild(o); });
}

function filtrarHistorial() {
    paginaPagos = 1;
    renderHistorial();
}

function filtrarLiberaciones() {
    paginaLiberaciones = 1;
    renderHistorialLiberaciones();
}

function getPagosFiltrados() {
    const anio  = el('filtroAnioHistorial').value;
    const mes   = el('filtroMesHistorial').value;
    const benef = el('filtroBeneficioHistorial').value;
    return pagos.filter(p => {
        const fecha = p.fecha_pago || '';
        if (anio  && !fecha.startsWith(anio)) return false;
        if (mes   && fecha.substring(5, 7) !== mes) return false;
        if (benef && p.beneficio_nombre !== benef) return false;
        return true;
    });
}

function renderHistorial() {
    const filtrados = getPagosFiltrados();
    const total = filtrados.length;
    const totalPags = Math.ceil(total / POR_PAGINA) || 1;
    if (paginaPagos > totalPags) paginaPagos = totalPags;

    el('histContador').innerHTML = `Total de pagos realizados: <strong>${total}</strong>`;

    if (!filtrados.length) {
        el('listaHistorial').innerHTML = `<div class="pb-empty">No hay pagos para los filtros seleccionados</div>`;
        el('paginacionPagos').innerHTML = '';
        return;
    }

    const inicio = (paginaPagos - 1) * POR_PAGINA;
    const pagina = filtrados.slice(inicio, inicio + POR_PAGINA);

    el('listaHistorial').innerHTML = pagina.map(p => {
        const esExtra = p.tipo_pago === 'extra';
        const obs = p.observaciones ? `<div class="pb-pago-obs">${p.observaciones}</div>` : '';
        return `
            <div class="pb-pago-item ${esExtra ? 'extra' : ''}">
                <div style="flex:1; min-width:0">
                    <div class="pb-pago-nombre">${p.beneficio_nombre || 'Beneficio'}</div>
                    <div class="pb-pago-meta">
                        <span>${fmtFecha(p.fecha_pago)}</span>
                        <span>${p.cantidad_tarjetas} tarjeta${p.cantidad_tarjetas !== 1 ? 's' : ''}</span>
                        <span>${esExtra ? 'Venta Extra' : 'Normal'}</span>
                        <span>${p.metodo_pago || 'Efectivo'}</span>
                    </div>
                    ${obs}
                </div>
                <div class="pb-pago-monto ${esExtra ? 'extra' : ''}">$${fmt(p.monto)}</div>
            </div>
        `;
    }).join('');

    el('paginacionPagos').innerHTML = renderPaginacion(totalPags, paginaPagos, 'irPaginaPagos');
}

function irPaginaPagos(n) {
    paginaPagos = n;
    renderHistorial();
    el('listaHistorial').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== MODAL PAGAR =====
function abrirModalPagar(asigId) {
    const a = asignaciones.find(x => x.id === asigId);
    if (!a) return;
    asignacionActual = a;

    el('pagarAsignacionId').value = a.id;
    el('pagarCantidad').value = '';
    el('pagarCantidad').max = a.tarjetas_disponibles;
    el('pagarMonto').value = '';
    el('pagarFecha').value = hoy();
    el('pagarMetodo').value = 'Efectivo';
    el('pagarComprobante').value = '';
    el('pagarObs').value = '';
    el('comprobanteGrupo').style.display = 'none';

    el('modalPagarSubtitle').textContent = a.beneficio_nombre;
    el('pbPagarInfo').innerHTML = `
        <strong>Disponibles:</strong> ${a.tarjetas_disponibles} tarjeta${a.tarjetas_disponibles !== 1 ? 's' : ''}
        &nbsp;·&nbsp; <strong>Precio:</strong> $${fmt(a.precio_tarjeta)} c/u
        &nbsp;·&nbsp; <strong>Pendiente:</strong> $${fmt(a.monto_pendiente)}
    `;

    el('modalPagar').style.display = 'flex';
}

function calcularMontoPago() {
    const cant = parseInt(el('pagarCantidad').value) || 0;
    const precio = parseFloat(asignacionActual?.precio_tarjeta || 0);
    el('pagarMonto').value = cant * precio;
}

function toggleComprobante() {
    const esTransf = el('pagarMetodo').value === 'Transferencia';
    ['comprobanteGrupo', 'pagarComprobanteGrupo', 'pagarArchivoGrupo'].forEach(id => {
        const e2 = el(id); if (e2) e2.style.display = esTransf ? '' : 'none';
    });
    if (!esTransf) {
        if (el('pagarComprobante')) el('pagarComprobante').value = '';
        if (el('pagarCuenta')) el('pagarCuenta').value = '';
        if (el('pagarArchivoB64')) el('pagarArchivoB64').value = '';
        if (el('prevCompBenef')) el('prevCompBenef').style.display = 'none';
        if (el('prevCompBenefPdf')) el('prevCompBenefPdf').style.display = 'none';
    }
}

function toggleExtraCuenta() {
    const esTransf = el('extraMetodo').value === 'Transferencia';
    ['extraCuentaGrupo', 'extraComprobanteGrupo', 'extraArchivoGrupo'].forEach(id => {
        const e2 = el(id); if (e2) e2.style.display = esTransf ? '' : 'none';
    });
    if (!esTransf) {
        if (el('extraArchivoB64')) el('extraArchivoB64').value = '';
        if (el('prevCompExtra')) el('prevCompExtra').style.display = 'none';
        if (el('prevCompExtraPdf')) el('prevCompExtraPdf').style.display = 'none';
    }
}

function previsualizarCompBenef(input) {
    _previsualizarComp(input, 'prevCompBenef', 'prevCompBenefPdf', 'pagarArchivoB64');
}
function previsualizarCompExtra(input) {
    _previsualizarComp(input, 'prevCompExtra', 'prevCompExtraPdf', 'extraArchivoB64');
}
function _previsualizarComp(input, imgId, pdfId, b64Id) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const b64 = ev.target.result;
        el(b64Id).value = b64;
        if (file.type.startsWith('image/')) {
            el(imgId).src = b64; el(imgId).style.display = 'block';
            el(pdfId).style.display = 'none';
        } else {
            el(imgId).style.display = 'none'; el(pdfId).style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

async function manejarPago(e) {
    e.preventDefault();
    if (!asignacionActual) return;

    const cant = parseInt(el('pagarCantidad').value) || 0;
    if (cant <= 0) { notif('Ingresa una cantidad válida de tarjetas', 'error'); return; }
    if (cant > asignacionActual.tarjetas_disponibles) {
        notif(`Solo hay ${asignacionActual.tarjetas_disponibles} tarjetas disponibles`, 'error');
        return;
    }

    const metodo = el('pagarMetodo').value;
    const cuentaId = el('pagarCuenta')?.value || null;
    if (metodo === 'Transferencia' && !cuentaId) {
        notif('Selecciona la cuenta bancaria destino', 'error'); return;
    }

    const obs = el('pagarObs').value.trim();
    const numComp = el('pagarComprobante')?.value.trim() || '';
    const b64Comp = el('pagarArchivoB64')?.value || null;

    const data = {
        asignacion_id: asignacionActual.id,
        cantidad_tarjetas: cant,
        fecha_pago: el('pagarFecha').value,
        metodo_pago: metodo,
        cuenta_bancaria_id: metodo === 'Transferencia' ? parseInt(cuentaId) : null,
        numero_comprobante: numComp,
        comprobante_base64: b64Comp,
        observaciones: obs
    };

    try {
        const res = await fetch(`${API_BASE}/pagar-beneficio-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al registrar'); }
        const r = await res.json();
        notif(r.mensaje, 'success');
        cerrarModal('modalPagar');
        await recargar();
    } catch (err) {
        notif(err.message, 'error');
    }
}

// ===== MODAL VENTA EXTRA =====
function abrirModalExtra(asigId) {
    const a = asignaciones.find(x => x.id === asigId);
    if (!a) return;
    asignacionActual = a;

    el('extraAsignacionId').value = a.id;
    el('extraPrecioUnitario').value = a.precio_tarjeta_extra || a.precio_tarjeta;
    el('extraCantidad').value = '';
    el('extraMonto').value = '';
    el('extraFecha').value = hoy();
    el('extraMetodo').value = 'Efectivo';
    el('extraObs').value = '';

    el('modalExtraSubtitle').textContent = a.beneficio_nombre;
    el('pbExtraInfo').innerHTML = `
        <strong>Beneficio:</strong> ${a.beneficio_nombre}
        &nbsp;·&nbsp; <strong>Precio tarjeta extra:</strong> $${fmt(a.precio_tarjeta_extra || a.precio_tarjeta)}
        <br>Vendidas normales: ${a.tarjetas_vendidas} &nbsp;·&nbsp; Extras actuales: ${a.tarjetas_extras_vendidas}
    `;

    el('modalExtra').style.display = 'flex';
}

function calcularMontoExtra() {
    const cant = parseInt(el('extraCantidad').value) || 0;
    const precio = parseFloat(el('extraPrecioUnitario').value) || 0;
    el('extraMonto').value = cant * precio;
}

async function manejarVentaExtra(e) {
    e.preventDefault();
    if (!asignacionActual) return;

    const cant = parseInt(el('extraCantidad').value) || 0;
    if (cant <= 0) { notif('Ingresa una cantidad válida', 'error'); return; }

    const extraMetodo = el('extraMetodo').value;
    const extraCuentaId = el('extraCuenta')?.value || null;
    if (extraMetodo === 'Transferencia' && !extraCuentaId) {
        notif('Selecciona la cuenta bancaria destino', 'error'); return;
    }

    const data = {
        asignacion_id: asignacionActual.id,
        cantidad_tarjetas: cant,
        fecha_pago: el('extraFecha').value,
        metodo_pago: extraMetodo,
        cuenta_bancaria_id: extraMetodo === 'Transferencia' ? parseInt(extraCuentaId) : null,
        numero_comprobante: el('extraComprobante')?.value.trim() || '',
        comprobante_base64: el('extraArchivoB64')?.value || null,
        observaciones: el('extraObs').value.trim()
    };

    try {
        const res = await fetch(`${API_BASE}/venta-extra-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error'); }
        const r = await res.json();
        notif(r.mensaje, 'success');
        cerrarModal('modalExtra');
        await recargar();
    } catch (err) {
        notif(err.message, 'error');
    }
}

// ===== MODAL LIBERAR =====
function abrirModalLiberar(asigId) {
    const a = asignaciones.find(x => x.id === asigId);
    if (!a) return;
    asignacionActual = a;

    el('liberarAsignacionId').value = a.id;
    el('liberarCantidad').value = '';
    el('liberarCantidad').max = a.tarjetas_disponibles;
    el('liberarMotivo').value = '';
    el('liberarAutorizadoPor').value = '';

    const radioTotal = document.querySelector('input[name="tipoLib"][value="total"]');
    if (radioTotal) radioTotal.checked = true;
    el('cantidadLiberarGrupo').style.display = 'none';
    el('liberarCantidad').required = false;

    el('modalLiberarSubtitle').textContent = a.beneficio_nombre;
    el('pbLiberarInfo').innerHTML = `
        <strong>Beneficio:</strong> ${a.beneficio_nombre}
        &nbsp;·&nbsp; <strong>Tarjetas disponibles:</strong> ${a.tarjetas_disponibles}
    `;

    el('modalLiberar').style.display = 'flex';
}

function toggleCantidadLiberar() {
    const tipo = document.querySelector('input[name="tipoLib"]:checked')?.value;
    const mostrar = tipo === 'parcial';
    el('cantidadLiberarGrupo').style.display = mostrar ? '' : 'none';
    el('liberarCantidad').required = mostrar;
}

async function manejarLiberar(e) {
    e.preventDefault();
    if (!asignacionActual) return;

    const tipo = document.querySelector('input[name="tipoLib"]:checked')?.value || 'total';
    const motivo = el('liberarMotivo').value.trim();
    const autorizado_por = el('liberarAutorizadoPor').value.trim();
    if (!motivo) { notif('Debes indicar el motivo', 'error'); return; }
    if (!autorizado_por) { notif('Debes indicar quién autorizó la liberación', 'error'); return; }

    let cantidad = 0;
    if (tipo === 'parcial') {
        cantidad = parseInt(el('liberarCantidad').value) || 0;
        if (cantidad <= 0 || cantidad > asignacionActual.tarjetas_disponibles) {
            notif(`Cantidad inválida (máximo: ${asignacionActual.tarjetas_disponibles})`, 'error');
            return;
        }
    }

    const textoConf = tipo === 'total'
        ? `¿Liberar TODAS las tarjetas de "${asignacionActual.beneficio_nombre}"?`
        : `¿Liberar ${cantidad} tarjeta${cantidad !== 1 ? 's' : ''} de "${asignacionActual.beneficio_nombre}"?`;

    if (!confirm(textoConf + `\n\nAutorizado por: ${autorizado_por}\nMotivo: ${motivo}`)) return;

    const data = { asignacion_id: asignacionActual.id, tipo, cantidad, motivo, autorizado_por };

    try {
        const res = await fetch(`${API_BASE}/liberar-tarjetas-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error'); }
        const r = await res.json();
        notif(r.mensaje, 'success');
        cerrarModal('modalLiberar');
        await recargar();
    } catch (err) {
        notif(err.message, 'error');
    }
}

// ===== TABS HISTORIAL =====
let tabActiva = 'pagos'; // 'pagos' | 'liberaciones' | 'rifa'

function verTab(tab) {
    tabActiva = tab;
    el('tabPagos').classList.toggle('activa', tab === 'pagos');
    el('tabLiberaciones').classList.toggle('activa', tab === 'liberaciones');
    if (el('tabRifa')) el('tabRifa').classList.toggle('activa', tab === 'rifa');
    el('panelPagos').style.display = tab === 'pagos' ? '' : 'none';
    el('panelLiberaciones').style.display = tab === 'liberaciones' ? '' : 'none';
    if (el('panelRifa')) el('panelRifa').style.display = tab === 'rifa' ? '' : 'none';
}

// ===== HISTORIAL LIBERACIONES =====
function getLiberacionesFiltradas() {
    const todas = [];
    asignaciones.forEach(a => {
        (a.historial_liberaciones || []).forEach(h => {
            todas.push({ ...h, beneficio_nombre: a.beneficio_nombre });
        });
    });
    todas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const anio  = el('filtroAnioLib').value;
    const mes   = el('filtroMesLib').value;
    const benef = el('filtroBeneficioLib').value;
    return todas.filter(h => {
        const fecha = (h.fecha || '').substring(0, 10);
        if (anio  && !fecha.startsWith(anio)) return false;
        if (mes   && fecha.substring(5, 7) !== mes) return false;
        if (benef && h.beneficio_nombre !== benef) return false;
        return true;
    });
}

function renderHistorialLiberaciones() {
    const todasSinFiltro = [];
    asignaciones.forEach(a => (a.historial_liberaciones || []).forEach(h => todasSinFiltro.push(h)));

    const filtradas = getLiberacionesFiltradas();
    const totalTarjetas = filtradas.reduce((s, h) => s + (h.cantidad || 0), 0);
    const totalPags = Math.ceil(filtradas.length / POR_PAGINA) || 1;
    if (paginaLiberaciones > totalPags) paginaLiberaciones = totalPags;

    // Mostrar/ocultar tab si hay liberaciones
    el('tabLiberaciones').style.display = todasSinFiltro.length ? '' : 'none';

    el('libResumen').innerHTML =
        `<span class="pb-lib-badge">${filtradas.length} registro${filtradas.length !== 1 ? 's' : ''} · ${totalTarjetas} tarjeta${totalTarjetas !== 1 ? 's' : ''} liberada${totalTarjetas !== 1 ? 's' : ''}</span>`;

    if (!filtradas.length) {
        el('listaLiberaciones').innerHTML = `<div class="pb-empty">No hay liberaciones para los filtros seleccionados</div>`;
        el('paginacionLiberaciones').innerHTML = '';
        return;
    }

    const inicio = (paginaLiberaciones - 1) * POR_PAGINA;
    const pagina = filtradas.slice(inicio, inicio + POR_PAGINA);

    el('listaLiberaciones').innerHTML = pagina.map(h => `
        <div class="pb-lib-item">
            <div class="pb-lib-top">
                <span class="pb-lib-beneficio">${h.beneficio_nombre}</span>
                <span class="pb-lib-tipo-badge ${h.tipo === 'total' ? 'total' : 'parcial'}">
                    ${h.tipo === 'total' ? 'Total' : 'Parcial'}
                </span>
            </div>
            <div class="pb-lib-meta">
                <span>${fmtFechaHora(h.fecha)}</span>
                <span>${h.cantidad} tarjeta${h.cantidad !== 1 ? 's' : ''}</span>
                <span>${h.autorizado_por || 'No registrado'}</span>
            </div>
            <div class="pb-lib-motivo">${h.motivo}</div>
        </div>
    `).join('');

    el('paginacionLiberaciones').innerHTML = renderPaginacion(totalPags, paginaLiberaciones, 'irPaginaLiberaciones');
}

function irPaginaLiberaciones(n) {
    paginaLiberaciones = n;
    renderHistorialLiberaciones();
    el('listaLiberaciones').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== PAGINACIÓN HELPER =====
function renderPaginacion(totalPags, paginaActual, fnNombre) {
    if (totalPags <= 1) return '';
    let btns = '';
    // Anterior
    btns += `<button class="pb-pag-btn${paginaActual === 1 ? ' disabled' : ''}" ${paginaActual === 1 ? 'disabled' : `onclick="${fnNombre}(${paginaActual - 1})"`}>‹</button>`;
    // Páginas
    for (let i = 1; i <= totalPags; i++) {
        if (totalPags > 7 && i > 2 && i < totalPags - 1 && Math.abs(i - paginaActual) > 1) {
            if (i === 3 || i === totalPags - 2) btns += `<span class="pb-pag-ellipsis">…</span>`;
            continue;
        }
        btns += `<button class="pb-pag-btn${i === paginaActual ? ' activa' : ''}" onclick="${fnNombre}(${i})">${i}</button>`;
    }
    // Siguiente
    btns += `<button class="pb-pag-btn${paginaActual === totalPags ? ' disabled' : ''}" ${paginaActual === totalPags ? 'disabled' : `onclick="${fnNombre}(${paginaActual + 1})"`}>›</button>`;
    return `<div class="pb-paginacion">${btns}</div>`;
}

// ===== PDF =====
function generarPDF() {
    if (!voluntario || typeof window.jspdf === 'undefined') {
        notif('jsPDF no disponible. Recarga la página (CTRL+F5)', 'error');
        return;
    }

    const filtradas = getAsignacionesFiltradas();
    const anioFiltro = el('filtroAnioBenef')?.value || '';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(255, 193, 7);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(196, 30, 58);
    doc.rect(0, 8, 210, 32, 'F');

    if (logoBase64) {
        try { doc.addImage(logoBase64, 'PNG', 12, 10, 26, 26); } catch (e) {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('REPORTE DE BENEFICIOS', 105, 21, { align: 'center' });
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(anioFiltro ? `Año ${anioFiltro}` : 'Todos los años', 105, 29, { align: 'center' });
    doc.setFontSize(8);
    doc.text(new Date().toLocaleDateString('es-CL'), 105, 36, { align: 'center' });

    // Info voluntario
    let y = 50;
    const nombre = voluntario.nombreCompleto || `${voluntario.primerNombre || ''} ${voluntario.primerApellido || ''}`.trim();
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(15, y, 180, 18, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.setTextColor(196, 30, 58);
    doc.text(nombre, 20, y + 7);
    doc.setFontSize(8); doc.setFont(undefined, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Clave: ${voluntario.claveBombero || 'N/A'}`, 20, y + 13);
    doc.text(`RUT: ${voluntario.rut || 'N/A'}`, 70, y + 13);

    // Resumen
    y += 26;
    const pendientes = filtradas.filter(a => a.estado_pago !== 'completo' && a.estado_pago !== 'liberado').length;
    const deuda = filtradas.reduce((s, a) => s + parseFloat(a.monto_pendiente || 0), 0);
    doc.setFillColor(255, 245, 245);
    doc.rect(15, y, 180, 14, 'F');
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Beneficios pendientes: ${pendientes}`, 20, y + 9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(196, 30, 58);
    doc.text(`Deuda total: $${fmt(deuda)}`, 110, y + 9);

    // Tabla de asignaciones
    y += 22;
    doc.setFillColor(196, 30, 58);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text(anioFiltro ? `BENEFICIOS ${anioFiltro}` : 'TODOS LOS BENEFICIOS', 20, y + 5.5);
    doc.text('TARJ.',         100, y + 5.5, { align: 'center' });
    doc.text('PAGADO',        130, y + 5.5, { align: 'center' });
    doc.text('PENDIENTE',     170, y + 5.5, { align: 'right' });
    doc.text('ESTADO',        195, y + 5.5, { align: 'right' });

    y += 8;
    doc.setTextColor(0, 0, 0);

    filtradas.forEach((a, i) => {
        if (y > 265) { doc.addPage(); y = 20; }
        const bg = i % 2 === 0 ? 252 : 255;
        doc.setFillColor(bg, bg, bg);
        doc.rect(15, y, 180, 10, 'F');
        doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
        doc.line(15, y, 195, y);

        doc.setFont(undefined, 'normal'); doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(a.beneficio_nombre.substring(0, 36), 20, y + 6.5);
        doc.text(`${a.tarjetas_asignadas}`, 100, y + 6.5, { align: 'center' });
        doc.setTextColor(34, 139, 34);
        doc.text(`$${fmt(a.monto_pagado)}`, 130, y + 6.5, { align: 'center' });
        doc.setFont(undefined, 'bold');
        doc.setTextColor(a.monto_pendiente > 0 ? 196 : 34, a.monto_pendiente > 0 ? 30 : 139, a.monto_pendiente > 0 ? 58 : 34);
        doc.text(`$${fmt(a.monto_pendiente)}`, 170, y + 6.5, { align: 'right' });
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(a.estado_pago, 195, y + 6.5, { align: 'right' });
        y += 10;
    });

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
        doc.line(15, 285, 195, 285);
        doc.setFontSize(7); doc.setFont(undefined, 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text('Sexta Compania De Bomberos de Puerto Montt', 20, 290);
        doc.text(`Pagina ${i} de ${pages}`, 105, 290, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-CL'), 190, 290, { align: 'right' });
    }

    doc.save(`beneficios-${(voluntario.nombreCompleto || 'voluntario').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    notif('PDF generado exitosamente', 'success');
}

// ===== UTILS =====
async function recargar() {
    await Promise.all([cargarAsignaciones(), cargarPagos()]);
    paginaPagos = 1;
    paginaLiberaciones = 1;
    renderResumen();
    inicializarFiltroBeneficios();
    renderBeneficios();
    renderHistorial();
    inicializarFiltroAnios();
    renderHistorialLiberaciones();
    asignacionActual = null;
}

function cerrarModal(id) { el(id).style.display = 'none'; }

function cerrarModalFondo(e, id) {
    if (e.target === el(id)) cerrarModal(id);
}

function el(id) { return document.getElementById(id); }
function fmt(n) { return new Intl.NumberFormat('es-CL').format(Math.round(parseFloat(n) || 0)); }
function fmtFecha(f) { return f ? new Date(f + 'T12:00:00').toLocaleDateString('es-CL') : '-'; }
function fmtFechaHora(f) { return f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '-'; }
function hoy() { return new Date().toISOString().split('T')[0]; }

function notif(msg, tipo) {
    const n = el('pbNotif');
    n.innerHTML = msg;
    n.className = 'pb-notif ' + tipo;
    n.style.display = 'block';
    if (tipo !== 'info') setTimeout(() => { n.style.display = 'none'; }, 5000);
}

// ==================== RIFA ====================
let rifaAsignacion = null;  // AsignacionRifa activa del voluntario

async function cargarRifaActiva() {
    if (!voluntario) return;
    try {
        const res = await fetch(`${API_BASE}/${voluntario.id}/rifa-activa-simple/`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.tiene_rifa) return;
        rifaAsignacion = data;
        // Mostrar tab
        const tab = el('tabRifa');
        if (tab) tab.style.display = '';
        renderRifaPanel();
    } catch (_) {}
}

function renderRifaPanel() {
    const a = rifaAsignacion;
    if (!a) return;
    const r = a.rifa;
    const numeros = (a.numeros || []).map(n => `${n.desde}–${n.hasta}`).join(', ') || 'Sin asignar';
    const estadoBadge = { no_retirada: 'badge-warn', retirada: 'badge-info', pagada: 'badge-ok', liberada: 'badge-neutral' };

    const pagosHtml = (a.pagos || []).length === 0
        ? '<p style="color:#9ca3af;font-size:0.85rem;margin:0">Sin pagos registrados</p>'
        : `<table style="width:100%;border-collapse:collapse;font-size:0.83rem">
            <thead><tr style="background:#fef2f2">
                <th style="padding:8px;text-align:left;border-bottom:1px solid #fecaca;color:#7f1d1d">Fecha</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #fecaca;color:#7f1d1d">Monto</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #fecaca;color:#7f1d1d">Método</th>
                <th style="padding:8px;text-align:left;border-bottom:1px solid #fecaca;color:#7f1d1d">Comprobante</th>
            </tr></thead>
            <tbody>${(a.pagos || []).map(p => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #f3f4f6">${fmtFecha(p.fecha_pago)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f3f4f6">$${fmt(p.monto)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f3f4f6">${p.metodo_pago}</td>
                    <td style="padding:8px;border-bottom:1px solid #f3f4f6">
                        ${p.comprobante_url
                            ? `<a href="${p.comprobante_url}" target="_blank" rel="noopener">Descargar</a>`
                            : p.comprobante_base64
                                ? `<a href="${p.comprobante_base64}" download="comprobante-beneficio-${p.id}">Descargar</a>`
                                : (p.numero_comprobante || '—')}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;

    const puedeOperar = a.estado !== 'pagada' && a.estado !== 'liberada' && r.estado === 'activa';

    el('rifaContent').innerHTML = `
        <div style="background:#fef2f2;border-radius:10px;padding:16px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                    <div style="font-size:1rem;font-weight:700;color:#7f1d1d">${r.nombre}</div>
                    <div style="font-size:0.82rem;color:#9b1c1c;margin-top:2px">Cierra: ${fmtFecha(r.fecha_cierre)}</div>
                </div>
                <span style="background:${a.estado==='pagada'?'#d1fae5':a.estado==='liberada'?'#f3f4f6':a.estado==='retirada'?'#dbeafe':'#fef3c7'};
                    color:${a.estado==='pagada'?'#065f46':a.estado==='liberada'?'#6b7280':a.estado==='retirada'?'#1e40af':'#92400e'};
                    padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;text-transform:uppercase">
                    ${a.estado.replace('_', ' ')}
                </span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
                <div style="background:white;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:1.1rem;font-weight:700;color:#111827">$${fmt(a.monto_total)}</div>
                    <div style="font-size:0.68rem;color:#9ca3af;text-transform:uppercase">Total</div>
                </div>
                <div style="background:white;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:1.1rem;font-weight:700;color:#059669">$${fmt(a.monto_pagado)}</div>
                    <div style="font-size:0.68rem;color:#9ca3af;text-transform:uppercase">Pagado</div>
                </div>
                <div style="background:white;border-radius:8px;padding:10px;text-align:center">
                    <div style="font-size:1.1rem;font-weight:700;color:#dc2626">$${fmt(a.monto_pendiente)}</div>
                    <div style="font-size:0.68rem;color:#9ca3af;text-transform:uppercase">Pendiente</div>
                </div>
            </div>
            <div style="font-size:0.82rem;color:#374151">
                <strong>Talonarios:</strong> ${a.talonarios_asignados} &nbsp;|&nbsp;
                <strong>Números:</strong> ${numeros}
            </div>
        </div>

        ${puedeOperar ? `
        <div style="display:flex;gap:10px;margin-bottom:16px">
            <button class="btn-pb submit" onclick="abrirModalPagarRifa()" style="flex:1">Pagar Rifa</button>
            <button class="btn-pb cancel" onclick="abrirModalLiberarRifa()" style="background:#fee2e2;color:#991b1b;border:none">Liberar</button>
        </div>` : ''}

        <div style="font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:10px">Historial de Pagos</div>
        ${pagosHtml}
    `;
}

function calcularMontoRifa() {
    if (!rifaAsignacion) return;
    const talonarios = parseInt(el('rifaTalonariosPagar').value) || 0;
    const r = rifaAsignacion.rifa;
    if (!r || talonarios <= 0) {
        el('rifaPagarMonto').value = '';
        el('rifaFormula').style.display = 'none';
        return;
    }
    const clpFmt = n => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(n);
    const monto = talonarios * r.numeros_por_talonario * r.precio_numero;
    el('rifaPagarMonto').value = Math.round(monto);
    el('rifaFormula').textContent = `${talonarios} talonario(s) × ${r.numeros_por_talonario} núms × ${clpFmt(r.precio_numero)} = ${clpFmt(monto)}`;
    el('rifaFormula').style.display = 'block';
}

function abrirModalPagarRifa() {
    if (!rifaAsignacion) return;
    el('modalRifaSubtitle').textContent = `${rifaAsignacion.rifa.nombre} — Pendiente: ${new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(rifaAsignacion.monto_pendiente)}`;
    el('rifaTalonariosPagar').value = rifaAsignacion.talonarios_asignados || '';
    el('rifaPagarMonto').value = '';
    el('rifaFormula').style.display = 'none';
    calcularMontoRifa();
    el('rifaPagarFecha').value = hoy();
    el('rifaPagarMetodo').value = 'efectivo';
    el('rifaCuentaGrupo').style.display = 'none';
    el('rifaComprobanteGrupo').style.display = 'none';
    el('rifaArchivoGrupo').style.display = 'none';
    el('rifaPagarObs').value = '';
    el('rifaPagarComprobante').value = '';
    el('rifaPagarArchivoB64').value = '';
    el('prevCompRifa').style.display = 'none';
    el('prevCompRifaPdf').style.display = 'none';
    el('modalPagarRifa').style.display = 'flex';
}

function toggleRifaCuenta() {
    const esTransf = el('rifaPagarMetodo').value === 'transferencia';
    el('rifaCuentaGrupo').style.display = esTransf ? '' : 'none';
    el('rifaComprobanteGrupo').style.display = esTransf ? '' : 'none';
    el('rifaArchivoGrupo').style.display = esTransf ? '' : 'none';
}

function previsualizarCompRifa(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        el('rifaPagarArchivoB64').value = e.target.result;
        if (file.type === 'application/pdf') {
            el('prevCompRifa').style.display = 'none';
            el('prevCompRifaPdf').style.display = 'block';
        } else {
            el('prevCompRifa').src = e.target.result;
            el('prevCompRifa').style.display = 'block';
            el('prevCompRifaPdf').style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
}

async function submitPagarRifa(e) {
    e.preventDefault();
    const talonarios = parseInt(el('rifaTalonariosPagar').value);
    const monto      = parseFloat(el('rifaPagarMonto').value);
    const metodo     = el('rifaPagarMetodo').value;
    const cuentaId   = el('rifaPagarCuenta').value;

    if (!talonarios || talonarios < 1) { notif('Ingresa la cantidad de talonarios a pagar', 'error'); return; }
    if (rifaAsignacion && talonarios > rifaAsignacion.talonarios_asignados) {
        notif(`Solo se pueden pagar hasta ${rifaAsignacion.talonarios_asignados} talonarios asignados`, 'error'); return;
    }
    if (!monto || monto <= 0) { notif('El monto no se pudo calcular', 'error'); return; }
    if (metodo === 'transferencia' && !cuentaId) { notif('Selecciona la cuenta bancaria', 'error'); return; }

    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    const body = {
        asignacion_id:      rifaAsignacion.id,
        monto,
        fecha_pago:         el('rifaPagarFecha').value,
        metodo_pago:        metodo,
        cuenta_bancaria_id: cuentaId ? parseInt(cuentaId) : null,
        numero_comprobante: el('rifaPagarComprobante').value,
        comprobante_base64: el('rifaPagarArchivoB64').value || null,
        observaciones:      el('rifaPagarObs').value,
    };

    try {
        const res = await fetch(`${API_BASE}/pagar-rifa-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { notif(data.error || 'Error al registrar pago', 'error'); return; }
        cerrarModal('modalPagarRifa');
        notif('Pago de rifa registrado correctamente', 'success');
        rifaAsignacion.monto_pagado    = data.monto_pagado;
        rifaAsignacion.monto_pendiente = data.monto_pendiente;
        rifaAsignacion.estado          = data.estado;
        await cargarRifaActiva();
    } catch (_) {
        notif('Error de conexión', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Registrar Pago'; }
    }
}

function abrirModalLiberarRifa() {
    if (!rifaAsignacion) return;
    el('modalRifaLibSubtitle').textContent = `${rifaAsignacion.rifa.nombre} — ${rifaAsignacion.talonarios_asignados} talonarios`;
    el('rifaLiberarCantidad').value = '';
    el('rifaLiberarAutorizadoPor').value = '';
    el('rifaLiberarMotivo').value = '';
    el('modalLiberarRifa').style.display = 'flex';
}

async function submitLiberarRifa(e) {
    e.preventDefault();
    const cantidad   = parseInt(el('rifaLiberarCantidad').value);
    const motivo     = el('rifaLiberarMotivo').value.trim();
    const autorizado = el('rifaLiberarAutorizadoPor').value.trim();

    if (!cantidad || cantidad <= 0) { notif('Ingresa la cantidad de talonarios', 'error'); return; }
    if (rifaAsignacion && cantidad > rifaAsignacion.talonarios_asignados) {
        notif(`No puedes liberar más de ${rifaAsignacion.talonarios_asignados} talonarios asignados`, 'error'); return;
    }
    if (!motivo) { notif('El motivo es obligatorio', 'error'); return; }

    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        const res = await fetch(`${API_BASE}/liberar-rifa-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                asignacion_id:      rifaAsignacion.id,
                cantidad_talonarios: cantidad,
                motivo,
                autorizado_por:     autorizado,
            }),
        });
        const data = await res.json();
        if (!res.ok) { notif(data.error || 'Error al liberar', 'error'); return; }
        cerrarModal('modalLiberarRifa');
        notif('Talonarios liberados correctamente', 'success');
        await cargarRifaActiva();
    } catch (_) {
        notif('Error de conexión', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Confirmar Liberacion'; }
    }
}

// ESC cierra modales
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        ['modalPagar', 'modalExtra', 'modalLiberar', 'modalPagarRifa', 'modalLiberarRifa'].forEach(id => {
            const m = el(id);
            if (m && m.style.display !== 'none') cerrarModal(id);
        });
    }
});
