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
                    <h3 style="color: #dc2626; margin-top: 0;"> No se pueden asignar cargos</h3>
                    <p style="color: #991b1b; margin: 10px 0; font-size: 16px;">${validacion.mensaje}</p>
                    <p style="color: #999; margin: 0;">Solo se puede consultar el historial de cargos de este voluntario.</p>
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
            'tecnico': document.getElementById('cargoTecnico'),
            'departamento_comandancia': document.getElementById('cargoDepartamento')
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
        const fechaInicio = document.getElementById('fechaInicioCargo')?.value;
        // Año automático (el campo está oculto): se toma del "Desde" o el año actual
        const anio = fechaInicio ? parseInt(fechaInicio.slice(0, 4)) : new Date().getFullYear();
        const fechaFin = document.getElementById('fechaFinCargo')?.value;
        const observaciones = document.getElementById('observacionesCargo')?.value;

        // Determinar qué select tiene valor
        const cargoComandancia = document.getElementById('cargoComandancia')?.value;
        const cargoCompania = document.getElementById('cargoCompania')?.value;
        const cargoConsejo = document.getElementById('cargoConsejo')?.value;
        const cargoTecnico = document.getElementById('cargoTecnico')?.value;
        const cargoDepartamento = document.getElementById('cargoDepartamento')?.value;

        let tipoCargo, nombreCargo;

        if (cargoComandancia) {
            tipoCargo = 'comandancia';
            nombreCargo = cargoComandancia;
        } else if (cargoDepartamento) {
            tipoCargo = 'departamento_comandancia';
            nombreCargo = cargoDepartamento;
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
            console.log('[CARGOS]  Cargo guardado:', cargoGuardado);

            Utils.mostrarNotificacion(
                this.cargoEditando ? 'Cargo actualizado exitosamente' : 'Cargo registrado exitosamente',
                'success'
            );

            this.limpiarFormulario();
            this.cargoEditando = null;
            await this.cargarCargos();
            this.renderizarCargos();

        } catch (error) {
            console.error('[CARGOS]  Error:', error);
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
                    <p> No hay cargos registrados para este voluntario</p>
                </div>
            `;
            return;
        }

        lista.innerHTML = this.cargos.map(cargo => this.generarHTMLCargo(cargo)).join('');
    }

    generarHTMLCargo(cargo) {
        const iconos = {
            'comandancia': '',
            'compania': '',
            'consejo': '⚖️',
            'tecnico': ''
        };

        const colores = {
            'comandancia': '#ff9800',
            'compania': '#ff9800',
            'consejo': '#ff9800',
            'tecnico': '#ff9800'
        };

        const icono = iconos[cargo.tipo_cargo] || '';
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
            'tecnico': 'Confianza',
            'departamento_comandancia': 'Departamento de Comandancia'
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
            'tecnico': document.getElementById('cargoTecnico'),
            'departamento_comandancia': document.getElementById('cargoDepartamento')
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
            btnSubmit.innerHTML = ' ACTUALIZAR CARGO';
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
        document.getElementById('cargoDepartamento').value = '';
        document.getElementById('tipoCargo').value = '';
        
        this.cargoEditando = null;

        const btnSubmit = document.querySelector('#formCargo button[type="submit"]');
        if (btnSubmit) {
            btnSubmit.innerHTML = ' REGISTRAR CARGO';
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

            // Paleta institucional: azul marino (marco/tablas) y guinda (títulos),
            // en vez del rojo brillante + tarjetas redondeadas de antes.
            const AZUL = [15, 35, 70];
            const GUINDA = [110, 18, 34];
            const TEXTO = [25, 25, 25];
            const TEXTO_SUAVE = [95, 95, 95];
            const MARGEN = 12;
            const xIzq = MARGEN + 6;
            const xDer = pageWidth - MARGEN - 6;
            const anchoUtil = xDer - xIzq;

            const dibujarMarco = () => {
                doc.setDrawColor(...AZUL);
                doc.setLineWidth(0.6);
                doc.rect(MARGEN, MARGEN, pageWidth - 2 * MARGEN, pageHeight - 2 * MARGEN);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...TEXTO_SUAVE);
                doc.text('Chorrillos 1339 - Fono 65-2252666 - Puerto Montt', pageWidth / 2, pageHeight - MARGEN - 4, { align: 'center' });
            };

            dibujarMarco();

            let yPos = MARGEN + 14;

            // ========== ENCABEZADO INSTITUCIONAL ==========
            const logoCompania = localStorage.getItem('logoCompania');
            if (logoCompania) {
                try { doc.addImage(logoCompania, 'PNG', xDer - 18, yPos - 10, 18, 18); } catch (e) { /* sin logo, no es crítico */ }
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...TEXTO);
            doc.text('SEXTA COMPAÑIA DE BOMBEROS PUERTO MONTT', pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
            doc.setFont('times', 'italic');
            doc.setFontSize(10);
            doc.text('"Abnegación y Constancia"', pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;

            doc.setDrawColor(...AZUL);
            doc.setLineWidth(0.3);
            doc.line(xIzq, yPos, xDer, yPos);
            yPos += 12;

            // ========== TÍTULO DEL CERTIFICADO ==========
            doc.setFillColor(...GUINDA);
            doc.rect(xIzq, yPos - 6, anchoUtil, 9, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('times', 'bold');
            doc.setFontSize(12.5);
            doc.text('CERTIFICADO DE CARGOS DESEMPEÑADOS', pageWidth / 2, yPos, { align: 'center' });
            yPos += 16;

            // ========== FOTO Y DATOS DEL VOLUNTARIO ==========
            const fotoAncho = 28;
            const fotoAlto = 34;
            doc.setDrawColor(...AZUL);
            doc.setLineWidth(0.4);
            doc.rect(xIzq, yPos, fotoAncho, fotoAlto);
            if (this.bomberoActual.foto) {
                try {
                    doc.addImage(this.bomberoActual.foto, 'JPEG', xIzq + 0.6, yPos + 0.6, fotoAncho - 1.2, fotoAlto - 1.2);
                } catch (e) {
                    doc.setFontSize(8);
                    doc.setTextColor(...TEXTO_SUAVE);
                    doc.text('SIN FOTO', xIzq + fotoAncho / 2, yPos + fotoAlto / 2, { align: 'center' });
                }
            } else {
                doc.setFontSize(8);
                doc.setTextColor(...TEXTO_SUAVE);
                doc.text('SIN FOTO', xIzq + fotoAncho / 2, yPos + fotoAlto / 2, { align: 'center' });
            }

            const nombreCompleto = this.bomberoActual.nombre_completo ||
                                  `${this.bomberoActual.primerNombre || ''} ${this.bomberoActual.segundoNombre || ''} ${this.bomberoActual.tercerNombre || ''} ${this.bomberoActual.primerApellido || ''} ${this.bomberoActual.segundoApellido || ''}`.replace(/\s+/g, ' ').trim();

            const datosX = xIzq + fotoAncho + 8;
            let datosY = yPos + 5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...TEXTO_SUAVE);
            doc.text('NOMBRE', datosX, datosY);
            datosY += 5.5;
            doc.setFont('times', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...TEXTO);
            doc.text(nombreCompleto, datosX, datosY);
            datosY += 7;

            const filasDatos = [
                ['Clave Bombero', this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero || 'N/A'],
                ['N° de Registro', this.bomberoActual.nroRegistro || this.bomberoActual.nro_registro || 'N/A'],
                ['RUN', this.bomberoActual.rut || 'N/A'],
                ['Compañía', this.bomberoActual.compania || 'N/A'],
            ];
            doc.setFontSize(9.5);
            filasDatos.forEach(([label, value]) => {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...TEXTO_SUAVE);
                doc.text(`${label}:`, datosX, datosY);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...TEXTO);
                doc.text(String(value), datosX + 32, datosY);
                datosY += 5.5;
            });

            yPos += fotoAlto + 12;

            // ========== TABLA DE CARGOS (orden cronológico, el más antiguo primero) ==========
            doc.setFillColor(...GUINDA);
            doc.rect(xIzq, yPos - 6, anchoUtil, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            doc.text('CARGOS DESEMPEÑADOS', pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;

            const cargosOrdenados = [...this.cargos].reverse();
            const filasCargos = cargosOrdenados.map((cargo, index) => [
                String(index + 1),
                cargo.nombre_cargo,
                String(cargo.anio),
                cargo.fecha_inicio ? Utils.formatearFecha(cargo.fecha_inicio) : '—',
                cargo.fecha_fin ? Utils.formatearFecha(cargo.fecha_fin) : 'En ejercicio',
            ]);

            doc.autoTable({
                startY: yPos,
                margin: { left: xIzq, right: MARGEN + 6, bottom: MARGEN + 10 },
                head: [['N°', 'Cargo', 'Año', 'Desde', 'Hasta']],
                body: filasCargos,
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 9.5, textColor: TEXTO, lineColor: [195, 195, 200], lineWidth: 0.2, cellPadding: 3 },
                headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
                alternateRowStyles: { fillColor: [246, 246, 248] },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    2: { cellWidth: 16, halign: 'center' },
                    3: { cellWidth: 26, halign: 'center' },
                    4: { cellWidth: 26, halign: 'center' },
                },
                didDrawPage: () => dibujarMarco(),
            });

            yPos = doc.lastAutoTable.finalY + 16;

            // ========== TEXTO DE CIERRE Y FIRMA ==========
            if (yPos > pageHeight - MARGEN - 55) {
                doc.addPage();
                dibujarMarco();
                yPos = MARGEN + 20;
            }

            const fechaActual = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(...TEXTO);
            const textoCierre = `Se extiende el presente certificado a petición del interesado, para los fines que estime pertinentes, en Puerto Montt a ${fechaActual}.`;
            const lineasCierre = doc.splitTextToSize(textoCierre, anchoUtil);
            doc.text(lineasCierre, xIzq, yPos);
            yPos += lineasCierre.length * 5 + 26;

            const anchoFirma = 65;
            const xFirma = pageWidth / 2 - anchoFirma / 2;
            doc.setDrawColor(...TEXTO);
            doc.setLineWidth(0.3);
            doc.line(xFirma, yPos, xFirma + anchoFirma, yPos);
            yPos += 5;
            doc.setFont('times', 'italic');
            doc.setFontSize(9.5);
            doc.setTextColor(...TEXTO);
            doc.text('Secretario de Compañía', pageWidth / 2, yPos, { align: 'center' });

            // ========== NUMERACIÓN DE PÁGINAS ==========
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...TEXTO_SUAVE);
                doc.text(`Página ${i} de ${totalPages}`, xDer, pageHeight - MARGEN - 4, { align: 'right' });
            }

            // Guardar
            const nombreArchivo = `Certificado_Cargos_${this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero || 'Bombero'}.pdf`;
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
