// ==================== BENEFICIOS v2.0 ====================
const API = '/api/voluntarios';

let beneficios = [];
let asignaciones = [];
let logoBase64 = null;
let modalDeudoresData = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    await cargarLogo();
    await cargarDatos();
    document.getElementById('formCrearBeneficio').addEventListener('submit', crearBeneficio);
});

async function cargarLogo() {
    try {
        const res = await fetch(`${API}/logo-simple/`);
        if (res.ok) {
            const data = await res.json();
            if (data.tiene_logo) logoBase64 = data.logo;
        }
    } catch (e) {}
}

async function cargarDatos() {
    try {
        mostrarNotif('Cargando beneficios...', 'info');

        const [resBen, resAsig] = await Promise.all([
            fetch(`${API}/beneficios/`),
            fetch(`${API}/asignaciones-beneficios/`)
        ]);

        if (resBen.ok) beneficios = await resBen.json();
        if (resAsig.ok) asignaciones = await resAsig.json();

        ocultarNotif();
        actualizarResumen();
        inicializarFiltros();
        renderLista();
    } catch (e) {
        mostrarNotif('Error al cargar datos: ' + e.message, 'error');
    }
}

// ===== RESUMEN HEADER =====
function actualizarResumen() {
    const activos = beneficios.filter(b => b.estado === 'activo').length;

    let esperado = 0, recaudado = 0, deudores = 0;
    asignaciones.forEach(a => {
        esperado  += parseFloat(a.monto_total  || 0);
        recaudado += parseFloat(a.monto_pagado || 0);
        if (a.estado_pago === 'pendiente' || a.estado_pago === 'parcial') deudores++;
    });

    const eficiencia = esperado > 0 ? Math.round((recaudado / esperado) * 100) : 0;

    el('statActivos').textContent    = activos;
    el('statEsperado').textContent   = '$' + fmt(esperado);
    el('statDeudores').textContent   = deudores;
    el('statEficiencia').textContent = eficiencia + '%';
}

// ===== FILTROS =====
function inicializarFiltros() {
    const anios = [...new Set(
        beneficios.map(b => (b.fecha_evento || '').substring(0, 4))
    )].filter(Boolean).sort().reverse();

    const select = el('filtroAnio');
    while (select.options.length > 1) select.remove(1);
    anios.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        select.appendChild(opt);
    });
}

function aplicarFiltros() {
    renderLista();
}

function getFiltrados() {
    const anio   = el('filtroAnio').value;
    const estado = el('filtroEstado').value;

    return beneficios.filter(b => {
        if (anio   && !(b.fecha_evento || '').startsWith(anio)) return false;
        if (estado && b.estado !== estado) return false;
        return true;
    });
}

// ===== RENDER LISTA =====
function renderLista() {
    const lista     = el('listaBeneficios');
    const filtrados = getFiltrados();

    el('benContador').textContent =
        `Mostrando ${filtrados.length} de ${beneficios.length} beneficios`;

    if (filtrados.length === 0) {
        lista.innerHTML = `
            <div class="ben-empty">
                <p>📋 No hay beneficios para mostrar</p>
                <p style="font-size:0.82rem">Crea el primer beneficio usando el botón "+ Nuevo Beneficio"</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = `<div class="ben-list">${filtrados.map(renderCard).join('')}</div>`;
}

function renderCard(b) {
    const asig      = asignaciones.filter(a => a.beneficio === b.id);
    const total     = asig.length;
    const pagados   = asig.filter(a => a.estado_pago === 'completo').length;
    const deudores  = asig.filter(a => a.estado_pago === 'pendiente' || a.estado_pago === 'parcial').length;

    const montoEsp  = asig.reduce((s, a) => s + parseFloat(a.monto_total  || 0), 0);
    const montoRec  = asig.reduce((s, a) => s + parseFloat(a.monto_pagado || 0), 0);
    const efic      = montoEsp > 0 ? Math.round((montoRec / montoEsp) * 100) : 0;

    const estadoBadge = `<span class="badge ${b.estado}">${b.estado === 'activo' ? 'Activo' : 'Cerrado'}</span>`;
    const tipoBadge   = b.tipo ? `<span class="badge tipo">${b.tipo}</span>` : '';

    const btnCerrar = b.estado === 'activo' ? `
        <button class="btn-act cerrar-btn" onclick="cerrarBeneficio(${b.id})">
            🔒 Cerrar
        </button>
    ` : '';

    return `
        <div class="bcard ${b.estado}">
            <div class="bcard-top">
                <div class="bcard-title">
                    <h3>${b.nombre}</h3>
                    <div class="bcard-meta">
                        <span>📅 Evento: ${fmtFecha(b.fecha_evento)}</span>
                        <span>⏱️ Límite: ${fmtFecha(b.fecha_limite_rendicion)}</span>
                        <span>💰 $${fmt(b.precio_por_tarjeta)}/tarjeta</span>
                    </div>
                </div>
                <div class="bcard-badges">
                    ${tipoBadge}
                    ${estadoBadge}
                </div>
            </div>
            <div class="bcard-stats">
                <div class="bstat">
                    <div class="bstat-val">${total}</div>
                    <div class="bstat-lbl">Asignados</div>
                </div>
                <div class="bstat pagados">
                    <div class="bstat-val">${pagados}</div>
                    <div class="bstat-lbl">Pagados</div>
                </div>
                <div class="bstat deudores">
                    <div class="bstat-val">${deudores}</div>
                    <div class="bstat-lbl">Deudores</div>
                </div>
                <div class="bstat">
                    <div class="bstat-val">${efic}%</div>
                    <div class="bstat-lbl">Eficiencia</div>
                </div>
            </div>
            <div class="bcard-actions">
                <button class="btn-act deudores-btn" onclick="verDeudores(${b.id})">
                    ⚠️ DEUDORES (${deudores})
                </button>
                ${btnCerrar}
            </div>
        </div>
    `;
}

// ===== FORMULARIO =====
function toggleFormulario() {
    const sec = el('formSection');
    const visible = sec.style.display !== 'none';
    sec.style.display = visible ? 'none' : 'block';
    if (!visible) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleOtroTipo() {
    const val = el('tipoBeneficio').value;
    el('otroTipoGrupo').style.display = val === 'Otro' ? '' : 'none';
    if (val !== 'Otro') el('otroTipoNombre').value = '';
}

async function crearBeneficio(e) {
    e.preventDefault();

    let tipo = el('tipoBeneficio').value;
    if (tipo === 'Otro') {
        tipo = el('otroTipoNombre').value.trim();
        if (!tipo) {
            mostrarNotif('Debes especificar el tipo de beneficio', 'error');
            return;
        }
    }

    const payload = {
        nombre:                   el('nombreBeneficio').value.trim(),
        tipo:                     tipo,
        descripcion:              el('descripcionBeneficio').value.trim() || '',
        fecha_evento:             el('fechaEvento').value,
        fecha_limite_rendicion:   el('fechaLimiteRendicion').value,
        precio_tarjeta:           parseInt(el('precioTarjeta').value),
        tarjetas_voluntarios:     parseInt(el('tarjetasVoluntarios').value),
        tarjetas_honorarios_cia:  parseInt(el('tarjetasHonorariosCia').value),
        tarjetas_honorarios_cuerpo: parseInt(el('tarjetasHonorariosCuerpo').value),
        tarjetas_insignes:        parseInt(el('tarjetasInsignes').value),
    };

    mostrarNotif('Creando beneficio...', 'info');

    try {
        const res = await fetch(`${API}/crear-beneficio-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al crear beneficio');
        }

        const result = await res.json();
        mostrarNotif(
            `✅ ${result.mensaje} — Asignaciones creadas: ${result.asignaciones_creadas}`,
            'success'
        );

        e.target.reset();
        toggleFormulario();

        await cargarDatos();
    } catch (err) {
        mostrarNotif('❌ Error: ' + err.message, 'error');
    }
}

// ===== DEUDORES MODAL =====
function verDeudores(beneficioId) {
    const b = beneficios.find(x => x.id === beneficioId);
    if (!b) return;

    const deudores = asignaciones.filter(a =>
        a.beneficio === beneficioId &&
        (a.estado_pago === 'pendiente' || a.estado_pago === 'parcial')
    );

    const totalDeuda = deudores.reduce((s, d) => s + parseFloat(d.monto_pendiente || 0), 0);
    const promedio   = deudores.length > 0 ? totalDeuda / deudores.length : 0;

    modalDeudoresData = { nombre: b.nombre, deudores, totalDeuda };

    el('modalDeudoresTitle').textContent    = 'Lista de Deudores';
    el('modalDeudoresSubtitle').textContent = b.nombre;

    el('modalDeudoresStats').innerHTML = `
        <div class="mstat">
            <div class="mstat-val">${deudores.length}</div>
            <div class="mstat-lbl">Deudores</div>
        </div>
        <div class="mstat">
            <div class="mstat-val">$${fmt(totalDeuda)}</div>
            <div class="mstat-lbl">Total Adeudado</div>
        </div>
        <div class="mstat">
            <div class="mstat-val">$${fmt(promedio)}</div>
            <div class="mstat-lbl">Promedio</div>
        </div>
    `;

    if (deudores.length === 0) {
        el('modalDeudoresList').innerHTML = `
            <div class="ben-empty" style="padding: 40px;">
                <p>✅ No hay deudores en este beneficio</p>
            </div>
        `;
    } else {
        el('modalDeudoresList').innerHTML = deudores.map((d, i) => `
            <div class="deudor-row">
                <div class="deudor-num">${i + 1}</div>
                <div class="deudor-info">
                    <div class="deudor-nombre">${d.voluntario_nombre}</div>
                    <div class="deudor-sub">${d.tarjetas_vendidas || 0}/${d.tarjetas_asignadas} tarjetas vendidas</div>
                </div>
                <div class="deudor-monto">$${fmt(d.monto_pendiente)}</div>
            </div>
        `).join('');
    }

    el('modalDeudores').style.display = 'flex';
}

function cerrarModalDeudores(e) {
    if (e.target === el('modalDeudores')) {
        el('modalDeudores').style.display = 'none';
    }
}

// ===== CERRAR BENEFICIO =====
async function cerrarBeneficio(id) {
    const b = beneficios.find(x => x.id === id);
    if (!b) return;

    if (!confirm(`¿Cerrar el beneficio "${b.nombre}"?\n\nSolo es posible si todas las tarjetas están vendidas o liberadas.`)) return;

    try {
        const res = await fetch(`${API}/cerrar-beneficio-simple/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beneficio_id: id })
        });
        const data = await res.json();

        if (!res.ok) {
            // Mostrar detalle de voluntarios bloqueantes
            if (data.pendientes && data.pendientes.length) {
                const lista = data.pendientes
                    .map(p => `• ${p.voluntario}: ${p.tarjetas_disponibles} tarjeta(s) disponible(s)`)
                    .join('\n');
                mostrarNotif(`❌ ${data.error}\n\nVoluntarios con tarjetas pendientes:\n${lista}`, 'error');
                // Mostrar también en alert para mayor visibilidad
                alert(`No se puede cerrar el beneficio.\n\n${data.error}\n\n${lista}`);
            } else {
                mostrarNotif('❌ ' + (data.error || 'Error al cerrar'), 'error');
            }
            return;
        }

        mostrarNotif('✅ ' + data.mensaje, 'success');
        await cargarDatos();
    } catch (e) {
        mostrarNotif('❌ ' + e.message, 'error');
    }
}

// ===== PDF DEUDORES =====
function exportarPDFDeudores() {
    if (!modalDeudoresData) return;
    const { nombre, deudores, totalDeuda } = modalDeudoresData;

    if (typeof window.jspdf === 'undefined') {
        alert('jsPDF no disponible. Recarga la página (CTRL+F5)');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(255, 193, 7);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(196, 30, 58);
    doc.rect(0, 8, 210, 35, 'F');

    if (logoBase64) {
        try { doc.addImage(logoBase64, 'PNG', 10, 10, 30, 30); } catch (e) {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('LISTA DE DEUDORES', 105, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(nombre, 105, 31, { align: 'center' });
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('es-CL'), 105, 39, { align: 'center' });

    // Resumen
    doc.setTextColor(0, 0, 0);
    let y = 52;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(15, y, 180, 22, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Total deudores: ${deudores.length}`, 22, y + 8);
    doc.text(`Total adeudado: $${fmt(totalDeuda)}`, 22, y + 15);
    doc.text(`Promedio: $${fmt(deudores.length > 0 ? totalDeuda / deudores.length : 0)}`, 110, y + 8);

    // Tabla
    y += 28;
    doc.setFillColor(196, 30, 58);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('#',               20,  y + 5.5);
    doc.text('BOMBERO',         40,  y + 5.5);
    doc.text('TARJETAS',        135, y + 5.5, { align: 'center' });
    doc.text('MONTO ADEUDADO',  185, y + 5.5, { align: 'right' });

    y += 8;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');

    deudores.forEach((d, i) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
            doc.setFillColor(196, 30, 58);
            doc.rect(15, y, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont(undefined, 'bold');
            doc.text('#',               20,  y + 5.5);
            doc.text('BOMBERO',         40,  y + 5.5);
            doc.text('TARJETAS',        135, y + 5.5, { align: 'center' });
            doc.text('MONTO ADEUDADO',  185, y + 5.5, { align: 'right' });
            y += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
        }

        const bg = i % 2 === 0 ? 250 : 255;
        doc.setFillColor(bg, bg, bg);
        doc.rect(15, y, 180, 10, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.1);
        doc.line(15, y, 195, y);

        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`${i + 1}`, 20, y + 6.5);
        doc.setTextColor(0, 0, 0);
        doc.text((d.voluntario_nombre || '').substring(0, 42), 40, y + 6.5);
        doc.text(`${d.tarjetas_asignadas}`, 135, y + 6.5, { align: 'center' });
        doc.setFont(undefined, 'bold');
        doc.setTextColor(196, 30, 58);
        doc.text(`$${fmt(d.monto_pendiente)}`, 185, y + 6.5, { align: 'right' });
        doc.setFont(undefined, 'normal');

        y += 10;
    });

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(15, 285, 195, 285);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('Sexta Compania De Bomberos de Puerto Montt', 20, 290);
        doc.text(`Pagina ${i} de ${pages}`, 105, 290, { align: 'center' });
        doc.text(new Date().toLocaleDateString('es-CL'), 190, 290, { align: 'right' });
    }

    doc.save(`deudores-${nombre.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
    mostrarNotif('✅ PDF generado exitosamente', 'success');
}

// ===== UTILS =====
function el(id)   { return document.getElementById(id); }
function fmt(n)   { return new Intl.NumberFormat('es-CL').format(Math.round(parseFloat(n) || 0)); }
function fmtFecha(f) {
    if (!f) return '-';
    return new Date(f + 'T12:00:00').toLocaleDateString('es-CL');
}

function mostrarNotif(msg, tipo) {
    const n = el('benNotif');
    n.innerHTML = msg;
    n.className = 'ben-notif ' + tipo;
    n.style.display = 'block';
    if (tipo !== 'info') setTimeout(ocultarNotif, 5000);
}

function ocultarNotif() {
    const n = el('benNotif');
    if (n) n.style.display = 'none';
}

// ESC cierra modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') el('modalDeudores').style.display = 'none';
});
