// ==================== SISTEMA DE CARGOS - DJANGO VERSION ====================
class SistemaCargos {
    constructor() {
        this.bomberoActual = null;
        this.cargos = [];
        this.cargoEditando = null;
        this.init();
    }

    async init() {
        console.log('🚀 Iniciando Sistema de Cargos Django');
        
        // Verificar autenticación con Django
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        // Cargar datos del bombero
        await this.cargarBomberoActual();
        
        // Cargar cargos
        await this.cargarCargos();
        
        // Configurar interfaz
        this.configurarInterfaz();
        
        // Renderizar cargos
        this.renderizarCargos();
    }

    async cargarBomberoActual() {
        console.log('[CARGOS] Cargando bombero actual...');
        const bomberoId = localStorage.getItem('bomberoCargoActual');
        
        if (!bomberoId) {
            Utils.mostrarNotificacion('No se ha seleccionado ningún bombero', 'error');
            setTimeout(() => this.volverAlSistema(), 2000);
            return;
        }

        try {
            const response = await fetch(`/api/voluntarios/${bomberoId}/`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error al cargar bombero');

            this.bomberoActual = await response.json();
            console.log('[CARGOS] Bombero cargado:', this.bomberoActual);
            this.mostrarInfoBombero();
            
        } catch (error) {
            console.error('[CARGOS] Error:', error);
            Utils.mostrarNotificacion('Error al cargar datos del bombero', 'error');
            setTimeout(() => this.volverAlSistema(), 2000);
        }
    }

    mostrarInfoBombero() {
        const contenedor = document.getElementById('bomberoDatosCargos');
        
        console.log('[CARGOS] Datos del bombero:', this.bomberoActual);
        
        // Compatibilidad con p6p (camelCase) y Django (snake_case)
        const nombreCompleto = this.bomberoActual.nombre_completo || 
                               `${this.bomberoActual.primerNombre || this.bomberoActual.nombre || ''} ${this.bomberoActual.segundoNombre || ''} ${this.bomberoActual.tercerNombre || ''} ${this.bomberoActual.primerApellido || this.bomberoActual.apellido_paterno || ''} ${this.bomberoActual.segundoApellido || this.bomberoActual.apellido_materno || ''}`.replace(/\s+/g, ' ').trim() ||
                               'Sin nombre';
        
        const claveBombero = this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero || 'Sin clave';
        const rut = this.bomberoActual.rut || this.bomberoActual.run || 'Sin RUT';
        const compania = this.bomberoActual.compania || 'Sin compañía';
        const estadoBombero = this.bomberoActual.estadoBombero || this.bomberoActual.estado_bombero || 'activo';
        const fechaIngreso = this.bomberoActual.fechaIngreso || this.bomberoActual.fecha_ingreso;
        
        const antiguedad = Utils.calcularAntiguedadDetallada(fechaIngreso);
        const estadoBadge = Utils.obtenerBadgeEstado(estadoBombero);
        
        // Validar si puede recibir cargos
        const validacion = Utils.puedeRecibirCargosOFelicitaciones(this.bomberoActual);
        if (!validacion.puede) {
            contenedor.innerHTML = `
                <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0;">⚠️ No se pueden asignar cargos</h3>
                    <p style="color: #991b1b; margin: 10px 0; font-size: 16px;">${validacion.mensaje}</p>
                    <p style="color: #666; margin: 0;">Solo se puede consultar el historial de cargos de este voluntario.</p>
                </div>
            `;
            
            // Deshabilitar formulario
            const formulario = document.getElementById('formCargo');
            if (formulario) {
                const inputs = formulario.querySelectorAll('input, select, textarea, button[type="submit"]');
                inputs.forEach(input => {
                    input.disabled = true;
                    input.style.opacity = '0.5';
                });
            }
            return;
        }
        
        contenedor.innerHTML = `
            <div><strong>Nombre Completo:</strong> <span>${nombreCompleto}</span></div>
            <div><strong>Clave Bombero:</strong> <span>${claveBombero}</span></div>
            <div><strong>RUN:</strong> <span>${rut}</span></div>
            <div><strong>Compañía:</strong> <span>${compania}</span></div>
            <div><strong>Estado:</strong> <span style="font-weight: bold;">${estadoBadge}</span></div>
            <div><strong>Antigüedad:</strong> <span>${antiguedad.años} años, ${antiguedad.meses} meses</span></div>
            <div><strong>Fecha Ingreso:</strong> <span>${Utils.formatearFecha(fechaIngreso)}</span></div>
        `;
    }

    async cargarCargos() {
        if (!this.bomberoActual) return;

        console.log(`[CARGOS] Cargando cargos del voluntario ${this.bomberoActual.id}...`);
        
        try {
            const response = await fetch(`/api/cargos/?voluntario=${this.bomberoActual.id}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error al cargar cargos');

            const data = await response.json();
            this.cargos = Array.isArray(data) ? data : (data.results || []);
            console.log(`[CARGOS] ${this.cargos.length} cargos cargados`);
            
        } catch (error) {
            console.error('[CARGOS] Error al cargar:', error);
            this.cargos = [];
        }
    }

    configurarInterfaz() {
        // Configurar evento del formulario
        const form = document.getElementById('formCargo');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.guardarCargo();
            });
        }

        // Botón limpiar
        const btnLimpiar = document.getElementById('btnLimpiarCargo');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => this.limpiarFormulario());
        }

        // Botón Excel
        const btnExcel = document.getElementById('btnExportarExcel');
        if (btnExcel) {
            btnExcel.addEventListener('click', () => this.exportarExcel());
        }

        // Establecer año actual por defecto
        const inputAnio = document.getElementById('añoCargo');
        if (inputAnio && !inputAnio.value) {
            inputAnio.value = new Date().getFullYear();
        }
    }

    seleccionarCargo(tipo) {
        console.log(`[CARGOS] Tipo seleccionado: ${tipo}`);
        
        // Limpiar otros selects
        const selects = {
            'comandancia': document.getElementById('cargoComandancia'),
            'compania': document.getElementById('cargoCompania'),
            'consejo': document.getElementById('cargoConsejo'),
            'tecnico': document.getElementById('cargoTecnico')
        };

        // Limpiar todos excepto el actual
        Object.keys(selects).forEach(key => {
            if (key !== tipo && selects[key]) {
                selects[key].value = '';
            }
        });

        // Actualizar campo oculto
        const inputTipo = document.getElementById('tipoCargo');
        if (inputTipo) {
            inputTipo.value = tipo;
        }
    }

    async guardarCargo() {
        console.log('[CARGOS] ===== GUARDANDO CARGO =====');

        // Obtener valores
        const anio = document.getElementById('añoCargo')?.value;
        const fechaInicio = document.getElementById('fechaInicioCargo')?.value;
        const fechaFin = document.getElementById('fechaFinCargo')?.value;
        const observaciones = document.getElementById('observacionesCargo')?.value;

        // Determinar qué select tiene valor
        const cargoComandancia = document.getElementById('cargoComandancia')?.value;
        const cargoCompania = document.getElementById('cargoCompania')?.value;
        const cargoConsejo = document.getElementById('cargoConsejo')?.value;
        const cargoTecnico = document.getElementById('cargoTecnico')?.value;

        let tipoCargo, nombreCargo;

        if (cargoComandancia) {
            tipoCargo = 'comandancia';
            nombreCargo = cargoComandancia;
        } else if (cargoCompania) {
            tipoCargo = 'compania';
            nombreCargo = cargoCompania;
        } else if (cargoConsejo) {
            tipoCargo = 'consejo';
            nombreCargo = cargoConsejo;
        } else if (cargoTecnico) {
            tipoCargo = 'tecnico';
            nombreCargo = cargoTecnico;
        } else {
            Utils.mostrarNotificacion('Debe seleccionar un cargo', 'error');
            return;
        }

        // Validar año
        if (!anio) {
            Utils.mostrarNotificacion('El año es obligatorio', 'error');
            return;
        }

        // Preparar datos
        const datosCargo = {
            voluntario: this.bomberoActual.id,
            tipo_cargo: tipoCargo,
            nombre_cargo: nombreCargo,
            anio: parseInt(anio),
            fecha_inicio: fechaInicio || null,
            fecha_fin: fechaFin || null,
            observaciones: observaciones || ''
        };

        console.log('[CARGOS] Datos a enviar:', datosCargo);

        try {
            const url = this.cargoEditando 
                ? `/api/cargos/${this.cargoEditando.id}/`
                : '/api/cargos/';
            
            const method = this.cargoEditando ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(datosCargo)
            });

            console.log('[CARGOS] Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[CARGOS] Error del servidor:', errorData);
                throw new Error(errorData.detail || 'Error al guardar cargo');
            }

            const cargoGuardado = await response.json();
            console.log('[CARGOS] ✅ Cargo guardado:', cargoGuardado);

            Utils.mostrarNotificacion(
                this.cargoEditando ? 'Cargo actualizado exitosamente' : 'Cargo registrado exitosamente',
                'success'
            );

            this.limpiarFormulario();
            this.cargoEditando = null;
            await this.cargarCargos();
            this.renderizarCargos();

        } catch (error) {
            console.error('[CARGOS] ❌ Error:', error);
            Utils.mostrarNotificacion(error.message || 'Error al guardar cargo', 'error');
        }
    }

    renderizarCargos() {
        const lista = document.getElementById('listaCargos');
        const total = document.getElementById('totalCargos');

        if (!lista) return;

        if (total) {
            total.textContent = this.cargos.length;
        }

        if (this.cargos.length === 0) {
            lista.innerHTML = `
                <div class="mensaje-vacio">
                    <p>📋 No hay cargos registrados para este voluntario</p>
                </div>
            `;
            return;
        }

        lista.innerHTML = this.cargos.map(cargo => this.generarHTMLCargo(cargo)).join('');
    }

    generarHTMLCargo(cargo) {
        const iconos = {
            'comandancia': '⭐',
            'compania': '👔',
            'consejo': '⚖️',
            'tecnico': '🔧'
        };

        const colores = {
            'comandancia': '#ff9800',
            'compania': '#ff9800',
            'consejo': '#ff9800',
            'tecnico': '#ff9800'
        };

        const icono = iconos[cargo.tipo_cargo] || '📋';
        const color = colores[cargo.tipo_cargo] || '#ff9800';

        const fechaInicio = cargo.fecha_inicio ? Utils.formatearFecha(cargo.fecha_inicio) : 'No especificado';
        const fechaFin = cargo.fecha_fin ? Utils.formatearFecha(cargo.fecha_fin) : 'En ejercicio';

        return `
            <div class="cargo-card" style="border-left: 4px solid ${color};">
                <div class="cargo-card-header">
                    <h3 style="color: ${color}; margin: 0; font-size: 18px; font-weight: bold;">
                        ${cargo.nombre_cargo} (${cargo.anio})
                    </h3>
                    <button class="btn-editar-cargo" onclick="cargosSistema.editarCargo(${cargo.id})">
                        ✏️ EDITAR
                    </button>
                </div>
                <div class="cargo-card-body">
                    <div class="cargo-detail-row">
                        <span class="cargo-label">Año:</span>
                        <span class="cargo-value">${cargo.anio}</span>
                    </div>
                    <div class="cargo-detail-row">
                        <span class="cargo-label">Cargo:</span>
                        <span class="cargo-value">${cargo.nombre_cargo}</span>
                    </div>
                    <div class="cargo-detail-row">
                        <span class="cargo-label">Desde:</span>
                        <span class="cargo-value">${fechaInicio}</span>
                    </div>
                    <div class="cargo-detail-row">
                        <span class="cargo-label">Hasta:</span>
                        <span class="cargo-value">${fechaFin}</span>
                    </div>
                    ${cargo.observaciones ? `
                    <div class="cargo-detail-row">
                        <span class="cargo-label">Observaciones:</span>
                        <span class="cargo-value">${cargo.observaciones}</span>
                    </div>
                    ` : '<div class="cargo-detail-row"><span class="cargo-label">Observaciones:</span><span class="cargo-value">Sin observaciones</span></div>'}
                </div>
            </div>
        `;
    }

    obtenerNombreTipo(tipo) {
        const nombres = {
            'comandancia': 'Comandancia',
            'compania': 'Compañía',
            'consejo': 'Consejo',
            'tecnico': 'Confianza'
        };
        return nombres[tipo] || tipo;
    }

    async editarCargo(cargoId) {
        console.log('[CARGOS] Editando cargo:', cargoId);
        
        const cargo = this.cargos.find(c => c.id === cargoId);
        if (!cargo) return;

        this.cargoEditando = cargo;

        // Llenar formulario
        document.getElementById('añoCargo').value = cargo.anio;
        document.getElementById('fechaInicioCargo').value = cargo.fecha_inicio || '';
        document.getElementById('fechaFinCargo').value = cargo.fecha_fin || '';
        document.getElementById('observacionesCargo').value = cargo.observaciones || '';

        // Seleccionar el cargo correcto según tipo
        const selects = {
            'comandancia': document.getElementById('cargoComandancia'),
            'compania': document.getElementById('cargoCompania'),
            'consejo': document.getElementById('cargoConsejo'),
            'tecnico': document.getElementById('cargoTecnico')
        };

        // Limpiar todos
        Object.values(selects).forEach(select => {
            if (select) select.value = '';
        });

        // Seleccionar el correcto
        if (selects[cargo.tipo_cargo]) {
            selects[cargo.tipo_cargo].value = cargo.nombre_cargo;
            this.seleccionarCargo(cargo.tipo_cargo);
        }

        // Cambiar texto del botón
        const btnSubmit = document.querySelector('#formCargo button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.innerHTML = '✅ ACTUALIZAR CARGO';
        }

        // Scroll al formulario
        document.getElementById('formCargo').scrollIntoView({ behavior: 'smooth' });
    }

    async eliminarCargo(cargoId) {
        if (!confirm('¿Está seguro de eliminar este cargo?')) return;

        console.log('[CARGOS] Eliminando cargo:', cargoId);

        try {
            const response = await fetch(`/api/cargos/${cargoId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error al eliminar cargo');

            Utils.mostrarNotificacion('Cargo eliminado exitosamente', 'success');
            await this.cargarCargos();
            this.renderizarCargos();

        } catch (error) {
            console.error('[CARGOS] Error al eliminar:', error);
            Utils.mostrarNotificacion('Error al eliminar cargo', 'error');
        }
    }

    limpiarFormulario() {
        document.getElementById('formCargo').reset();
        document.getElementById('añoCargo').value = new Date().getFullYear();
        document.getElementById('cargoComandancia').value = '';
        document.getElementById('cargoCompania').value = '';
        document.getElementById('cargoConsejo').value = '';
        document.getElementById('cargoTecnico').value = '';
        document.getElementById('tipoCargo').value = '';
        
        this.cargoEditando = null;

        const btnSubmit = document.querySelector('#formCargo button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.innerHTML = '✅ REGISTRAR CARGO';
        }
    }

    exportarExcel() {
        if (this.cargos.length === 0) {
            Utils.mostrarNotificacion('No hay cargos para exportar', 'error');
            return;
        }

        console.log('[CARGOS] Exportando a Excel...');

        try {
            const datos = this.cargos.map(cargo => ({
                'Año': cargo.anio,
                'Tipo': this.obtenerNombreTipo(cargo.tipo_cargo),
                'Cargo': cargo.nombre_cargo,
                'Fecha Inicio': cargo.fecha_inicio || 'No especificado',
                'Fecha Fin': cargo.fecha_fin || 'En ejercicio',
                'Observaciones': cargo.observaciones || 'Sin observaciones',
                'Registrado': new Date(cargo.created_at).toLocaleDateString('es-CL')
            }));

            const ws = XLSX.utils.json_to_sheet(datos);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Cargos');

            const nombreArchivo = `Cargos_${this.bomberoActual.claveBombero || 'Bombero'}_${new Date().getTime()}.xlsx`;
            XLSX.writeFile(wb, nombreArchivo);

            Utils.mostrarNotificacion('Excel generado exitosamente', 'success');

        } catch (error) {
            console.error('[CARGOS] Error al generar Excel:', error);
            Utils.mostrarNotificacion('Error al generar Excel', 'error');
        }
    }

    async exportarPDF() {
        if (!this.bomberoActual) {
            Utils.mostrarNotificacion('No hay bombero seleccionado', 'error');
            return;
        }

        if (this.cargos.length === 0) {
            Utils.mostrarNotificacion('No hay cargos para exportar', 'error');
            return;
        }

        console.log('[CARGOS] Generando PDF...');

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            let yPos = 20;

            // ========== ENCABEZADO CON FONDO NEGRO ==========
            doc.setFillColor(0, 0, 0);
            doc.rect(0, 0, pageWidth, 55, 'F');
            
            // ========== FOTO DEL BOMBERO (IZQUIERDA) ==========
            if (this.bomberoActual.foto) {
                try {
                    const fotoX = 14;
                    const fotoY = 8;
                    const fotoWidth = 32;
                    const fotoHeight = 40;
                    doc.addImage(this.bomberoActual.foto, 'JPEG', fotoX, fotoY, fotoWidth, fotoHeight);
                } catch (error) {
                    console.log('No se pudo cargar la foto');
                    doc.setFillColor(60, 60, 60);
                    doc.roundedRect(14, 8, 32, 40, 16, 16, 'F');
                    doc.setTextColor(200, 200, 200);
                    doc.setFontSize(8);
                    doc.text('SIN', 30, 26, { align: 'center' });
                    doc.text('FOTO', 30, 32, { align: 'center' });
                }
            } else {
                doc.setFillColor(60, 60, 60);
                doc.roundedRect(14, 8, 32, 40, 16, 16, 'F');
                doc.setTextColor(200, 200, 200);
                doc.setFontSize(8);
                doc.text('SIN', 30, 26, { align: 'center' });
                doc.text('FOTO', 30, 32, { align: 'center' });
            }

            // ========== TÍTULO CENTRADO ==========
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont(undefined, 'bold');
            doc.text('CERTIFICADO DE CARGOS', pageWidth / 2, 23, { align: 'center' });
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.text('Cuerpo de Bomberos', pageWidth / 2, 31, { align: 'center' });
            
            const fechaActual = new Date().toLocaleDateString('es-CL', { 
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            doc.setFontSize(9);
            doc.text(`${fechaActual}`, pageWidth / 2, 38, { align: 'center' });
            
            // ========== LOGO COMPAÑÍA (DERECHA) ==========
            const logoCompania = localStorage.getItem('logoCompania');
            if (logoCompania) {
                try {
                    doc.addImage(logoCompania, 'PNG', pageWidth - 46, 10, 32, 36);
                } catch (error) {
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(10);
                    doc.setFont(undefined, 'bold');
                    doc.text('LOGO', pageWidth - 30, 24, { align: 'center' });
                    doc.setFontSize(8);
                    doc.setFont(undefined, 'normal');
                    doc.text('COMPAÑIA', pageWidth - 30, 30, { align: 'center' });
                }
            } else {
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.text('LOGO', pageWidth - 30, 24, { align: 'center' });
                doc.setFontSize(8);
                doc.setFont(undefined, 'normal');
                doc.text('COMPAÑIA', pageWidth - 30, 30, { align: 'center' });
            }
            
            yPos = 65;

            // ========== DATOS DEL VOLUNTARIO ==========
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('DATOS DEL VOLUNTARIO', pageWidth / 2, yPos, { align: 'center' });
            yPos += 3;
            
            doc.setDrawColor(196, 30, 58);
            doc.setLineWidth(0.8);
            doc.line(pageWidth / 2 - 35, yPos, pageWidth / 2 + 35, yPos);
            yPos += 8;
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(60, 60, 60);
            
            const nombreCompleto = this.bomberoActual.nombre_completo || 
                                  `${this.bomberoActual.primerNombre || ''} ${this.bomberoActual.segundoNombre || ''} ${this.bomberoActual.tercerNombre || ''} ${this.bomberoActual.primerApellido || ''} ${this.bomberoActual.segundoApellido || ''}`.replace(/\s+/g, ' ').trim();
            
            const infoBombero = [
                `Nombre: ${nombreCompleto}`,
                `Clave Bombero: ${this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero || 'N/A'}`,
                `N° Registro: ${this.bomberoActual.nroRegistro || this.bomberoActual.nro_registro || 'N/A'}`,
                `RUN: ${this.bomberoActual.rut || 'N/A'}`,
                `Compañía: ${this.bomberoActual.compania || 'N/A'}`
            ];
            
            infoBombero.forEach(info => {
                doc.text(info, pageWidth / 2, yPos, { align: 'center' });
                yPos += 6;
            });
            
            yPos += 8;

            // ========== TÍTULO DE CARGOS ==========
            doc.setFillColor(196, 30, 58);
            doc.rect(20, yPos, pageWidth - 40, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('CARGOS DESEMPEÑADOS', pageWidth / 2, yPos + 7, { align: 'center' });
            yPos += 16;

            // ========== LISTA DE CARGOS ==========
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            this.cargos.forEach((cargo, index) => {
                if (yPos > 260) {
                    doc.addPage();
                    yPos = 20;
                }

                // Borde izquierdo rojo
                doc.setFillColor(196, 30, 58);
                doc.rect(25, yPos - 2, 3, 12, 'F');
                
                // Número y título del cargo
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(`${index + 1}. ${cargo.nombre_cargo} (${cargo.anio})`, 32, yPos + 3);
                
                yPos += 8;
                
                // Fechas
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(80, 80, 80);
                const fechaInicio = cargo.fecha_inicio ? Utils.formatearFecha(cargo.fecha_inicio) : 'No especificado';
                const fechaFin = cargo.fecha_fin ? Utils.formatearFecha(cargo.fecha_fin) : 'En ejercicio';
                doc.text(`Desde: ${fechaInicio} | Hasta: ${fechaFin}`, 32, yPos);
                
                yPos += 10;
            });

            // ========== PIE DE PÁGINA ==========
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                
                // Línea superior
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.3);
                doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
                
                // Texto en cursiva
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text('Este certificado acredita los cargos desempeñados por el voluntario', pageWidth / 2, pageHeight - 14, { align: 'center' });
                doc.text('en el Cuerpo de Bomberos', pageWidth / 2, pageHeight - 10, { align: 'center' });
                
                // Número de página
                doc.setFont(undefined, 'normal');
                doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
            }

            // Guardar
            const nombreArchivo = `Cargos_${this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero || 'Bombero'}_${new Date().getTime()}.pdf`;
            doc.save(nombreArchivo);

            Utils.mostrarNotificacion('PDF generado exitosamente', 'success');

        } catch (error) {
            console.error('[CARGOS] Error al generar PDF:', error);
            Utils.mostrarNotificacion('Error al generar PDF: ' + error.message, 'error');
        }
    }

    volverAlSistema() {
        window.location.href = '/sistema.html';
    }
}

// Instancia global
let cargosSistema;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    cargosSistema = new SistemaCargos();
});
