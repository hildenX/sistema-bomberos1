// ==================== LISTADO GENERAL DE SANCIONES ====================
class ListadoGeneralSanciones {
    constructor() {
        this.sanciones = [];
        this.bomberos = [];
        this.sancionesFiltradas = [];
        this.init();
    }

    async init() {
        if (!checkAuth()) {
            window.location.href = 'index.html';
            return;
        }

        // Cargar datos
        this.sanciones = storage.getSanciones();
        this.bomberos = storage.getBomberos();

        // Combinar datos
        this.prepararDatos();

        // Configurar eventos
        this.configurarEventos();

        // Renderizar
        this.aplicarFiltros();
        this.actualizarEstadisticas();
    }

prepararDatos() {
    this.sancionesFiltradas = this.sanciones.map(sancion => {
        const bombero = this.bomberos.find(b => b.id == sancion.bomberoId);
        return {
            ...sancion,
            nombreBombero: bombero ? Utils.obtenerNombreCompleto(bombero) : 'Bombero no encontrado',
            runBombero: bombero ? bombero.rut : 'N/A'
        };
    });
}
    configurarEventos() {
        document.getElementById('filtroTipo').addEventListener('change', () => this.aplicarFiltros());
        document.getElementById('filtroAutoridad').addEventListener('change', () => this.aplicarFiltros());
        document.getElementById('filtroNombre').addEventListener('input', () => this.aplicarFiltros());
        document.getElementById('filtroRun').addEventListener('input', () => this.aplicarFiltros());
    }

    aplicarFiltros() {
        const filtroTipo = document.getElementById('filtroTipo').value;
        const filtroAutoridad = document.getElementById('filtroAutoridad').value;
        const filtroNombre = document.getElementById('filtroNombre').value.toLowerCase();
        const filtroRun = document.getElementById('filtroRun').value.toLowerCase();

        this.prepararDatos();
        let resultado = this.sancionesFiltradas;

        if (filtroTipo) {
            resultado = resultado.filter(s => s.tipoSancion === filtroTipo);
        }

        if (filtroAutoridad) {
            resultado = resultado.filter(s => s.autoridadSancionatoria === filtroAutoridad);
        }

        if (filtroNombre) {
            resultado = resultado.filter(s => s.nombreBombero.toLowerCase().includes(filtroNombre));
        }

        if (filtroRun) {
            resultado = resultado.filter(s => s.runBombero.toLowerCase().includes(filtroRun));
        }

        resultado.sort((a, b) => new Date(b.fechaDesde) - new Date(a.fechaDesde));

        this.sancionesFiltradas = resultado;
        this.renderizarTabla();
    }

    renderizarTabla() {
        const tbody = document.getElementById('tablaSanciones');
        const emptyState = document.getElementById('emptyState');
        
        if (this.sancionesFiltradas.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        tbody.innerHTML = this.sancionesFiltradas.map((sancion, index) => {
            const tipoClase = `tipo-${sancion.tipoSancion}`;
            const tipoTexto = sancion.tipoSancion.charAt(0).toUpperCase() + sancion.tipoSancion.slice(1);
            
            let autoridadClase = 'autoridad-consejo';
            if (sancion.autoridadSancionatoria === 'Capitanía') {
                autoridadClase = 'autoridad-capitania';
            } else if (sancion.autoridadSancionatoria === 'Comandancia') {
                autoridadClase = 'autoridad-comandancia';
            }

            return `
                <tr>
                    <td style="text-align: center; font-weight: 600;">${index + 1}</td>
                    <td><div style="font-weight: 600;">${sancion.nombreBombero}</div></td>
                    <td><span style="font-family: monospace;">${sancion.runBombero}</span></td>
                    <td><span class="tipo-badge ${tipoClase}">${tipoTexto}</span></td>
                    <td style="white-space: nowrap;">${Utils.formatearFecha(sancion.fechaDesde)}</td>
                    <td style="text-align: center; font-weight: 600;">${sancion.diasSancion || '-'}</td>
                    <td style="white-space: nowrap;">
                        ${sancion.fechaHasta ? Utils.formatearFecha(sancion.fechaHasta) : '<span style="color: #f44336; font-weight: 600;">Indefinida</span>'}
                    </td>
                    <td style="text-align: center;">
                        ${sancion.documentoOficio ? 
                            `<a href="${sancion.documentoOficio}" target="_blank" download="${sancion.documentoNombreOriginal}">📎</a>` : 
                            '➖'
                        }
                    </td>
                    <td>
                        ${sancion.autoridadSancionatoria ? 
                            `<span class="autoridad-badge ${autoridadClase}">${sancion.autoridadSancionatoria}</span>` : 
                            '-'
                        }
                    </td>
                    <td style="font-family: monospace; font-weight: 600;">${sancion.oficioNumero}</td>
                </tr>
            `;
        }).join('');
    }

    actualizarEstadisticas() {
        document.getElementById('totalSanciones').textContent = this.sanciones.length;
        document.getElementById('totalRenuncias').textContent = this.sanciones.filter(s => s.tipoSancion === 'renuncia').length;
        document.getElementById('totalSuspensiones').textContent = this.sanciones.filter(s => s.tipoSancion === 'suspension').length;
        document.getElementById('totalSeparaciones').textContent = this.sanciones.filter(s => s.tipoSancion === 'separacion').length;
        document.getElementById('totalExpulsiones').textContent = this.sanciones.filter(s => s.tipoSancion === 'expulsion').length;
    }

    async exportarExcel() {
        if (this.sancionesFiltradas.length === 0) {
            Utils.mostrarNotificacion('No hay sanciones para exportar', 'error');
            return;
        }

        try {
            const datosExcel = this.sancionesFiltradas.map((sancion, index) => ({
                'N°': index + 1,
                'Nombre': sancion.nombreBombero,
                'RUN': sancion.runBombero,
                'Tipo': sancion.tipoSancion.charAt(0).toUpperCase() + sancion.tipoSancion.slice(1),
                'Fecha Inicio': Utils.formatearFecha(sancion.fechaDesde),
                'Días': sancion.diasSancion || 'N/A',
                'Fecha Fin': sancion.fechaHasta ? Utils.formatearFecha(sancion.fechaHasta) : 'Indefinida',
                'Documento': sancion.documentoOficio ? 'Sí' : 'No',
                'Autoridad': sancion.autoridadSancionatoria || 'N/A',
                'Oficio': sancion.oficioNumero,
                'Motivo': sancion.motivo
            }));

            await Utils.exportarAExcel(
                datosExcel,
                `Listado_Sanciones_${new Date().toISOString().split('T')[0]}.xlsx`,
                'Sanciones'
            );

            Utils.mostrarNotificacion('Excel exportado exitosamente', 'success');
        } catch (error) {
            Utils.mostrarNotificacion('Error al exportar: ' + error.message, 'error');
        }
    }

    volver() {
        window.location.href = 'sistema.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.listadoSanciones = new ListadoGeneralSanciones();
});
