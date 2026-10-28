// Bandeja de solicitudes de pago del portal (tesorería).
// Muestra carritos y solicitudes simples en una sola lista, pendientes primero.
(function () {
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
        'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const ESTADOS = {
        pendiente: { label: 'Pendiente', clase: 'is-pendiente' },
        observada: { label: 'Observada', clase: 'is-observada' },
        aprobada: { label: 'Aprobada', clase: 'is-aprobada' },
        rechazada: { label: 'Rechazada', clase: 'is-rechazada' },
        expirada: { label: 'Expirada', clase: 'is-expirada' },
    };
    const state = { estado: 'pendiente', q: '', page: 1, accion: null, objetivo: null };

    async function request(url, options = {}) {
        const res = await fetch(url, { credentials: 'include', ...options });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Error de comunicación');
        return data;
    }

    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
    const fecha = (v) => v ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v.length === 10 ? `${v}T12:00:00` : v)) : '—';
    const fechaHora = (v) => v ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—';

    // "Cuotas febrero a julio 2026 · 6 × $7.000" en vez de una caja por mes
    function resumirConceptos(items) {
        const cuotas = items.filter((i) => i.tipo_pago === 'cuota' && i.cuota_mes);
        const otros = items.filter((i) => !(i.tipo_pago === 'cuota' && i.cuota_mes));
        const partes = [];
        const porAnio = {};
        cuotas.forEach((c) => { (porAnio[c.cuota_anio] = porAnio[c.cuota_anio] || []).push(c); });
        Object.keys(porAnio).sort().forEach((anio) => {
            const lista = porAnio[anio].sort((a, b) => a.cuota_mes - b.cuota_mes);
            const meses = lista.map((c) => c.cuota_mes);
            const seguidos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1);
            let texto;
            if (meses.length === 1) texto = `Cuota ${MESES[meses[0] - 1]} ${anio}`;
            else if (seguidos) texto = `Cuotas ${MESES[meses[0] - 1]} a ${MESES[meses[meses.length - 1] - 1]} ${anio}`;
            else texto = `Cuotas ${meses.map((m) => MESES[m - 1]).join(', ')} ${anio}`;
            const montos = [...new Set(lista.map((c) => c.monto_solicitado))];
            if (lista.length > 1 && montos.length === 1) texto += ` · ${lista.length} × ${money(montos[0])}`;
            partes.push(texto);
        });
        otros.forEach((o) => partes.push(o.nombre_pago));
        return partes;
    }

    function normalizarGrupo(g) {
        return {
            tipo: 'grupo', id: g.id, estado: g.estado, voluntario: g.voluntario, monto: g.monto_total,
            conceptos: resumirConceptos(g.items),
            detalle: g.items.length > 1 ? g.items.slice().sort((a, b) => (a.cuota_anio - b.cuota_anio) || (a.cuota_mes - b.cuota_mes)) : [],
            fecha_pago: g.fecha_pago, numero_comprobante: g.numero_comprobante, descripcion: g.descripcion,
            feedback: g.feedback_tesorero, comprobante_url: g.comprobante_url, observada_hasta: g.observada_hasta,
            revisada_por: g.revisada_por, revisada_at: g.revisada_at, created_at: g.created_at,
        };
    }

    function normalizarSimple(s) {
        return {
            tipo: 'simple', id: s.id, estado: s.estado, voluntario: s.voluntario, monto: s.monto_solicitado,
            conceptos: resumirConceptos([s]), detalle: [],
            fecha_pago: s.fecha_pago, numero_comprobante: s.numero_comprobante, descripcion: s.descripcion,
            feedback: s.feedback_tesorero, comprobante_url: s.comprobante_url, observada_hasta: s.observada_hasta,
            revisada_por: s.revisada_por, revisada_at: s.revisada_at, created_at: s.created_at,
        };
    }

    function comprobanteHtml(url) {
        if (!url) return '<div class="bj-comp is-vacio">Sin comprobante adjunto</div>';
        const esImagen = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
        return esImagen
            ? `<a class="bj-comp" href="${esc(url)}" target="_blank" rel="noopener" title="Abrir comprobante"><img src="${esc(url)}" alt="Comprobante de pago" loading="lazy"><span>Ver en grande</span></a>`
            : `<a class="bj-comp is-pdf" href="${esc(url)}" target="_blank" rel="noopener"><b>PDF</b><span>Abrir comprobante</span></a>`;
    }

    function cierreHtml(c) {
        if (c.estado === 'aprobada' || c.estado === 'rechazada') {
            const quien = c.revisada_por ? ` por ${esc(c.revisada_por)}` : '';
            const cuando = c.revisada_at ? ` el ${fechaHora(c.revisada_at)}` : '';
            return `<p class="bj-cierre">${c.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}${quien}${cuando}</p>`;
        }
        if (c.estado === 'expirada') return '<p class="bj-cierre">Venció el plazo de corrección sin respuesta del voluntario</p>';
        return '';
    }

    function tarjetaHtml(c) {
        const est = ESTADOS[c.estado] || { label: c.estado, clase: '' };
        const gestionable = c.estado === 'pendiente' || c.estado === 'observada';
        const v = c.voluntario || {};
        const ident = [v.clave ? `Clave ${esc(v.clave)}` : '', v.rut ? `RUN ${esc(v.rut)}` : '', `enviada ${fechaHora(c.created_at)}`].filter(Boolean).join(' · ');
        return `
            <article class="bj-card ${est.clase}">
                <header class="bj-card-head">
                    <div class="bj-quien">
                        <h3>${esc(v.nombre)}</h3>
                        <p>${ident}</p>
                    </div>
                    <div class="bj-cifra">
                        <span class="bj-pill ${est.clase}">${est.label}</span>
                        <strong>${money(c.monto)}</strong>
                    </div>
                </header>
                <div class="bj-card-body">
                    <div class="bj-info">
                        <ul class="bj-conceptos">${c.conceptos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
                        ${c.detalle.length ? `
                            <details class="bj-detalle">
                                <summary>Ver detalle (${c.detalle.length})</summary>
                                <ul>${c.detalle.map((i) => `<li><span>${esc(i.nombre_pago)}</span><b>${money(i.monto_solicitado)}</b></li>`).join('')}</ul>
                            </details>` : ''}
                        <dl class="bj-datos">
                            <div><dt>Fecha de pago</dt><dd>${fecha(c.fecha_pago)}</dd></div>
                            <div><dt>N° comprobante</dt><dd>${esc(c.numero_comprobante || '—')}</dd></div>
                        </dl>
                        ${c.descripcion ? `<p class="bj-nota"><span>Nota del voluntario</span>${esc(c.descripcion)}</p>` : ''}
                        ${c.feedback ? `<p class="bj-feedback"><span>Respuesta de tesorería</span>${esc(c.feedback)}</p>` : ''}
                        ${c.observada_hasta && c.estado === 'observada' ? `<p class="bj-plazo">Debe corregir antes del ${fechaHora(c.observada_hasta)}</p>` : ''}
                        ${cierreHtml(c)}
                    </div>
                    ${comprobanteHtml(c.comprobante_url)}
                </div>
                ${gestionable ? `
                    <footer class="bj-acciones">
                        <button type="button" class="bj-btn is-rechazar" data-accion="rechazar" data-tipo="${c.tipo}" data-id="${c.id}">Rechazar</button>
                        ${c.tipo === 'simple' ? `<button type="button" class="bj-btn is-observar" data-accion="observar" data-tipo="${c.tipo}" data-id="${c.id}">Pedir corrección</button>` : ''}
                        <button type="button" class="bj-btn is-aprobar" data-accion="aprobar" data-tipo="${c.tipo}" data-id="${c.id}" data-monto="${c.monto}" data-nombre="${esc(v.nombre)}">Aprobar pago</button>
                    </footer>` : ''}
            </article>`;
    }

    function pintarConteos(s) {
        const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n || 0; };
        set('cntPendiente', s.pendientes);
        set('cntObservada', s.observadas);
        set('cntPagado', s.pagados);
        set('cntRechazada', s.rechazadas);
        set('cntTodos', s.total);
        document.title = s.pendientes ? `(${s.pendientes}) Solicitudes de pago` : 'Solicitudes de pago';
    }

    function pintarPaginacion(p) {
        const cont = document.getElementById('bjPaginacion');
        if (!p || p.total_pages <= 1) { cont.innerHTML = ''; return; }
        cont.innerHTML = `
            <button type="button" ${p.has_previous ? '' : 'disabled'} data-page="${p.page - 1}">Anterior</button>
            <span>Página ${p.page} de ${p.total_pages}</span>
            <button type="button" ${p.has_next ? '' : 'disabled'} data-page="${p.page + 1}">Siguiente</button>`;
        cont.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { state.page = Number(b.dataset.page); cargar(); }));
    }

    function vacioHtml() {
        if (state.q) return `<div class="bj-vacio"><h3>Sin resultados para "${esc(state.q)}"</h3><p>Prueba con otro nombre o concepto.</p></div>`;
        if (state.estado === 'pendiente') return '<div class="bj-vacio is-ok"><h3>Todo al día</h3><p>No hay solicitudes por revisar.</p></div>';
        return '<div class="bj-vacio"><h3>No hay solicitudes en este estado</h3></div>';
    }

    async function cargar() {
        const lista = document.getElementById('bjLista');
        lista.innerHTML = '<div class="bj-cargando">Cargando solicitudes…</div>';
        const params = new URLSearchParams({ page: String(state.page) });
        if (state.estado !== 'todos') params.set('estado', state.estado);
        if (state.q) params.set('q', state.q);
        const paramsGrupo = state.estado !== 'todos' ? `?estado=${state.estado}` : '';
        try {
            const [simples, grupos] = await Promise.all([
                request(`/api/portal/tesoreria/solicitudes/?${params}`),
                state.page === 1 ? request(`/api/portal/tesoreria/solicitudes/grupo/${paramsGrupo}`) : Promise.resolve({ grupos: [] }),
            ]);
            pintarConteos(simples.summary || {});
            const q = state.q.toLowerCase();
            const tarjetas = [
                ...grupos.grupos.map(normalizarGrupo).filter((c) => !q || `${c.voluntario.nombre} ${c.voluntario.clave || ''} ${c.conceptos.join(' ')}`.toLowerCase().includes(q)),
                ...simples.solicitudes.map(normalizarSimple),
            ];
            // Pendientes y observadas: las más antiguas primero (cola de atención); el resto, las más recientes primero
            const cola = state.estado === 'pendiente' || state.estado === 'observada';
            tarjetas.sort((a, b) => (cola ? 1 : -1) * (new Date(a.created_at) - new Date(b.created_at)));
            lista.innerHTML = tarjetas.length ? tarjetas.map(tarjetaHtml).join('') : vacioHtml();
            pintarPaginacion(simples.pagination);
        } catch (err) {
            lista.innerHTML = `<div class="bj-vacio"><h3>No se pudo cargar la bandeja</h3><p>${esc(err.message)}</p></div>`;
        }
    }

    async function ejecutar(tipo, id, accion, feedback = '') {
        const url = tipo === 'grupo'
            ? `/api/portal/tesoreria/solicitudes/grupo/${id}/accion/`
            : `/api/portal/tesoreria/solicitudes/${id}/accion/`;
        await request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '' },
            body: JSON.stringify({ accion, feedback }),
        });
        await cargar();
    }

    function abrirModal(tipo, id, accion) {
        state.objetivo = { tipo, id };
        state.accion = accion;
        const observar = accion === 'observar';
        document.getElementById('modalGestionTitulo').textContent = observar ? 'Pedir corrección' : 'Rechazar solicitud';
        document.getElementById('modalGestionHelper').textContent = observar
            ? 'El voluntario verá este mensaje y podrá reenviar el comprobante.'
            : 'El voluntario verá este motivo. Elige uno frecuente o escribe el tuyo.';
        document.getElementById('modalGestionSubmit').textContent = observar ? 'Enviar corrección' : 'Confirmar rechazo';
        const ta = document.getElementById('modalGestionFeedback');
        ta.value = '';
        document.getElementById('modalGestionSolicitud').classList.add('is-open');
        ta.focus();
    }

    function cerrarModal() {
        document.getElementById('modalGestionSolicitud').classList.remove('is-open');
        state.objetivo = null;
        state.accion = null;
    }

    async function confirmarModal() {
        const ta = document.getElementById('modalGestionFeedback');
        const feedback = ta.value.trim();
        if (!feedback) { ta.focus(); return; }
        const btn = document.getElementById('modalGestionSubmit');
        btn.disabled = true;
        try {
            await ejecutar(state.objetivo.tipo, state.objetivo.id, state.accion, feedback);
            cerrarModal();
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
        }
    }

    function init() {
        if (!document.getElementById('bandejaPortal')) return;

        document.querySelectorAll('.bj-tabs [data-estado]').forEach((b) => b.addEventListener('click', () => {
            state.estado = b.dataset.estado;
            state.page = 1;
            document.querySelectorAll('.bj-tabs [data-estado]').forEach((x) => x.classList.toggle('is-active', x === b));
            cargar();
        }));

        let t;
        document.getElementById('bjBuscar').addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; cargar(); }, 280);
        });

        document.getElementById('bjLista').addEventListener('click', async (e) => {
            const b = e.target.closest('[data-accion]');
            if (!b) return;
            const { accion, tipo, id } = b.dataset;
            if (accion !== 'aprobar') { abrirModal(tipo, id, accion); return; }
            if (!confirm(`¿Aprobar el pago de ${money(Number(b.dataset.monto))} de ${b.dataset.nombre}?\nSe registrará en tesorería.`)) return;
            b.disabled = true;
            b.textContent = 'Aprobando…';
            try { await ejecutar(tipo, id, 'aprobar'); } catch (err) { alert(err.message); b.disabled = false; b.textContent = 'Aprobar pago'; }
        });

        document.querySelectorAll('#bjMotivos button').forEach((b) => b.addEventListener('click', () => {
            const ta = document.getElementById('modalGestionFeedback');
            ta.value = b.textContent;
            ta.focus();
        }));
        document.getElementById('modalGestionClose').addEventListener('click', cerrarModal);
        document.getElementById('modalGestionCancel').addEventListener('click', cerrarModal);
        document.getElementById('modalGestionBackdrop').addEventListener('click', cerrarModal);
        document.getElementById('modalGestionSubmit').addEventListener('click', confirmarModal);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

        cargar();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
