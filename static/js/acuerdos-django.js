// ==================== REGISTRO DE ACUERDOS DE ASAMBLEA / DIRECTORIO ====================
console.log('🚀 [ACUERDOS] Cargando acuerdos-django.js');

class SistemaAcuerdos {
    constructor(tipoOrgano) {
        this.tipoOrgano = tipoOrgano; // 'asamblea' | 'directorio'
        this.eventos = [];
        this.acuerdos = [];
        this.contadorGlosas = 0;
        this.init();
    }

    async init() {
        console.log(`[ACUERDOS] Iniciando sistema (${this.tipoOrgano})...`);

        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        await this.cargarEventos();
        this.agregarGlosa();
        await this.cargarAcuerdos();
    }

    async cargarEventos() {
        try {
            const resp = await fetch(`/api/eventos-asistencia/?tipo=${this.tipoOrgano}`, { credentials: 'include' });
            if (!resp.ok) throw new Error('Error al cargar eventos');
            const data = await resp.json();
            const eventos = Array.isArray(data) ? data : (data.results || []);
            this.eventos = eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            const select = document.getElementById('eventoAcuerdo');
            if (!select) return;

            if (this.eventos.length === 0) {
                select.innerHTML = '<option value="">No hay eventos registrados todavía</option>';
                return;
            }

            select.innerHTML = '<option value="">Seleccione la sesión</option>' + this.eventos.map(ev => {
                const etiquetaTipo = ev.tipo_asamblea
                    ? (ev.tipo_asamblea === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria')
                    : (this.tipoOrgano === 'asamblea' ? 'Asamblea' : 'Directorio');
                return `<option value="${ev.id}">${Utils.formatearFecha(ev.fecha)} - ${etiquetaTipo}</option>`;
            }).join('');
        } catch (error) {
            console.error('[ACUERDOS] Error cargando eventos:', error);
            Utils.mostrarNotificacion('No se pudieron cargar las sesiones registradas', 'error');
        }
    }

    // ==================== GLOSAS DINÁMICAS (varios acuerdos en una sola sesión) ====================

    agregarGlosa(valor = '') {
        this.contadorGlosas++;
        const id = this.contadorGlosas;
        const contenedor = document.getElementById('listaGlosas');
        if (!contenedor) return;

        const div = document.createElement('div');
        div.className = 'glosa-item';
        div.dataset.glosaId = id;
        div.innerHTML = `
            <div class="glosa-item-header">
                <strong>Acuerdo ${contenedor.children.length + 1}</strong>
                <button type="button" class="btn-quitar-glosa" onclick="acuerdosSistema.quitarGlosa(${id})">✕ Quitar</button>
            </div>
            <textarea class="glosa-texto" placeholder="Glosa del acuerdo tomado..." required></textarea>
        `;
        div.querySelector('.glosa-texto').value = valor;
        contenedor.appendChild(div);
    }

    quitarGlosa(id) {
        const items = document.querySelectorAll('#listaGlosas .glosa-item');
        if (items.length <= 1) {
            Utils.mostrarNotificacion('Debe quedar al menos un acuerdo en el formulario', 'error');
            return;
        }
        const div = document.querySelector(`.glosa-item[data-glosa-id="${id}"]`);
        if (div) div.remove();
        this.renumerarGlosas();
    }

    renumerarGlosas() {
        document.querySelectorAll('#listaGlosas .glosa-item').forEach((item, index) => {
            const titulo = item.querySelector('.glosa-item-header strong');
            if (titulo) titulo.textContent = `Acuerdo ${index + 1}`;
        });
    }

    obtenerGlosas() {
        const textareas = document.querySelectorAll('#listaGlosas .glosa-texto');
        return Array.from(textareas)
            .map(t => t.value.trim())
            .filter(v => v.length > 0);
    }

    // ==================== TABLA DE ACUERDOS YA REGISTRADOS ====================

    async cargarAcuerdos() {
        try {
            const resp = await fetch(`/api/acuerdos/?tipo_organo=${this.tipoOrgano}`, { credentials: 'include' });
            if (!resp.ok) throw new Error('Error al cargar acuerdos');
            const data = await resp.json();
            this.acuerdos = Array.isArray(data) ? data : (data.results || []);
            this.renderizarTabla();
        } catch (error) {
            console.error('[ACUERDOS] Error cargando:', error);
            Utils.mostrarNotificacion('Error al cargar los acuerdos', 'error');
        }
    }

    renderizarTabla() {
        const tbody = document.getElementById('tablaAcuerdosBody');
        if (!tbody) return;

        if (this.acuerdos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="sin-acuerdos">Aún no hay acuerdos registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = this.acuerdos.map(a => `
            <tr>
                <td>${Utils.formatearFecha(a.fecha_acuerdo)}</td>
                <td>${a.tipo_sesion === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</td>
                <td>${this.escapeHtml(a.glosa)}</td>
                <td class="acuerdo-acciones">
                    <button type="button" class="btn-mini btn-danger" onclick="acuerdosSistema.eliminarAcuerdo(${a.id})">Eliminar</button>
                </td>
            </tr>
        `).join('');
    }

    async guardarAcuerdo(event) {
        event.preventDefault();

        const eventoId = document.getElementById('eventoAcuerdo').value;
        if (!eventoId) {
            Utils.mostrarNotificacion('Seleccione a qué sesión pertenece este acuerdo', 'error');
            return;
        }

        const evento = this.eventos.find(ev => String(ev.id) === String(eventoId));
        if (!evento) {
            Utils.mostrarNotificacion('La sesión seleccionada ya no está disponible', 'error');
            return;
        }

        const glosas = this.obtenerGlosas();
        if (glosas.length === 0) {
            Utils.mostrarNotificacion('Escriba al menos un acuerdo', 'error');
            return;
        }

        const tipoSesion = evento.tipo_asamblea || 'ordinaria';

        try {
            for (const glosa of glosas) {
                const payload = {
                    tipo_organo: this.tipoOrgano,
                    evento: evento.id,
                    fecha_acuerdo: evento.fecha,
                    tipo_sesion: tipoSesion,
                    glosa: glosa,
                };

                const resp = await fetch('/api/acuerdos/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken'),
                    },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });

                if (!resp.ok) throw new Error('Error al guardar un acuerdo');
            }

            Utils.mostrarNotificacion(`${glosas.length} acuerdo(s) agregado(s)`, 'success');
            document.getElementById('formAcuerdo').reset();
            document.getElementById('listaGlosas').innerHTML = '';
            this.agregarGlosa();
            await this.cargarAcuerdos();
        } catch (error) {
            console.error('[ACUERDOS] Error guardando:', error);
            Utils.mostrarNotificacion('Error al guardar los acuerdos', 'error');
        }
    }

    async eliminarAcuerdo(id) {
        if (!confirm('¿Eliminar este acuerdo? Esta acción no se puede deshacer.')) return;

        try {
            const resp = await fetch(`/api/acuerdos/${id}/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
                credentials: 'include',
            });

            if (!resp.ok && resp.status !== 204) throw new Error('Error al eliminar');

            Utils.mostrarNotificacion('Acuerdo eliminado', 'success');
            await this.cargarAcuerdos();
        } catch (error) {
            console.error('[ACUERDOS] Error eliminando:', error);
            Utils.mostrarNotificacion('Error al eliminar el acuerdo', 'error');
        }
    }

    descargarPdf() {
        window.open(`/api/acuerdos/pdf_acuerdos/?tipo_organo=${this.tipoOrgano}`, '_blank');
    }

    escapeHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto || '';
        return div.innerHTML;
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
