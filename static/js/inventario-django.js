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

class SistemaInventario {
    constructor() {
        this.items = [];
        this.terminoBusqueda = '';
        this.init();
    }

    async init() {
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        this.aplicarPermisos();
        await this.cargarItems();
    }

    aplicarPermisos() {
        const rolesConEdicion = ['Director', 'Super Administrador'];
        const puedeEditar = rolesConEdicion.includes(currentUser.role);
        this.puedeEditar = puedeEditar;

        const btnNuevo = document.getElementById('btnNuevoItem');
        if (btnNuevo) btnNuevo.style.display = puedeEditar ? 'inline-block' : 'none';
    }

    async cargarItems() {
        try {
            const response = await fetch('/api/inventario/', { credentials: 'include' });
            if (!response.ok) throw new Error('Error al cargar inventario');
            const data = await response.json();
            this.items = Array.isArray(data) ? data : (data.results || []);
            this.renderizar();
        } catch (error) {
            console.error('[INVENTARIO] Error:', error);
            this.mostrarNotificacion('Error al cargar el inventario', 'err');
        }
    }

    filtrar(termino) {
        this.terminoBusqueda = termino.toLowerCase().trim();
        this.renderizar();
    }

    renderizar() {
        const contenedor = document.getElementById('invListado');

        let itemsFiltrados = this.items;
        if (this.terminoBusqueda) {
            itemsFiltrados = this.items.filter(item =>
                (item.nombre || '').toLowerCase().includes(this.terminoBusqueda) ||
                (item.categoria || '').toLowerCase().includes(this.terminoBusqueda) ||
                (item.marca || '').toLowerCase().includes(this.terminoBusqueda)
            );
        }

        if (itemsFiltrados.length === 0) {
            contenedor.innerHTML = '<div class="inv-empty">No hay items que coincidan con la búsqueda.</div>';
            return;
        }

        const grupos = {};
        itemsFiltrados.forEach(item => {
            const cat = item.categoria || 'Sin categoría';
            if (!grupos[cat]) grupos[cat] = [];
            grupos[cat].push(item);
        });

        let html = '';
        Object.keys(grupos).sort().forEach(categoria => {
            html += `
                <div class="inv-categoria">
                    <div class="inv-categoria-titulo">${categoria} (${grupos[categoria].length})</div>
                    <div class="inv-tabla-wrap">
                        <table class="inv-tabla">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Cantidad</th>
                                    <th>Marca</th>
                                    <th>Tamaño</th>
                                    <th>Estado</th>
                                    <th>Responsable</th>
                                    ${this.puedeEditar ? '<th>Acciones</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${grupos[categoria].map(item => this.renderizarFila(item)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        contenedor.innerHTML = html;
    }

    renderizarFila(item) {
        const estadoBadge = item.estado
            ? `<span class="inv-badge-estado ${item.estado}">${item.estado.charAt(0).toUpperCase() + item.estado.slice(1)}</span>`
            : '—';

        return `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad} ${item.unidad || ''}</td>
                <td>${item.marca || '—'}</td>
                <td>${item.tamano || '—'}</td>
                <td>${estadoBadge}</td>
                <td>${item.responsable || '—'}</td>
                ${this.puedeEditar ? `
                <td>
                    <button class="btn-inv sm secondary" onclick="inventario.abrirModalEditar(${item.id})">Editar</button>
                    <button class="btn-inv sm danger" onclick="inventario.eliminarItem(${item.id})">Eliminar</button>
                </td>` : ''}
            </tr>
        `;
    }

    abrirModalNuevo() {
        document.getElementById('invModalTitulo').textContent = 'Nuevo Item';
        document.getElementById('invForm').reset();
        document.getElementById('invItemId').value = '';
        document.getElementById('invResponsable').value = 'Miguel Vásquez';
        document.getElementById('invUbicacion').value = 'Pañol';
        document.getElementById('invModal').style.display = 'flex';
    }

    abrirModalEditar(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        document.getElementById('invModalTitulo').textContent = 'Editar Item';
        document.getElementById('invItemId').value = item.id;
        document.getElementById('invNombre').value = item.nombre || '';
        document.getElementById('invCategoria').value = item.categoria || '';
        document.getElementById('invCantidad').value = item.cantidad || '';
        document.getElementById('invUnidad').value = item.unidad || '';
        document.getElementById('invMarca').value = item.marca || '';
        document.getElementById('invTamano').value = item.tamano || '';
        document.getElementById('invEstado').value = item.estado || '';
        document.getElementById('invNumeroSerie').value = item.numero_serie || '';
        document.getElementById('invResponsable').value = item.responsable || '';
        document.getElementById('invUbicacion').value = item.ubicacion || '';
        document.getElementById('invObservaciones').value = item.observaciones || '';
        document.getElementById('invModal').style.display = 'flex';
    }

    cerrarModal() {
        document.getElementById('invModal').style.display = 'none';
    }

    async guardarItem(event) {
        event.preventDefault();

        const id = document.getElementById('invItemId').value;
        const payload = {
            nombre: document.getElementById('invNombre').value,
            categoria: document.getElementById('invCategoria').value,
            cantidad: document.getElementById('invCantidad').value,
            unidad: document.getElementById('invUnidad').value,
            marca: document.getElementById('invMarca').value,
            tamano: document.getElementById('invTamano').value,
            estado: document.getElementById('invEstado').value,
            numero_serie: document.getElementById('invNumeroSerie').value,
            responsable: document.getElementById('invResponsable').value,
            ubicacion: document.getElementById('invUbicacion').value,
            observaciones: document.getElementById('invObservaciones').value,
        };

        try {
            const url = id ? `/api/inventario/${id}/` : '/api/inventario/';
            const method = id ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Error al guardar el item');

            this.cerrarModal();
            this.mostrarNotificacion(id ? 'Item actualizado' : 'Item creado', 'ok');
            await this.cargarItems();
        } catch (error) {
            console.error('[INVENTARIO] Error al guardar:', error);
            this.mostrarNotificacion('Error al guardar el item', 'err');
        }
    }

    async eliminarItem(id) {
        if (!confirm('¿Eliminar este item del inventario?')) return;

        try {
            const response = await fetch(`/api/inventario/${id}/`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'X-CSRFToken': getCookie('csrftoken') },
            });

            if (!response.ok) throw new Error('Error al eliminar');

            this.mostrarNotificacion('Item eliminado', 'ok');
            await this.cargarItems();
        } catch (error) {
            console.error('[INVENTARIO] Error al eliminar:', error);
            this.mostrarNotificacion('Error al eliminar el item', 'err');
        }
    }

    exportarExcel() {
        window.location.href = '/api/voluntarios/inventario/exportar-excel/';
    }

    mostrarNotificacion(mensaje, tipo) {
        const notif = document.getElementById('invNotif');
        notif.textContent = mensaje;
        notif.className = `inv-notif ${tipo}`;
        notif.style.display = 'block';
        setTimeout(() => { notif.style.display = 'none'; }, 4000);
    }
}

let inventario;
document.addEventListener('DOMContentLoaded', () => {
    inventario = new SistemaInventario();
});
