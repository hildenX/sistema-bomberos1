// ==================== SISTEMA DE UNIFORMES - DJANGO ====================
console.log('👔 [UNIFORMES] uniformes-django.js v7.7 - Tabla HTML + API Django');

class SistemaUniformesDjango {
    constructor() {
        this.bomberoActual = null;
        this.uniformes = [];
        this.entregas = [];
        this.tipoSeleccionado = null;
        this.init();
    }

    async init() {
        console.log('[UNIFORMES] Iniciando sistema...');
        console.log('[UNIFORMES] URL actual:', window.location.href);
        console.log('[UNIFORMES] Search params:', window.location.search);
        
        if (!await checkAuth()) {
            window.location.href = '/';
            return;
        }

        // Cargar datos del voluntario actual (desde URL)
        const urlParams = new URLSearchParams(window.location.search);
        const voluntarioId = urlParams.get('id');
        
        console.log('[UNIFORMES] Voluntario ID desde URL:', voluntarioId);
        
        if (voluntarioId) {
            await this.cargarVoluntario(voluntarioId);
        } else {
            console.error('[UNIFORMES] ❌ No hay ID en la URL!');
            Utils.mostrarNotificacion('No se especificó un voluntario', 'error');
            setTimeout(() => window.location.href = '/sistema.html', 2000);
            return;
        }

        // Configurar visibilidad según rol
        await this.configurarVisibilidadPorRol();
        
        // Cargar uniformes
        await this.cargarUniformesDisponibles();
        await this.cargarUniformesVoluntario();
        
        this.renderizarEntregas();
        
        console.log('[UNIFORMES] ✅ Sistema inicializado');
    }

    async cargarVoluntario(id) {
        try {
            const response = await fetch(`/api/voluntarios/${id}/`, {
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error('Voluntario no encontrado');
            
            this.bomberoActual = await response.json();
            this.renderizarInfoVoluntario();
            
            console.log('[UNIFORMES] ✅ Voluntario cargado:', this.bomberoActual.claveBombero, '-', this.bomberoActual.nombreCompleto);
        } catch (error) {
            console.error('[UNIFORMES] Error:', error);
            Utils.mostrarNotificacion('Error al cargar voluntario', 'error');
        }
    }

    renderizarInfoVoluntario() {
        if (!this.bomberoActual) return;
        
        // ⭐ LA API USA CAMELCASE (JavaScript), NO SNAKE_CASE (Python)
        
        // Usar nombreCompleto del serializer si está disponible, sino construirlo
        const nombreCompleto = this.bomberoActual.nombreCompleto || 
                              `${this.bomberoActual.primerNombre || ''} ${this.bomberoActual.segundoNombre || ''} ${this.bomberoActual.tercerNombre || ''} ${this.bomberoActual.primerApellido || ''} ${this.bomberoActual.segundoApellido || ''}`.replace(/\s+/g, ' ').trim();
        
        const claveBombero = this.bomberoActual.claveBombero || 'N/A';
        const rut = this.bomberoActual.rut || 'N/A';
        
        // Estado con checkmark ☑
        const estado = this.bomberoActual.estadoBombero || 'activo';
        const estadoBadge = estado === 'activo' 
            ? '<span style="color: #4caf50;">☑ Activo</span>'
            : `<span style="color: #f44336;">✗ ${estado.charAt(0).toUpperCase() + estado.slice(1)}</span>`;
        
        // Formatear antigüedad - viene como objeto {años, meses, dias}
        let antiguedad = 'N/A';
        if (this.bomberoActual.antiguedad && typeof this.bomberoActual.antiguedad === 'object') {
            const a = this.bomberoActual.antiguedad;
            antiguedad = `${a.años || 0} años, ${a.meses || 0} meses`;
        } else if (this.bomberoActual.fechaIngreso) {
            antiguedad = this.calcularAntiguedad(this.bomberoActual.fechaIngreso);
        }
        
        const container = document.getElementById('bomberoDatosUniformes');
        if (container) {
            container.innerHTML = `
                <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #2196f3; margin: 0 0 15px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.3rem;">👤</span> Información del Bombero
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 10px;">
                        <div>
                            <span style="color: #2196f3; font-weight: 500;">Nombre Completo:</span>
                            <span style="color: #333; margin-left: 5px;">${nombreCompleto}</span>
                        </div>
                        <div>
                            <span style="color: #2196f3; font-weight: 500;">Clave Bombero:</span>
                            <span style="color: #333; margin-left: 5px;">${claveBombero}</span>
                        </div>
                        <div>
                            <span style="color: #2196f3; font-weight: 500;">RUN:</span>
                            <span style="color: #333; margin-left: 5px;">${rut}</span>
                        </div>
                        <div>
                            <span style="color: #2196f3; font-weight: 500;">Compañía:</span>
                            <span style="color: #333; margin-left: 5px;">Sexta Compañía De Bomberos de Puerto Montt</span>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                        <div>
                            <span style="color: #2196f3; font-weight: 500;">Estado:</span>
                            <span style="margin-left: 5px;">${estadoBadge}</span>
                        </div>
                        <div>
                            <span style="color: #2196f3; font-weight: 500;">Antigüedad:</span>
                            <span style="color: #333; margin-left: 5px;">${antiguedad}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Verificar si puede recibir uniformes
        this.validarEstadoVoluntario();
    }
    
    validarEstadoVoluntario() {
        const estadosBloqueados = ['renunciado', 'expulsado', 'fallecido'];
        const estado = (this.bomberoActual.estadoBombero || 'activo').toLowerCase();
        
        if (estadosBloqueados.includes(estado)) {
            // Deshabilitar selector de tipos
            const tipoSelector = document.querySelector('.tipo-uniforme-selector');
            if (tipoSelector) {
                tipoSelector.style.opacity = '0.5';
                tipoSelector.style.pointerEvents = 'none';
            }
            
            // Mostrar alerta prominente
            const listaUniformes = document.getElementById('listaUniformes');
            if (listaUniformes) {
                listaUniformes.innerHTML = `
                    <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin-top: 20px;">
                        <h3 style="color: #dc2626; margin-top: 0;">⚠️ No se pueden asignar uniformes</h3>
                        <p style="color: #991b1b; margin: 10px 0; font-size: 16px;">
                            Este voluntario tiene estado <strong>${this.bomberoActual.estado.toUpperCase()}</strong> y no puede recibir nuevos uniformes.
                        </p>
                        <p style="color: #666; margin: 0; font-size: 14px;">
                            Solo se puede consultar el historial de uniformes de este voluntario.
                        </p>
                    </div>
                ` + listaUniformes.innerHTML;
            }
            
            // Deshabilitar todas las tarjetas
            document.querySelectorAll('.tipo-uniforme-card').forEach(card => {
                card.style.opacity = '0.5';
                card.style.cursor = 'not-allowed';
                card.onclick = null;
            });
            
            return false;
        }
        
        return true;
    }
    
    calcularAntiguedad(fechaIngreso) {
        if (!fechaIngreso) return 'N/A';
        const inicio = new Date(fechaIngreso);
        const hoy = new Date();
        const diff = hoy - inicio;
        const años = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        const meses = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
        return `${años} años, ${meses} meses`;
    }

    async configurarVisibilidadPorRol() {
        const user = await this.getCurrentUser();
        const rol = user?.rol || '';
        
        console.log('[UNIFORMES] Usuario con rol:', rol);
        console.log('[UNIFORMES] ⭐ TODAS las tarjetas visibles para todos los roles (permisos de registro por implementar)');
        
        // TODO: Implementar permisos de REGISTRO (no visibilidad) por rol
        // Por ahora todas las tarjetas son visibles para todos
        
        /* SISTEMA DE PERMISOS DESHABILITADO - TODAS LAS TARJETAS VISIBLES
        const cardsBasicas = ['cardEstructural', 'cardForestal', 'cardRescate', 'cardHazmat'];
        
        if (rol === 'Tesorero') {
            // Solo ve Accesorios y Tenida
            cardsBasicas.forEach(id => {
                const card = document.getElementById(id);
                if (card) card.style.display = 'none';
            });
            const cardAccesorios = document.getElementById('cardAccesorios');
            const cardTenida = document.getElementById('cardTenida');
            if (cardAccesorios) cardAccesorios.style.display = 'block';
            if (cardTenida) cardTenida.style.display = 'block';
        }
        else if (rol === 'Director') {
            // Solo ve Parada
            cardsBasicas.forEach(id => {
                const card = document.getElementById(id);
                if (card) card.style.display = 'none';
            });
            const cardParada = document.getElementById('cardParada');
            if (cardParada) cardParada.style.display = 'block';
        }
        else if (rol === 'Capitán' || rol === 'Ayudante') {
            // Ve básicas + especialidades
            const cardUsar = document.getElementById('cardUsar');
            const cardAgreste = document.getElementById('cardAgreste');
            const cardUm6 = document.getElementById('cardUm6');
            const cardGersa = document.getElementById('cardGersa');
            if (cardUsar) cardUsar.style.display = 'block';
            if (cardAgreste) cardAgreste.style.display = 'block';
            if (cardUm6) cardUm6.style.display = 'block';
            if (cardGersa) cardGersa.style.display = 'block';
        }
        */
    }

    async getCurrentUser() {
        try {
            const response = await fetch('/api/auth/check/', {
                credentials: 'include'
            });
            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('[UNIFORMES] Error obteniendo usuario:', error);
            return null;
        }
    }

    async cargarUniformesDisponibles() {
        try {
            const response = await fetch('/api/uniformes/', {
                credentials: 'include'
            });
            const data = await response.json();
            this.uniformes = Array.isArray(data) ? data : (data.results || []);
            
            console.log('[UNIFORMES] Uniformes disponibles cargados:', this.uniformes.length);
        } catch (error) {
            console.error('[UNIFORMES] Error cargando uniformes:', error);
            this.uniformes = [];
        }
    }

    async cargarUniformesVoluntario() {
        if (!this.bomberoActual) return;
        
        try {
            const response = await fetch(`/api/uniformes/por_voluntario/?voluntario_id=${this.bomberoActual.id}`, {
                credentials: 'include'
            });
            const data = await response.json();
            this.entregas = Array.isArray(data) ? data : (data.results || []);
            
            console.log('[UNIFORMES] Uniformes del voluntario cargados:', this.entregas.length);
        } catch (error) {
            console.error('[UNIFORMES] Error cargando uniformes:', error);
            this.entregas = [];
        }
    }

    seleccionarTipo(tipo) {
        console.log('[UNIFORMES] Tipo seleccionado:', tipo);
        this.tipoSeleccionado = tipo;
        this.mostrarFormulario(tipo);
    }

    mostrarFormulario(tipo) {
        const formulario = document.getElementById('formularioUniforme');
        
        // Mapeo de tipos a info
        const tipoInfo = {
            'estructural': { nombre: 'Estructural', icono: '🧯', color: '#ff9800', articulos: ['Jardinera', 'Chaqueta', 'Casco'] },
            'forestal': { nombre: 'Forestal', icono: '🌲', color: '#4caf50', articulos: ['Jardinera', 'Chaqueta', 'Casco'] },
            'rescate': { nombre: 'Rescate', icono: '🚑', color: '#f44336', articulos: ['Jardinera', 'Chaqueta', 'Casco'] },
            'hazmat': { nombre: 'Hazmat', icono: '☣️', color: '#ff5722', articulos: ['Casaca', 'Pantalón', 'Botas', 'Casco'] },
            'tenidaCuartel': { nombre: 'Tenida de Cuartel', icono: '🏠', color: '#2196f3', articulos: ['Polera', 'Polerón', 'Casaca', 'Pantalón'] },
            'accesorios': { nombre: 'Accesorios', icono: '🎒', color: '#9c27b0', articulos: ['Radio', 'Cargador', 'Batería', 'Linterna'] },
            'parada': { nombre: 'Parada', icono: '🎖️', color: '#673ab7', articulos: ['Casaca', 'Pantalón', 'Cinturón'] },
            'usar': { nombre: 'USAR', icono: '🚨', color: '#ff5722', articulos: ['EPP Multi Rol', 'Botas', 'Casco'] },
            'agreste': { nombre: 'AGRESTE', icono: '🌾', color: '#8bc34a', articulos: ['Mat. Peligrosos', 'Botas', 'Casco'] },
            'um6': { nombre: 'UM-6', icono: '⚓', color: '#0096c7', articulos: ['Traje Marítimo', 'Chaleco Flotante'] },
            'gersa': { nombre: 'GERSA', icono: '🤿', color: '#00bcd4', articulos: ['Traje de Buceo', 'Aletas', 'Compensador'] }
        };
        
        const info = tipoInfo[tipo] || { nombre: tipo, icono: '👔', color: '#666', articulos: ['Artículo'] };
        
        this.articulosActuales = [];
        this.contadorArticulos = 0;
        
        let html = `
            <div style="border-left: 4px solid ${info.color}; padding-left: 20px; margin-bottom: 30px;">
                <h3 style="color: ${info.color}; margin: 0;">${info.icono} Registrar Entrega - ${info.nombre}</h3>
            </div>
            
            <button type="button" class="btn btn-secondary" onclick="sistemaUniformes.cancelarFormulario()" style="margin-bottom: 20px;">
                ← VOLVER A TIPOS
            </button>
            
            <div id="articulosContainer"></div>
            
            <button type="button" class="btn" onclick="sistemaUniformes.agregarArticulo('${tipo}')" style="background: #4caf50; color: white; margin: 20px 0;">
                ➕ AGREGAR OTRO ARTÍCULO
            </button>
            
            <div class="form-section" style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                <h4 style="color: #ff9800;">Información de Entrega</h4>
                <div class="form-group">
                    <label>Fecha de Entrega *</label>
                    <input type="date" id="fechaEntrega" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                <div class="form-group">
                    <label>Observaciones Generales:</label>
                    <textarea id="observacionesEntrega" class="form-input" rows="3" placeholder="Observaciones opcionales..."></textarea>
                </div>
            </div>
            
            <div class="form-buttons" style="margin-top: 30px;">
                <button type="button" class="btn btn-uniforme" onclick="sistemaUniformes.registrarEntregaMultiple()">
                    ✅ REGISTRAR ENTREGA COMPLETA
                </button>
            </div>
        `;
        
        formulario.innerHTML = html;
        formulario.style.display = 'block';
        
        // Agregar primer artículo automáticamente
        this.agregarArticulo(tipo);
        
        // Scroll al formulario
        formulario.scrollIntoView({ behavior: 'smooth' });
    }
    
    agregarArticulo(tipo) {
        this.contadorArticulos++;
        const articuloId = `articulo${this.contadorArticulos}`;
        const cantidadArticulos = document.querySelectorAll('.articulo-item').length + 1;
        
        // Obtener opciones específicas del tipo
        const opcionesComponente = this.obtenerOpcionesComponente(tipo);
        const incluyeTalla = tipo !== 'accesorios';
        
        const html = `
            <div class="articulo-item" id="${articuloId}" style="background: white; border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 20px; position: relative;">
                <button type="button" class="btn-eliminar-articulo" onclick="sistemaUniformes.eliminarArticulo('${articuloId}')" 
                        style="position: absolute; top: 10px; right: 10px; background: #f44336; color: white; border: none; border-radius: 5px; padding: 8px 15px; cursor: pointer;"
                        ${cantidadArticulos === 1 ? 'disabled' : ''}>
                    ❌ ELIMINAR
                </button>
                
                <h4 style="color: #ff9800; margin-bottom: 20px;">🔧 Artículo #${this.contadorArticulos}</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div class="form-group">
                        <label>${tipo === 'accesorios' ? 'Tipo de Accesorio' : 'Artículo'} *</label>
                        <select class="form-input articulo-tipo" required onchange="sistemaUniformes.toggleOtroArticulo('${articuloId}')">
                            <option value="">Seleccione...</option>
                            ${opcionesComponente}
                        </select>
                    </div>
                    
                    <div class="form-group" id="otro_${articuloId}" style="display: none;">
                        <label>Nombre del Artículo *</label>
                        <input type="text" class="form-input articulo-personalizado" placeholder="Nombre personalizado">
                    </div>
                    
                    <div class="form-group">
                        <label>Marca / Modelo</label>
                        <input type="text" class="form-input articulo-marca" placeholder="Ej: Lion, Rosenbauer">
                    </div>
                    
                    <div class="form-group">
                        <label>N° de Serie</label>
                        <input type="text" class="form-input articulo-serie" placeholder="Ej: HAZ-123">
                    </div>
                    
                    ${incluyeTalla ? `
                    <div class="form-group">
                        <label>Talla</label>
                        <input type="text" class="form-input articulo-talla" placeholder="Ej: M, L, XL">
                    </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label>Condición *</label>
                        <select class="form-input articulo-condicion" required>
                            <option value="">Seleccione...</option>
                            <option value="nuevo">🆕 Nuevo</option>
                            <option value="semi-nuevo">🔄 Semi-Nuevo</option>
                            <option value="usado">📦 Usado</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Estado Físico *</label>
                        <select class="form-input articulo-estado" required>
                            <option value="">Seleccione...</option>
                            <option value="bueno">✅ Bueno</option>
                            <option value="regular">⚠️ Regular</option>
                            <option value="malo">❌ Malo</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('articulosContainer').insertAdjacentHTML('beforeend', html);
    }
    
    toggleOtroArticulo(articuloId) {
        const item = document.getElementById(articuloId);
        if (!item) return;
        
        const select = item.querySelector('.articulo-tipo');
        const otroContainer = document.getElementById(`otro_${articuloId}`);
        const otroInput = otroContainer?.querySelector('.articulo-personalizado');
        
        if (select && otroContainer && otroInput) {
            if (select.value === 'otro') {
                otroContainer.style.display = 'block';
                otroInput.required = true;
            } else {
                otroContainer.style.display = 'none';
                otroInput.required = false;
                otroInput.value = '';
            }
        }
    }
    
    obtenerOpcionesComponente(tipo) {
        const opciones = {
            'estructural': `
                <option value="jardinera">Jardinera Estructural</option>
                <option value="chaqueta">Chaqueta Estructural</option>
                <option value="guantes">Guantes Estructurales</option>
                <option value="botas">Botas Estructurales</option>
                <option value="casco">Casco Estructural</option>
                <option value="esclavina">Esclavina Estructural</option>
                <option value="otro">Otro</option>
            `,
            'forestal': `
                <option value="jardinera">Jardinera Forestal</option>
                <option value="chaqueta">Chaqueta Forestal</option>
                <option value="guantes">Guantes Forestales</option>
                <option value="botas">Botas Forestales</option>
                <option value="casco">Casco Forestal</option>
                <option value="esclavina">Esclavina Forestal</option>
                <option value="otro">Otro</option>
            `,
            'rescate': `
                <option value="jardinera">Jardinera de Rescate</option>
                <option value="chaqueta">Chaqueta de Rescate</option>
                <option value="guantes">Guantes de Rescate</option>
                <option value="botas">Botas de Rescate</option>
                <option value="casco">Casco de Rescate</option>
                <option value="esclavina">Esclavina de Rescate</option>
                <option value="otro">Otro</option>
            `,
            'hazmat': `
                <option value="casaca_multi_rol">Casaca Multi Rol</option>
                <option value="pantalon_multi_rol">Pantalón Multi Rol</option>
                <option value="botas">Botas</option>
                <option value="casco">Casco Hazmat</option>
                <option value="guantes">Guantes Hazmat</option>
                <option value="esclavina">Esclavina</option>
                <option value="otro">Otro</option>
            `,
            'tenidaCuartel': `
                <option value="polera_institucional_cia">Polera Institucional de Cía.</option>
                <option value="poleron_institucional_cia">Polerón Institucional de Cía.</option>
                <option value="casaca_institucional_cia">Casaca Institucional de Cía.</option>
                <option value="pantalon_institucional_cia">Pantalón Institucional de Cía.</option>
                <option value="otro">Otro</option>
            `,
            'accesorios': `
                <option value="radio_portatil">Radio Portátil</option>
                <option value="cargador">Cargador</option>
                <option value="bateria_adicional">Batería Adicional</option>
                <option value="linterna">Linterna</option>
                <option value="otro">Otro</option>
            `,
            'parada': `
                <option value="casaca">Casaca</option>
                <option value="pantalon_negro">Pantalón Negro</option>
                <option value="pantalon_blanco">Pantalón Blanco</option>
                <option value="cinturon_negro">Cinturón Negro</option>
                <option value="cinturon_blanco">Cinturón Blanco</option>
                <option value="otro">Otro</option>
            `,
            'usar': `
                <option value="casaca_multi_rol">Casaca Multi Rol</option>
                <option value="pantalon_multi_rol">Pantalón Multi Rol</option>
                <option value="botas">Botas</option>
                <option value="casco">Casco USAR</option>
                <option value="guantes">Guantes USAR</option>
                <option value="otro">Otro</option>
            `,
            'agreste': `
                <option value="casaca_multi_rol">Casaca Multi Rol</option>
                <option value="pantalon_multi_rol">Pantalón Multi Rol</option>
                <option value="botas">Botas</option>
                <option value="casco">Casco AGRESTE</option>
                <option value="guantes">Guantes AGRESTE</option>
                <option value="otro">Otro</option>
            `,
            'um6': `
                <option value="casaca_multi_rol">Casaca Multi Rol</option>
                <option value="pantalon_multi_rol">Pantalón Multi Rol</option>
                <option value="botas">Botas</option>
                <option value="casco">Casco UM-6</option>
                <option value="guantes">Guantes UM-6</option>
                <option value="chaleco_salvavidas">Chaleco Salvavidas</option>
                <option value="otro">Otro</option>
            `,
            'gersa': `
                <option value="traje_buceo">Traje de Buceo</option>
                <option value="aletas">Aletas</option>
                <option value="mascara">Máscara</option>
                <option value="regulador">Regulador</option>
                <option value="tanque_oxigeno">Tanque de Oxígeno</option>
                <option value="chaleco_compensador">Chaleco Compensador</option>
                <option value="otro">Otro</option>
            `
        };
        
        return opciones[tipo] || '';
    }
    
    eliminarArticulo(articuloId) {
        const articulo = document.getElementById(articuloId);
        if (articulo) {
            articulo.remove();
        }
    }

    async registrarEntregaMultiple() {
        const fechaEntrega = document.getElementById('fechaEntrega')?.value;
        const observacionesGenerales = document.getElementById('observacionesEntrega')?.value;
        
        if (!fechaEntrega) {
            Utils.mostrarNotificacion('Debe especificar la fecha de entrega', 'error');
            return;
        }
        
        // Recopilar todos los artículos
        const articulosItems = document.querySelectorAll('.articulo-item');
        
        if (articulosItems.length === 0) {
            Utils.mostrarNotificacion('Debe agregar al menos un artículo', 'error');
            return;
        }
        
        const piezas = [];
        
        for (const item of articulosItems) {
            let componente = item.querySelector('.articulo-tipo')?.value;
            let nombrePersonalizado = null;
            
            // Si es "otro", usar el nombre personalizado
            if (componente === 'otro') {
                nombrePersonalizado = item.querySelector('.articulo-personalizado')?.value;
                if (!nombrePersonalizado) {
                    Utils.mostrarNotificacion('Debe especificar el nombre del artículo personalizado', 'error');
                    return;
                }
                componente = nombrePersonalizado.toLowerCase().replace(/ /g, '_');
            }
            
            const marca = item.querySelector('.articulo-marca')?.value || '';
            const serie = item.querySelector('.articulo-serie')?.value || '';
            const talla = item.querySelector('.articulo-talla')?.value || '';
            const condicion = item.querySelector('.articulo-condicion')?.value;
            const estado_fisico = item.querySelector('.articulo-estado')?.value;
            
            if (!componente || !condicion || !estado_fisico) {
                Utils.mostrarNotificacion('Complete todos los campos obligatorios (*) de cada artículo', 'error');
                return;
            }
            
            const piezaData = {
                componente: componente,
                marca: marca,
                serie: serie,
                talla: talla,
                condicion: condicion,
                estado_fisico: estado_fisico,
                fecha_entrega: fechaEntrega
            };
            
            // Agregar nombre personalizado si existe
            if (nombrePersonalizado) {
                piezaData.nombre_personalizado = nombrePersonalizado;
            }
            
            piezas.push(piezaData);
        }
        
        const payload = {
            tipo_uniforme: this.tipoSeleccionado,
            bombero_id: this.bomberoActual.id,
            observaciones: observacionesGenerales || '',
            piezas: piezas
        };
        
        console.log('═══════════════════════════════════════════════');
        console.log('📤 ENVIANDO AL BACKEND:');
        console.log('═══════════════════════════════════════════════');
        console.log('Payload completo:', payload);
        console.log('Tipo:', this.tipoSeleccionado);
        console.log('Voluntario ID:', this.bomberoActual.id);
        console.log('Piezas:', piezas);
        console.log('═══════════════════════════════════════════════');
        
        try {
            const response = await fetch('/api/uniformes/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            
            console.log('[UNIFORMES] Response status:', response.status);
            
            if (!response.ok) {
                // Leer el body UNA SOLA VEZ
                const contentType = response.headers.get('content-type');
                let errorMessage = 'Error al registrar entrega';
                
                if (contentType && contentType.includes('application/json')) {
                    // Es JSON
                    const error = await response.json();
                    console.error('[UNIFORMES] ❌ Error del servidor (JSON):', error);
                    errorMessage = error.detail || error.message || JSON.stringify(error);
                } else {
                    // Es HTML (página de error de Django)
                    const htmlError = await response.text();
                    console.error('[UNIFORMES] ❌ Error del servidor (HTML):', htmlError.substring(0, 1000));
                    console.error('[UNIFORMES] ❌ REVISA EL TERMINAL DE DJANGO para ver el traceback completo');
                    errorMessage = `Error ${response.status}: Revisa la consola del navegador y el terminal de Django`;
                }
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log('[UNIFORMES] Uniforme creado:', data);
            
            Utils.mostrarNotificacion(`Uniforme ${data.id} registrado con ${piezas.length} pieza(s)`, 'success');
            
            // Recargar datos
            await this.cargarUniformesVoluntario();
            this.renderizarEntregas();
            this.cancelarFormulario();
            
        } catch (error) {
            console.error('[UNIFORMES] Error:', error);
            Utils.mostrarNotificacion(error.message, 'error');
        }
    }

    renderizarEntregas() {
        const container = document.getElementById('contenedorPrincipalUniformes');
        if (!container) return;
        
        if (!this.paginaActualEntregas) this.paginaActualEntregas = 1;
        if (!this.paginaActualDevoluciones) this.paginaActualDevoluciones = 1;
        if (this.mostrarEntregas === undefined) this.mostrarEntregas = true;
        if (this.mostrarDevoluciones === undefined) this.mostrarDevoluciones = false;
        
        const uniformesActivos = this.entregas.filter(u => u.estado === 'activo');
        
        let html = `
            <!-- BOTONES DE NAVEGACIÓN -->
            <div style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border-radius: 12px; padding: 20px 30px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap;">
                <button onclick="sistemaUniformes.imprimirTabla()" 
                        style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 1em;">
                    📄 Imprimir Tabla
                </button>
                
                <div style="display: flex; gap: 15px;">
                    <button onclick="sistemaUniformes.toggleSeccion('entregas')" 
                            style="background: ${this.mostrarEntregas ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' : '#e0e0e0'}; color: ${this.mostrarEntregas ? 'white' : '#666'}; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 1em;">
                        👔 Uniformes Asignados (${uniformesActivos.length})
                    </button>
                    
                    <button onclick="sistemaUniformes.toggleSeccion('devoluciones')" 
                            style="background: ${this.mostrarDevoluciones ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' : '#e0e0e0'}; color: ${this.mostrarDevoluciones ? 'white' : '#666'}; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 1em;">
                        📋 Historial Devoluciones
                    </button>
                </div>
            </div>
        `;
        
        // SECCIÓN 1: UNIFORMES ASIGNADOS (Colapsable)
        if (this.mostrarEntregas) {
            html += `
                <section style="margin-bottom: 40px; animation: fadeIn 0.3s;">
                    <div style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border-radius: 12px; padding: 30px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); border: 1px solid #e0e0e0;">
                        <div style="border-left: 5px solid #2196F3; padding-left: 20px; margin-bottom: 25px;">
                            <h3 style="color: #1976D2; margin: 0 0 10px 0; font-size: 1.5em; display: flex; align-items: center; gap: 10px;">
                                👔 Uniformes Asignados al Voluntario
                            </h3>
                            <p style="color: #666; margin: 0; font-size: 1em;">
                                Total de entregas registradas: <strong style="color: #2196F3; font-size: 1.2em;">${uniformesActivos.length}</strong>
                            </p>
                        </div>
                        <div id="contenedorEntregas"></div>
                    </div>
                </section>
            `;
        }
        
        // SECCIÓN 2: HISTORIAL DE DEVOLUCIONES (Colapsable)
        if (this.mostrarDevoluciones) {
            html += `
                <section style="margin-bottom: 40px; animation: fadeIn 0.3s;">
                    <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border-radius: 12px; padding: 30px; box-shadow: 0 4px 16px rgba(255, 152, 0, 0.15); border: 1px solid #ffe0b2;">
                        <div style="border-left: 5px solid #ff9800; padding-left: 20px; margin-bottom: 25px;">
                            <h3 style="color: #e65100; margin: 0 0 10px 0; font-size: 1.5em; display: flex; align-items: center; gap: 10px;">
                                📋 Historial de Devoluciones
                            </h3>
                            <p style="color: #666; margin: 0; font-size: 0.95em;">
                                Registro completo de artículos devueltos por el voluntario
                            </p>
                        </div>
                        <div id="contenedorDevoluciones"></div>
                    </div>
                </section>
            `;
        }
        
        container.innerHTML = html;
        
        // Renderizar contenido según qué esté visible
        if (this.mostrarEntregas) {
            this.renderizarPaginacionEntregas(uniformesActivos);
        }
        
        if (this.mostrarDevoluciones) {
            this.renderizarHistorialDevoluciones(this.entregas);
        }
    }
    
    toggleSeccion(seccion) {
        if (seccion === 'entregas') {
            this.mostrarEntregas = true;
            this.mostrarDevoluciones = false;
        } else if (seccion === 'devoluciones') {
            this.mostrarEntregas = false;
            this.mostrarDevoluciones = true;
        }
        this.renderizarEntregas();
    }
    
    renderizarPaginacionEntregas(uniformes) {
        const contenedor = document.getElementById('contenedorEntregas');
        const itemsPorPagina = 5;
        const totalPaginas = Math.ceil(uniformes.length / itemsPorPagina);
        const inicio = (this.paginaActualEntregas - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        const uniformesPagina = uniformes.slice(inicio, fin);
        
        let html = uniformesPagina.map(uniforme => {
            const piezasActivas = (uniforme.piezas || []).filter(p => p.estado_pieza === 'activo');
            if (piezasActivas.length === 0) return '';
            
            const fechaRegistro = new Date(uniforme.fecha_registro).toLocaleDateString('es-CL');
            const tipoNombre = this.obtenerNombreTipo(uniforme.tipo_uniforme);
            
            let tablaPiezas = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; box-shadow: 0 1px 3px rgba(0,0,0,0.1); background: white;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white;">
                            <th style="padding: 12px 8px;">Artículo</th>
                            <th style="padding: 12px 8px;">Marca</th>
                            <th style="padding: 12px 8px;">Serie</th>
                            <th style="padding: 12px 8px;">Talla</th>
                            <th style="padding: 12px 8px;">Condición</th>
                            <th style="padding: 12px 8px;">Estado</th>
                            <th style="padding: 12px 8px;">F.Entrega</th>
                            <th style="padding: 12px 8px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>`;
            
            piezasActivas.forEach(pieza => {
                const nombrePieza = pieza.nombre_personalizado || this.formatearNombreComponente(pieza.componente);
                const fechaEntrega = pieza.fecha_entrega ? new Date(pieza.fecha_entrega).toLocaleDateString('es-CL') : '-';
                
                tablaPiezas += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px;">${nombrePieza}</td>
                        <td style="padding: 8px; text-align: center;">${pieza.marca || 'N/A'}</td>
                        <td style="padding: 8px; text-align: center;">${pieza.serie || 'N/A'}</td>
                        <td style="padding: 8px; text-align: center;">${pieza.talla || 'N/A'}</td>
                        <td style="padding: 8px; text-align: center;">${this.formatearCondicion(pieza.condicion)}</td>
                        <td style="padding: 8px; text-align: center;">
                            <select onchange="sistemaUniformes.actualizarEstado('${uniforme.id}', ${pieza.id}, this.value)" 
                                    style="padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85em;">
                                <option value="bueno" ${pieza.estado_fisico === 'bueno' ? 'selected' : ''}>✅ Bueno</option>
                                <option value="regular" ${pieza.estado_fisico === 'regular' ? 'selected' : ''}>⚠️ Regular</option>
                                <option value="malo" ${pieza.estado_fisico === 'malo' ? 'selected' : ''}>❌ Malo</option>
                            </select>
                        </td>
                        <td style="padding: 8px; text-align: center;">${fechaEntrega}</td>
                        <td style="padding: 8px; text-align: center;">
                            <button class="btn btn-danger btn-sm" onclick="sistemaUniformes.mostrarModalDevolucion('${uniforme.id}', ${pieza.id}, '${nombrePieza}')" 
                                    style="font-size: 0.8em; padding: 4px 8px;">
                                📤
                            </button>
                        </td>
                    </tr>`;
            });
            
            tablaPiezas += `</tbody></table>`;
            
            return `
                <div class="uniforme-card" style="margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <h4 style="margin: 0;">${tipoNombre} - ID: ${uniforme.id}</h4>
                        <button class="btn btn-pdf btn-sm" onclick="sistemaUniformes.generarPDF('${uniforme.id}')"
                                style="background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                            📄 PDF
                        </button>
                    </div>
                    ${tablaPiezas}
                    ${uniforme.observaciones ? `<p style="margin-top: 10px; font-size: 0.9em;"><strong>Observaciones:</strong> ${uniforme.observaciones}</p>` : ''}
                    <p style="font-size: 0.85em; color: #666; margin-top: 10px; margin-bottom: 0;">Registrado el ${fechaRegistro}</p>
                </div>
            `;
        }).join('');
        
        // Paginación
        if (totalPaginas > 1) {
            html += `<div style="margin-top: 25px; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">`;
            for (let i = 1; i <= totalPaginas; i++) {
                const active = i === this.paginaActualEntregas;
                const bgColor = active ? 'background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; transform: scale(1.1);' : 'background: white; color: #333;';
                html += `
                    <button onclick="sistemaUniformes.cambiarPaginaEntregas(${i})" 
                            style="${bgColor} border: 2px solid ${active ? '#1976D2' : '#e0e0e0'}; padding: 10px 16px; margin: 0 4px; border-radius: 8px; cursor: pointer; font-weight: 600; min-width: 44px; transition: all 0.3s; box-shadow: ${active ? '0 4px 8px rgba(33,150,243,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'};"
                            onmouseover="if(${!active}) this.style.borderColor='#2196F3'; if(${!active}) this.style.transform='translateY(-2px)';"
                            onmouseout="if(${!active}) this.style.borderColor='#e0e0e0'; if(${!active}) this.style.transform='translateY(0)';">
                        ${i}
                    </button>`;
            }
            html += `</div>`;
        }
        
        contenedor.innerHTML = html || '<p style="text-align: center; color: #999;">No hay uniformes asignados</p>';
    }
    
    cambiarPaginaEntregas(pagina) {
        this.paginaActualEntregas = pagina;
        const uniformesActivos = this.entregas.filter(u => u.estado === 'activo');
        this.renderizarPaginacionEntregas(uniformesActivos);
    }
    
    cambiarPaginaDevoluciones(pagina) {
        this.paginaActualDevoluciones = pagina;
        this.renderizarHistorialDevoluciones(this.entregas);
    }
    
    renderizarHistorialDevoluciones(todosUniformes) {
        const contenedor = document.getElementById('contenedorDevoluciones');
        if (!contenedor) return;
        
        // Recopilar TODAS las piezas devueltas
        const todasPiezasDevueltas = [];
        
        todosUniformes.forEach(uniforme => {
            if (!uniforme.piezas) return;
            
            uniforme.piezas.forEach(pieza => {
                if (pieza.estado_pieza === 'devuelto' && pieza.fecha_devolucion) {
                    todasPiezasDevueltas.push({
                        ...pieza,
                        uniformeId: uniforme.id,
                        tipoUniforme: this.obtenerNombreTipo(uniforme.tipo_uniforme)
                    });
                }
            });
        });
        
        // Si no hay devoluciones
        if (todasPiezasDevueltas.length === 0) {
            contenedor.innerHTML = `
                <h3 style="color: #e65100; margin-top: 0; margin-bottom: 15px;">📋 Historial de Devoluciones</h3>
                <p style="color: #999; text-align: center; padding: 40px;">No hay artículos devueltos registrados</p>
            `;
            return;
        }
        
        // Ordenar por fecha de devolución (más reciente primero)
        todasPiezasDevueltas.sort((a, b) => new Date(b.fecha_devolucion) - new Date(a.fecha_devolucion));
        
        // Paginación
        const itemsPorPagina = 5;
        const totalPaginas = Math.ceil(todasPiezasDevueltas.length / itemsPorPagina);
        const inicio = (this.paginaActualDevoluciones - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        const piezasPagina = todasPiezasDevueltas.slice(inicio, fin);
        
        let html = `
            <div style="background: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                <p style="font-size: 1em; color: #555; margin: 0; display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 600; color: #e65100;">Total de artículos devueltos:</span>
                    <span style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 1.1em;">
                        ${todasPiezasDevueltas.length}
                    </span>
                </p>
            </div>
            
            <div style="overflow-x: auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #ff6f00 0%, #ff8f00 100%); color: white;">
                            <th style="padding: 14px 10px; text-align: left; font-weight: 600; border-bottom: 3px solid #e65100;">Uniforme</th>
                            <th style="padding: 14px 10px; text-align: left; font-weight: 600; border-bottom: 3px solid #e65100;">Artículo</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">Marca</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">Serie</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">Talla</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">F. Dev.</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">Estado</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">Condición</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">Devuelto por</th>
                            <th style="padding: 14px 10px; text-align: center; font-weight: 600; border-bottom: 3px solid #e65100;">PDF</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        piezasPagina.forEach((pieza, index) => {
            const nombrePieza = pieza.nombre_personalizado || this.formatearNombreComponente(pieza.componente);
            const fechaDevolucion = pieza.fecha_devolucion ? new Date(pieza.fecha_devolucion).toLocaleDateString('es-CL') : '-';
            const estadoDevolucion = this.formatearEstadoDevolucion(pieza.estado_devolucion);
            const condicionDevolucion = this.formatearCondicionDevolucion(pieza.condicion_devolucion);
            const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
            
            html += `
                <tr style="border-bottom: 1px solid #ddd; background: ${bgColor};">
                    <td style="padding: 8px; font-size: 0.85em;">
                        <span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; display: inline-block;">
                            ${pieza.tipoUniforme}<br>${pieza.uniformeId}
                        </span>
                    </td>
                    <td style="padding: 8px;">${nombrePieza}</td>
                    <td style="padding: 8px; text-align: center;">${pieza.marca || '-'}</td>
                    <td style="padding: 8px; text-align: center;">${pieza.serie || '-'}</td>
                    <td style="padding: 8px; text-align: center;">${pieza.talla || '-'}</td>
                    <td style="padding: 8px; text-align: center;">${fechaDevolucion}</td>
                    <td style="padding: 8px; text-align: center; font-size: 0.85em;">${estadoDevolucion}</td>
                    <td style="padding: 8px; text-align: center; font-size: 0.85em;">${condicionDevolucion}</td>
                    <td style="padding: 8px; text-align: center;">${pieza.devuelto_por || '-'}</td>
                    <td style="padding: 8px; text-align: center;">
                        <button class="btn btn-pdf btn-sm" onclick="sistemaUniformes.generarPDFDevolucion('${pieza.uniformeId}', ${pieza.id})" 
                                style="background: #ff9800; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                            📄 PDF
                        </button>
                    </td>
                </tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>`;
        
        // Paginación
        if (totalPaginas > 1) {
            html += `<div style="margin-top: 25px; text-align: center; padding: 20px; background: #fff3e0; border-radius: 8px;">`;
            for (let i = 1; i <= totalPaginas; i++) {
                const active = i === this.paginaActualDevoluciones;
                const bgColor = active ? 'background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; transform: scale(1.1);' : 'background: white; color: #333;';
                html += `
                    <button onclick="sistemaUniformes.cambiarPaginaDevoluciones(${i})" 
                            style="${bgColor} border: 2px solid ${active ? '#f57c00' : '#ffe0b2'}; padding: 10px 16px; margin: 0 4px; border-radius: 8px; cursor: pointer; font-weight: 600; min-width: 44px; transition: all 0.3s; box-shadow: ${active ? '0 4px 8px rgba(255,152,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'};"
                            onmouseover="if(${!active}) this.style.borderColor='#ff9800'; if(${!active}) this.style.transform='translateY(-2px)';"
                            onmouseout="if(${!active}) this.style.borderColor='#ffe0b2'; if(${!active}) this.style.transform='translateY(0)';">
                        ${i}
                    </button>`;
            }
            html += `</div>`;
        }
        
        contenedor.innerHTML = html;
    }
    
    formatearEstadoDevolucion(estado) {
        const map = {
            'bueno': '<span style="color: #4caf50; font-weight: bold;">✅ Bueno</span>',
            'regular': '<span style="color: #ff9800; font-weight: bold;">⚠️ Regular</span>',
            'malo': '<span style="color: #f44336; font-weight: bold;">❌ Malo</span>',
            'deteriorado': '<span style="color: #9e9e9e; font-weight: bold;">💔 Deteriorado</span>'
        };
        return map[estado] || estado;
    }
    
    formatearCondicionDevolucion(condicion) {
        const map = {
            'nuevo': '🆕 Como Nuevo',
            'semi-nuevo': '🔄 Semi-Nuevo',
            'usado': '📦 Usado',
            'muy_usado': '📉 Muy Usado'
        };
        return map[condicion] || condicion;
    }
    
    obtenerNombreTipo(tipo) {
        const nombres = {
            'estructural': '🧯 Estructural',
            'forestal': '🌲 Forestal',
            'rescate': '🚑 Rescate',
            'hazmat': '☣️ Hazmat',
            'tenidaCuartel': '🏠 Tenida de Cuartel',
            'accesorios': '🎒 Accesorios',
            'parada': '🎖️ Uniforme de Parada',
            'usar': '🚨 Uniforme USAR',
            'agreste': '🌾 Uniforme AGRESTE',
            'um6': '⚓ Uniforme UM-6',
            'gersa': '🤿 Uniforme GERSA'
        };
        return nombres[tipo] || 'Uniforme';
    }
    
    formatearNombreComponente(componente) {
        // Manejo especial para cinturones
        if (componente === 'cinturon_negro') return 'Cinturón Negro';
        if (componente === 'cinturon_blanco') return 'Cinturón Blanco';
        return componente.replace(/_/g, ' ').split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    
    formatearCondicion(condicion) {
        const map = { 'nuevo': '🆕 Nuevo', 'semi-nuevo': '🔄 Semi-Nuevo', 'usado': '📦 Usado' };
        return map[condicion] || condicion;
    }
    
    async actualizarEstado(uniformeId, piezaId, nuevoEstado) {
        console.log('[UNIFORMES] Actualizando estado pieza:', piezaId, 'de uniforme:', uniformeId, 'a:', nuevoEstado);
        
        try {
            const response = await fetch(`/api/uniformes/${uniformeId}/actualizar_pieza/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                credentials: 'include',
                body: JSON.stringify({
                    pieza_id: piezaId,
                    campo: 'estado_fisico',
                    valor: nuevoEstado
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al actualizar estado');
            }
            
            Utils.mostrarNotificacion('✅ Estado actualizado', 'success');
            await this.cargarUniformesVoluntario();
            this.renderizarEntregas();
            
        } catch (error) {
            console.error('[UNIFORMES] Error:', error);
            Utils.mostrarNotificacion(error.message, 'error');
            // Recargar para restaurar el valor anterior
            await this.cargarUniformesVoluntario();
            this.renderizarEntregas();
        }
    }
    
    mostrarModalDevolucion(uniformeId, piezaId, nombrePieza) {
        const modalHTML = `
            <div class="modal-overlay" id="modalDevolucion" 
                 onclick="if(event.target.id === 'modalDevolucion') document.getElementById('modalDevolucion').remove()"
                 style="
                position: fixed;
                top: 0; left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            ">
                <div class="modal-content" style="
                    background: white;
                    border-radius: 8px;
                    padding: 30px;
                    width: 90%;
                    max-width: 500px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin: 0 0 20px 0; color: #333; border-left: 4px solid #dc3545; padding-left: 12px;">
                        📤 Registrar Devolución
                    </h3>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555;">
                            Artículo:
                        </label>
                        <div style="padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                            ${nombrePieza}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555;">
                            Estado en que se devuelve: <span style="color: red;">*</span>
                        </label>
                        <select id="estadoDevolucion" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #dee2e6;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                            <option value="">Seleccione...</option>
                            <option value="bueno">✅ Bueno</option>
                            <option value="regular">⚠️ Regular</option>
                            <option value="malo">❌ Malo</option>
                            <option value="deteriorado">🔻 Deteriorado</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555;">
                            Condición en que se devuelve: <span style="color: red;">*</span>
                        </label>
                        <select id="condicionDevolucion" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #dee2e6;
                            border-radius: 4px;
                            font-size: 14px;
                        ">
                            <option value="">Seleccione...</option>
                            <option value="nuevo">🆕 Como Nuevo</option>
                            <option value="semi-nuevo">🔄 Semi-Nuevo</option>
                            <option value="usado">📦 Usado</option>
                            <option value="muy_usado">📉 Muy Usado</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555;">
                            Observaciones de devolución:
                        </label>
                        <textarea id="observacionesDevolucion" 
                                  placeholder="Daños, desgaste, etc..." 
                                  rows="4"
                                  style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #dee2e6;
                            border-radius: 4px;
                            font-size: 14px;
                            font-family: inherit;
                            resize: vertical;
                        "></textarea>
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="document.getElementById('modalDevolucion').remove()" 
                                class="btn btn-secondary"
                                style="
                            padding: 12px 24px;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            background: #6c757d;
                            color: white;
                            transition: background 0.2s;
                        "
                        onmouseover="this.style.background='#5a6268'"
                        onmouseout="this.style.background='#6c757d'">
                            ❌ CANCELAR
                        </button>
                        <button onclick="sistemaUniformes.confirmarDevolucion('${uniformeId}', ${piezaId})" 
                                class="btn btn-danger"
                                style="
                            padding: 12px 24px;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            background: #dc3545;
                            color: white;
                            transition: background 0.2s;
                        "
                        onmouseover="this.style.background='#c82333'"
                        onmouseout="this.style.background='#dc3545'">
                            ✅ CONFIRMAR DEVOLUCIÓN
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    async confirmarDevolucion(uniformeId, piezaId) {
        const estado = document.getElementById('estadoDevolucion').value;
        const condicion = document.getElementById('condicionDevolucion').value;
        const observaciones = document.getElementById('observacionesDevolucion').value;
        
        if (!estado || !condicion) {
            Utils.mostrarNotificacion('Complete todos los campos obligatorios (*)', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/uniformes/${uniformeId}/devolver_pieza/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                credentials: 'include',
                body: JSON.stringify({
                    pieza_id: piezaId,
                    estado_devolucion: estado,
                    condicion_devolucion: condicion,
                    observaciones_devolucion: observaciones
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error al devolver pieza');
            }
            
            Utils.mostrarNotificacion('✅ Pieza devuelta exitosamente', 'success');
            
            // Cerrar modal
            document.getElementById('modalDevolucion').remove();
            
            // Recargar datos
            await this.cargarUniformesVoluntario();
            this.renderizarEntregas();
            
        } catch (error) {
            console.error('[UNIFORMES] Error:', error);
            Utils.mostrarNotificacion(error.message, 'error');
        }
    }

    mostrarDevolucion(uniformeId) {
        // Por ahora permite devolver uniforme completo
        if (!confirm('¿Confirmar devolución de TODAS las piezas de este uniforme?')) return;
        
        const uniforme = this.entregas.find(u => u.id === uniformeId);
        if (!uniforme) {
            Utils.mostrarNotificacion('Uniforme no encontrado', 'error');
            return;
        }
        
        // Devolver cada pieza
        const piezasActivas = (uniforme.piezas || []).filter(p => p.estado_pieza === 'activo');
        if (piezasActivas.length === 0) {
            Utils.mostrarNotificacion('No hay piezas activas para devolver', 'error');
            return;
        }
        
        this.devolverTodasPiezas(uniformeId, piezasActivas);
    }
    
    async devolverTodasPiezas(uniformeId, piezas) {
        const estadoDevolucion = prompt('Estado de devolución:\n1=Bueno\n2=Regular\n3=Malo\n4=Deteriorado', '1');
        if (!estadoDevolucion) return;
        
        const estadosMap = {'1': 'bueno', '2': 'regular', '3': 'malo', '4': 'deteriorado'};
        const estado = estadosMap[estadoDevolucion] || 'bueno';
        
        const condicionDevolucion = prompt('Condición:\n1=Como Nuevo\n2=Semi-Nuevo\n3=Usado\n4=Muy Usado', '3');
        if (!condicionDevolucion) return;
        
        const condicionesMap = {'1': 'nuevo', '2': 'semi-nuevo', '3': 'usado', '4': 'muy_usado'};
        const condicion = condicionesMap[condicionDevolucion] || 'usado';
        
        const observaciones = prompt('Observaciones de devolución (opcional):', '');
        
        try {
            for (const pieza of piezas) {
                const response = await fetch(`/api/uniformes/${uniformeId}/devolver_pieza/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        pieza_id: pieza.id,
                        estado_devolucion: estado,
                        condicion_devolucion: condicion,
                        observaciones_devolucion: observaciones
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Error al devolver pieza');
                }
            }
            
            Utils.mostrarNotificacion('Uniforme devuelto exitosamente', 'success');
            
            await this.cargarUniformesVoluntario();
            this.renderizarEntregas();
            
        } catch (error) {
            console.error('[UNIFORMES] Error:', error);
            Utils.mostrarNotificacion(error.message, 'error');
        }
    }

    generarPDF(uniformeId) {
        Utils.mostrarNotificacion('Generando PDF...', 'info');
        window.open(`/api/uniformes/${uniformeId}/generar_pdf/`, '_blank');
        console.log('[UNIFORMES] Generar PDF para uniforme:', uniformeId);
    }
    
    generarPDFDevolucion(uniformeId, piezaId) {
        Utils.mostrarNotificacion('Generando PDF de devolución...', 'info');
        window.open(`/api/uniformes/${uniformeId}/generar_pdf_devolucion/?pieza_id=${piezaId}`, '_blank');
        console.log('[UNIFORMES] Generar PDF devolución para pieza:', piezaId, 'del uniforme:', uniformeId);
    }
    
    imprimirTabla() {
        if (!this.bomberoActual || !this.bomberoActual.id) {
            Utils.mostrarNotificacion('No hay voluntario seleccionado', 'error');
            return;
        }
        
        Utils.mostrarNotificacion('Abriendo tabla de uniformes...', 'info');
        window.open(`/tabla-uniformes-voluntario.html?id=${this.bomberoActual.id}`, '_blank');
        console.log('[UNIFORMES] Abrir tabla para voluntario:', this.bomberoActual.id);
    }

    cancelarFormulario() {
        document.getElementById('formularioUniforme').style.display = 'none';
        this.tipoSeleccionado = null;
    }

    volverAlSistema() {
        window.location.href = '/sistema.html';
    }

    getCSRFToken() {
        return document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1] || '';
    }
}

// Inicializar
let sistemaUniformes;
document.addEventListener('DOMContentLoaded', () => {
    sistemaUniformes = new SistemaUniformesDjango();
});
