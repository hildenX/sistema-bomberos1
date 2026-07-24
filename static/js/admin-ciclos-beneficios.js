// ==================== CICLOS ANUALES DE BENEFICIOS v1.0 ====================

const API_BASE = '/api/voluntarios/ciclos-beneficios-simple';

let ciclos = [];
let cicloActivo = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    cargarCiclos();

    // Actualiza fechas al cambiar el año en el modal
    const inputAnio = document.getElementById('inputAnio');
    if (inputAnio) inputAnio.addEventListener('input', autocompletarFechas);
});

// ===== CARGA =====
async function cargarCiclos() {
    try {
        const res = await fetch(`${API_BASE}/`);
        if (!res.ok) throw new Error('Error al cargar ciclos');
        ciclos = await res.json();
        cicloActivo = ciclos.find(c => c.activo && !c.sin_ciclo_formal) || null;
        renderCiclos();
        if (cicloActivo) actualizarDashboard(cicloActivo);
    } catch (e) {
        notif('Error al cargar ciclos: ' + e.message, 'error');
    }
}

// ===== RENDER =====
function renderCiclos() {
    const cont = document.getElementById('listaCiclos');

    if (!ciclos.length) {
        cont.innerHTML = `<div class="cb-empty">No hay ciclos registrados. Crea el primer ciclo para comenzar.</div>`;
        return;
    }

    cont.innerHTML = ciclos.map(c => {
        const esActivo  = c.activo && !c.cerrado;
        const esCerrado = c.cerrado;
        const sinCiclo  = c.sin_ciclo_formal;

        const claseCard = sinCiclo ? 'sin-ciclo' : (esCerrado ? 'cerrado' : (esActivo ? 'activo' : ''));

        const badges = `
            ${esActivo  ? '<span class="cb-badge activo">● Activo</span>' : ''}
            ${esCerrado ? '<span class="cb-badge cerrado">Cerrado</span>' : ''}
            ${sinCiclo  ? '<span class="cb-badge sin-ciclo">Sin ciclo formal</span>' : ''}
        `;

        const eficiencia = c.total_esperado > 0
            ? Math.round(c.total_recaudado / c.total_esperado * 100)
            : 0;

        const statsHtml = `
            <div class="cb-card-stats">
                <div class="cb-stat-cell">
                    <div class="val">${c.total_beneficios}</div>
                    <div class="lbl">Beneficios</div>
                </div>
                <div class="cb-stat-cell">
                    <div class="val">${c.beneficios_activos}</div>
                    <div class="lbl">Activos</div>
                </div>
                <div class="cb-stat-cell">
                    <div class="val">${c.beneficios_cerrados}</div>
                    <div class="lbl">Cerrados</div>
                </div>
                <div class="cb-stat-cell">
                    <div class="val verde">$${fmt(c.total_recaudado)}</div>
                    <div class="lbl">Recaudado</div>
                </div>
                <div class="cb-stat-cell">
                    <div class="val rojo">$${fmt(c.deuda_pendiente)}</div>
                    <div class="lbl">Deuda</div>
                </div>
                <div class="cb-stat-cell">
                    <div class="val ${eficiencia >= 80 ? 'verde' : eficiencia >= 50 ? 'naranja' : 'rojo'}">${eficiencia}%</div>
                    <div class="lbl">Eficiencia</div>
                </div>
            </div>
        `;

        const botonesAccion = sinCiclo ? `
            <button class="btn-cb nuevo sm" onclick="crearCicloPara(${c.anio})">＋ Formalizar ciclo ${c.anio}</button>
        ` : `
            ${!esActivo && !esCerrado ? `<button class="btn-cb activar sm" onclick="activarCiclo(${c.id})">Activar</button>` : ''}
            ${!esCerrado ? `<button class="btn-cb cerrar sm" onclick="cerrarCiclo(${c.id})">Cerrar Ciclo</button>` : ''}
            ${esCerrado  ? `<button class="btn-cb reabrir sm" onclick="reabrirCiclo(${c.id})">Reabrir</button>` : ''}
            <button class="btn-cb stats sm" onclick="verEstadisticas(${c.id})">Estadísticas</button>
        `;

        const fechaCierre = c.fecha_cierre
            ? `<span style="margin-left:12px">Cerrado: ${fmtFecha(c.fecha_cierre)}</span>`
            : '';

        return `
            <div class="cb-card ${claseCard}">
                <div class="cb-card-header">
                    <div class="cb-card-anio">Ciclo ${c.anio}</div>
                    <div class="cb-badges">${badges}</div>
                </div>
                <div class="cb-dates">
                    ${fmtFecha(c.fecha_inicio)} → ${fmtFecha(c.fecha_fin)}${fechaCierre}
                    ${c.observaciones ? `&nbsp;·&nbsp; ${c.observaciones}` : ''}
                </div>
                ${statsHtml}
                <div class="cb-card-actions">${botonesAccion}</div>
            </div>
        `;
    }).join('');
}

function actualizarDashboard(c) {
    document.getElementById('dashboardActivo').style.display = '';
    document.getElementById('cicloActivoAnio').textContent = c.anio;
    document.getElementById('dsBeneficios').textContent = c.total_beneficios;
    document.getElementById('dsEsperado').textContent = '$' + fmt(c.total_esperado);
    document.getElementById('dsRecaudado').textContent = '$' + fmt(c.total_recaudado);
    document.getElementById('dsDeuda').textContent = '$' + fmt(c.deuda_pendiente);
}

// ===== ACCIONES =====
async function activarCiclo(id) {
    if (!confirm('¿Activar este ciclo? El ciclo activo actual se desactivará.')) return;
    try {
        const res = await fetch(`${API_BASE}/${id}/activar/`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        notif(data.mensaje, 'success');
        await cargarCiclos();
    } catch (e) {
        notif(e.message, 'error');
    }
}

async function cerrarCiclo(id) {
    if (!confirm('¿Cerrar este ciclo?\n\nRequiere que TODOS los beneficios del año estén cerrados.\n(Cada beneficio se cierra cuando sus tarjetas están vendidas o liberadas)')) return;

    try {
        const res = await fetch(`${API_BASE}/${id}/cerrar/`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
            if (data.beneficios_activos && data.beneficios_activos.length) {
                const lista = data.beneficios_activos
                    .map(b => `• ${b.nombre} (${b.fecha})`)
                    .join('\n');
                alert(`No se puede cerrar el ciclo.\n\n${data.error}\n\nBeneficios activos:\n${lista}`);
                notif(`${data.error}`, 'error');
            } else {
                notif((data.error || 'Error al cerrar'), 'error');
            }
            return;
        }

        notif(`${data.mensaje}`, 'success');
        await cargarCiclos();
    } catch (e) {
        notif(e.message, 'error');
    }
}

async function reabrirCiclo(id) {
    if (!confirm('¿Reabrir este ciclo?\n\nNota: los beneficios cerrados NO se reactivarán automáticamente.')) return;
    try {
        const res = await fetch(`${API_BASE}/${id}/reabrir/`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        notif(data.mensaje, 'success');
        await cargarCiclos();
    } catch (e) {
        notif(e.message, 'error');
    }
}

async function verEstadisticas(id) {
    try {
        const res = await fetch(`${API_BASE}/${id}/estadisticas/`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error');

        const estado = d.eficiencia >= 80 ? 'Excelente'
                     : d.eficiencia >= 50 ? 'Regular'
                     : 'Bajo';

        notif(`
            <strong>Estadísticas Ciclo ${d.ciclo.anio}</strong><br><br>
            Beneficios totales: <strong>${d.total_beneficios}</strong>
            &nbsp;·&nbsp; Activos: <strong>${d.beneficios_activos}</strong>
            &nbsp;·&nbsp; Cerrados: <strong>${d.beneficios_cerrados}</strong><br>
            Total esperado: <strong>$${fmt(d.total_esperado)}</strong>
            &nbsp;·&nbsp; Recaudado: <strong>$${fmt(d.total_recaudado)}</strong><br>
            Deuda pendiente: <strong>$${fmt(d.deuda_pendiente)}</strong>
            &nbsp;·&nbsp; Voluntarios con deuda: <strong>${d.voluntarios_con_deuda}</strong><br>
            Eficiencia: <strong>${d.eficiencia}%</strong> — ${estado}
            <br><br><a href="#" onclick="document.getElementById('cbNotif').style.display='none';return false" style="color:inherit;font-size:0.8rem">Cerrar</a>
        `, 'info');
    } catch (e) {
        notif(e.message, 'error');
    }
}

// ===== MODAL NUEVO CICLO =====
function abrirModalNuevo() {
    document.getElementById('formCiclo').reset();
    document.getElementById('modalTitulo').textContent = 'Nuevo Ciclo de Beneficios';
    const anio = new Date().getFullYear() + 1;
    document.getElementById('inputAnio').value = anio;
    document.getElementById('inputInicio').value = `${anio}-01-01`;
    document.getElementById('inputFin').value = `${anio}-12-31`;
    document.getElementById('modalCiclo').style.display = 'flex';
}

function crearCicloPara(anio) {
    document.getElementById('formCiclo').reset();
    document.getElementById('modalTitulo').textContent = `Formalizar Ciclo ${anio}`;
    document.getElementById('inputAnio').value = anio;
    document.getElementById('inputInicio').value = `${anio}-01-01`;
    document.getElementById('inputFin').value = `${anio}-12-31`;
    document.getElementById('modalCiclo').style.display = 'flex';
}

function autocompletarFechas() {
    const anio = parseInt(document.getElementById('inputAnio').value);
    if (anio >= 2020 && anio <= 2050) {
        document.getElementById('inputInicio').value = `${anio}-01-01`;
        document.getElementById('inputFin').value = `${anio}-12-31`;
    }
}

function cerrarModal() {
    document.getElementById('modalCiclo').style.display = 'none';
}

function cerrarModalFondo(e) {
    if (e.target.id === 'modalCiclo') cerrarModal();
}

async function guardarCiclo(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        anio: parseInt(form.anio.value),
        fecha_inicio: form.fecha_inicio.value,
        fecha_fin: form.fecha_fin.value,
        activo: form.activo.checked,
        observaciones: form.observaciones.value.trim(),
    };
    try {
        const res = await fetch(`${API_BASE}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Error al crear ciclo');
        notif(`Ciclo ${d.anio} creado exitosamente`, 'success');
        cerrarModal();
        await cargarCiclos();
    } catch (e) {
        notif(e.message, 'error');
    }
}

// ===== UTILS =====
function fmt(n) {
    return new Intl.NumberFormat('es-CL').format(Math.round(parseFloat(n) || 0));
}

function fmtFecha(f) {
    if (!f) return '—';
    const s = f.substring(0, 10);
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
}

function notif(msg, tipo) {
    const n = document.getElementById('cbNotif');
    n.innerHTML = msg;
    n.className = 'cb-notif ' + tipo;
    n.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tipo !== 'info') setTimeout(() => { n.style.display = 'none'; }, 6000);
}

// ESC cierra modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModal();
});
