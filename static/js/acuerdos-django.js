// ==================== REGISTRO DE ACUERDOS DE ASAMBLEA / DIRECTORIO ====================
console.log('🚀 [ACUERDOS] Cargando acuerdos-django.js');

class SistemaAcuerdos {
    constructor(tipoOrgano) {
        this.tipoOrgano = tipoOrgano; // 'asamblea' | 'directorio'
        this.acuerdos = [];
        this.editandoId = null;
        this.init();
    }

    async init() {
        console.log(`[ACUERDOS] Iniciando sistema (${this.tipoOrgano})...`);

        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        this.inicializarFecha();
        await this.cargarAcuerdos();
    }

    inicializarFecha() {
        const fechaInput = document.getElementById('fechaAcuerdo');
        if (fechaInput) fechaInput.valueAsDate = new Date();
    }

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
                    <button type="button" class="btn-mini btn-secondary" onclick="acuerdosSistema.editarAcuerdo(${a.id})">Editar</button>
                    <button type="button" class="btn-mini btn-danger" onclick="acuerdosSistema.eliminarAcuerdo(${a.id})">Eliminar</button>
                </td>
            </tr>
        `).join('');
    }

    editarAcuerdo(id) {
        const acuerdo = this.acuerdos.find(a => a.id === id);
        if (!acuerdo) return;

        this.editandoId = id;
        document.getElementById('fechaAcuerdo').value = acuerdo.fecha_acuerdo;
        document.getElementById('tipoSesionAcuerdo').value = acuerdo.tipo_sesion;
        document.getElementById('glosaAcuerdo').value = acuerdo.glosa;
        document.getElementById('btnGuardarAcuerdo').textContent = 'Guardar Cambios';
        document.getElementById('btnCancelarEdicion').style.display = 'inline-block';
        document.getElementById('formAcuerdo').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    cancelarEdicion() {
        this.editandoId = null;
        document.getElementById('formAcuerdo').reset();
        this.inicializarFecha();
        document.getElementById('btnGuardarAcuerdo').textContent = '+ Agregar Acuerdo';
        document.getElementById('btnCancelarEdicion').style.display = 'none';
    }

    async guardarAcuerdo(event) {
        event.preventDefault();

        const fecha = document.getElementById('fechaAcuerdo').value;
        const tipoSesion = document.getElementById('tipoSesionAcuerdo').value;
        const glosa = document.getElementById('glosaAcuerdo').value.trim();

        if (!fecha || !tipoSesion || !glosa) {
            Utils.mostrarNotificacion('Complete todos los campos', 'error');
            return;
        }

        const payload = {
            tipo_organo: this.tipoOrgano,
            fecha_acuerdo: fecha,
            tipo_sesion: tipoSesion,
            glosa: glosa,
        };

        try {
            const url = this.editandoId ? `/api/acuerdos/${this.editandoId}/` : '/api/acuerdos/';
            const method = this.editandoId ? 'PATCH' : 'POST';

            const resp = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            if (!resp.ok) throw new Error('Error al guardar el acuerdo');

            Utils.mostrarNotificacion(this.editandoId ? 'Acuerdo actualizado' : 'Acuerdo agregado', 'success');
            this.cancelarEdicion();
            await this.cargarAcuerdos();
        } catch (error) {
            console.error('[ACUERDOS] Error guardando:', error);
            Utils.mostrarNotificacion('Error al guardar el acuerdo', 'error');
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
            if (this.editandoId === id) this.cancelarEdicion();
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
