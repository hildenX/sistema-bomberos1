// ==================== SISTEMA DE FELICITACIONES ====================
class SistemaFelicitaciones {
    constructor() {
        this.bomberoActual = null;
        this.felicitaciones = [];
        this.init();
    }

    async init() {
        // Verificar autenticación
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        console.log('[FELICITACIONES] Usuario:', window.currentUser.username);

        // Cargar datos del bombero
        await this.cargarBomberoActual();
        
        // Cargar felicitaciones desde API
        await this.cargarFelicitaciones();
        
        // Configurar interfaz
        this.configurarInterfaz();
        
        // Renderizar felicitaciones
        this.renderizarFelicitaciones();
        
        // Mostrar logo de compañía si existe
    }

    async cargarFelicitaciones() {
        if (!this.bomberoActual) {
            console.error('[FELICITACIONES] No hay bombero actual');
            return;
        }

        try {
            const url = `/api/felicitaciones/?voluntario=${this.bomberoActual.id}`;
            console.log('[FELICITACIONES] Cargando desde:', url);
            
            const response = await fetch(url, {
                credentials: 'include'
            });

            console.log('[FELICITACIONES] Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('[FELICITACIONES] Datos recibidos:', data);
                console.log('[FELICITACIONES] Tipo de datos:', typeof data);
                console.log('[FELICITACIONES] Es array?', Array.isArray(data));
                
                // Django REST Framework puede devolver array directo o objeto con results
                if (Array.isArray(data)) {
                    this.felicitaciones = data;
                } else if (data.results && Array.isArray(data.results)) {
                    this.felicitaciones = data.results;
                } else {
                    console.warn('[FELICITACIONES] Formato inesperado:', data);
                    this.felicitaciones = [];
                }
                
                console.log('[FELICITACIONES] Cargadas exitosamente:', this.felicitaciones.length);
                console.log('[FELICITACIONES] Array final:', this.felicitaciones);
            } else {
                console.warn('[FELICITACIONES] Response no OK, status:', response.status);
                this.felicitaciones = [];
            }
        } catch (error) {
            console.error('[FELICITACIONES] Error al cargar:', error);
            this.felicitaciones = [];
        }
    }

    async cargarBomberoActual() {
        const bomberoId = localStorage.getItem('bomberoFelicitacionActual');
        if (!bomberoId) {
            Utils.mostrarNotificacion('No se ha seleccionado ningún bombero', 'error');
            setTimeout(() => this.volverAlSistema(), 2000);
            return;
        }

        try {
            const response = await fetch(`/api/voluntarios/${bomberoId}/`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Bombero no encontrado');
            }

            this.bomberoActual = await response.json();
        
            this.mostrarInfoBombero();
            
        } catch (error) {
            console.error('[ERROR] Cargando bombero:', error);
            Utils.mostrarNotificacion('Error al cargar bombero', 'error');
            setTimeout(() => this.volverAlSistema(), 2000);
        }
    }

    mostrarInfoBombero() {
        const contenedor = document.getElementById('bomberoDatosFelicitaciones');
        const antiguedad = Utils.calcularAntiguedadDetallada(this.bomberoActual.fechaIngreso);
        const estadoBadge = Utils.obtenerBadgeEstado(this.bomberoActual.estadoBombero);
        
        // Validar si puede recibir felicitaciones
        const validacion = Utils.puedeRecibirCargosOFelicitaciones(this.bomberoActual);
        if (!validacion.puede) {
            contenedor.innerHTML = `
                <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0;">⚠️ No se pueden registrar felicitaciones</h3>
                    <p style="color: #991b1b; margin: 10px 0; font-size: 16px;">${validacion.mensaje}</p>
                    <p style="color: #666; margin: 0;">Solo se puede consultar el historial de felicitaciones de este voluntario.</p>
                </div>
            `;
            
            // Deshabilitar formulario
            const formulario = document.getElementById('formFelicitacion');
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
            <div><strong>Nombre Completo:</strong> <span>${Utils.obtenerNombreCompleto(this.bomberoActual)}</span></div>
            <div><strong>Clave Bombero:</strong> <span>${this.bomberoActual.claveBombero}</span></div>
            <div><strong>RUN:</strong> <span>${this.bomberoActual.rut}</span></div>
            <div><strong>Compañía:</strong> <span>${this.bomberoActual.compania}</span></div>
            <div><strong>Estado:</strong> <span style="font-weight: bold;">${estadoBadge}</span></div>
            <div><strong>Antigüedad:</strong> <span>${antiguedad.años} años, ${antiguedad.meses} meses</span></div>
            <div><strong>Fecha Ingreso:</strong> <span>${Utils.formatearFecha(this.bomberoActual.fechaIngreso)}</span></div>
        `;

        document.getElementById('bomberoFelicitacionId').value = this.bomberoActual.id;
    }

    configurarInterfaz() {
        // Configurar formulario
        document.getElementById('formFelicitacion').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.manejarSubmitFormulario(e);
        });

        // Configurar fecha de oficio automática
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaOficioFelicitacion').value = hoy;

        // Configurar previsualización de archivo
        document.getElementById('documentoFelicitacion').addEventListener('change', (e) => {
            this.previsualizarArchivo(e.target);
        });

        // Configurar cambio en tipo de felicitación para mostrar campo de nombre
        const tipoSelect = document.getElementById('tipoFelicitacion');
        if (tipoSelect) {
            tipoSelect.addEventListener('change', () => {
                this.controlarCampoNombre();
            });
        }
    }

    controlarCampoNombre() {
        const tipoSelect = document.getElementById('tipoFelicitacion');
        const grupoNombre = document.getElementById('grupo-nombreFelicitacion');
        const inputNombre = document.getElementById('nombreFelicitacion');
        
        if (tipoSelect && grupoNombre && inputNombre) {
            if (tipoSelect.value === 'otra') {
                grupoNombre.style.display = 'block';
                inputNombre.required = true;
            } else {
                grupoNombre.style.display = 'none';
                inputNombre.required = false;
                inputNombre.value = '';
            }
        }
    }

    async previsualizarArchivo(input) {
        const preview = document.getElementById('previewDocumento');
        const previewImage = document.getElementById('previewImageDocumento');
        const previewFileName = document.getElementById('previewFileNameDocumento');

        if (input.files && input.files[0]) {
            const file = input.files[0];
            
            // Validar tamaño
            if (file.size > 10 * 1024 * 1024) { // 10MB
                Utils.mostrarNotificacion('El archivo no debe superar los 10MB', 'error');
                input.value = '';
                return;
            }

            preview.style.display = 'block';
            
            // Mostrar previsualización según tipo de archivo
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                };
                reader.readAsDataURL(file);
                previewFileName.textContent = file.name;
            } else {
                previewImage.style.display = 'none';
                previewFileName.textContent = `📄 ${file.name}`;
            }
        } else {
            preview.style.display = 'none';
        }
    }

    async manejarSubmitFormulario(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const datos = Object.fromEntries(formData);
        
        console.log('📝 Datos de felicitación capturados:', datos);
        
        // Validar campos obligatorios
        if (!datos.bomberoFelicitacionId) {
            Utils.mostrarNotificacion('Error: No se ha seleccionado un bombero', 'error');
            return;
        }
        
        // Validaciones básicas
        if (!datos.tipoFelicitacion) {
            Utils.mostrarNotificacion('Debe seleccionar un tipo de felicitación', 'error');
            return;
        }

        // Si es tipo "otra", validar que tenga nombre
        if (datos.tipoFelicitacion === 'otra' && !datos.nombreFelicitacion) {
            Utils.mostrarNotificacion('Debe especificar el nombre de la felicitación', 'error');
            return;
        }

        if (!datos.fechaFelicitacion) {
            Utils.mostrarNotificacion('Debe ingresar la fecha de felicitación', 'error');
            return;
        }

        if (!datos.oficioNumeroFelicitacion) {
            Utils.mostrarNotificacion('Debe ingresar el número de documento', 'error');
            return;
        }

        if (!datos.motivo) {
            Utils.mostrarNotificacion('Debe describir el mérito', 'error');
            return;
        }

        try {
            await this.guardarFelicitacion(datos);
            this.limpiarFormulario();
            this.renderizarFelicitaciones();
            Utils.mostrarNotificacion('✅ Felicitación registrada exitosamente', 'success');
        } catch (error) {
            console.error('❌ Error al registrar felicitación:', error);
            Utils.mostrarNotificacion('Error al registrar felicitación: ' + error.message, 'error');
        }
    }

    async guardarFelicitacion(datos) {
        try {
            console.log('[FELICITACIONES] ===== GUARDANDO FELICITACIÓN =====');
            console.log('[FELICITACIONES] Bombero actual ID:', this.bomberoActual.id);
            console.log('[FELICITACIONES] Datos recibidos:', datos);
            
            // Preparar datos para Django
            const felicitacionData = {
                voluntario: this.bomberoActual.id,
                tipo_felicitacion: datos.tipoFelicitacion,
                nombre_felicitacion: datos.nombreFelicitacion || null,
                compania_otorgante: datos.companiaOtorgante || '',
                autoridad_otorgante: datos.autoridadOtorgante || '',
                fecha_felicitacion: datos.fechaFelicitacion,
                oficio_numero: datos.oficioNumeroFelicitacion,
                fecha_oficio: datos.fechaOficioFelicitacion || null,
                motivo: datos.motivo
            };

            console.log('[FELICITACIONES] Datos preparados para enviar:', felicitacionData);

            // Si hay documento, convertir a base64
            const archivoInput = document.getElementById('documentoFelicitacion');
            if (archivoInput && archivoInput.files && archivoInput.files[0]) {
                const archivo = archivoInput.files[0];
                console.log('[FELICITACIONES] Convirtiendo archivo a base64:', archivo.name);
                felicitacionData.documento_felicitacion = await Utils.leerArchivoComoBase64(archivo);
                felicitacionData.documento_nombre_original = archivo.name;
            }

            // Enviar a Django
            console.log('[FELICITACIONES] Enviando POST a /api/felicitaciones/');
            const response = await fetch('/api/felicitaciones/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(felicitacionData)
            });

            console.log('[FELICITACIONES] Response status:', response.status);
            console.log('[FELICITACIONES] Response OK:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[FELICITACIONES] Error response:', errorText);
                let errorObj;
                try {
                    errorObj = JSON.parse(errorText);
                } catch (e) {
                    errorObj = { detail: errorText };
                }
                throw new Error(JSON.stringify(errorObj));
            }

            const felicitacionGuardada = await response.json();
            console.log('[FELICITACIONES] ✅ Felicitación guardada exitosamente:', felicitacionGuardada);

            // Recargar felicitaciones
            await this.cargarFelicitaciones();
            
            // Re-renderizar
            this.renderizarFelicitaciones();

        } catch (error) {
            console.error('[FELICITACIONES] ❌ ERROR:', error);
            throw error;
        }
    }

    renderizarFelicitaciones() {
        console.log('[FELICITACIONES] Renderizando historial...');
        
        const lista = document.getElementById('listaFelicitaciones');
        const total = document.getElementById('totalFelicitaciones');
        
        console.log('[FELICITACIONES] Elemento lista encontrado:', !!lista);
        console.log('[FELICITACIONES] Elemento total encontrado:', !!total);
        
        if (!lista) {
            console.error('[FELICITACIONES] No se encontró elemento #listaFelicitaciones');
            return;
        }

        // VALIDAR que felicitaciones sea un array
        if (!Array.isArray(this.felicitaciones)) {
            console.error('[FELICITACIONES] this.felicitaciones NO es un array:', this.felicitaciones);
            this.felicitaciones = [];
        }

        console.log('[FELICITACIONES] Total a renderizar:', this.felicitaciones.length);
        
        if (!this.felicitaciones || this.felicitaciones.length === 0) {
            lista.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay felicitaciones registradas para este bombero</p>';
            if (total) total.textContent = '0';
            return;
        }

        // Ordenar por fecha de registro (más reciente primero)
        const felicitacionesOrdenadas = [...this.felicitaciones].sort((a, b) => 
            new Date(b.created_at || b.fechaRegistro) - new Date(a.created_at || a.fechaRegistro)
        );
        
        console.log('[FELICITACIONES] Felicitaciones ordenadas:', felicitacionesOrdenadas.length);
        
        if (total) total.textContent = this.felicitaciones.length;
        lista.innerHTML = felicitacionesOrdenadas.map(f => this.generarHTMLFelicitacion(f)).join('');
        
        console.log('[FELICITACIONES] Renderizado completado');
    }

    generarHTMLFelicitacion(felicitacion) {
        const iconos = {
            'destacado': '⭐',
            'merito': '🏅',
            'valor': '💪',
            'servicio': '🎖️',
            'antiguedad': '📅',
            'otra': '📌'
        };

        const colores = {
            'destacado': '#2196f3',
            'merito': '#ff9800',
            'valor': '#9c27b0',
            'servicio': '#4caf50',
            'antiguedad': '#00bcd4',
            'otra': '#607d8b'
        };

        const tipo = felicitacion.tipo_felicitacion || felicitacion.tipoFelicitacion;
        const tipoTexto = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const icono = iconos[tipo] || '🏆';
        const color = colores[tipo] || '#28a745';
        
        const nombreFelicitacion = felicitacion.nombre_felicitacion || felicitacion.nombreFelicitacion;
        const fechaRegistro = felicitacion.created_at || felicitacion.fechaRegistro;
        const fechaFelicitacion = felicitacion.fecha_felicitacion || felicitacion.fechaFelicitacion;
        const companiaOtorgante = felicitacion.compania_otorgante || felicitacion.companiaOtorgante;
        const autoridadOtorgante = felicitacion.autoridad_otorgante || felicitacion.autoridadOtorgante;
        const oficioNumero = felicitacion.oficio_numero || felicitacion.oficioNumero;
        const fechaOficio = felicitacion.fecha_oficio || felicitacion.fechaOficio;
        const documentoFelicitacion = felicitacion.documento_felicitacion || felicitacion.documentoFelicitacion;
        const documentoNombre = felicitacion.documento_nombre_original || felicitacion.documentoNombreOriginal;
        const registradoPor = felicitacion.created_by || felicitacion.registradoPor || 'Sistema';
        
        return `
            <div class="item-card felicitacion-card" style="border-left-color: ${color};">
                <div class="item-header">
                    <div class="item-tipo" style="color: ${color};">
                        ${icono} ${tipoTexto}
                        ${tipo === 'otra' && nombreFelicitacion ? `<br><span style="font-size: 0.85em; font-weight: 600;">"${nombreFelicitacion}"</span>` : ''}
                    </div>
                    <div class="item-fecha">
                        Registrado: ${Utils.formatearFecha(fechaRegistro)}
                    </div>
                </div>
                <div class="item-info">
                    <div><strong>Fecha de felicitación:</strong> <span>${Utils.formatearFecha(fechaFelicitacion)}</span></div>
                    
                    ${companiaOtorgante ? `
                        <div><strong>Compañía otorgante:</strong> <span>${companiaOtorgante}</span></div>
                    ` : ''}
                    
                    ${autoridadOtorgante ? `
                        <div><strong>Autoridad otorgante:</strong> <span>${autoridadOtorgante}</span></div>
                    ` : ''}
                    
                    <div><strong>Documento N°:</strong> <span>${oficioNumero}</span></div>
                    ${fechaOficio ? `<div><strong>Fecha del documento:</strong> <span>${Utils.formatearFecha(fechaOficio)}</span></div>` : ''}
                    
                    ${documentoFelicitacion ? `
                        <div class="full-width" style="margin-top: 10px;">
                            <strong>📎 Documento adjunto:</strong>
                            <a href="${documentoFelicitacion}" 
                               target="_blank" 
                               download="${documentoNombre}"
                               class="documento-link"
                               style="display: inline-block; margin-top: 5px; padding: 8px 15px; background: ${color}; color: white; border-radius: 5px; text-decoration: none; transition: all 0.3s;">
                                📄 Ver/Descargar ${documentoNombre}
                            </a>
                        </div>
                    ` : ''}
                    
                    <div class="full-width" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                        <strong>Descripción del Mérito:</strong><br>
                        <span style="white-space: pre-wrap;">${felicitacion.motivo}</span>
                    </div>
                    
                    <div style="margin-top: 10px; font-size: 0.85rem; color: #999;">
                        <strong>Registrado por:</strong> ${registradoPor}
                    </div>
                </div>
            </div>
        `;
    }

    limpiarFormulario() {
        document.getElementById('formFelicitacion').reset();
        
        // Restaurar fecha de oficio a hoy
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaOficioFelicitacion').value = hoy;
        
        // Restaurar ID del bombero
        document.getElementById('bomberoFelicitacionId').value = this.bomberoActual.id;
        
        // Limpiar previsualización de archivo
        const preview = document.getElementById('previewDocumento');
        if (preview) {
            preview.style.display = 'none';
        }
    }


    async exportarExcel() {
        if (!this.bomberoActual) {
            Utils.mostrarNotificacion('Error: No hay un bombero seleccionado', 'error');
            return;
        }

        if (this.felicitaciones.length === 0) {
            Utils.mostrarNotificacion('No hay felicitaciones registradas para exportar', 'error');
            return;
        }

        try {
            const nombreCompleto = Utils.obtenerNombreCompleto(this.bomberoActual);
            const claveBombero = this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero;
            
            const datosExcel = this.felicitaciones.map((felicitacion, index) => {
                const tipo = felicitacion.tipo_felicitacion || felicitacion.tipoFelicitacion;
                const nombreFelicitacion = felicitacion.nombre_felicitacion || felicitacion.nombreFelicitacion;
                const companiaOtorgante = felicitacion.compania_otorgante || felicitacion.companiaOtorgante;
                const autoridadOtorgante = felicitacion.autoridad_otorgante || felicitacion.autoridadOtorgante;
                const fechaFelicitacion = felicitacion.fecha_felicitacion || felicitacion.fechaFelicitacion;
                const oficioNumero = felicitacion.oficio_numero || felicitacion.oficioNumero;
                const fechaOficio = felicitacion.fecha_oficio || felicitacion.fechaOficio;
                const documentoFelicitacion = felicitacion.documento_felicitacion || felicitacion.documentoFelicitacion;
                const registradoPor = felicitacion.created_by || felicitacion.registradoPor || 'Sistema';
                const fechaRegistro = felicitacion.created_at || felicitacion.fechaRegistro;
                
                return {
                    'N°': index + 1,
                    'Bombero': nombreCompleto,
                    'Clave': claveBombero,
                    'RUN': this.bomberoActual.rut,
                    'Tipo de Felicitación': tipo.charAt(0).toUpperCase() + tipo.slice(1),
                    'Nombre': nombreFelicitacion || '',
                    'Fecha': Utils.formatearFecha(fechaFelicitacion),
                    'Compañía': companiaOtorgante || '',
                    'Autoridad': autoridadOtorgante || '',
                    'Documento N°': oficioNumero,
                    'Fecha Documento': fechaOficio ? Utils.formatearFecha(fechaOficio) : '',
                    'Descripción': felicitacion.motivo,
                    'Tiene Documento': documentoFelicitacion ? 'Sí' : 'No',
                    'Registrado por': registradoPor,
                    'Fecha Registro': Utils.formatearFecha(fechaRegistro)
                };
            });

            const clave = this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero;
            await Utils.exportarAExcel(
                datosExcel,
                `Felicitaciones_${clave}_${new Date().toISOString().split('T')[0]}.xlsx`,
                'Felicitaciones'
            );

            Utils.mostrarNotificacion('Excel de felicitaciones descargado exitosamente', 'success');
        } catch (error) {
            Utils.mostrarNotificacion('Error al generar Excel: ' + error.message, 'error');
        }
    }

    async generarPDF() {
        if (!this.bomberoActual) {
            Utils.mostrarNotificacion('Error: No hay un bombero seleccionado', 'error');
            return;
        }

        if (this.felicitaciones.length === 0) {
            Utils.mostrarNotificacion('No hay felicitaciones registradas para generar PDF', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            let yPos = 20;
            let currentPage = 1;

            // Obtener logo de compañía
            const logoCompania = localStorage.getItem('logoCompania');

            // Función para agregar encabezado
            const addHeader = () => {
                // Fondo verde para el encabezado
                doc.setFillColor(40, 167, 69); // Verde
                doc.rect(0, 0, pageWidth, 55, 'F');
                
                // FOTO DEL VOLUNTARIO (izquierda)
                if (this.bomberoActual.foto) {
                    try {
                        doc.addImage(this.bomberoActual.foto, 'JPEG', 12, 13, 28, 28);
                    } catch (error) {
                        console.warn('No se pudo cargar la foto del voluntario');
                    }
                }
                
                // LOGO DE LA COMPAÑÍA (derecha)
                if (logoCompania) {
                    try {
                        doc.addImage(logoCompania, 'PNG', pageWidth - 40, 13, 28, 28);
                    } catch (error) {
                        console.warn('No se pudo cargar el logo de la compañía');
                    }
                }
                
                // Título principal (centro)
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(17);
                doc.setFont(undefined, 'bold');
                doc.text('CERTIFICADO DE RECONOCIMIENTOS', pageWidth / 2, 20, { align: 'center' });
                
                // Subtítulo
                doc.setFontSize(12);
                doc.setFont(undefined, 'normal');
                doc.text('Cuerpo de Bomberos', pageWidth / 2, 30, { align: 'center' });
                
                // Fecha
                doc.setFontSize(10);
                doc.text(new Date().toLocaleDateString('es-CL', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                }), pageWidth / 2, 45, { align: 'center' });
                
                return 65;
            };

            // Función para agregar footer
            const addFooter = (pageNum, totalPages) => {
                doc.setFontSize(9);
                doc.setFont(undefined, 'italic');
                doc.setTextColor(120, 120, 120);
                doc.text('Este certificado acredita las felicitaciones y reconocimientos otorgados al voluntario', pageWidth / 2, pageHeight - 15, { align: 'center' });
                doc.text('en el Cuerpo de Bomberos', pageWidth / 2, pageHeight - 10, { align: 'center' });
                doc.setFont(undefined, 'normal');
                doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            };

            // Calcular páginas necesarias
            const itemsPerPage = 4;
            const totalPages = Math.ceil(this.felicitaciones.length / itemsPerPage) || 1;

            // Primera página - Encabezado y datos del bombero
            yPos = addHeader();
            
            // DATOS DEL VOLUNTARIO
            doc.setTextColor(0, 0, 0);
            
            // Título de sección con fondo verde
            yPos += 10;
            doc.setFillColor(40, 167, 69);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('DATOS DEL VOLUNTARIO', pageWidth / 2, yPos + 7, { align: 'center' });
            
            yPos += 20;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            // Datos centrados
            const fechaIngreso = this.bomberoActual.fechaIngreso || this.bomberoActual.fecha_ingreso;
            const antiguedad = Utils.calcularAntiguedadDetallada(fechaIngreso);
            const nombreCompleto = Utils.obtenerNombreCompleto(this.bomberoActual);
            const claveBombero = this.bomberoActual.claveBombero || this.bomberoActual.clave_bombero;
            const nroRegistro = this.bomberoActual.nroRegistro || this.bomberoActual.nro_registro || 'N/A';
            
            doc.text(`Nombre: ${nombreCompleto}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
            doc.text(`Clave Bombero: ${claveBombero}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
            doc.text(`N° Registro: ${nroRegistro}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
            doc.text(`RUN: ${this.bomberoActual.rut}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 6;
            doc.text(`Compañía: ${this.bomberoActual.compania}`, pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 15;

            // FELICITACIONES Y RECONOCIMIENTOS
            doc.setFillColor(40, 167, 69);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('FELICITACIONES Y RECONOCIMIENTOS', pageWidth / 2, yPos + 7, { align: 'center' });
            
            yPos += 18;
            doc.setTextColor(0, 0, 0);

            // Listado de felicitaciones
            this.felicitaciones.forEach((felicitacion, index) => {
                const tipo = felicitacion.tipo_felicitacion || felicitacion.tipoFelicitacion;
                const fechaFelicitacion = felicitacion.fecha_felicitacion || felicitacion.fechaFelicitacion;
                const oficioNumero = felicitacion.oficio_numero || felicitacion.oficioNumero;
                const autoridadOtorgante = felicitacion.autoridad_otorgante || felicitacion.autoridadOtorgante;
                // Verificar si necesitamos nueva página
                if (yPos > pageHeight - 60) {
                    addFooter(currentPage, totalPages);
                    doc.addPage();
                    currentPage++;
                    yPos = addHeader();
                    yPos += 10;
                }

                const tipoTexto = tipo.charAt(0).toUpperCase() + tipo.slice(1);
                const año = new Date(fechaFelicitacion).getFullYear();

                // Barra verde lateral
                doc.setFillColor(40, 167, 69);
                doc.rect(margin, yPos - 3, 4, 22, 'F');

                // Número y título
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text(`${index + 1}. ${tipoTexto} (${año})`, margin + 8, yPos + 3);

                yPos += 8;
                doc.setFontSize(10);
                doc.setFont(undefined, 'normal');
                
                // Fecha
                doc.text(`Fecha: ${Utils.formatearFecha(fechaFelicitacion)}`, margin + 8, yPos);
                yPos += 5;

                // Documento
                doc.text(`Documento N°: ${oficioNumero}`, margin + 8, yPos);
                yPos += 5;

                // Autoridad si existe
                if (autoridadOtorgante) {
                    doc.text(`Otorgado por: ${autoridadOtorgante}`, margin + 8, yPos);
                    yPos += 5;
                }

                // Descripción (truncada)
                if (felicitacion.motivo) {
                    const motivoCorto = felicitacion.motivo.length > 80 
                        ? felicitacion.motivo.substring(0, 80) + '...' 
                        : felicitacion.motivo;
                    doc.text(`Mérito: ${motivoCorto}`, margin + 8, yPos);
                    yPos += 5;
                }

                yPos += 8; // Espaciado entre felicitaciones
            });

            // Footer de la última página
            addFooter(currentPage, totalPages);

            doc.save(`Certificado_Felicitaciones_${claveBombero}_${new Date().toISOString().split('T')[0]}.pdf`);
            Utils.mostrarNotificacion('PDF generado exitosamente', 'success');
        } catch (error) {
            console.error('Error:', error);
            Utils.mostrarNotificacion('Error al generar PDF: ' + error.message, 'error');
        }
    }

    volverAlSistema() {
        localStorage.removeItem('bomberoFelicitacionActual');
        window.location.href = '/sistema.html';
    }
}

// Inicializar sistema cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
    window.felicitacionesSistema = new SistemaFelicitaciones();
});
