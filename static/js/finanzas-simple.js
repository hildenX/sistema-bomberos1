// ==================== FINANZAS v5.1 ====================
// Tabs independientes, paginacion 10/pag, busqueda inteligente y comprobantes

const CATEGORIAS_INGRESO = [
    'Cartones bingo', 'Accesorios bingo', 'Asesorias',
    'Socios cooperadores', 'Cuotas sociales', 'Rifa Gigante', 'Arriendo salon'
];

const CATEGORIAS_EGRESO = [
    'Mantenimiento de Equipos', 'Combustible', 'Uniformes y Vestimenta',
    'Capacitaciones', 'Servicios Basicos', 'Seguros', 'Alimentacion', 'Reparaciones'
];

const POR_PAGINA = 10;

let movimientos = [];
let paginaIngresos = 1;
let paginaEgresos = 1;

// ==================== INIT ====================

async function init() {
    const anio = new Date().getFullYear();
    document.getElementById('anioLabel').textContent = anio;
    document.getElementById('anioLabelE').textContent = anio;

    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaIngreso').value = hoy;
    document.getElementById('fechaEgreso').value = hoy;

    inicializarSelectorAnio('anioFiltroIngresos', anio);
    inicializarSelectorAnio('anioFiltroEgresos', anio);

    document.getElementById('formIngreso').addEventListener('submit', guardarIngreso);
    document.getElementById('formEgreso').addEventListener('submit', guardarEgreso);

    mostrarLoading();
    await Promise.all([cargarMovimientos(), cargarCuentasFinanzas()]);
    actualizarResumen();
    renderTab('ingresos');
    renderTab('egresos');
}

async function cargarCuentasFinanzas() {
    try {
        const res = await fetch('/api/voluntarios/cuentas-bancarias-simple/');
        if (!res.ok) return;

        const cuentas = await res.json();
        const opciones = '<option value="">- Seleccionar cuenta -</option>' +
            cuentas.map(c => `<option value="${c.id}">${escHtml(c.nombre)} (${escHtml(c.banco)})</option>`).join('');

        const selIng = document.getElementById('cuentaBancariaIngreso');
        if (selIng) selIng.innerHTML = opciones;

        const selEgr = document.getElementById('cuentaBancariaEgreso');
        if (selEgr) selEgr.innerHTML = opciones;
    } catch (_) {
        // Silencioso: la pantalla sigue funcionando aunque no carguen cuentas.
    }
}

function toggleCuentaIngreso() {
    const metodo = document.getElementById('metodoPagoIngreso').value;
    const grupo = document.getElementById('cuentaBancariaIngresoGrupo');
    if (grupo) grupo.style.display = metodo === 'transferencia' ? '' : 'none';
}

function toggleCuentaEgreso() {
    const metodo = document.getElementById('metodoPagoEgreso').value;
    const grupo = document.getElementById('cuentaBancariaEgresoGrupo');
    if (grupo) grupo.style.display = metodo === 'transferencia' ? '' : 'none';
}

function inicializarSelectorAnio(id, anioActual) {
    const sel = document.getElementById(id);
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Todos';
    sel.appendChild(opt0);

    for (let y = anioActual + 1; y >= 2020; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === anioActual) opt.selected = true;
        sel.appendChild(opt);
    }
}

function mostrarLoading() {
    document.getElementById('listaIngresos').innerHTML = '<div class="mov-loading">Cargando...</div>';
    document.getElementById('listaEgresos').innerHTML = '<div class="mov-loading">Cargando...</div>';
}

// ==================== API ====================

async function cargarMovimientos() {
    try {
        let url = '/api/movimientos-financieros/';
        let todos = [];

        while (url) {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            if (Array.isArray(data)) {
                todos = todos.concat(data);
                url = null;
            } else {
                todos = todos.concat(data.results || []);
                url = data.next || null;
            }
        }

        movimientos = todos;
    } catch (e) {
        console.error('[FINANZAS] Error cargando movimientos:', e);
        movimientos = [];
    }
}

// ==================== RESUMEN ====================

function actualizarResumen() {
    const anioActual = new Date().getFullYear().toString();
    const selI = document.getElementById('anioFiltroIngresos');
    const selE = document.getElementById('anioFiltroEgresos');
    const anioI = selI && selI.value ? selI.value : anioActual;
    const anioE = selE && selE.value ? selE.value : anioActual;

    let saldo = 0;
    let ingresosAnio = 0;
    let egresosAnio = 0;

    movimientos.forEach(m => {
        const monto = parseFloat(m.monto) || 0;
        if (m.tipo === 'ingreso') {
            saldo += monto;
            if ((m.fecha || '').startsWith(anioI)) ingresosAnio += monto;
        } else {
            saldo -= monto;
            if ((m.fecha || '').startsWith(anioE)) egresosAnio += monto;
        }
    });

    const fmt = n => '$' + Math.abs(n).toLocaleString('es-CL');
    const el = id => document.getElementById(id);

    el('saldoTotal').textContent = (saldo < 0 ? '-' : '') + fmt(saldo);
    el('saldoTotal').className = 'sum-value ' + (saldo >= 0 ? 'verde' : 'rojo');
    el('totalIngresosAnio').textContent = fmt(ingresosAnio);
    el('totalEgresosAnio').textContent = fmt(egresosAnio);
    el('anioLabel').textContent = anioI === '' ? 'Total' : anioI;
    el('anioLabelE').textContent = anioE === '' ? 'Total' : anioE;
}

// ==================== TABS ====================

function cambiarTab(tab) {
    document.getElementById('panel-ingresos').style.display = tab === 'ingresos' ? 'block' : 'none';
    document.getElementById('panel-egresos').style.display = tab === 'egresos' ? 'block' : 'none';
    document.getElementById('tab-btn-ingresos').classList.toggle('active', tab === 'ingresos');
    document.getElementById('tab-btn-egresos').classList.toggle('active', tab === 'egresos');
}

// ==================== FILTROS ====================

function getFiltrados(tipo) {
    const esIngreso = tipo === 'ingresos';
    const busq = (document.getElementById(esIngreso ? 'busqIngresos' : 'busqEgresos').value || '').toLowerCase().trim();
    const catFiltro = esIngreso
        ? document.getElementById('tipoFiltroIngresos').value
        : document.getElementById('motivoFiltroEgresos').value;
    const anioFiltro = esIngreso
        ? document.getElementById('anioFiltroIngresos').value
        : document.getElementById('anioFiltroEgresos').value;
    const desde = document.getElementById(esIngreso ? 'desdeIngresos' : 'desdeEgresos').value;
    const hasta = document.getElementById(esIngreso ? 'hastaIngresos' : 'hastaEgresos').value;
    const predefinidos = esIngreso ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;
    const tipoApi = esIngreso ? 'ingreso' : 'egreso';

    return movimientos.filter(m => {
        if (m.tipo !== tipoApi) return false;
        if (anioFiltro && !(m.fecha || '').startsWith(anioFiltro)) return false;

        if (catFiltro) {
            const categoriaMovimiento = normalizarTexto(m.categoria || '');
            const categoriaFiltro = normalizarTexto(catFiltro);
            const categoriasBase = predefinidos.map(normalizarTexto);

            if (catFiltro === '__otro__') {
                if (categoriasBase.includes(categoriaMovimiento)) return false;
            } else if (categoriaMovimiento !== categoriaFiltro) {
                return false;
            }
        }

        if (desde && m.fecha < desde) return false;
        if (hasta && m.fecha > hasta) return false;

        if (busq) {
            const texto = [
                m.categoria || '',
                m.descripcion || '',
                m.monto != null ? String(m.monto) : '',
                m.created_by_nombre || '',
                m.numero_comprobante || ''
            ].join(' ').toLowerCase();
            if (!texto.includes(busq)) return false;
        }

        return true;
    });
}

function resetPagina(tipo) {
    if (tipo === 'ingresos') paginaIngresos = 1;
    else paginaEgresos = 1;
}

function limpiarFiltros(tipo) {
    const anio = new Date().getFullYear().toString();

    if (tipo === 'ingresos') {
        document.getElementById('busqIngresos').value = '';
        document.getElementById('tipoFiltroIngresos').value = '';
        document.getElementById('anioFiltroIngresos').value = anio;
        document.getElementById('desdeIngresos').value = '';
        document.getElementById('hastaIngresos').value = '';
    } else {
        document.getElementById('busqEgresos').value = '';
        document.getElementById('motivoFiltroEgresos').value = '';
        document.getElementById('anioFiltroEgresos').value = anio;
        document.getElementById('desdeEgresos').value = '';
        document.getElementById('hastaEgresos').value = '';
    }

    resetPagina(tipo);
    renderTab(tipo);
}

// ==================== RENDER ====================

function renderTab(tipo) {
    actualizarResumen();

    const filtrados = getFiltrados(tipo);
    const esIngreso = tipo === 'ingresos';
    let pagina = esIngreso ? paginaIngresos : paginaEgresos;
    const totalPags = Math.ceil(filtrados.length / POR_PAGINA) || 1;

    pagina = Math.min(Math.max(pagina, 1), totalPags);
    if (esIngreso) paginaIngresos = pagina;
    else paginaEgresos = pagina;

    const inicio = (pagina - 1) * POR_PAGINA;
    const porPagina = filtrados.slice(inicio, inicio + POR_PAGINA);
    const totalTipo = movimientos.filter(m => m.tipo === (esIngreso ? 'ingreso' : 'egreso')).length;

    const contId = esIngreso ? 'contadorIngresos' : 'contadorEgresos';
    const listId = esIngreso ? 'listaIngresos' : 'listaEgresos';
    const pagIds = esIngreso
        ? ['paginIngresosTop', 'paginIngresos']
        : ['paginEgresosTop', 'paginEgresos'];

    const label = esIngreso ? 'ingreso' : 'egreso';
    const paginaTexto = totalPags > 1 ? ` - Pagina <strong>${pagina}</strong> de <strong>${totalPags}</strong>` : '';

    if (filtrados.length < totalTipo) {
        document.getElementById(contId).innerHTML =
            `Mostrando <strong>${filtrados.length}</strong> de <strong>${totalTipo}</strong> ${label}s (filtrados)${paginaTexto}`;
    } else {
        document.getElementById(contId).innerHTML =
            `<strong>${totalTipo}</strong> ${label}${totalTipo !== 1 ? 's' : ''} en total${paginaTexto}`;
    }

    if (porPagina.length === 0) {
        document.getElementById(listId).innerHTML =
            `<div class="mov-empty">No hay ${tipo} que coincidan con los filtros.</div>`;
        limpiarPaginacion(pagIds);
        return;
    }

    document.getElementById(listId).innerHTML = porPagina.map(renderMovCard).join('');
    renderPaginacion(pagIds, pagina, totalPags, tipo);
}

function renderMovCard(m) {
    const monto = parseFloat(m.monto) || 0;
    const clase = m.tipo === 'ingreso' ? 'ingreso' : 'egreso';
    const montoFmt = '$' + monto.toLocaleString('es-CL');
    const fecha = m.fecha || '';
    const autor = m.created_by_nombre || 'Sistema';
    const doc = m.numero_comprobante ? ` &bull; Doc: ${escHtml(m.numero_comprobante)}` : '';
    const comprobante = obtenerLinkComprobante(m);
    const categoria = m.categoria || '-';
    const desc = m.descripcion ? `<div class="mov-desc">${escHtml(m.descripcion)}</div>` : '';

    return `
    <div class="mov-card ${clase}">
        <div class="mov-main">
            <div class="mov-info">
                <div class="mov-head">
                    <div class="mov-cat">${escHtml(categoria)}</div>
                </div>
                ${desc}
                <div class="mov-footer">
                    <div class="mov-meta">${escHtml(fecha)} &bull; ${escHtml(autor)}${doc}</div>
                    ${comprobante}
                </div>
            </div>
            <div class="mov-side">
                <div class="mov-monto ${clase}">${montoFmt}</div>
            </div>
        </div>
    </div>`;
}

function obtenerLinkComprobante(m) {
    if (m.comprobante_url) {
        return `
        <a href="${escAttr(m.comprobante_url)}" target="_blank" rel="noopener" class="mov-download-button" data-tooltip="Comprobante">
            <span class="mov-download-wrapper">
                <span class="mov-download-text">Descargar</span>
                <span class="mov-download-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                        <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                    </svg>
                </span>
            </span>
        </a>`;
    }

    if (m.comprobante_base64) {
        return `
        <a href="${escAttr(m.comprobante_base64)}" target="_blank" rel="noopener" download="comprobante-movimiento-${m.id}" class="mov-download-button" data-tooltip="Comprobante">
            <span class="mov-download-wrapper">
                <span class="mov-download-text">Descargar</span>
                <span class="mov-download-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
                        <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                    </svg>
                </span>
            </span>
        </a>`;
    }

    return '';
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function normalizarTexto(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// ==================== PAGINACION ====================

function limpiarPaginacion(containerIds) {
    const ids = Array.isArray(containerIds) ? containerIds : [containerIds];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function renderPaginacion(containerIds, pagina, totalPags, tipo) {
    const ids = Array.isArray(containerIds) ? containerIds : [containerIds];

    if (totalPags <= 1) {
        limpiarPaginacion(ids);
        return;
    }

    let html = `<div class="pag-container"><span class="pag-info">Pagina ${pagina} de ${totalPags}</span><div class="pag-btns">`;

    html += `<button class="pag-btn${pagina === 1 ? ' disabled' : ''}" onclick="irPagina('${tipo}', ${pagina - 1})">&#8249;</button>`;

    for (let i = 1; i <= totalPags; i++) {
        const enRango = i === 1 || i === totalPags || (i >= pagina - 2 && i <= pagina + 2);
        if (enRango) {
            html += `<button class="pag-btn${i === pagina ? ' active' : ''}" onclick="irPagina('${tipo}', ${i})">${i}</button>`;
        } else if (i === pagina - 3 || i === pagina + 3) {
            html += '<span class="pag-dots">...</span>';
        }
    }

    html += `<button class="pag-btn${pagina === totalPags ? ' disabled' : ''}" onclick="irPagina('${tipo}', ${pagina + 1})">&#8250;</button>`;
    html += '</div></div>';

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}

function irPagina(tipo, pagina) {
    const filtrados = getFiltrados(tipo);
    const totalPags = Math.ceil(filtrados.length / POR_PAGINA) || 1;
    if (pagina < 1 || pagina > totalPags) return;

    if (tipo === 'ingresos') paginaIngresos = pagina;
    else paginaEgresos = pagina;

    renderTab(tipo);
    document.getElementById(`panel-${tipo}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== MODALES ====================

function abrirModal(tipo) {
    document.getElementById(tipo === 'ingreso' ? 'modalIngreso' : 'modalEgreso').style.display = 'flex';
}

function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

function cerrarModalFondo(e, id) {
    if (e.target.id === id) cerrarModal(id);
}

function toggleOtro(tipo) {
    const esIngreso = tipo === 'ingreso';
    const sel = document.getElementById(esIngreso ? 'tipoIngreso' : 'motivoEgreso').value;
    const grupo = document.getElementById(esIngreso ? 'otroIngresoGrupo' : 'otroEgresoGrupo');
    const campo = document.getElementById(esIngreso ? 'otroIngresoNombre' : 'otroEgresoNombre');
    const esOtro = sel === '__otro__';

    grupo.style.display = esOtro ? 'block' : 'none';
    if (!esOtro) campo.value = '';
}

// ==================== GUARDAR INGRESO ====================

async function guardarIngreso(e) {
    e.preventDefault();

    let categoria = document.getElementById('tipoIngreso').value;
    if (categoria === '__otro__') {
        categoria = document.getElementById('otroIngresoNombre').value.trim();
        if (!categoria) {
            alert('Especifique el tipo de ingreso.');
            return;
        }
    }
    if (!categoria) {
        alert('Seleccione un tipo de ingreso.');
        return;
    }

    const monto = parseFloat(document.getElementById('montoIngreso').value);
    const fecha = document.getElementById('fechaIngreso').value;
    const descripcion = document.getElementById('descripcionIngreso').value.trim();
    const metodoPago = document.getElementById('metodoPagoIngreso')?.value || 'efectivo';
    const cuentaId = document.getElementById('cuentaBancariaIngreso')?.value || null;

    if (!monto || monto <= 0) {
        alert('Ingrese un monto valido.');
        return;
    }
    if (!fecha) {
        alert('Seleccione una fecha.');
        return;
    }
    if (metodoPago === 'transferencia' && !cuentaId) {
        alert('Seleccione la cuenta bancaria destino.');
        return;
    }

    const payload = {
        tipo: 'ingreso',
        categoria,
        monto,
        descripcion,
        fecha,
        metodo_pago: metodoPago,
        cuenta_bancaria: metodoPago === 'transferencia' ? parseInt(cuentaId, 10) : null,
    };

    try {
        const res = await fetch('/api/movimientos-financieros/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al guardar');
        }

        cerrarModal('modalIngreso');
        document.getElementById('formIngreso').reset();
        toggleOtro('ingreso');
        toggleCuentaIngreso();

        await cargarMovimientos();
        actualizarResumen();
        resetPagina('ingresos');
        renderTab('ingresos');
        renderTab('egresos');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ==================== GUARDAR EGRESO ====================

async function guardarEgreso(e) {
    e.preventDefault();

    let categoria = document.getElementById('motivoEgreso').value;
    if (categoria === '__otro__') {
        categoria = document.getElementById('otroEgresoNombre').value.trim();
        if (!categoria) {
            alert('Especifique el motivo del egreso.');
            return;
        }
    }
    if (!categoria) {
        alert('Seleccione un motivo.');
        return;
    }

    const monto = parseFloat(document.getElementById('montoEgreso').value);
    const fecha = document.getElementById('fechaEgreso').value;
    const descripcion = document.getElementById('descripcionEgreso').value.trim();
    const numeroDoc = document.getElementById('numeroDocEgreso').value.trim();
    const metodoPago = document.getElementById('metodoPagoEgreso')?.value || 'efectivo';
    const cuentaId = document.getElementById('cuentaBancariaEgreso')?.value || null;

    if (!monto || monto <= 0) {
        alert('Ingrese un monto valido.');
        return;
    }
    if (!fecha) {
        alert('Seleccione una fecha.');
        return;
    }
    if (!descripcion) {
        alert('Ingrese una descripcion del egreso.');
        return;
    }
    if (metodoPago === 'transferencia' && !cuentaId) {
        alert('Seleccione la cuenta bancaria de origen.');
        return;
    }

    const payload = {
        tipo: 'egreso',
        categoria,
        monto,
        descripcion,
        fecha,
        numero_comprobante: numeroDoc,
        metodo_pago: metodoPago,
        cuenta_bancaria: metodoPago === 'transferencia' ? parseInt(cuentaId, 10) : null,
    };

    try {
        const res = await fetch('/api/movimientos-financieros/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al guardar');
        }

        cerrarModal('modalEgreso');
        document.getElementById('formEgreso').reset();
        toggleOtro('egreso');
        toggleCuentaEgreso();

        await cargarMovimientos();
        actualizarResumen();
        resetPagina('egresos');
        renderTab('ingresos');
        renderTab('egresos');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ==================== START ====================

document.addEventListener('DOMContentLoaded', init);
