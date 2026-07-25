// ==================== SISTEMA DE SANCIONES - VERSION DJANGO ====================
class SistemaSanciones {
    constructor() {
        this.bomberoActual = null;
        this.sanciones = [];
        this.init();
    }

    async init() {
        // Verificar autenticación con Django
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated || !window.currentUser) {
            window.location.href = '/';
            return;
        }

        // Verificar permisos (temporal: todos pueden ver)
        // TODO: Implementar permisos desde Django
        
        // Cargar datos del bombero
        await this.cargarBomberoActual();
        
        // Cargar sanciones desde API
        await this.cargarSanciones();
        
        // Configurar interfaz
        this.configurarInterfaz();
        
        // Renderizar sanciones
        this.renderizarSanciones();
    }

    async cargarBomberoActual() {
        const bomberoId = localStorage.getItem('bomberoSancionActual');
        if (!bomberoId) {
            Utils.mostrarNotificacion('No se ha seleccionado ningún bombero', 'error');
            setTimeout(() => this.volverAlSistema(), 2000);
            return;
        }

        try {
            // Cargar desde API Django
            const response = await fetch(`/api/voluntarios/${bomberoId}/`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Bombero no encontrado');
            }

            this.bomberoActual = await response.json();
            this.mostrarInfoBombero();
            
        } catch (error) {
            console.error('Error al cargar bombero:', error);
            Utils.mostrarNotificacion('Error al cargar datos del bombero', 'error');
            setTimeout(() => this.volverAlSistema(), 2000);
        }
    }

    async cargarSanciones() {
        if (!this.bomberoActual) {
            console.error('[SANCIONES] No hay bombero actual');
            return;
        }

        try {
            const url = `/api/sanciones/?voluntario=${this.bomberoActual.id}`;
            console.log('[SANCIONES] Cargando desde:', url);
            
            const response = await fetch(url, {
                credentials: 'include'
            });

            console.log('[SANCIONES] Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('[SANCIONES] Datos recibidos:', data);
                console.log('[SANCIONES] Tipo de datos:', typeof data);
                console.log('[SANCIONES] Es array?', Array.isArray(data));
                
                // Django REST Framework puede devolver array directo o objeto con results
                if (Array.isArray(data)) {
                    this.sanciones = data;
                } else if (data.results && Array.isArray(data.results)) {
                    this.sanciones = data.results;
                } else {
                    console.warn('[SANCIONES] Formato inesperado:', data);
                    this.sanciones = [];
                }
                
                console.log('[SANCIONES] Cargadas exitosamente:', this.sanciones.length);
                console.log('[SANCIONES] Array final:', this.sanciones);
            } else {
                console.warn('[SANCIONES] Response no OK, status:', response.status);
                this.sanciones = [];
            }
        } catch (error) {
            console.error('[SANCIONES] Error al cargar:', error);
            this.sanciones = [];
        }
    }

    mostrarInfoBombero() {
        const contenedor = document.getElementById('bomberoDatosSanciones');
        if (!contenedor) return;

        const antiguedad = Utils.calcularAntiguedadDetallada(this.bomberoActual.fechaIngreso);
        const estadoBadge = Utils.obtenerBadgeEstado(this.bomberoActual.estadoBombero);
        
        // Verificar si puede ser sancionado
        const validacion = Utils.puedeSerSancionado(this.bomberoActual);
        if (!validacion.puede) {
            contenedor.innerHTML = `
                <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px;">
                    <h3 style="color: #dc2626; margin-top: 0;"> No se pueden registrar sanciones</h3>
                    <p style="color: #991b1b; margin: 10px 0; font-size: 16px;">${validacion.mensaje}</p>
                    <p style="color: #666; margin: 0;">Solo se puede consultar el historial de sanciones de este voluntario.</p>
                </div>
            `;
            
            // Deshabilitar formulario
            const formulario = document.getElementById('formSancion');
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
            <div><strong>Nombre:</strong> <span>${Utils.obtenerNombreCompleto(this.bomberoActual)}</span></div>
            <div><strong>Clave:</strong> <span>${this.bomberoActual.claveBombero}</span></div>
            <div><strong>RUN:</strong> <span>${this.bomberoActual.rut}</span></div>
            <div><strong>Compañía:</strong> <span>${this.bomberoActual.compania}</span></div>
            <div><strong>Estado:</strong> <span style="font-weight: bold;">${estadoBadge}</span></div>
            <div><strong>Antigüedad:</strong> <span>${antiguedad.años} años, ${antiguedad.meses} meses</span></div>
            <div><strong>Fecha Ingreso:</strong> <span>${Utils.formatearFecha(this.bomberoActual.fechaIngreso)}</span></div>
        `;

        const inputId = document.getElementById('bomberoSancionId');
        if (inputId) {
            inputId.value = this.bomberoActual.id;
        }
    }

    configurarInterfaz() {
        // Obtener usuario actual
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
        const esCapitan = currentUser.role === 'Capitán';
        
        // Configurar formulario
        const form = document.getElementById('formSancion');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.manejarSubmitFormulario(e);
            });
        }

        // Configurar fecha de oficio automática
        const hoy = new Date().toISOString().split('T')[0];
        const fechaOficioInput = document.getElementById('fechaOficio');
        if (fechaOficioInput) {
            fechaOficioInput.value = hoy;
        }

        // RESTRICCIÓN PARA CAPITÁN: Solo suspensiones y Capitanía
        const tipoSancionSelect = document.getElementById('tipoSancion');
        const companiaAutoridadInput = document.getElementById('companiaAutoridad');
        
        if (esCapitan) {
            // Restringir tipo de sanción a solo suspension
            if (tipoSancionSelect) {
                // Deshabilitar todas las opciones excepto suspension
                Array.from(tipoSancionSelect.options).forEach(option => {
                    if (option.value !== 'suspension') {
                        option.disabled = true;
                        option.style.display = 'none';
                    }
                });
                // Pre-seleccionar suspension y bloquear visualmente
                tipoSancionSelect.value = 'suspension';
                tipoSancionSelect.style.opacity = '0.7';
                tipoSancionSelect.style.cursor = 'not-allowed';
                tipoSancionSelect.style.pointerEvents = 'none';
                
                // Marcar que es Capitán para que el formulario siempre envíe 'suspension'
                tipoSancionSelect.setAttribute('data-capitan-lock', 'true');
            }
            
            // Pre-llenar y deshabilitar Compañía Autoridad
            if (companiaAutoridadInput) {
                companiaAutoridadInput.value = 'Capitanía';
                companiaAutoridadInput.readOnly = true;
                companiaAutoridadInput.style.opacity = '0.7';
                companiaAutoridadInput.style.cursor = 'not-allowed';
            }
            
            console.log('[SANCIONES] Restricción de Capitán aplicada: Solo suspensiones y Capitanía');
        }

        // Configurar cambios en selector de tipo de sanción
        if (tipoSancionSelect) {
            tipoSancionSelect.addEventListener('change', () => {
                this.actualizarEstiloTipoSancion();
            });
            // Inicializar estilo
            this.actualizarEstiloTipoSancion();
        }

        // Configurar cambio en días de sanción
        const diasSancionInput = document.getElementById('diasSancion');
        if (diasSancionInput) {
            diasSancionInput.addEventListener('input', () => {
                this.calcularFechaTermino();
            });
        }

        // Configurar cambio en fecha de inicio
        const fechaDesdeInput = document.getElementById('fechaDesde');
        if (fechaDesdeInput) {
            fechaDesdeInput.addEventListener('change', () => {
                this.calcularFechaTermino();
            });
        }

        // Configurar previsualización de archivo
        const docInput = document.getElementById('documentoOficio');
        if (docInput) {
            docInput.addEventListener('change', (e) => {
                this.previsualizarArchivo(e.target);
            });
        }
    }

    actualizarEstiloTipoSancion() {
        const select = document.getElementById('tipoSancion');
        if (!select) return;

        const valor = select.value;
        
        // Resetear estilos
        select.className = 'tipo-sancion-select';
        
        // Aplicar estilo según el tipo
        if (valor === 'renuncia') {
            select.classList.add('tipo-renuncia');
        } else if (valor === 'suspension') {
            select.classList.add('tipo-suspension');
        } else if (valor === 'separacion') {
            select.classList.add('tipo-separacion');
        } else if (valor === 'expulsion') {
            select.classList.add('tipo-expulsion');
        }
        
        // OCULTAR/MOSTRAR CAMPOS SEGÚN TIPO DE SANCIÓN
        this.controlarCamposSegunTipo(valor);
    }

    controlarCamposSegunTipo(tipoSancion) {
        // Elementos a controlar
        const companiaAutoridad = document.querySelector('[for="companiaAutoridad"]')?.parentElement;
        const autoridadSancionatoria = document.getElementById('grupo-autoridadSancionatoria');
        const diasSancion = document.querySelector('[for="diasSancion"]')?.parentElement;
        const fechaHasta = document.querySelector('[for="fechaHasta"]')?.parentElement;
        const fechaOficio = document.querySelector('[for="fechaOficio"]')?.parentElement;
        
        // Labels
        const labelFechaDesde = document.querySelector('[for="fechaDesde"]');
        const labelOficioNumero = document.querySelector('[for="oficioNumero"]');
        const labelDoc = document.querySelector('[for="documentoOficio"]');
        const labelMotivo = document.querySelector('[for="motivo"]');
        
        // RENUNCIA: Campos mínimos
        if (tipoSancion === 'renuncia') {
            if (companiaAutoridad) companiaAutoridad.style.display = 'none';
            if (autoridadSancionatoria) autoridadSancionatoria.style.display = 'none';
            if (diasSancion) diasSancion.style.display = 'none';
            if (fechaHasta) fechaHasta.style.display = 'none';
            if (fechaOficio) fechaOficio.style.display = 'none';
            
            if (labelFechaDesde) labelFechaDesde.textContent = 'Fecha de Renuncia';
            if (labelOficioNumero) labelOficioNumero.textContent = 'Identificador del Oficio';
            if (labelDoc) labelDoc.textContent = '📎 Adjuntar Oficio y Carta de Renuncia';
            if (labelMotivo) labelMotivo.textContent = 'Detalle de la Renuncia';
        }
        
        // SEPARACIÓN: Sin días ni fecha término
        else if (tipoSancion === 'separacion') {
            if (companiaAutoridad) companiaAutoridad.style.display = 'block';
            if (autoridadSancionatoria) autoridadSancionatoria.style.display = 'block';
            if (diasSancion) diasSancion.style.display = 'none'; //  OCULTAR
            if (fechaHasta) fechaHasta.style.display = 'none'; //  OCULTAR
            if (fechaOficio) fechaOficio.style.display = 'block';
            
            if (labelFechaDesde) labelFechaDesde.textContent = 'Fecha de Separación';
            if (labelOficioNumero) labelOficioNumero.textContent = 'Número de Oficio';
            if (labelDoc) labelDoc.textContent = '📎 Adjuntar Documento de Separación';
            if (labelMotivo) labelMotivo.textContent = 'Motivo de la Separación';
        }
        
        // EXPULSIÓN: Sin días ni fecha término
        else if (tipoSancion === 'expulsion') {
            if (companiaAutoridad) companiaAutoridad.style.display = 'block';
            if (autoridadSancionatoria) autoridadSancionatoria.style.display = 'block';
            if (diasSancion) diasSancion.style.display = 'none'; //  OCULTAR
            if (fechaHasta) fechaHasta.style.display = 'none'; //  OCULTAR
            if (fechaOficio) fechaOficio.style.display = 'block';
            
            if (labelFechaDesde) labelFechaDesde.textContent = 'Fecha de Expulsión';
            if (labelOficioNumero) labelOficioNumero.textContent = 'Número de Oficio';
            if (labelDoc) labelDoc.textContent = '📎 Adjuntar Documento de Expulsión';
            if (labelMotivo) labelMotivo.textContent = 'Motivo de la Expulsión';
        }
        
        // SUSPENSIÓN: Con días y fecha término
        else if (tipoSancion === 'suspension') {
            if (companiaAutoridad) companiaAutoridad.style.display = 'block';
            if (autoridadSancionatoria) autoridadSancionatoria.style.display = 'block';
            if (diasSancion) diasSancion.style.display = 'block'; //  MOSTRAR
            if (fechaHasta) fechaHasta.style.display = 'block'; //  MOSTRAR
            if (fechaOficio) fechaOficio.style.display = 'block';
            
            if (labelFechaDesde) labelFechaDesde.textContent = 'Fecha de Inicio de Suspensión';
            if (labelOficioNumero) labelOficioNumero.textContent = 'Número de Oficio';
            if (labelDoc) labelDoc.textContent = '📎 Adjuntar Documento de Suspensión';
            if (labelMotivo) labelMotivo.textContent = 'Motivo de la Suspensión';
        }
        
        // DEFAULT: Mostrar todos
        else {
            if (companiaAutoridad) companiaAutoridad.style.display = 'block';
            if (autoridadSancionatoria) autoridadSancionatoria.style.display = 'block';
            if (diasSancion) diasSancion.style.display = 'block';
            if (fechaHasta) fechaHasta.style.display = 'block';
            if (fechaOficio) fechaOficio.style.display = 'block';
            
            if (labelFechaDesde) labelFechaDesde.textContent = 'Fecha de Inicio';
            if (labelOficioNumero) labelOficioNumero.textContent = 'Número de Oficio';
            if (labelDoc) labelDoc.textContent = '📎 Adjuntar Documento';
            if (labelMotivo) labelMotivo.textContent = 'Descripción del Motivo';
        }
    }

    calcularFechaTermino() {
        const diasInput = document.getElementById('diasSancion');
        const fechaDesdeInput = document.getElementById('fechaDesde');
        const fechaHastaInput = document.getElementById('fechaHasta');

        if (!diasInput || !fechaDesdeInput || !fechaHastaInput) return;

        const dias = parseInt(diasInput.value);
        const fechaDesde = fechaDesdeInput.value;

        if (dias && fechaDesde) {
            const fecha = new Date(fechaDesde);
            fecha.setDate(fecha.getDate() + dias);
            fechaHastaInput.value = fecha.toISOString().split('T')[0];
        }
    }

    async previsualizarArchivo(input) {
        const preview = document.getElementById('previewDocumento');
        const previewImage = document.getElementById('previewImageDocumento');
        const previewFileName = document.getElementById('previewFileNameDocumento');

        if (!input.files || !input.files[0]) return;

        const file = input.files[0];
        
        // Validar tamaño
        if (file.size > 10 * 1024 * 1024) { // 10MB
            Utils.mostrarNotificacion('El archivo no debe superar los 10MB', 'error');
            input.value = '';
            return;
        }

        if (preview) preview.style.display = 'block';
        
        // Mostrar previsualización según tipo de archivo
        if (file.type.startsWith('image/') && previewImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            if (previewImage) previewImage.style.display = 'none';
        }

        if (previewFileName) {
            previewFileName.textContent = file.name;
        }
    }

    async manejarSubmitFormulario(e) {
        const formData = new FormData(e.target);
        
        // Convertir FormData a objeto
        const datos = {};
        formData.forEach((value, key) => {
            datos[key] = value;
        });

        // FORZAR VALORES PARA CAPITÁN (si el campo está bloqueado)
        const tipoSancionSelect = document.getElementById('tipoSancion');
        if (tipoSancionSelect?.getAttribute('data-capitan-lock') === 'true') {
            datos.tipoSancion = 'suspension';
            datos.companiaAutoridad = 'Capitanía';
            console.log('[SANCIONES] Forzando valores de Capitán: suspension + Capitanía');
        }

        // Validaciones básicas
        if (!datos.tipoSancion) {
            Utils.mostrarNotificacion('Debe seleccionar un tipo de sanción', 'error');
            return;
        }

        if (!datos.fechaDesde) {
            Utils.mostrarNotificacion('Debe especificar la fecha de inicio', 'error');
            return;
        }

        if (!datos.oficioNumero) {
            Utils.mostrarNotificacion('Debe ingresar el número de oficio', 'error');
            return;
        }

        if (!datos.motivo) {
            Utils.mostrarNotificacion('Debe describir el motivo', 'error');
            return;
        }

        // Confirmar
        const confirmado = await Utils.confirmarAccion(
            `¿Está seguro de registrar esta ${datos.tipoSancion} para ${Utils.obtenerNombreCompleto(this.bomberoActual)}?`
        );

        if (!confirmado) return;

        await this.guardarSancion(datos, formData);
    }

    async guardarSancion(datos, formData) {
        try {
            // Preparar datos para Django
            const sancionData = {
                voluntario: this.bomberoActual.id,
                tipo_sancion: datos.tipoSancion,
                compania_autoridad: datos.companiaAutoridad || '',
                autoridad_sancionatoria: datos.autoridadSancionatoria || '',
                fecha_desde: datos.fechaDesde,
                fecha_hasta: datos.fechaHasta || null,
                dias_sancion: datos.diasSancion ? parseInt(datos.diasSancion) : null,
                oficio_numero: datos.oficioNumero,
                fecha_oficio: datos.fechaOficio || null,
                motivo: datos.motivo
            };

            // Si hay documento, convertir a base64
            const archivoInput = document.getElementById('documentoOficio');
            if (archivoInput && archivoInput.files && archivoInput.files[0]) {
                const archivo = archivoInput.files[0];
                sancionData.documento_oficio = await Utils.leerArchivoComoBase64(archivo);
                sancionData.documento_nombre_original = archivo.name;
            }

            // Enviar a Django
            const response = await fetch('/api/sanciones/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                credentials: 'include',
                body: JSON.stringify(sancionData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Error al guardar sanción');
            }

            const sancionGuardada = await response.json();
            console.log('[SANCION] Guardada:', sancionGuardada);

            Utils.mostrarNotificacion('Sanción registrada exitosamente', 'success');

            // Recargar sanciones
            await this.cargarSanciones();
            this.renderizarSanciones();

            // Limpiar formulario
            document.getElementById('formSancion').reset();
            const preview = document.getElementById('previewDocumento');
            if (preview) preview.style.display = 'none';

        } catch (error) {
            console.error('Error al guardar sanción:', error);
            Utils.mostrarNotificacion(`Error: ${error.message}`, 'error');
        }
    }

    renderizarSanciones() {
        console.log('[SANCIONES] Renderizando historial...');
        
        const listado = document.getElementById('listaSanciones');
        const totalElement = document.getElementById('totalSanciones');
        
        console.log('[SANCIONES] Elemento listado encontrado:', !!listado);
        
        if (!listado) {
            console.error('[SANCIONES] No se encontró elemento #listaSanciones');
            return;
        }

        // VALIDAR que sanciones sea un array
        if (!Array.isArray(this.sanciones)) {
            console.error('[SANCIONES] this.sanciones NO es un array:', this.sanciones);
            this.sanciones = [];
        }

        console.log('[SANCIONES] Cantidad de sanciones:', this.sanciones.length);
        
        // Actualizar contador
        if (totalElement) {
            totalElement.textContent = this.sanciones.length;
        }

        if (this.sanciones.length === 0) {
            listado.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <p>No hay sanciones registradas para este voluntario</p>
                </div>
            `;
            return;
        }

        listado.innerHTML = this.sanciones.map(sancion => {
            const tipoInfo = this.obtenerInfoTipoSancion(sancion.tipo_sancion);
            const fechaRegistro = sancion.created_at ? new Date(sancion.created_at).toLocaleDateString('es-CL') : 'N/A';
            
            // Determinar duración según tipo de sanción
            let duracion = 'N/A';
            switch(sancion.tipo_sancion) {
                case 'suspension':
                    duracion = sancion.dias_sancion ? `${sancion.dias_sancion} días` : 'N/A';
                    break;
                case 'renuncia':
                    duracion = 'Indefinido';
                    break;
                case 'separacion':
                    duracion = '1 año';
                    break;
                case 'expulsion':
                    duracion = '2 años';
                    break;
            }
            
            return `
                <div style="background: #ffffff; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #3b82f6; font-size: 18px;"></span>
                            <strong style="font-size: 16px; color: #1f2937;">${tipoInfo.nombre}</strong>
                        </div>
                        <span style="font-size: 13px; color: #6b7280;">Registrado: ${fechaRegistro}</span>
                    </div>
                    
                    <!-- Grid de datos - Primera fila -->
                    <div style="display: grid; grid-template-columns: repeat(${sancion.compania_autoridad ? '4' : '3'}, 1fr); gap: 15px; margin-bottom: 12px;">
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Fecha de inicio:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${Utils.formatearFecha(sancion.fecha_desde)}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Fecha de término:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${sancion.fecha_hasta ? Utils.formatearFecha(sancion.fecha_hasta) : 'Indefinida'}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Duración:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${duracion}</div>
                        </div>
                        ${sancion.compania_autoridad ? `
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Compañía responsable:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${sancion.compania_autoridad}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Grid de datos - Segunda fila -->
                    <div style="display: grid; grid-template-columns: repeat(${sancion.autoridad_sancionatoria ? '3' : '2'}, 1fr); gap: 15px; margin-bottom: 15px;">
                        ${sancion.autoridad_sancionatoria ? `
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Autoridad sancionatoria:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${sancion.autoridad_sancionatoria}</div>
                        </div>
                        ` : ''}
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Oficio N°:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${sancion.oficio_numero}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Fecha del oficio:</div>
                            <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${sancion.fecha_oficio ? Utils.formatearFecha(sancion.fecha_oficio) : 'N/A'}</div>
                        </div>
                    </div>
                    
                    <!-- Motivo -->
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Motivo:</div>
                        <div style="font-size: 14px; color: #1f2937; line-height: 1.5;">${sancion.motivo}</div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="font-size: 13px; color: #6b7280; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                        Registrado por: <strong>${sancion.registrado_por || 'Sistema'}</strong>
                    </div>
                </div>
            `;
        }).join('');
    }

    obtenerInfoTipoSancion(tipo) {
        const tipos = {
            'suspension': { nombre: 'Suspensión', icono: '⏸️', clase: 'tipo-suspension' },
            'renuncia': { nombre: 'Renuncia', icono: '', clase: 'tipo-renuncia' },
            'separacion': { nombre: 'Separación', icono: '⏸️', clase: 'tipo-separacion' },
            'expulsion': { nombre: 'Expulsión', icono: '', clase: 'tipo-expulsion' }
        };
        return tipos[tipo] || { nombre: tipo, icono: '', clase: '' };
    }

    limpiarFormulario() {
        const form = document.getElementById('formSancion');
        if (form) {
            form.reset();
            
            // Limpiar preview de documento de oficio
            const previewDocumento = document.getElementById('previewDocumento');
            if (previewDocumento) previewDocumento.style.display = 'none';
            
            Utils.mostrarNotificacion('Formulario limpiado', 'success');
        }
    }


    async generarPDF() {
        if (!this.bomberoActual) {
            Utils.mostrarNotificacion('No hay voluntario cargado', 'error');
            return;
        }

        // Validar que sanciones sea un array
        if (!Array.isArray(this.sanciones)) {
            console.error('[PDF] this.sanciones NO es un array:', this.sanciones);
            Utils.mostrarNotificacion('Error: Datos de sanciones inválidos', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // ==================== HEADER NEGRO ====================
            doc.setFillColor(0, 0, 0);
            doc.rect(0, 0, pageWidth, 50, 'F');
            
            // Foto del voluntario (izquierda)
            if (this.bomberoActual.foto) {
                try {
                    doc.addImage(this.bomberoActual.foto, 'JPEG', 10, 10, 30, 30);
                } catch (e) {
                    console.warn('No se pudo cargar foto del voluntario');
                }
            }
            
            // Logo de bomberos (derecha)
            const logoCompania = localStorage.getItem('logoCompania');
            if (logoCompania) {
                try {
                    doc.addImage(logoCompania, 'PNG', pageWidth - 40, 10, 30, 30);
                } catch (e) {
                    console.warn('No se pudo cargar logo de compañía');
                }
            }
            
            // Título "CERTIFICADO DE SANCIONES"
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('CERTIFICADO DE SANCIONES', pageWidth / 2, 25, { align: 'center' });
            
            // Subtítulo "Cuerpo de Bomberos"
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text('Cuerpo de Bomberos', pageWidth / 2, 33, { align: 'center' });
            
            // Fecha
            doc.setFontSize(10);
            const fechaHoy = new Date().toLocaleDateString('es-CL', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            });
            doc.text(fechaHoy, pageWidth / 2, 42, { align: 'center' });
            
            // ==================== DATOS DEL VOLUNTARIO ====================
            let y = 65;
            
            // Header rojo "DATOS DEL VOLUNTARIO"
            doc.setFillColor(196, 30, 58); // Rojo bomberos
            doc.rect(15, y, pageWidth - 30, 10, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('DATOS DEL VOLUNTARIO', pageWidth / 2, y + 7, { align: 'center' });
            
            // Contenido - fondo blanco
            y += 10;
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(200, 200, 200);
            doc.rect(15, y, pageWidth - 30, 35, 'FD');
            
            y += 8;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            doc.text(`Nombre: ${this.bomberoActual.nombreCompleto}`, pageWidth / 2, y, { align: 'center' });
            y += 6;
            doc.text(`Clave Bombero: ${this.bomberoActual.claveBombero}`, pageWidth / 2, y, { align: 'center' });
            y += 6;
            doc.text(`N° Registro: ${this.bomberoActual.nroRegistro || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
            y += 6;
            doc.text(`RUN: ${this.bomberoActual.rut}`, pageWidth / 2, y, { align: 'center' });
            y += 6;
            doc.text(`Compañía: ${this.bomberoActual.compania || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
            
            // ==================== SANCIONES DISCIPLINARIAS ====================
            y += 15;
            
            // Header rojo "SANCIONES DISCIPLINARIAS REGISTRADAS"
            doc.setFillColor(196, 30, 58);
            doc.rect(15, y, pageWidth - 30, 10, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('SANCIONES DISCIPLINARIAS REGISTRADAS', pageWidth / 2, y + 7, { align: 'center' });
            
            y += 15;
            
            // Lista de sanciones
            if (this.sanciones.length === 0) {
                doc.setTextColor(100, 100, 100);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.text('No hay sanciones registradas', pageWidth / 2, y + 10, { align: 'center' });
            } else {
                this.sanciones.forEach((sancion, index) => {
                    if (y > 250) {
                        doc.addPage();
                        y = 20;
                    }
                    
                    const tipoInfo = this.obtenerInfoTipoSancion(sancion.tipo_sancion);
                    const anio = sancion.fecha_desde ? new Date(sancion.fecha_desde).getFullYear() : '';
                    
                    // Determinar duración según tipo de sanción
                    let duracionTexto = 'N/A';
                    switch(sancion.tipo_sancion) {
                        case 'suspension':
                            duracionTexto = sancion.dias_sancion ? `${sancion.dias_sancion} días` : 'N/A';
                            break;
                        case 'renuncia':
                            duracionTexto = 'Indefinido';
                            break;
                        case 'separacion':
                            duracionTexto = '1 año';
                            break;
                        case 'expulsion':
                            duracionTexto = '2 años';
                            break;
                    }
                    
                    // Barra roja lateral
                    doc.setFillColor(196, 30, 58);
                    doc.rect(20, y, 3, 40, 'F');
                    
                    // Contenido de la sanción
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${index + 1}. ${tipoInfo.nombre} (${anio})`, 28, y + 6);
                    
                    y += 10;
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    
                    // Desde y Hasta
                    let detalles = `Desde: ${Utils.formatearFecha(sancion.fecha_desde)}`;
                    if (sancion.fecha_hasta) {
                        detalles += ` | Hasta: ${Utils.formatearFecha(sancion.fecha_hasta)}`;
                    } else {
                        detalles += ' | Estado: Indefinida';
                    }
                    doc.text(detalles, 28, y);
                    
                    y += 6;
                    doc.text(`Oficio N°: ${sancion.oficio_numero}`, 28, y);
                    
                    y += 6;
                    doc.text(`Duración: ${duracionTexto}`, 28, y);
                    
                    // Solo mostrar Compañía si existe
                    if (sancion.compania_autoridad) {
                        y += 6;
                        doc.text(`Compañía: ${sancion.compania_autoridad}`, 28, y);
                    }
                    
                    // Solo mostrar Autoridad si existe
                    if (sancion.autoridad_sancionatoria) {
                        y += 6;
                        doc.text(`Autoridad: ${sancion.autoridad_sancionatoria}`, 28, y);
                    }
                    
                    y += 6;
                    
                    // Observación (motivo)
                    const motivoLines = doc.splitTextToSize(`Obs: ${sancion.motivo}`, 160);
                    doc.text(motivoLines, 28, y);
                    
                    y += (motivoLines.length * 5) + 15;
                });
            }
            
            // ==================== FOOTER ====================
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.setFont('helvetica', 'italic');
                
                const footerText = 'Este certificado acredita las sanciones disciplinarias registradas del voluntario\nen el Cuerpo de Bomberos.';
                const footerLines = footerText.split('\n');
                
                let footerY = doc.internal.pageSize.getHeight() - 20;
                footerLines.forEach(line => {
                    doc.text(line, pageWidth / 2, footerY, { align: 'center' });
                    footerY += 4;
                });
                
                // Número de página
                doc.text(`Página ${i}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
            }
            
            // Guardar PDF
            const nombreArchivo = `Certificado_Sanciones_${this.bomberoActual.claveBombero}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(nombreArchivo);
            
            Utils.mostrarNotificacion('Certificado PDF generado exitosamente', 'success');
            
        } catch (error) {
            console.error('Error al generar PDF:', error);
            Utils.mostrarNotificacion('Error al generar PDF. Asegúrate de que jsPDF esté cargado.', 'error');
        }
    }

    async exportarExcel() {
        if (!this.bomberoActual) {
            Utils.mostrarNotificacion('No hay voluntario cargado', 'error');
            return;
        }

        // Validar que sanciones sea un array
        if (!Array.isArray(this.sanciones)) {
            console.error('[EXCEL] this.sanciones NO es un array:', this.sanciones);
            Utils.mostrarNotificacion('Error: Datos de sanciones inválidos', 'error');
            return;
        }

        if (this.sanciones.length === 0) {
            Utils.mostrarNotificacion('No hay sanciones para exportar', 'warning');
            return;
        }

        try {
            // Preparar datos
            const datos = this.sanciones.map((sancion, index) => {
                const tipoInfo = this.obtenerInfoTipoSancion(sancion.tipo_sancion);
                
                // Determinar duración según tipo de sanción
                let duracion = 'N/A';
                switch(sancion.tipo_sancion) {
                    case 'suspension':
                        duracion = sancion.dias_sancion ? `${sancion.dias_sancion} días` : 'N/A';
                        break;
                    case 'renuncia':
                        duracion = 'Indefinido';
                        break;
                    case 'separacion':
                        duracion = '1 año';
                        break;
                    case 'expulsion':
                        duracion = '2 años';
                        break;
                }
                
                return {
                    '#': index + 1,
                    'Tipo': tipoInfo.nombre,
                    'Fecha Inicio': Utils.formatearFecha(sancion.fecha_desde),
                    'Fecha Término': sancion.fecha_hasta ? Utils.formatearFecha(sancion.fecha_hasta) : 'Indefinida',
                    'Duración': duracion,
                    'Oficio N°': sancion.oficio_numero,
                    'Compañía': sancion.compania_autoridad || '',
                    'Autoridad': sancion.autoridad_sancionatoria || '',
                    'Motivo': sancion.motivo
                };
            });

            // Crear hoja de cálculo
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(datos);
            
            // Ajustar anchos de columna
            ws['!cols'] = [
                { wch: 5 },  // #
                { wch: 15 }, // Tipo
                { wch: 15 }, // Fecha Inicio
                { wch: 15 }, // Fecha Término
                { wch: 12 }, // Duración
                { wch: 15 }, // Oficio N°
                { wch: 25 }, // Compañía
                { wch: 20 }, // Autoridad
                { wch: 50 }  // Motivo
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'Sanciones');
            
            // Guardar archivo
            const nombreArchivo = `Sanciones_${this.bomberoActual.claveBombero}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, nombreArchivo);
            
            Utils.mostrarNotificacion('Excel exportado exitosamente', 'success');
            
        } catch (error) {
            console.error('Error al exportar Excel:', error);
            Utils.mostrarNotificacion('Error al exportar Excel. Asegúrate de que SheetJS esté cargado.', 'error');
        }
    }

    volverAlSistema() {
        window.location.href = '/sistema.html';
    }
}

// Inicializar sistema cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.sancionesSistema = new SistemaSanciones();
});
