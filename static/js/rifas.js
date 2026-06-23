/* rifas.js — Sistema de Rifas Anuales v2.0 */
'use strict';

const API = '/api/voluntarios';
let rifas = [];
let rifaACerrar = null;

const clp = n => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
const el  = id => document.getElementById(id);

function mostrarNotif(msg, tipo = 'ok') {
    const n = el('rifNotif');
    n.innerHTML = `<span>${tipo === 'ok' ? '✅' : '❌'}</span> ${msg}`;
    n.className = `rif-notif ${tipo}`;
    n.style.display = 'flex';
    setTimeout(() => { n.style.display = 'none'; }, 5000);
}

// ---------------------------------------------------------------------------
// Cargar rifas
// ---------------------------------------------------------------------------
async function cargarRifas() {
    el('rifasGrid').innerHTML = '<div class="loading">Cargando rifas...</div>';
    try {
        const resp = await fetch(`${API}/rifas-simple/`);
        rifas = await resp.json();
        renderEstadisticas();
        renderRifas();
    } catch (_) {
        el('rifasGrid').innerHTML = '<div class="loading">Error al cargar rifas</div>';
    }
}

function renderEstadisticas() {
    const activas = rifas.filter(r => r.estado === 'activa');
    el('statActivas').textContent = activas.length;

    let transfTotal = 0, efecTotal = 0, pagadas = 0, total = 0;
    activas.forEach(r => {
        const s = r.stats || {};
        transfTotal += s.recaudado_transferencia || 0;
        efecTotal   += s.recaudado_efectivo || 0;
        pagadas     += s.pagada || 0;
        total       += s.total  || 0;
    });
    el('statTransf').textContent  = clp(transfTotal);
    el('statEfec').textContent    = clp(efecTotal);
    el('statPagadas').textContent = `${pagadas}/${total}`;
}

function renderRifas() {
    if (!rifas.length) {
        el('rifasGrid').innerHTML = `
            <div style="padding:16px">
                <div class="empty-state">
                    <div class="icon">🎟</div>
                    <h3>No hay rifas registradas</h3>
                    <p>Haz clic en «＋ Nueva Rifa» para comenzar</p>
                </div>
            </div>`;
        return;
    }
    el('rifasGrid').innerHTML = `<div class="rifas-grid">${rifas.map(renderRifaCard).join('')}</div>`;
}

function renderRifaCard(r) {
    const s = r.stats || {};
    const total      = s.total    || 0;
    const terminadas = (s.pagada || 0) + (s.liberada || 0);
    const pct        = total > 0 ? Math.round(terminadas / total * 100) : 0;
    const recTransf  = s.recaudado_transferencia || 0;
    const recEfec    = s.recaudado_efectivo    || 0;
    const recTotal   = recTransf + recEfec;
    const puedeCerrar = r.estado === 'activa' && total > 0 && terminadas === total;

    return `
    <div class="rifa-card">
        <div class="rifa-card-top">
            <div>
                <div class="rifa-nombre">${r.nombre}</div>
                <div class="rifa-ciclo">Ciclo ${r.ciclo}</div>
            </div>
            <span class="badge-estado ${r.estado}">${r.estado === 'activa' ? '● Activa' : '○ Cerrada'}</span>
        </div>

        <div class="rifa-info">
            📅 Cierre: <strong>${new Date(r.fecha_cierre + 'T12:00:00').toLocaleDateString('es-CL')}</strong>
            &nbsp;·&nbsp; 💵 <strong>${clp(r.precio_numero)}</strong>/nro
            &nbsp;·&nbsp; 📋 <strong>${r.numeros_por_talonario}</strong> nros/talonario
        </div>

        <div class="rifa-stats-grid">
            <div class="stat-mini sin-ret">
                <div class="stat-mini-val">${s.no_retirada || 0}</div>
                <div class="stat-mini-lbl">Sin retirar</div>
            </div>
            <div class="stat-mini retirada">
                <div class="stat-mini-val">${s.retirada || 0}</div>
                <div class="stat-mini-lbl">Retiradas</div>
            </div>
            <div class="stat-mini pagada">
                <div class="stat-mini-val">${s.pagada || 0}</div>
                <div class="stat-mini-lbl">Pagadas</div>
            </div>
            <div class="stat-mini liberada">
                <div class="stat-mini-val">${s.liberada || 0}</div>
                <div class="stat-mini-lbl">Liberadas</div>
            </div>
        </div>

        <div class="rifa-recaudado">
            <div class="rec-item transf">
                <div class="rec-val">${clp(recTransf)}</div>
                <div class="rec-lbl">💳 Transf.</div>
            </div>
            <div style="width:1px;background:#e5e7eb;margin:4px 0"></div>
            <div class="rec-item efec">
                <div class="rec-val">${clp(recEfec)}</div>
                <div class="rec-lbl">💵 Efectivo</div>
            </div>
            <div style="width:1px;background:#e5e7eb;margin:4px 0"></div>
            <div class="rec-item">
                <div class="rec-val" style="color:#c41e3a">${clp(recTotal)}</div>
                <div class="rec-lbl">🏦 Total</div>
            </div>
        </div>

        <div class="rifa-progress-wrap">
            <div class="rifa-progress-header">
                <span>Progreso de talonarios</span>
                <span class="rifa-progress-pct">${terminadas}/${total} &nbsp;(${pct}%)</span>
            </div>
            <div class="rifa-progress-track">
                <div class="rifa-progress-fill" style="width:${pct}%"></div>
            </div>
        </div>

        <div class="rifa-actions">
            ${r.estado === 'activa'
                ? `<button class="btn-rif primary" onclick="window.location.href='/rifa-entregar.html?id=${r.id}'">📦 Gestionar Entrega →</button>`
                : ''}
            ${puedeCerrar
                ? `<button class="btn-rif danger" onclick="pedirCerrarRifa(${r.id}, '${r.nombre}')">🔒 Cerrar Rifa</button>`
                : ''}
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Modal Nueva Rifa
// ---------------------------------------------------------------------------
function abrirModalNuevaRifa() {
    const anio = new Date().getFullYear();
    el('nrCiclo').value        = anio;
    el('nrNombre').value       = `Rifa ${anio}`;
    el('nrFechaInicio').value  = new Date().toISOString().split('T')[0];
    el('nrFechaCierre').value  = `${anio}-12-30`;
    el('nrPrecio').value       = '';
    el('nrNumTalonario').value = '';
    el('nrTalVol').value       = 1;
    el('nrTalHCia').value      = 1;
    el('nrTalHCuerpo').value   = 1;
    el('nrTalInsigne').value   = 1;
    nrError('');
    el('modalNuevaRifa').style.display = 'flex';
}

function cerrarModalNuevaRifa() {
    el('modalNuevaRifa').style.display = 'none';
}

el('nrCiclo').addEventListener('input', function() {
    const ciclo = this.value.trim();
    if (/^20\d{2}$/.test(ciclo)) {
        el('nrNombre').value      = `Rifa ${ciclo}`;
        el('nrFechaCierre').value = `${ciclo}-12-30`;
    }
});

// Muestra error inline en el modal
function nrError(msg) {
    let div = el('nrError');
    if (!div) return mostrarNotif(msg, 'err');
    div.textContent = msg;
    div.style.display = msg ? 'block' : 'none';
}

async function crearRifa() {
    const ciclo                 = el('nrCiclo').value.trim();
    const nombre                = el('nrNombre').value.trim();
    const fecha_inicio          = el('nrFechaInicio').value;
    const fecha_cierre          = el('nrFechaCierre').value;
    const precio_numero         = el('nrPrecio').value;
    const numeros_por_talonario = el('nrNumTalonario').value;

    // ── Validaciones frontend ──────────────────────────────────────────────
    if (!ciclo || !nombre || !fecha_inicio || !precio_numero || !numeros_por_talonario) {
        nrError('Completa todos los campos obligatorios'); return;
    }
    if (!/^20\d{2}$/.test(ciclo)) {
        nrError('El ciclo debe ser un año válido entre 2000 y 2099'); return;
    }
    if (parseFloat(precio_numero) <= 0) {
        nrError('El precio por número debe ser mayor a 0'); return;
    }
    if (parseInt(numeros_por_talonario) <= 0) {
        nrError('Los números por talonario deben ser mayor a 0'); return;
    }
    if (fecha_cierre && fecha_inicio > fecha_cierre) {
        nrError('La fecha de inicio no puede ser posterior a la fecha de cierre'); return;
    }
    const tal_vol     = parseInt(el('nrTalVol').value)     || 0;
    const tal_hcia    = parseInt(el('nrTalHCia').value)    || 0;
    const tal_hcuerpo = parseInt(el('nrTalHCuerpo').value) || 0;
    const tal_insignes = parseInt(el('nrTalInsigne').value) || 0;
    if (tal_vol + tal_hcia + tal_hcuerpo + tal_insignes === 0) {
        nrError('Asigna al menos un talonario en alguna categoría'); return;
    }
    // Verificar duplicidad en rifas ya cargadas
    if (rifas.some(r => r.ciclo === ciclo)) {
        nrError(`Ya existe una rifa para el ciclo ${ciclo}`); return;
    }
    nrError('');

    const btn = document.querySelector('#modalNuevaRifa .modal-footer .btn-rif.primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; btn.style.opacity = '0.7'; }

    const body = {
        ciclo, nombre, fecha_inicio,
        fecha_cierre: fecha_cierre || null,
        precio_numero: parseFloat(precio_numero),
        numeros_por_talonario: parseInt(numeros_por_talonario),
        talonarios_voluntarios:       tal_vol,
        talonarios_honorarios_cia:    tal_hcia,
        talonarios_honorarios_cuerpo: tal_hcuerpo,
        talonarios_insignes:          tal_insignes,
    };

    try {
        const resp = await fetch(`${API}/rifas-simple/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (!resp.ok) { nrError(data.error || 'Error al crear rifa'); return; }
        cerrarModalNuevaRifa();
        mostrarNotif(`${data.nombre} creada — ${data.asignaciones_creadas} asignaciones generadas`);
        cargarRifas();
    } catch (_) {
        nrError('Error de conexión');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🎟 Crear Rifa'; btn.style.opacity = ''; }
    }
}

// ---------------------------------------------------------------------------
// Cerrar rifa
// ---------------------------------------------------------------------------
function pedirCerrarRifa(id, nombre) {
    rifaACerrar = id;
    el('modalCerrarTexto').textContent = `¿Cerrar la rifa "${nombre}"?`;
    el('modalCerrar').style.display = 'flex';
}

async function confirmarCerrarRifa() {
    if (!rifaACerrar) return;
    el('modalCerrar').style.display = 'none';
    try {
        const resp = await fetch(`${API}/cerrar-rifa-simple/${rifaACerrar}/`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok) { mostrarNotif(data.error || 'Error al cerrar rifa', 'err'); return; }
        mostrarNotif(data.mensaje);
        rifaACerrar = null;
        cargarRifas();
    } catch (_) { mostrarNotif('Error de conexión', 'err'); }
}

// Cerrar modales con ESC o click fuera
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    cerrarModalNuevaRifa();
    el('modalCerrar').style.display = 'none';
});
document.addEventListener('click', e => {
    if (e.target === el('modalNuevaRifa')) cerrarModalNuevaRifa();
    if (e.target === el('modalCerrar'))    el('modalCerrar').style.display = 'none';
});

// Init
cargarRifas();
