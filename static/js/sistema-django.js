// ==================== SISTEMA PRINCIPAL DE BOMBEROS ====================
console.log('🚀 [SISTEMA] Cargando sistema-django.js v4.0');

class SistemaBomberos {
    constructor() {
        console.log('🏗️ [SISTEMA] Constructor iniciado');
        this.bomberos = [];
        this.sancionesActivas = [];
        this.cargosVigentes = {}; // {bomberoId: cargo}
        this.terminoBusqueda = '';
        this.filtroEstado = 'todos'; // Filtro de estado
        this.filtroCompania = 'todas';
        this.paginationBomberos = null;
        this.init();
    }

    aplicarPermisosUI() {
        const userPerms = getUserPermissions();
        const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || 'null');
        const userRole = currentUser?.role || null;

        const formContainer = document.querySelector('.form-container');
        const registrosButtons = document.querySelector('.registros-buttons');

        // Determinar permisos (con fallback por rol)
        let puedeCrear, puedeEditar;

        if (userPerms) {
            puedeCrear = userPerms.voluntarios?.create || false;
            puedeEditar = userPerms.voluntarios?.edit || false;
        } else if (userRole === 'Tesorero' || userRole === 'Capitán' || userRole === 'Ayudante') {
            puedeCrear = false;  // Tesorero, Capitán y Ayudante NO pueden crear
            puedeEditar = false; // Tesorero, Capitán y Ayudante NO pueden editar
        } else {
            puedeCrear = true;   // Otros roles pueden por defecto
            puedeEditar = true;
        }

        console.log('[PERMISOS UI] userRole:', userRole, '| puedeCrear:', puedeCrear, '| puedeEditar:', puedeEditar);

        // Mostrar mensaje de bienvenida para todos
        if (formContainer && currentUser) {
            const mensaje = document.createElement('div');
            mensaje.className = 'info-solo-lectura mensaje-bienvenida';
            mensaje.innerHTML = `<h3>Bienvenido ${currentUser.role}</h3>`;
            mensaje.style.cssText = `
                background: linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(25, 118, 210, 0.15) 100%);
                border: 2px solid rgba(33, 150, 243, 0.3);
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
                animation: fadeIn 0.5s ease-in;
                transition: opacity 0.5s ease-out;
            `;
            formContainer.insertBefore(mensaje, formContainer.firstChild);

            // Desaparecer después de 4 segundos
            setTimeout(() => {
                mensaje.style.opacity = '0';
                setTimeout(() => mensaje.remove(), 500);
            }, 4000);
        }

        // Manejar visibilidad del botón de crear voluntario
        const contenedorBoton = document.getElementById('contenedorCrearVoluntario');

        if (!puedeCrear) {
            console.log('[PERMISOS UI] Ocultando botón de crear voluntario para:', userRole);

            if (contenedorBoton) {
                contenedorBoton.style.display = 'none';
                console.log('[PERMISOS UI] ✅ Contenedor del botón de crear OCULTADO');
            } else {
                // Fallback: buscar por selector
                const btnCrear = document.querySelector('button[onclick*="irACrear"]');
                if (btnCrear && btnCrear.parentElement) {
                    btnCrear.parentElement.style.display = 'none';
                    console.log('[PERMISOS UI] ✅ Botón de crear OCULTADO (fallback)');
                } else {
                    console.warn('[PERMISOS UI] ⚠️ No se encontró el botón de crear voluntario');
                }
            }
        } else {
            // Si tiene permisos, asegurarse de que el botón esté visible
            console.log('[PERMISOS UI] Mostrando botón de crear voluntario para:', userRole);
            if (contenedorBoton) {
                contenedorBoton.style.display = '';
                console.log('[PERMISOS UI] ✅ Contenedor del botón de crear VISIBLE');
            }
        }

        if (!puedeEditar) {
            if (formContainer) {
                const allElements = formContainer.querySelectorAll('form, .buttons, .modo-edicion');
                allElements.forEach(el => el.style.display = 'none');
            }

            if (registrosButtons) {
                registrosButtons.style.display = 'none';
            }
        }
    }

    async init() {
        console.log('[SISTEMA] Iniciando sistema...');

        // Obtener usuario desde localStorage (ya debería estar desde el login)
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            window.currentUser = JSON.parse(storedUser);
            console.log('[SISTEMA] Usuario cargado:', window.currentUser.username);
        } else {
            console.log('[SISTEMA] Sin usuario en localStorage');
        }

        // IMPORTANTE: Aplicar permisos UI PRIMERO (antes de renderizar)
        this.aplicarPermisosUI();

        this.inicializarContadores();
        await this.cargarDatos(); // Cargar bomberos, sanciones Y cargos
        this.migrarEstadosBomberos(); // NUEVO: Migrar bomberos sin campo estadoBombero
        this.configurarInterfaz();
        this.renderizarBomberos(); // Renderizar DESPUÉS de aplicar permisos
        this.mostrarInfoUsuario();

        // TODO: Migrar estas funciones a Django
        // await this.calcularYMostrarDeudores();
        // this.mostrarSaldoEnHeader();

        // NO inicializar sidebar aquí (ya se inicializa automáticamente desde sidebar-django.js)
        
        // Verificar si se debe generar PDF automáticamente
        if (localStorage.getItem('generarPDFAlCargar') === 'true') {
            localStorage.removeItem('generarPDFAlCargar');
            setTimeout(() => {
                this.generarPDFConsultaVoluntarios();
            }, 500);
        }
        
        // Verificar si se debe mostrar notificación de deudores
        if (localStorage.getItem('mostrarDeudoresAlCargar') === 'true') {
            localStorage.removeItem('mostrarDeudoresAlCargar');
            setTimeout(() => {
                this.toggleNotificacionDeudores();
            }, 500);
        }
    }

    inicializarContadores() {
        window.idCounter = 1;
        window.sancionIdCounter = 1;
        window.cargoIdCounter = 1;
        window.felicitacionIdCounter = 1;
        window.uniformeIdCounter = 1;
        
        console.log('[INIT] Contadores inicializados:', {
            idCounter: window.idCounter,
            sancionIdCounter: window.sancionIdCounter,
            cargoIdCounter: window.cargoIdCounter,
            felicitacionIdCounter: window.felicitacionIdCounter,
            uniformeIdCounter: window.uniformeIdCounter
        });
    }

    estaSuspendido(bomberoId) {
        // Verificar si tiene sanción de suspensión activa
        // Las sanciones ya están filtradas como activas en sancionesActivas
        const suspendido = this.sancionesActivas.some(s => s.voluntario === bomberoId);
        
        if (suspendido) {
            console.log(`[SUSPENSIÓN] ⚠️ Bombero ${bomberoId} está SUSPENDIDO`);
        }
        
        return suspendido;
    }

    async obtenerCargoVigente(bomberoId) {
        // Obtener el cargo vigente del voluntario
        try {
            const response = await fetch(`/api/cargos/?voluntario=${bomberoId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            const cargos = Array.isArray(data) ? data : (data.results || []);
            
            if (cargos.length === 0) return null;
            
            // Filtrar cargos vigentes (sin fecha_fin o fecha_fin mayor a hoy)
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            
            const cargosVigentes = cargos.filter(c => {
                if (!c.fecha_fin) return true; // Sin fecha fin = vigente
                
                const fechaFin = new Date(c.fecha_fin);
                fechaFin.setHours(0, 0, 0, 0);
                
                return fechaFin >= hoy;
            });
            
            // Devolver el más reciente
            if (cargosVigentes.length > 0) {
                return cargosVigentes.sort((a, b) => {
                    const fechaA = new Date(a.fecha_inicio || a.anio);
                    const fechaB = new Date(b.fecha_inicio || b.anio);
                    return fechaB - fechaA;
                })[0];
            }
            
            return null;
        } catch (error) {
            console.error('[CARGO VIGENTE] Error:', error);
            return null;
        }
    }

    async cargarDatos() {
        try {
            // Cargar desde API Django
            const response = await fetch('/api/voluntarios/', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Error al cargar voluntarios');
            }

            const data = await response.json();
            
            // DRF puede devolver paginado o directo
            if (Array.isArray(data)) {
                this.bomberos = data;
            } else if (data && data.results && Array.isArray(data.results)) {
                this.bomberos = data.results;
            } else {
                console.error('❌ Formato inesperado:', data);
                this.bomberos = [];
            }
            
            console.log('[DATA] Datos recibidos de la API:', this.bomberos);
            
            // Fecha base para la antigüedad: la efectiva (reconocida) si existe, si no la de ingreso
            this.bomberos.forEach((b) => {
                b.fechaAntiguedad = b.fechaIngresoEfectiva || b.fechaIngreso || b.fecha_ingreso;
            });

            // ORDENAR POR ANTIGÜEDAD: la más antigua (reconocida) primero
            this.bomberos.sort((a, b) => {
                const fechaA = new Date(a.fechaAntiguedad);
                const fechaB = new Date(b.fechaAntiguedad);
                return fechaA - fechaB; // Más antiguo primero
            });

            // Asignar número de posición por antigüedad a cada bombero
            this.bomberos.forEach((b, index) => {
                b.posicionPorAntiguedad = index + 1;
            });
            
            console.log('[LOAD] Datos cargados y ordenados:', this.bomberos.length, 'voluntarios');
            
            // Cargar sanciones para todos los voluntarios para detectar suspendidos
            await this.cargarSancionesParaDeteccion();
            
            // Cargar cargos vigentes para mostrar en tarjetas
            await this.cargarCargosVigentes();
            
        } catch (error) {
            console.error('[ERROR] Error al cargar datos:', error);
            this.bomberos = [];
        }
    }

    async cargarSancionesParaDeteccion() {
        // Carga TODAS las sanciones en UN solo request (antes era 1 por bombero -> lento en remoto)
        console.log('[LOAD] Cargando sanciones (bulk)...');
        this.sancionesActivas = [];
        try {
            const response = await fetch('/api/sanciones/', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                const sanciones = Array.isArray(data) ? data : (data.results || []);
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                this.sancionesActivas = sanciones.filter(s => {
                    if (s.tipo_sancion !== 'suspension') return false;
                    if (!s.fecha_hasta) return false;
                    const desde = new Date(s.fecha_desde); desde.setHours(0, 0, 0, 0);
                    const hasta = new Date(s.fecha_hasta); hasta.setHours(0, 0, 0, 0);
                    return desde <= hoy && hoy <= hasta;
                });
            }
        } catch (error) {
            console.error('[ERROR] Cargando sanciones:', error);
        }
        console.log('[LOAD] ✅ Sanciones activas:', this.sancionesActivas.length);
    }

    async cargarCargosVigentes() {
        // Cargar cargos vigentes para todos los voluntarios
        console.log('[LOAD] Iniciando carga de cargos vigentes...');
        console.log('[LOAD] Total bomberos a revisar:', this.bomberos.length);
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        console.log('[LOAD] Fecha de hoy:', hoy.toISOString().split('T')[0]);
        
        // Carga TODOS los cargos en UN solo request y agrupa por voluntario
        try {
            const response = await fetch('/api/cargos/', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                const cargos = Array.isArray(data) ? data : (data.results || []);

                const porVol = {};
                for (const c of cargos) {
                    if (c.voluntario == null) continue;
                    (porVol[c.voluntario] = porVol[c.voluntario] || []).push(c);
                }

                Object.keys(porVol).forEach(volId => {
                    const vigentes = porVol[volId].filter(c => {
                        if (!c.fecha_fin) return true;
                        const fechaFin = new Date(c.fecha_fin);
                        fechaFin.setHours(0, 0, 0, 0);
                        return fechaFin >= hoy;
                    });
                    if (vigentes.length > 0) {
                        const masReciente = vigentes.sort((a, b) => {
                            const fechaA = new Date(a.fecha_inicio || a.anio);
                            const fechaB = new Date(b.fecha_inicio || b.anio);
                            return fechaB - fechaA;
                        })[0];
                        this.cargosVigentes[volId] = masReciente;
                    }
                });
            }
        } catch (error) {
            console.error('[ERROR] Cargando cargos:', error);
        }

        console.log('[LOAD] ✅ Cargos vigentes cargados:', Object.keys(this.cargosVigentes).length);
    }

    guardarDatos() {
        // Ya no se guarda en localStorage - se guarda en Django
        console.log('[WARN] guardarDatos() deshabilitado - usar API Django');
    }

    // ==================== MIGRACIÓN DE ESTADOS ====================
    migrarEstadosBomberos() {
        let cambios = 0;
        this.bomberos.forEach(bombero => {
            if (!bombero.estadoBombero) {
                bombero.estadoBombero = 'activo'; // Por defecto, todos son activos
                cambios++;
            }
        });
        
        if (cambios > 0) {
            this.guardarDatos();
            console.log(`[MIGRATE] Migracion completada: ${cambios} bomberos actualizados con estado 'activo'`);
        }
    }

    configurarInterfaz() {
        document.getElementById('buscadorBomberos').addEventListener('input', (e) => {
            this.terminoBusqueda = e.target.value.toLowerCase();
            this.renderizarBomberos();
        });

        // Configurar botones de filtro de estado
        const botonesFilter = document.querySelectorAll('.btn-filtro-estado');
        botonesFilter.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover clase active de todos
                botonesFilter.forEach(b => {
                    b.classList.remove('active');
                    const estado = b.dataset.estado;
                    const colors = {
                        'todos': '#4caf50',
                        'activo': '#4caf50',
                        'renunciado': '#f59e0b',
                        'separado': '#ef4444',
                        'expulsado': '#dc2626',
                        'martir': '#9c27b0',
                        'fallecido': '#6b7280'
                    };
                    const color = colors[estado] || '#4caf50';
                    b.style.background = 'white';
                    b.style.color = color;
                });
                
                // Agregar clase active al botón clickeado
                btn.classList.add('active');
                const estado = btn.dataset.estado;
                const colors = {
                    'todos': '#4caf50',
                    'activo': '#4caf50',
                    'renunciado': '#f59e0b',
                    'separado': '#ef4444',
                    'expulsado': '#dc2626',
                    'martir': '#9c27b0',
                    'fallecido': '#6b7280'
                };
                const color = colors[estado] || '#4caf50';
                btn.style.background = color;
                btn.style.color = 'white';
                
                // Aplicar filtro
                this.filtroEstado = btn.dataset.estado;
                this.renderizarBomberos();
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            logout();
        });
    }

    mostrarInfoUsuario() {
        const userRoleInfo = document.getElementById('userRoleInfo');
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        
        if (currentUser) {
            userRoleInfo.textContent = `${currentUser.role}: ${currentUser.username}`;
            
            const btnBeneficios = document.getElementById('btnBeneficios');
            if (btnBeneficios && (currentUser.role === 'Director' || currentUser.role === 'Super Administrador' || currentUser.role === 'Tesorero')) {
                btnBeneficios.style.display = 'inline-block';
                btnBeneficios.onclick = () => {
                    this.verBeneficios();
                };
            }
            
            if (currentUser.role === 'Tesorero') {
                this.mostrarSaldoEnHeader();
                
                const btnFinanzas = document.getElementById('btnFinanzas');
                if (btnFinanzas) {
                    btnFinanzas.style.display = 'inline-block';
                    btnFinanzas.onclick = () => {
                        window.location.href = 'finanzas.html';
                    };
                }
                
                const btnDeudores = document.getElementById('btnDeudores');
                if (btnDeudores) {
                    btnDeudores.style.display = 'inline-block';
                    btnDeudores.onclick = () => {
                        this.toggleNotificacionDeudores();
                    };
                }
            }
            
            // Botones de Asistencia (visibles para todos)
            const btnRegistroAsistencia = document.getElementById('btnRegistroAsistencia');
            if (btnRegistroAsistencia) {
                btnRegistroAsistencia.style.display = 'inline-block';
                btnRegistroAsistencia.onclick = () => {
                    this.verRegistroAsistencia();
                };
            }
            
            const btnHistorialAsistencias = document.getElementById('btnHistorialAsistencias');
            if (btnHistorialAsistencias) {
                btnHistorialAsistencias.style.display = 'inline-block';
                btnHistorialAsistencias.onclick = () => {
                    this.verHistorialAsistencias();
                };
            }
            
            // Botón Listado de Sanciones
            const btnListadoSanciones = document.getElementById('btnListadoSanciones');
            if (btnListadoSanciones) {
                btnListadoSanciones.style.display = 'inline-block';
                btnListadoSanciones.onclick = () => {
                    window.location.href = 'listado-sanciones.html';
                };
            }
        }
    }

    mostrarSaldoEnHeader() {
        const saldoDiv = document.getElementById('saldoCompaniaHeader');
        const saldoMonto = document.getElementById('saldoMontoHeader');
        const saldoSidebar = document.getElementById('saldoSidebar');
        
        if (saldoDiv && saldoMonto) {
            // Obtener movimientos desde localStorage directamente
            const movimientos = JSON.parse(localStorage.getItem('finanzas')) || [];
            
            const ingresos = movimientos
                .filter(m => m.tipo === 'ingreso')
                .reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);
            
            const egresos = movimientos
                .filter(m => m.tipo === 'egreso')
                .reduce((sum, m) => sum + parseFloat(m.monto || 0), 0);
            
            const saldo = ingresos - egresos;
            
            const saldoFormateado = new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0
            }).format(saldo);
            
            saldoMonto.textContent = saldoFormateado;
            
            if (saldo < 0) {
                saldoMonto.style.color = '#f44336';
            } else if (saldo === 0) {
                saldoMonto.style.color = '#ff9800';
            } else {
                saldoMonto.style.color = '#4caf50';
            }
            
            saldoDiv.style.display = 'flex';
            
            // Actualizar también en el sidebar
            if (saldoSidebar) {
                saldoSidebar.textContent = saldoFormateado;
            }
        }
    }

    // ==================== REDIRIGIR A CREAR VOLUNTARIO ====================
    irACrear() {
        Utils.mostrarNotificacion('Redirigiendo a crear nuevo voluntario...', 'info');
        setTimeout(() => {
            window.location.href = 'crear-bombero.html';
        }, 800);
    }

renderizarBomberos() {
    // IMPORTANTE: this.bomberos ya está ordenado por antigüedad
    
    // Filtrar bomberos por búsqueda
    let bomberosFiltrados = this.terminoBusqueda ? 
        Utils.filtrarBomberos(this.bomberos, this.terminoBusqueda) : 
        this.bomberos;
    
    // Filtrar por estado (incluyendo suspendidos)
    if (this.filtroEstado !== 'todos') {
        console.log(`[FILTRO] Filtrando por estado: ${this.filtroEstado}`);
        
        bomberosFiltrados = bomberosFiltrados.filter(b => {
            const estadoBombero = b.estadoBombero || 'activo';
            
            // Si filtramos por "suspendido", verificar si tiene sanción activa
            if (this.filtroEstado === 'suspendido') {
                const suspendido = this.estaSuspendido(b.id);
                console.log(`[FILTRO]   Bombero ${b.id} (${b.claveBombero}): suspendido=${suspendido}`);
                return suspendido;
            }
            
            return estadoBombero === this.filtroEstado;
        });
        
        console.log(`[FILTRO] Resultados después de filtrar: ${bomberosFiltrados.length}`);
    }
    
    // Aplicar paginación
    const bomberosToShow = this.paginationBomberos ? 
        this.paginationBomberos.getCurrentPageItems() : 
        bomberosFiltrados;

    const listaBomberos = document.getElementById('listaBomberos');
    
    // Actualizar contador
    const totalElement = document.getElementById('totalBomberos');
    if (totalElement) {
        totalElement.textContent = `Total de bomberos registrados: ${this.bomberos.length}`;
    }
    
    if (bomberosToShow.length === 0) {
        listaBomberos.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <h3>No se encontraron bomberos</h3>
                <p>Intenta con otro término de búsqueda</p>
            </div>
        `;
        return;
    }

    // Obtener permisos y rol del usuario
    const userPerms = getUserPermissions();
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || 'null');
    const userRole = currentUser?.role || null;

    console.log('[PERMISOS] userRole:', userRole);
    console.log('[PERMISOS] userPerms:', userPerms);

    // Mapear permisos según el ROL (con fallback por rol)
    let permisos;

    if (userPerms) {
        // Usar permisos del backend si están disponibles
        permisos = {
            canEdit: userPerms.voluntarios?.edit || false,
            canDelete: userPerms.voluntarios?.delete || false,
            canCreate: userPerms.voluntarios?.create || false,
            canViewCargos: userPerms.cargos?.view || false,
            canViewSanciones: userPerms.sanciones?.view || false,
            canViewFinanzas: userPerms.cuotas?.view || userPerms.beneficios?.view || false,
            canEditFinanzas: userPerms.cuotas?.edit || userPerms.beneficios?.edit || false,
            canGeneratePDFFicha: userPerms.pdfs?.view || userPerms.pdfs?.create || false,
            canViewFelicitaciones: userPerms.felicitaciones?.view || false,
            canViewUniformes: userPerms.uniformes?.view || false,
            canViewTablaUniformes: userPerms.uniformes?.view || false,
            canViewAsistencias: userPerms.asistencias?.view || false,
            canOnlySuspensions: false
        };
    } else if (userRole === 'Tesorero') {
        // FALLBACK: Permisos hardcodeados para Tesorero
        console.log('[PERMISOS] ⚠️ Usando permisos hardcodeados para Tesorero');
        permisos = {
            canEdit: false,             // NO puede editar voluntarios
            canDelete: false,           // NO puede eliminar
            canCreate: false,           // NO puede crear voluntarios
            canViewCargos: false,       // NO ve cargos
            canViewSanciones: false,    // NO ve sanciones
            canViewFinanzas: true,      // ✅ VE CUOTAS y BENEFICIOS
            canEditFinanzas: true,      // ✅ Gestiona cuotas/beneficios
            canGeneratePDFFicha: false, // NO ve ficha PDF
            canViewFelicitaciones: false, // NO ve felicitaciones
            canViewUniformes: true,     // ✅ VE UNIFORMES
            canViewTablaUniformes: false, // NO ve tabla uniformes
            canViewAsistencias: false,  // NO ve asistencias
            canOnlySuspensions: false
        };
    } else if (userRole === 'Capitán' || userRole === 'Ayudante') {
        // FALLBACK: Permisos hardcodeados para Capitán y Ayudante
        console.log('[PERMISOS] ⚠️ Usando permisos hardcodeados para', userRole);
        permisos = {
            canEdit: false,             // NO puede editar voluntarios
            canDelete: false,           // NO puede inactivar
            canCreate: false,           // NO puede crear voluntarios
            canViewCargos: false,       // NO ve cargos
            canViewSanciones: true,     // ✅ VE SANCIONES (solo suspensiones)
            canViewFinanzas: false,     // NO ve cuotas ni beneficios
            canEditFinanzas: false,     // NO puede desactivar cuotas ni activar estudiante
            canGeneratePDFFicha: true,  // ✅ VE FICHA PDF
            canViewFelicitaciones: true, // ✅ VE FELICITACIONES
            canViewUniformes: true,     // ✅ VE UNIFORMES
            canViewTablaUniformes: true, // ✅ VE TABLA UNIFORMES
            canViewAsistencias: true,   // ✅ VE ASISTENCIAS
            canOnlySuspensions: true    // Solo suspensiones, no otras sanciones
        };
    } else if (userRole === 'Director') {
        // FALLBACK: Permisos hardcodeados para Director
        console.log('[PERMISOS] ⚠️ Usando permisos hardcodeados para Director');
        permisos = {
            canEdit: true,              // ✅ Puede editar voluntarios
            canDelete: true,            // ✅ Puede inactivar
            canCreate: true,            // ✅ Puede crear voluntarios
            canViewCargos: true,        // ✅ VE CARGOS
            canViewSanciones: true,     // ✅ VE SANCIONES
            canViewFinanzas: false,     // NO ve cuotas ni beneficios
            canEditFinanzas: false,     // NO puede desactivar cuotas ni activar estudiante
            canGeneratePDFFicha: true,  // ✅ VE FICHA PDF
            canViewFelicitaciones: true, // ✅ VE FELICITACIONES
            canViewUniformes: true,     // ✅ VE UNIFORMES
            canViewTablaUniformes: true, // ✅ VE TABLA UNIFORMES
            canViewAsistencias: true,   // ✅ VE ASISTENCIAS
            canOnlySuspensions: false
        };
    } else if (userRole === 'Secretario') {
        // FALLBACK: Permisos hardcodeados para Secretario (mínimos)
        console.log('[PERMISOS] ⚠️ Usando permisos hardcodeados para Secretario');
        permisos = {
            canEdit: true,              // ✅ Puede editar voluntarios
            canDelete: true,            // ✅ Puede inactivar
            canCreate: true,            // ✅ Puede crear voluntarios
            canViewCargos: true,        // ✅ VE CARGOS
            canViewSanciones: true,     // ✅ VE SANCIONES
            canViewFinanzas: false,     // NO ve cuotas ni beneficios
            canEditFinanzas: false,     // NO puede desactivar cuotas ni activar estudiante
            canGeneratePDFFicha: true,  // ✅ VE FICHA PDF
            canViewFelicitaciones: true, // ✅ VE FELICITACIONES
            canViewUniformes: false,    // NO ve uniformes
            canViewTablaUniformes: false, // NO ve tabla uniformes
            canViewAsistencias: false,  // NO ve asistencias
            canOnlySuspensions: false
        };
    } else {
        // Otros roles: permisos completos por defecto
        permisos = {
            canEdit: true,
            canDelete: true,
            canCreate: true,
            canViewCargos: true,
            canViewSanciones: true,
            canViewFinanzas: true,
            canEditFinanzas: true,
            canGeneratePDFFicha: true,
            canViewFelicitaciones: true,
            canViewUniformes: true,
            canViewTablaUniformes: true,
            canViewAsistencias: true,
            canOnlySuspensions: false
        };
    }

    console.log('[PERMISOS] permisos finales:', permisos);

    const puedeEditar = permisos.canEdit;
    const puedeEliminar = permisos.canDelete;
    const puedeVerCargos = permisos.canViewCargos;
    const puedeVerSanciones = permisos.canViewSanciones;

    listaBomberos.innerHTML = bomberosToShow.map((bombero, index) => {
        const nombreCompleto = Utils.obtenerNombreCompleto(bombero);
        
        // Debug: Ver qué fechas llegan
        console.log('DEBUG Bombero:', {
            id: bombero.id,
            fechaIngreso: bombero.fechaIngreso,
            fechaNacimiento: bombero.fechaNacimiento
        });
        
        const antiguedad = Utils.calcularAntiguedadDetallada(bombero.fechaAntiguedad);
        const edad = Utils.calcularEdad(bombero.fechaNacimiento);
        const categoria = Utils.calcularCategoriaBombero(bombero.fechaAntiguedad);
        
        console.log('DEBUG Cálculos:', { edad, antiguedad, categoria });
        
        // Usar la posición asignada al cargar los datos
        const posicionPorAntiguedad = bombero.posicionPorAntiguedad || (index + 1);
        
        // Estado del bombero
        const estadoBombero = bombero.estadoBombero || 'activo';
        const estadoInfo = {
            'activo': { icono: '✅', texto: 'ACTIVO', color: '#4caf50', bgColor: '#e8f5e9', borderColor: '#4caf50', cardBg: '#ffffff' },
            'inactivo': { icono: '⚠️', texto: 'INACTIVO', color: '#ff9800', bgColor: '#fff3e0', borderColor: '#ff9800', cardBg: '#fffbf0' },
            'renunciado': { icono: '🔄', texto: 'RENUNCIADO', color: '#f59e0b', bgColor: '#fef3c7', borderColor: '#f59e0b', cardBg: '#fffbeb' },
            'separado': { icono: '⏸️', texto: 'SEPARADO', color: '#ef4444', bgColor: '#fee2e2', borderColor: '#ef4444', cardBg: '#fef2f2' },
            'expulsado': { icono: '❌', texto: 'EXPULSADO', color: '#dc2626', bgColor: '#fecaca', borderColor: '#dc2626', cardBg: '#fee2e2' },
            'martir': { icono: '🕊️', texto: 'MÁRTIR', color: '#9c27b0', bgColor: '#f3e5f5', borderColor: '#9c27b0', cardBg: '#faf5ff' },
            'fallecido': { icono: '☠️', texto: 'FALLECIDO', color: '#6b7280', bgColor: '#f3f4f6', borderColor: '#6b7280', cardBg: '#f9fafb' }
        };
        const estado = estadoInfo[estadoBombero] || estadoInfo['activo'];
        
        // Verificar si puede reintegrarse
        const validacionReintegracion = Utils.puedeReintegrarse(bombero);
        const puedeReintegrarse = validacionReintegracion.puede;
        
        // DEBUG: Log para ver por qué no aparece el botón
        if (bombero.id === 7) {
            console.log('[RENDER JUAN] ID:', bombero.id);
            console.log('[RENDER JUAN] estadoBombero:', bombero.estadoBombero);
            console.log('[RENDER JUAN] validacionReintegracion:', validacionReintegracion);
            console.log('[RENDER JUAN] puedeReintegrarse:', puedeReintegrarse);
            console.log('[RENDER JUAN] puedeEditar:', puedeEditar);
            console.log('[RENDER JUAN] Condición final:', puedeReintegrarse && puedeEditar);
        }
        
        // NUEVO: Verificar si las cuotas están activas para este bombero
        const tieneCuotasActivas = bombero.cuotasActivas !== false;
        const categoriaTexto = categoria.categoria || categoria;
        const esHonorarioCompania = categoriaTexto === 'Voluntario Honorario de Compañía';
        const esHonorarioCuerpo = categoriaTexto === 'Voluntario Honorario del Cuerpo';
        const esInsigne = categoriaTexto === 'Voluntario Insigne de Chile';
        const esMartir = estadoBombero === 'martir';
        
        // Considerar exento si es: Honorario de Compañía (20-24), Honorario del Cuerpo (25-49), Insigne (50+) o Mártir
        const esExento = esHonorarioCompania || esHonorarioCuerpo || esInsigne || esMartir;
        
        // Ocultar botón de cuotas si es exento Y no tiene cuotas activadas
        const mostrarBotonCuotas = !(esExento && !tieneCuotasActivas);

        // Verificar si está suspendido actualmente
        const suspendido = this.estaSuspendido(bombero.id);
        const cardStyle = suspendido ? 
            `background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%); border-left: 4px solid #ff9800; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.2);` :
            `background-color: ${estado.cardBg}; border-left: 4px solid ${estado.borderColor};`;

        // Obtener cargo vigente
        const cargoVigente = this.cargosVigentes[bombero.id];
        let badgeCargo = '';
        
        if (cargoVigente) {
            const iconosCargo = {
                'comandancia': '⭐',
                'compania': '👔',
                'consejo': '⚖️',
                'tecnico': '🔧'
            };
            
            const coloresCargo = {
                'comandancia': { bg: '#fef3c7', color: '#f59e0b', border: '#f59e0b' },
                'compania': { bg: '#dbeafe', color: '#3b82f6', border: '#3b82f6' },
                'consejo': { bg: '#f3e8ff', color: '#a855f7', border: '#a855f7' },
                'tecnico': { bg: '#d1fae5', color: '#10b981', border: '#10b981' }
            };
            
            const tipoCargo = cargoVigente.tipo_cargo || 'tecnico';
            const color = coloresCargo[tipoCargo] || coloresCargo.tecnico;
            const icono = iconosCargo[tipoCargo] || '📋';
            
            badgeCargo = `
                <span style="display: inline-block; background: ${color.bg}; color: ${color.color}; padding: 3px 10px; border-radius: 12px; font-size: 0.65rem; font-weight: 700; margin-left: 6px; border: 1.5px solid ${color.border}; line-height: 1.2;">
                    ${icono} ${cargoVigente.nombre_cargo.toUpperCase()}
                </span>
            `;
        }

        return `
            <div class="bombero-card" style="${cardStyle}">
                <!-- Foto izquierda -->
                <div class="bombero-foto-wrapper">
                    ${bombero.foto ? `
                        <img src="${bombero.foto}" alt="${nombreCompleto}" class="bombero-foto" style="${estadoBombero !== 'activo' ? 'filter: grayscale(50%);' : ''}">
                    ` : `
                        <div class="bombero-sin-foto">Sin foto</div>
                    `}
                </div>
                
                <!-- Contenido -->
                <div class="bombero-contenido">
                    <!-- Header: Nombre + Botones -->
                    <div class="bombero-top">
                        <div>
                            <h2 class="bombero-nombre">${nombreCompleto} 
                                <span style="display: inline-block; background: ${estado.bgColor}; color: ${estado.color}; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; margin-left: 10px;">
                                    ${estado.icono} ${estado.texto}
                                </span>
                                ${suspendido ? `
                                <span style="display: inline-block; background: #fff3e0; color: #ff9800; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; margin-left: 5px; border: 2px solid #ff9800; animation: pulse 2s infinite;">
                                    ⏸️ SUSPENDIDO
                                </span>
                                ` : ''}
                                ${badgeCargo}
                            </h2>
                            <p class="bombero-clave">Clave: ${bombero.claveBombero} | RUN: ${bombero.rut}</p>
                        </div>
                        
                        <div class="bombero-botones">
                            ${permisos && permisos.canGeneratePDFFicha ? `<button class="btn btn-pdf-ficha" onclick="sistemaBomberos.generarFichaPersonalPDF(${bombero.id})">📄 Ficha PDF</button>` : ''}
                            ${permisos && permisos.canViewFinanzas && mostrarBotonCuotas ? `<button class="btn btn-cuotas" onclick="sistemaBomberos.verCuotas(${bombero.id})">💳 Cuotas</button>` : ''}
                            ${permisos && permisos.canViewFinanzas && !esMartir ? `<button class="btn btn-beneficios" onclick="sistemaBomberos.verPagarBeneficios(${bombero.id})">🎫 Beneficios</button>` : ''}
                            ${permisos && permisos.canViewFinanzas && permisos.canEditFinanzas && !esMartir ? `<button class="btn btn-pdf" onclick="sistemaBomberos.generarPDFDeudasBombero(${bombero.id})">📄 PDF Deudas</button>` : ''}
                            ${permisos && permisos.canViewAsistencias ? `<button class="btn btn-asistencias" onclick="verReporteAsistencias(${bombero.id})" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white;">📊 Asistencias</button>` : ''}
                            ${puedeEditar ? `<button class="btn btn-editar" onclick="sistemaBomberos.editarBombero(${bombero.id})">Editar</button>` : ''}
                            ${puedeReintegrarse && puedeEditar ? `<button class="btn btn-success" onclick="sistemaBomberos.iniciarReintegracion(${bombero.id})" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">🔄 Reintegrar</button>` : ''}
                            ${puedeEliminar ? `<button class="btn ${estadoBombero === 'activo' ? 'btn-warning' : 'btn-success'}" onclick="sistemaBomberos.cambiarEstadoBombero(${bombero.id})">${estadoBombero === 'activo' ? '⚠️ Inactivar' : '✅ Activar'}</button>` : ''}
                            ${puedeVerCargos ? `<button class="btn btn-cargos" onclick="sistemaBomberos.verCargos(${bombero.id})">Cargos</button>` : ''}
                            ${puedeVerSanciones ? `<button class="btn btn-sanciones" onclick="sistemaBomberos.verSanciones(${bombero.id})">${permisos.canOnlySuspensions ? 'Suspensiones' : 'Sanciones'}</button>` : ''}
                            ${permisos && permisos.canViewFelicitaciones ? `<button class="btn btn-felicitaciones" onclick="sistemaBomberos.verFelicitaciones(${bombero.id})">🏆 Felicitaciones</button>` : ''}
                            ${permisos && permisos.canViewUniformes ? `<button class="btn btn-uniformes" onclick="sistemaBomberos.verUniformes(${bombero.id})">👔 Uniformes</button>` : ''}
                            ${permisos && permisos.canViewTablaUniformes ? `<button class="btn btn-tabla-uniformes" onclick="window.location.href='tabla-uniformes-voluntario.html?id=${bombero.id}'" title="Ver tabla de todos los uniformes del voluntario">📋 Tabla Uniformes</button>` : ''}
                        </div>
                    </div>
                    
                    <!-- Edad y Antigüedad -->
                    <div class="bombero-edad-antiguedad">
                        <strong>Edad:</strong> ${edad} años
                        <span class="separador">|</span>
                        <strong>Antigüedad:</strong> ${antiguedad.años} años, ${antiguedad.meses} meses, ${antiguedad.dias} días
                    </div>
                    
                    <!-- Badge Categoría -->
<div class="categoria-box" style="border-left-color: ${categoria.color}; background-color: ${categoria.color}10; display: block; width: 100%; max-width: 400px;">                        ${categoria.icono} ${categoria.categoria}
                    </div>
                    
                    <!-- Grid Info -->
                    <div class="info-grid">
                        <div class="info-col">
                            <span class="info-label">Profesión:</span>
                            <span class="info-value">${bombero.profesion || 'N/A'}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Domicilio:</span>
                            <span class="info-value">${bombero.domicilio || 'N/A'}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Registro Nacional:</span>
                            <span class="info-value">${bombero.nroRegistro || 'N/A'}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Compañía:</span>
                            <span class="info-value">${bombero.compania || 'N/A'}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Grupo Sanguíneo:</span>
                            <span class="info-value">${bombero.grupoSanguineo || 'N/A'}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Fecha Ingreso:</span>
                            <span class="info-value">${Utils.formatearFecha(bombero.fechaIngreso)}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Teléfono:</span>
                            <span class="info-value">${bombero.telefono || 'N/A'}</span>
                        </div>
                        <div class="info-col">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${bombero.email || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (this.paginationBomberos) {
        this.paginationBomberos.renderControls('paginationControlsBomberos', 'sistemaBomberos.cambiarPagina');
    }
}

    cambiarPaginaBomberos(pageNumber) {
        if (this.paginationBomberos.goToPage(pageNumber)) {
            this.renderizarBomberos();
            document.getElementById('listaBomberos').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }


async cambiarEstadoBombero(id) {
    // Convertir a número para comparación exacta
    const bombero = this.bomberos.find(b => b.id === parseInt(id));
    if (!bombero) return;

    const estadoActual = bombero.estadoBombero || 'activo';
    let nuevoEstado = '';
    let confirmacionMsg = '';
    
    if (estadoActual === 'activo') {
        confirmacionMsg = `¿Desea cambiar el estado del voluntario <strong>${Utils.obtenerNombreCompleto(bombero)}</strong> a INACTIVO?<br><br>Este voluntario ya no aparecerá como activo en el sistema.`;
        nuevoEstado = 'inactivo';
    } else if (estadoActual === 'inactivo') {
        confirmacionMsg = `¿Desea cambiar el estado del voluntario <strong>${Utils.obtenerNombreCompleto(bombero)}</strong> a ACTIVO?<br><br>Este voluntario volverá a estar activo en el sistema.`;
        nuevoEstado = 'activo';
    } else if (estadoActual === 'martir') {
        Utils.mostrarNotificacion('No se puede cambiar el estado de un mártir', 'warning');
        return;
    }

    const confirmado = await Utils.confirmarAccion(confirmacionMsg);

    if (confirmado) {
        bombero.estadoBombero = nuevoEstado;
        bombero.fechaCambioEstado = new Date().toISOString();
        this.guardarDatos();
        this.renderizarBomberos();
        Utils.mostrarNotificacion(`Estado cambiado a: ${nuevoEstado.toUpperCase()}`, 'success');
    }
}

    async toggleCuotasActivas(id) {
        // Convertir a número para comparación exacta
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        if (!bombero) return;

        const categoria = Utils.calcularCategoriaBombero(bombero.fechaAntiguedad);
        const categoriaTexto = categoria.categoria || categoria;
        const estadoActual = bombero.cuotasActivas !== false; // Por defecto true
        const nuevoEstado = !estadoActual;
        
        const accion = nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR';
        const confirmacionMsg = `¿Desea ${accion} las cuotas sociales para <strong>${Utils.obtenerNombreCompleto(bombero)}</strong>?<br><br>` +
            `Categoría: <strong>${categoriaTexto}</strong><br><br>` +
            (nuevoEstado ? 
                '✅ Si activa las cuotas, este voluntario <strong>deberá pagar cuotas mensuales</strong> y aparecerá como deudor si no las paga.' :
                '🚫 Si desactiva las cuotas, este voluntario <strong>NO deberá pagar cuotas mensuales</strong> y no aparecerá como deudor.');

        const confirmado = await Utils.confirmarAccion(confirmacionMsg);

        if (confirmado) {
            bombero.cuotasActivas = nuevoEstado;
            bombero.fechaCambioCuotas = new Date().toISOString();
            this.guardarDatos();
            this.renderizarBomberos();
            Utils.mostrarNotificacion(
                `Cuotas ${nuevoEstado ? 'ACTIVADAS' : 'DESACTIVADAS'} para ${Utils.obtenerNombreCompleto(bombero)}`, 
                'success'
            );
        }
    }

    // ==================== GESTIÓN DE ESTUDIANTES ====================
    async activarEstudiante(id) {
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        if (!bombero) return;

        const nombreCompleto = Utils.obtenerNombreCompleto(bombero);
        const anioActual = new Date().getFullYear();
        const mesActual = new Date().getMonth() + 1;

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const modalHTML = `
            <div class="modal-overlay" id="modalEstudiante" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 99999;">
                <div class="modal-content" style="background: white; border-radius: 15px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">👨‍🎓 Activar Estado Estudiante</h3>
                        <button class="modal-close" onclick="document.getElementById('modalEstudiante').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">✖</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p><strong>Voluntario:</strong> ${nombreCompleto}</p>
                        <p><strong>Clave:</strong> ${bombero.claveBombero}</p>
                        <hr style="margin: 15px 0;">
                        
                        <form id="formActivarEstudiante">
                            <div class="form-group">
                                <label class="required">Certificado de Alumno Regular:</label>
                                <input type="file" 
                                       id="certificadoEstudiante" 
                                       accept=".pdf,.jpg,.jpeg,.png" 
                                       required
                                       onchange="sistemaBomberos.previsualizarCertificado(this)">
                                <small class="form-help">PDF o imagen (máx 5MB)</small>
                                <div id="previewCertificado" style="margin-top: 10px;"></div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="required">Aplicar desde Mes:</label>
                                    <select id="mesInicioEstudiante" required>
                                        ${meses.map((m, i) => `<option value="${i + 1}" ${i + 1 === mesActual ? 'selected' : ''}>${m}</option>`).join('')}
                                    </select>
                                </div>

                                <div class="form-group" style="display: none;">
                                    <label>Año (oculto):</label>
                                    <input type="hidden" id="anioInicioEstudiante" value="${anioActual}">
                                </div>
                            </div>

                            <div class="info-box info-info">
                                <p><strong>ℹ️ Importante:</strong></p>
                                <p>Los meses anteriores a la fecha seleccionada se cobrarán a precio regular.</p>
                                <p>Desde el mes seleccionado en adelante, se aplicará el precio estudiante.</p>
                            </div>
                            
                            <div class="form-group">
                                <label>Observaciones:</label>
                                <textarea id="observacionesEstudiante" rows="3" placeholder="Observaciones adicionales (opcional)"></textarea>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" 
                                        onclick="document.getElementById('modalEstudiante').remove()">
                                    Cancelar
                                </button>
                                <button type="submit" class="btn btn-success">
                                    ✅ Activar Estudiante
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('formActivarEstudiante').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.guardarActivacionEstudiante(bombero);
        });
    }

    previsualizarCertificado(input) {
        const preview = document.getElementById('previewCertificado');
        preview.innerHTML = '';
        
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            
            if (fileSize > 5) {
                Utils.mostrarNotificacion('El archivo no debe superar los 5MB', 'error');
                input.value = '';
                return;
            }
            
            const fileName = file.name;
            const fileType = file.type;
            
            preview.innerHTML = `
                <div style="padding: 10px; background: #e8f5e9; border-radius: 5px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">${fileType.includes('pdf') ? '📄' : '🖼️'}</span>
                    <div style="flex: 1;">
                        <strong>${fileName}</strong><br>
                        <small>${fileSize} MB</small>
                    </div>
                </div>
            `;
        }
    }

    async guardarActivacionEstudiante(bombero) {
        const inputCertificado = document.getElementById('certificadoEstudiante');
        const mesInicio = parseInt(document.getElementById('mesInicioEstudiante').value);
        const anioInicio = parseInt(document.getElementById('anioInicioEstudiante').value);

        if (!inputCertificado.files || !inputCertificado.files[0]) {
            Utils.mostrarNotificacion('Debe seleccionar un certificado', 'error');
            return;
        }

        try {
            const archivo = inputCertificado.files[0];
            const certificadoBase64 = await Utils.leerArchivoComoBase64(archivo);

            bombero.esEstudiante = true;
            bombero.certificadoEstudiante = certificadoBase64;
            bombero.nombreCertificadoEstudiante = archivo.name;
            bombero.mesInicioEstudiante = mesInicio;
            bombero.anioInicioEstudiante = anioInicio;
            bombero.fechaActivacionEstudiante = new Date().toISOString();

            this.guardarDatos();
            this.renderizarBomberos();

            document.getElementById('modalEstudiante').remove();

            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            
            Utils.mostrarNotificacion(
                `✅ Estado estudiante activado desde ${meses[mesInicio - 1]} ${anioInicio}`, 
                'success'
            );
        } catch (error) {
            Utils.mostrarNotificacion('Error al procesar certificado: ' + error.message, 'error');
        }
    }

    async verCertificadoEstudiante(id) {
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        if (!bombero || !bombero.esEstudiante) return;

        const nombreCompleto = Utils.obtenerNombreCompleto(bombero);
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const modalHTML = `
            <div class="modal-overlay" id="modalVerEstudiante" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 99999;">
                <div class="modal-content" style="background: white; border-radius: 15px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);">
                    <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">👨‍🎓 Información de Estudiante</h3>
                        <button class="modal-close" onclick="document.getElementById('modalVerEstudiante').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">✖</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p><strong>Voluntario:</strong> ${nombreCompleto}</p>
                        <p><strong>Clave:</strong> ${bombero.claveBombero}</p>
                        <p><strong>Aplicando precio estudiante desde:</strong> ${meses[bombero.mesInicioEstudiante - 1]} ${bombero.anioInicioEstudiante}</p>
                        <p><strong>Fecha de activación:</strong> ${Utils.formatearFecha(bombero.fechaActivacionEstudiante)}</p>
                        <hr style="margin: 15px 0;">
                        
                        <h4>📄 Certificado:</h4>
                        <div style="margin: 15px 0;">
                            ${bombero.certificadoEstudiante.startsWith('data:application/pdf') ? `
                                <iframe src="${bombero.certificadoEstudiante}" 
                                        style="width: 100%; height: 400px; border: 1px solid #ddd; border-radius: 5px;">
                                </iframe>
                            ` : `
                                <img src="${bombero.certificadoEstudiante}" 
                                     style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px;"
                                     alt="Certificado">
                            `}
                        </div>
                        <p><strong>Nombre archivo:</strong> ${bombero.nombreCertificadoEstudiante}</p>

                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" 
                                    onclick="document.getElementById('modalVerEstudiante').remove()">
                                Cerrar
                            </button>
                            <button type="button" class="btn btn-primary" 
                                    onclick="sistemaBomberos.descargarCertificado(${bombero.id})">
                                💾 Descargar
                            </button>
                            <button type="button" class="btn btn-warning" 
                                    onclick="sistemaBomberos.desactivarEstudiante(${bombero.id})">
                                ❌ Desactivar Estudiante
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    descargarCertificado(id) {
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        if (!bombero || !bombero.certificadoEstudiante) return;

        const link = document.createElement('a');
        link.href = bombero.certificadoEstudiante;
        link.download = bombero.nombreCertificadoEstudiante || 'certificado_estudiante.pdf';
        link.click();
        
        Utils.mostrarNotificacion('Certificado descargado', 'success');
    }

    async desactivarEstudiante(id) {
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        if (!bombero) return;

        const confirmado = await Utils.confirmarAccion(
            `¿Está seguro de desactivar el estado estudiante de <strong>${Utils.obtenerNombreCompleto(bombero)}</strong>?<br><br>` +
            `Se volverá a aplicar el precio regular de cuotas.`
        );

        if (confirmado) {
            bombero.esEstudiante = false;
            bombero.fechaDesactivacionEstudiante = new Date().toISOString();
            // Mantener el certificado por historial, pero marcar como inactivo
            
            this.guardarDatos();
            this.renderizarBomberos();
            
            const modal = document.getElementById('modalVerEstudiante');
            if (modal) modal.remove();
            
            Utils.mostrarNotificacion('Estado estudiante desactivado', 'success');
        }
    }

    editarBombero(id) {
        // Convertir a número para comparación exacta
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        if (!bombero) {
            Utils.mostrarNotificacion('Bombero no encontrado', 'error');
            return;
        }

        localStorage.setItem('bomberoEditarActual', id);
        Utils.mostrarNotificacion('Redirigiendo a editar voluntario...', 'info');
        setTimeout(() => {
            window.location.href = 'editar-bombero.html';
        }, 800);
    }

    verSanciones(id) {
        Utils.mostrarNotificacion('Redirigiendo a sanciones...', 'info');
        localStorage.setItem('bomberoSancionActual', id);
        setTimeout(() => window.location.href = '/sanciones.html', 1000);
    }

    verFelicitaciones(id) {
        Utils.mostrarNotificacion('Redirigiendo a felicitaciones...', 'info');
        localStorage.setItem('bomberoFelicitacionActual', id);
        setTimeout(() => window.location.href = 'felicitaciones.html', 1000);
    }

    verUniformes(id) {
        console.log('[SISTEMA] 👔 Botón Uniformes clickeado, ID:', id);
        console.log('[SISTEMA] 🔗 Redirigiendo a:', `/uniformes.html?id=${id}`);
        Utils.mostrarNotificacion('Redirigiendo a uniformes...', 'info');
        localStorage.setItem('bomberoUniformeActual', id);
        setTimeout(() => {
            console.log('[SISTEMA] ✈️ Navegando ahora a:', `/uniformes.html?id=${id}`);
            window.location.href = `/uniformes.html?id=${id}`;
        }, 500);
    }

    verCargos(id) {
        Utils.mostrarNotificacion('Redirigiendo a cargos...', 'info');
        localStorage.setItem('bomberoCargoActual', id);
        setTimeout(() => window.location.href = 'cargos.html', 1000);
    }

    iniciarReintegracion(id) {
        Utils.mostrarNotificacion('Iniciando proceso de reintegración...', 'info');
        localStorage.setItem('voluntarioReintegracionId', id);
        setTimeout(() => window.location.href = 'reintegracion-voluntario.html', 1000);
    }

    verCuotas(id) {
        Utils.mostrarNotificacion('Redirigiendo a cuotas sociales...', 'info');
        // Pasar ID por URL para usar con Django API
        setTimeout(() => window.location.href = `cuotas-beneficios.html?id=${id}`, 800);
    }

    verRegistroAsistencia() {
        Utils.mostrarNotificacion('Seleccione el tipo de asistencia...', 'info');
        setTimeout(() => window.location.href = 'tipos-asistencia.html', 800);
    }

    verHistorialAsistencias() {
        Utils.mostrarNotificacion('Redirigiendo a historial de asistencias...', 'info');
        setTimeout(() => window.location.href = 'historial-asistencias.html', 800);
    }

    async generarFichaPersonalPDF(id) {
        // Convertir a número para comparación exacta
        const bombero = this.bomberos.find(b => b.id === parseInt(id));
        
        if (!bombero) {
            Utils.mostrarNotificacion('Bombero no encontrado', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            let yPos = 20;

            // Obtener logo de compañía
            const logoCompania = localStorage.getItem('logoCompania');

            // ENCABEZADO con fondo negro
            doc.setFillColor(0, 0, 0); // Negro
            doc.rect(0, 0, pageWidth, 60, 'F');

            // FOTO DEL VOLUNTARIO (izquierda)
            if (bombero.foto) {
                try {
                    doc.addImage(bombero.foto, 'JPEG', 12, 10, 40, 40);
                } catch (error) {
                    console.warn('No se pudo cargar la foto del voluntario');
                }
            }

            // LOGO DE LA COMPAÑÍA (derecha)
            if (logoCompania) {
                try {
                    doc.addImage(logoCompania, 'PNG', pageWidth - 52, 10, 40, 40);
                } catch (error) {
                    console.warn('No se pudo cargar el logo de la compañía');
                }
            }

            // Título principal (centro)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont(undefined, 'bold');
            doc.text('FICHA PERSONAL', pageWidth / 2, 25, { align: 'center' });
            
            // Subtítulo
            doc.setFontSize(14);
            doc.setFont(undefined, 'normal');
            doc.text('Voluntario Bombero', pageWidth / 2, 35, { align: 'center' });
            
            // Fecha de emisión
            doc.setFontSize(10);
            doc.text(new Date().toLocaleDateString('es-CL', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            }), pageWidth / 2, 48, { align: 'center' });

            yPos = 70;

            // DATOS PERSONALES
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(196, 30, 58);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('DATOS PERSONALES', pageWidth / 2, yPos + 7, { align: 'center' });
            
            yPos += 18;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');

            // Nombre completo
            const nombreCompleto = Utils.obtenerNombreCompleto(bombero);
            doc.setFont(undefined, 'bold');
            doc.text('Nombre Completo:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(nombreCompleto, margin + 50, yPos);
            yPos += 7;

            // RUN
            doc.setFont(undefined, 'bold');
            doc.text('RUN:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.rut || 'N/A', margin + 50, yPos);
            yPos += 7;

            // Fecha de Nacimiento y Edad
            const edad = Utils.calcularEdad(bombero.fechaNacimiento);
            doc.setFont(undefined, 'bold');
            doc.text('Fecha de Nacimiento:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(`${Utils.formatearFecha(bombero.fechaNacimiento)} (${edad} años)`, margin + 50, yPos);
            yPos += 7;

            // Sexo
            if (bombero.sexo) {
                doc.setFont(undefined, 'bold');
                doc.text('Sexo:', margin, yPos);
                doc.setFont(undefined, 'normal');
                doc.text(bombero.sexo, margin + 50, yPos);
                yPos += 7;
            }

            // Estado Civil
            if (bombero.estadoCivil) {
                doc.setFont(undefined, 'bold');
                doc.text('Estado Civil:', margin, yPos);
                doc.setFont(undefined, 'normal');
                doc.text(bombero.estadoCivil, margin + 50, yPos);
                yPos += 7;
            }

            // Profesión
            doc.setFont(undefined, 'bold');
            doc.text('Profesión:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.profesion || 'N/A', margin + 50, yPos);
            yPos += 7;

            // Grupo Sanguíneo
            doc.setFont(undefined, 'bold');
            doc.text('Grupo Sanguíneo:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.grupoSanguineo || 'N/A', margin + 50, yPos);
            yPos += 7;

            // Padrino 1
            if (bombero.nombrePrimerPadrino) {
                doc.setFont(undefined, 'bold');
                doc.text('Primer Padrino:', margin, yPos);
                doc.setFont(undefined, 'normal');
                doc.text(bombero.nombrePrimerPadrino, margin + 50, yPos);
                yPos += 7;
            }

            // Padrino 2
            if (bombero.nombreSegundoPadrino) {
                doc.setFont(undefined, 'bold');
                doc.text('Segundo Padrino:', margin, yPos);
                doc.setFont(undefined, 'normal');
                doc.text(bombero.nombreSegundoPadrino, margin + 50, yPos);
                yPos += 7;
            }

            yPos += 3;

            // DATOS DE CONTACTO
            doc.setFillColor(25, 118, 210); // Azul
            doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('DATOS DE CONTACTO', pageWidth / 2, yPos + 7, { align: 'center' });
            
            yPos += 18;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');

            // Domicilio
            doc.setFont(undefined, 'bold');
            doc.text('Domicilio:', margin, yPos);
            doc.setFont(undefined, 'normal');
            const domicilio = bombero.domicilio || 'N/A';
            const domicilioLines = doc.splitTextToSize(domicilio, pageWidth - margin - 60);
            doc.text(domicilioLines, margin + 50, yPos);
            yPos += (domicilioLines.length * 7);

            // Teléfono
            doc.setFont(undefined, 'bold');
            doc.text('Teléfono:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.telefono || 'N/A', margin + 50, yPos);
            yPos += 7;

            // Email
            doc.setFont(undefined, 'bold');
            doc.text('Email:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.email || 'N/A', margin + 50, yPos);
            yPos += 10;

            // DATOS INSTITUCIONALES
            doc.setFillColor(196, 30, 58);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text('DATOS INSTITUCIONALES', pageWidth / 2, yPos + 7, { align: 'center' });
            
            yPos += 18;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');

            // Clave Bombero
            doc.setFont(undefined, 'bold');
            doc.text('Clave Bombero:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.claveBombero, margin + 50, yPos);
            yPos += 7;

            // Número de Registro
            doc.setFont(undefined, 'bold');
            doc.text('N° Registro Nacional:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.nroRegistro || 'N/A', margin + 50, yPos);
            yPos += 7;

            // Compañía
            doc.setFont(undefined, 'bold');
            doc.text('Compañía:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(bombero.compania || 'N/A', margin + 50, yPos);
            yPos += 7;

            // Fecha de Ingreso
            doc.setFont(undefined, 'bold');
            doc.text('Fecha de Ingreso:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(Utils.formatearFecha(bombero.fechaIngreso), margin + 50, yPos);
            yPos += 7;

            // Antigüedad
            const antiguedad = Utils.calcularAntiguedadDetallada(bombero.fechaAntiguedad);
            doc.setFont(undefined, 'bold');
            doc.text('Antigüedad:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(`${antiguedad.años} años, ${antiguedad.meses} meses, ${antiguedad.dias} días`, margin + 50, yPos);
            yPos += 7;

            // Categoría
            const categoria = Utils.calcularCategoriaBombero(bombero.fechaAntiguedad);
            doc.setFont(undefined, 'bold');
            doc.text('Categoría:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(categoria.categoria, margin + 50, yPos);
            yPos += 7;

            // Estado
            const estadoBombero = bombero.estadoBombero || 'activo';
            doc.setFont(undefined, 'bold');
            doc.text('Estado:', margin, yPos);
            doc.setFont(undefined, 'normal');
            doc.text(estadoBombero.toUpperCase(), margin + 50, yPos);
            yPos += 15;

            // FOOTER
            doc.setFontSize(9);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(120, 120, 120);
            doc.text('Este documento certifica los datos personales e institucionales del voluntario', pageWidth / 2, pageHeight - 20, { align: 'center' });
            doc.text('registrados en el sistema del Cuerpo de Bomberos', pageWidth / 2, pageHeight - 15, { align: 'center' });
            doc.setFont(undefined, 'normal');
            doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

            // Guardar PDF
            doc.save(`Ficha_Personal_${bombero.claveBombero}_${new Date().toISOString().split('T')[0]}.pdf`);
            Utils.mostrarNotificacion('Ficha personal generada exitosamente', 'success');
        } catch (error) {
            console.error('Error al generar PDF:', error);
            Utils.mostrarNotificacion('Error al generar la ficha personal: ' + error.message, 'error');
        }
    }

    async toggleDatosEjemplo() {
        const tieneEjemplos = storage.tieneEjemplosActivos();
        
        if (tieneEjemplos) {
            const confirmado = await Utils.confirmarAccion(
                '¿Está seguro de eliminar TODOS los datos de ejemplo? ' +
                'Esto removerá 6 bomberos, 12 sanciones y 18 cargos de ejemplo.'
            );
            
            if (confirmado) {
                const resultado = storage.eliminarEjemplos();
                
                this.bomberos = storage.getBomberos();
                this.terminoBusqueda = '';
                document.getElementById('buscadorBomberos').value = '';
                this.renderizarBomberos();
                
                Utils.mostrarNotificacion(
                    `Ejemplos eliminados: ${resultado.bomberosEliminados} bomberos, ` +
                    `${resultado.sancionesEliminadas} sanciones, ` +
                    `${resultado.cargosEliminados} cargos`,
                    'success'
                );
            }
        } else {
            const confirmado = await Utils.confirmarAccion(
                '¿Cargar datos de ejemplo completos? ' +
                'Esto incluirá 6 bomberos con diferentes categorías, ' +
                '12 sanciones disciplinarias y 18 cargos históricos.'
            );
            
            if (confirmado) {
                const resultado = storage.cargarEjemplosCompletos();
                
                this.bomberos = storage.getBomberos();
                this.renderizarBomberos();
                
                Utils.mostrarNotificacion(
                    `Ejemplos cargados: ${resultado.bomberos} bomberos, ` +
                    `${resultado.sanciones} sanciones, ` +
                    `${resultado.cargos} cargos`,
                    'success'
                );
            }
        }
    }

    toggleInfoCategorias() {
        const info = document.getElementById('infoCategorias');
        info.style.display = info.style.display === 'none' ? 'block' : 'none';
    }

    verBeneficios() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const puedeVer = currentUser.role === 'Director' || 
                         currentUser.role === 'Super Administrador' || 
                         currentUser.role === 'Tesorero';
        
        if (puedeVer) {
            window.location.href = 'beneficios.html';
        } else {
            Utils.mostrarNotificacion('No tienes permisos para acceder a esta sección', 'error');
        }
    }

    verPagarBeneficios(id) {
        Utils.mostrarNotificacion('Redirigiendo a pago de beneficios...', 'info');
        setTimeout(() => window.location.href = `pagar-beneficio.html?id=${id}`, 1000);
    }

    async generarPDFDeudasBombero(bomberoId) {
        const bombero = this.bomberos.find(b => b.id === parseInt(bomberoId));
        if (!bombero) {
            Utils.mostrarNotificacion('Bombero no encontrado', 'error');
            return;
        }

        try {
            Utils.mostrarNotificacion('Generando PDF de deudas...', 'info');

            const esMartir = bombero.estadoBombero === 'martir';

            // Cargar datos desde Django API
            const [logoRes, configRes, cicloRes, estadoRes, asigRes] = await Promise.all([
                fetch('/api/voluntarios/logo-simple/').then(r => r.json()).catch(() => ({ tiene_logo: false })),
                fetch('/api/voluntarios/configuracion-cuotas-simple/').then(r => r.json()).catch(() => null),
                fetch('/api/voluntarios/ciclos-cuotas/?activo=true').then(r => r.json()).catch(() => []),
                fetch(`/api/voluntarios/${bombero.id}/estado-cuotas-simple/`).then(r => r.json()).catch(() => null),
                esMartir ? Promise.resolve([]) :
                    fetch(`/api/voluntarios/${bombero.id}/beneficios-asignados-simple/`).then(r => r.json()).catch(() => [])
            ]);

            const precioRegular    = configRes ? parseFloat(configRes.precio_regular    || 5000) : 5000;
            const precioEstudiante = configRes ? parseFloat(configRes.precio_estudiante || 3000) : 3000;

            const ciclos     = Array.isArray(cicloRes) ? cicloRes : (cicloRes.results || []);
            const anioActivo = ciclos.length > 0 ? ciclos[0].anio : new Date().getFullYear();

            const cuotasDesactivadas = estadoRes?.cuotas_desactivadas || false;
            const esEstudiante       = estadoRes?.es_estudiante       || false;

            // Pagos cuotas del año activo
            const pagosRes   = await fetch(`/api/voluntarios/pagos-cuotas-simple/?voluntario_id=${bombero.id}&anio=${anioActivo}`).then(r => r.json()).catch(() => []);
            const pagosCuotas = Array.isArray(pagosRes) ? pagosRes : [];

            const hoy       = new Date();
            const mesActual = hoy.getMonth() + 1;

            // Deudas cuotas
            const deudaCuotasData = [];
            let totalDeudaCuotas = 0;

            if (!cuotasDesactivadas && !esMartir) {
                const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                for (let mes = 1; mes <= mesActual; mes++) {
                    const pagado = pagosCuotas.find(p => {
                        const vid = p.voluntario || p.voluntario_id;
                        return vid == bombero.id && p.mes == mes && p.anio == anioActivo;
                    });
                    if (!pagado) {
                        const precio    = esEstudiante ? precioEstudiante : precioRegular;
                        const tipoTexto = esEstudiante ? 'Estudiante' : 'Regular';
                        deudaCuotasData.push({ mes: meses[mes - 1], anio: anioActivo, monto: precio, tipo: tipoTexto });
                        totalDeudaCuotas += precio;
                    }
                }
            }

            // Deudas beneficios
            const asignaciones       = Array.isArray(asigRes) ? asigRes : [];
            const deudaBeneficiosData = [];
            let totalDeudaBeneficios = 0;

            asignaciones.forEach(a => {
                if ((a.estado_pago === 'pendiente' || a.estado_pago === 'parcial') && parseFloat(a.monto_pendiente) > 0) {
                    deudaBeneficiosData.push({
                        nombre:         a.beneficio_nombre,
                        montoPendiente: parseFloat(a.monto_pendiente),
                        montoEsperado:  parseFloat(a.monto_total),
                        montoPagado:    parseFloat(a.monto_pagado)
                    });
                    totalDeudaBeneficios += parseFloat(a.monto_pendiente);
                }
            });

            const deudaTotal = totalDeudaCuotas + totalDeudaBeneficios;
            const fmtM = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(v);

            // ===== GENERAR PDF =====
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header bomberil
            doc.setFillColor(255, 193, 7);
            doc.rect(0, 0, 210, 8, 'F');
            doc.setFillColor(196, 30, 58);
            doc.rect(0, 8, 210, 32, 'F');

            if (logoRes.tiene_logo && logoRes.logo) {
                try { doc.addImage(logoRes.logo, 'PNG', 12, 10, 26, 26); } catch (e) {}
            }

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18); doc.setFont(undefined, 'bold');
            doc.text('INFORME DE DEUDAS', pageWidth / 2, 21, { align: 'center' });
            doc.setFontSize(10); doc.setFont(undefined, 'normal');
            doc.text(`Ciclo ${anioActivo}`, pageWidth / 2, 29, { align: 'center' });
            doc.setFontSize(8);
            doc.text(new Date().toLocaleDateString('es-CL'), pageWidth / 2, 36, { align: 'center' });

            let yPos = 50;

            // Info voluntario
            const nombreV = Utils.obtenerNombreCompleto(bombero);
            doc.setTextColor(0, 0, 0);
            doc.setFillColor(245, 245, 245);
            doc.roundedRect(15, yPos, 180, 22, 2, 2, 'F');
            doc.setFontSize(11); doc.setFont(undefined, 'bold');
            doc.setTextColor(196, 30, 58);
            doc.text(nombreV, 20, yPos + 8);
            doc.setFontSize(8); doc.setFont(undefined, 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(`Clave: ${bombero.claveBombero || 'N/A'}`, 20, yPos + 15);
            doc.text(`RUT: ${bombero.rut || 'N/A'}`, 70, yPos + 15);
            doc.text(`Compañía: ${bombero.compania || 'N/A'}`, 120, yPos + 15);

            // Resumen
            yPos += 30;
            doc.setFillColor(deudaTotal > 0 ? 255 : 232, deudaTotal > 0 ? 235 : 245, deudaTotal > 0 ? 238 : 233);
            doc.rect(15, yPos, 180, 26, 'F');
            doc.setFontSize(9); doc.setFont(undefined, 'normal');
            doc.setTextColor(80, 80, 80);
            doc.text(`Deuda en Cuotas: ${fmtM(totalDeudaCuotas)} (${deudaCuotasData.length} meses)`, 20, yPos + 8);
            doc.text(`Deuda en Beneficios: ${fmtM(totalDeudaBeneficios)} (${deudaBeneficiosData.length} beneficios)`, 20, yPos + 15);
            doc.setFont(undefined, 'bold'); doc.setFontSize(11);
            doc.setTextColor(deudaTotal > 0 ? 196 : 46, deudaTotal > 0 ? 30 : 125, deudaTotal > 0 ? 58 : 50);
            doc.text(`TOTAL ADEUDADO: ${fmtM(deudaTotal)}`, pageWidth / 2, yPos + 23, { align: 'center' });
            doc.setTextColor(0, 0, 0);

            // Encabezado
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text('INFORME DE DEUDAS', pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, yPos, { align: 'center' });

            // Datos del voluntario
            yPos += 15;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('DATOS DEL VOLUNTARIO', 15, yPos);
            
            yPos += 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Nombre: ${Utils.obtenerNombreCompleto(bombero)}`, 15, yPos);
            yPos += 6;
            doc.text(`Clave: ${bombero.claveBombero}`, 15, yPos);
            yPos += 6;
            doc.text(`RUT: ${bombero.rut}`, 15, yPos);
            yPos += 6;
            doc.text(`Compañía: ${bombero.compania}`, 15, yPos);

            // Resumen de deudas
            yPos += 12;
            doc.setFillColor(240, 240, 240);
            doc.rect(15, yPos, pageWidth - 30, 35, 'F');
            
            yPos += 8;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('RESUMEN DE DEUDAS', 20, yPos);
            
            yPos += 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const formatMonto = (monto) => new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                minimumFractionDigits: 0
            }).format(monto);
            
            doc.text(`Deuda en Cuotas: ${formatMonto(totalDeudaCuotas)} (${deudaCuotasData.length} meses)`, 20, yPos);
            yPos += 6;
            doc.text(`Deuda en Beneficios: ${formatMonto(totalDeudaBeneficios)} (${deudaBeneficiosData.length} beneficios)`, 20, yPos);
            
            yPos += 8;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            if (deudaTotal > 0) {
                doc.setTextColor(244, 67, 54); // Rojo
            } else {
                doc.setTextColor(76, 175, 80); // Verde
            }
            doc.text(`TOTAL ADEUDADO: ${formatMonto(deudaTotal)}`, 20, yPos);
            doc.setTextColor(0, 0, 0);

            // Detalle cuotas
            if (deudaCuotasData.length > 0) {
                yPos += 18;
                doc.setFillColor(196, 30, 58);
                doc.rect(15, yPos, 180, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9); doc.setFont(undefined, 'bold');
                doc.text('CUOTAS PENDIENTES', 20, yPos + 5.5);
                doc.text('MES', 90, yPos + 5.5, { align: 'center' });
                doc.text('TIPO', 130, yPos + 5.5, { align: 'center' });
                doc.text('MONTO', 192, yPos + 5.5, { align: 'right' });
                yPos += 8;
                doc.setTextColor(0, 0, 0);
                deudaCuotasData.forEach((d, i) => {
                    if (yPos > 265) { doc.addPage(); yPos = 20; }
                    const bg = i % 2 === 0 ? 252 : 255;
                    doc.setFillColor(bg, bg, bg); doc.rect(15, yPos, 180, 9, 'F');
                    doc.setFont(undefined, 'normal'); doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);
                    doc.text(d.mes, 20, yPos + 6);
                    doc.text(`${d.anio}`, 90, yPos + 6, { align: 'center' });
                    doc.setTextColor(d.tipo === 'Estudiante' ? 33 : 80, d.tipo === 'Estudiante' ? 150 : 80, d.tipo === 'Estudiante' ? 243 : 80);
                    doc.text(d.tipo, 130, yPos + 6, { align: 'center' });
                    doc.setFont(undefined, 'bold'); doc.setTextColor(196, 30, 58);
                    doc.text(fmtM(d.monto), 192, yPos + 6, { align: 'right' });
                    doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
                    yPos += 9;
                });
            }

            // Detalle beneficios
            if (deudaBeneficiosData.length > 0) {
                if (yPos > 230) { doc.addPage(); yPos = 20; }
                yPos += 12;
                doc.setFillColor(196, 30, 58);
                doc.rect(15, yPos, 180, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9); doc.setFont(undefined, 'bold');
                doc.text('BENEFICIOS PENDIENTES', 20, yPos + 5.5);
                doc.text('PAGADO', 130, yPos + 5.5, { align: 'center' });
                doc.text('PENDIENTE', 192, yPos + 5.5, { align: 'right' });
                yPos += 8;
                doc.setTextColor(0, 0, 0);
                deudaBeneficiosData.forEach((d, i) => {
                    if (yPos > 265) { doc.addPage(); yPos = 20; }
                    const bg = i % 2 === 0 ? 252 : 255;
                    doc.setFillColor(bg, bg, bg); doc.rect(15, yPos, 180, 9, 'F');
                    doc.setFont(undefined, 'normal'); doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);
                    doc.text(d.nombre.substring(0, 42), 20, yPos + 6);
                    doc.setTextColor(46, 125, 50);
                    doc.text(fmtM(d.montoPagado), 130, yPos + 6, { align: 'center' });
                    doc.setFont(undefined, 'bold'); doc.setTextColor(196, 30, 58);
                    doc.text(fmtM(d.montoPendiente), 192, yPos + 6, { align: 'right' });
                    doc.setFont(undefined, 'normal'); doc.setTextColor(0, 0, 0);
                    yPos += 9;
                });
            }

            if (deudaTotal === 0) {
                yPos += 20;
                doc.setFillColor(232, 245, 233);
                doc.rect(15, yPos, 180, 16, 'F');
                doc.setFontSize(10); doc.setFont(undefined, 'bold');
                doc.setTextColor(46, 125, 50);
                doc.text('✓ Sin deudas pendientes', pageWidth / 2, yPos + 10, { align: 'center' });
                doc.setTextColor(0, 0, 0);
            }

            // Footer
            const pages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pages; i++) {
                doc.setPage(i);
                doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
                doc.line(15, 285, 195, 285);
                doc.setFontSize(7); doc.setFont(undefined, 'normal');
                doc.setTextColor(130, 130, 130);
                doc.text('Sexta Compania De Bomberos de Puerto Montt', 20, 290);
                doc.text(`Pagina ${i} de ${pages}`, pageWidth / 2, 290, { align: 'center' });
                doc.text(new Date().toLocaleDateString('es-CL'), 190, 290, { align: 'right' });
            }

            const nombreArchivo = `Deudas_${bombero.claveBombero || bombero.id}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(nombreArchivo);
            Utils.mostrarNotificacion('✅ PDF de deudas generado exitosamente', 'success');

        } catch (error) {
            console.error('Error al generar PDF:', error);
            Utils.mostrarNotificacion('❌ Error al generar PDF: ' + error.message, 'error');
        }
    }

    async calcularYMostrarDeudores() {
        const pagosCuotas = storage.getPagosCuotas();
        const hoy = new Date();
        const mesActual = hoy.getMonth() + 1;
        const anioActual = hoy.getFullYear();
        
        let deudoresCuotas = [];
        
        this.bomberos.forEach(bombero => {
            // VALIDAR SI PUEDE PAGAR CUOTAS (categoría + estado)
            const categoria = Utils.calcularCategoriaBombero(bombero.fechaAntiguedad);
            const categoriaTexto = categoria.categoria || categoria;
            const esHonorarioCompania = categoriaTexto === 'Voluntario Honorario de Compañía';
            const esHonorarioCuerpo = categoriaTexto === 'Voluntario Honorario del Cuerpo';
            const esInsigne = categoriaTexto === 'Voluntario Insigne de Chile';
            
            // Exentos por categoría
            if (esHonorarioCompania || esHonorarioCuerpo || esInsigne) {
                return;
            }
            
            // Validar por estado del voluntario
            const validacionEstado = Utils.puedePagarCuotas(bombero);
            if (!validacionEstado.puede) {
                return; // No puede pagar (renunciado, separado, expulsado, mártir, fallecido)
            }
            
            // NUEVO: Verificar si las cuotas están activas para este bombero
            const tieneCuotasActivas = bombero.cuotasActivas !== false; // Por defecto true
            if (!tieneCuotasActivas) {
                return;
            }
            
            let mesesPendientes = 0;
            let deudaCuotas = 0;
            
            // Obtener precios configurados
            const configCuotas = localStorage.getItem('configuracionCuotas');
            const precioRegular = configCuotas ? JSON.parse(configCuotas).precioRegular : 5000;
            const precioEstudiante = configCuotas ? JSON.parse(configCuotas).precioEstudiante : 3000;
            
            for (let mes = 1; mes <= mesActual; mes++) {
                const pagado = pagosCuotas.find(p => 
                    p.bomberoId == bombero.id && 
                    p.mes == mes && 
                    p.anio == anioActual
                );
                
                if (!pagado) {
                    // Determinar precio según si es estudiante y la fecha
                    let precio = precioRegular;
                    
                    if (bombero.esEstudiante && bombero.mesInicioEstudiante && bombero.anioInicioEstudiante) {
                        // Comparar mes/año actual con mes/año inicio estudiante
                        const fechaMes = anioActual * 12 + mes;
                        const fechaInicioEstudiante = bombero.anioInicioEstudiante * 12 + bombero.mesInicioEstudiante;
                        
                        if (fechaMes >= fechaInicioEstudiante) {
                            precio = precioEstudiante;
                        }
                    }
                    
                    mesesPendientes++;
                    deudaCuotas += precio;
                }
            }
            
            if (mesesPendientes > 0) {
                deudoresCuotas.push({
                    bombero: bombero,
                    tipo: 'Cuota Social',
                    mesesPendientes: mesesPendientes,
                    deuda: deudaCuotas
                });
            }
        });
        
        const asignaciones = storage.getAsignacionesBeneficios();
        const beneficios = storage.getBeneficios();
        
        let deudoresBeneficios = [];
        
        asignaciones.forEach(asignacion => {
            const beneficio = beneficios.find(b => b.id === asignacion.beneficioId);
            if (!beneficio || beneficio.estado !== 'activo') return;
            
            if (asignacion.estadoPago === 'pendiente' || asignacion.estadoPago === 'parcial') {
                const bombero = this.bomberos.find(b => b.id === parseInt(asignacion.bomberoId));
                if (bombero) {
                    // EXCLUIR MÁRTIRES: Los mártires NO deben tener beneficios ni deudas en tesorería
                    const esMartir = bombero.estadoBombero === 'martir';
                    if (esMartir) {
                        return; // Saltar este bombero
                    }
                    
                    const deuda = asignacion.montoEsperado - asignacion.montoPagado;
                    deudoresBeneficios.push({
                        bombero: bombero,
                        tipo: 'Beneficio',
                        nombreBeneficio: beneficio.nombre,
                        deuda: deuda,
                        vencido: new Date(beneficio.fechaLimiteRendicion) < hoy
                    });
                }
            }
        });
        
        const totalDeudores = deudoresCuotas.length + deudoresBeneficios.length;
        
        const cantidadElement = document.getElementById('cantidadDeudores');
        if (cantidadElement) {
            cantidadElement.textContent = totalDeudores;
            
            const btnDeudores = document.getElementById('btnDeudores');
            if (btnDeudores) {
                if (totalDeudores > 0) {
                    btnDeudores.classList.add('tiene-deudores');
                } else {
                    btnDeudores.classList.remove('tiene-deudores');
                }
            }
        }
        
        window.deudoresData = { deudoresCuotas, deudoresBeneficios };
    }

    toggleNotificacionDeudores() {
        const notifExistente = document.querySelector('.notificacion-deudores');
        
        if (notifExistente) {
            notifExistente.style.animation = 'slideOutRight 0.4s ease-in';
            setTimeout(() => notifExistente.remove(), 400);
            return;
        }
        
        const { deudoresCuotas, deudoresBeneficios } = window.deudoresData || { deudoresCuotas: [], deudoresBeneficios: [] };
        const totalDeudores = deudoresCuotas.length + deudoresBeneficios.length;
        
        if (totalDeudores === 0) {
            Utils.mostrarNotificacion('No hay deudores en el sistema', 'success');
            return;
        }
        
        this.mostrarNotificacionDeudores(totalDeudores, deudoresCuotas, deudoresBeneficios);
    }

    mostrarNotificacionDeudores(total, deudoresCuotas, deudoresBeneficios) {
        const notificacion = document.createElement('div');
        notificacion.className = 'notificacion-deudores';
        
        const totalDeudaCuotas = deudoresCuotas.reduce((sum, d) => sum + d.deuda, 0);
        const totalDeudaBeneficios = deudoresBeneficios.reduce((sum, d) => sum + d.deuda, 0);
        const totalGeneral = totalDeudaCuotas + totalDeudaBeneficios;
        
        notificacion.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease;">
                <div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative; animation: slideInDown 0.4s ease;">
                    
                    <button onclick="this.closest('.notificacion-deudores').remove()" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: all 0.3s; z-index: 10;">✕</button>
                    
                    <!-- Header -->
                    <div style="background: rgba(255,255,255,0.1); padding: 30px; border-bottom: 2px solid rgba(255,255,255,0.2);">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <div style="font-size: 60px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">⚠️</div>
                            <div>
                                <h3 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Deudores Detectados</h3>
                                <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Se requiere revisión de pagos pendientes</p>
                            </div>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 20px; padding: 30px; background: rgba(255,255,255,0.05);">
                        <div style="text-align: center;">
                            <div style="color: rgba(255,255,255,0.7); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Total Deudores</div>
                            <div style="color: #ff5252; font-size: 48px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${total}</div>
                            <div style="color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 5px;">voluntarios con deudas</div>
                        </div>
                        
                        <div style="width: 2px; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent);"></div>
                        
                        <div style="text-align: center;">
                            <div style="color: rgba(255,255,255,0.7); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Total Adeudado</div>
                            <div style="color: #ffd700; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${this.formatearMonto(totalGeneral)}</div>
                            <div style="color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 5px;">suma de todas las deudas</div>
                        </div>
                    </div>

                    <!-- Detalle -->
                    <div style="padding: 30px;">
                        <div style="background: rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #ff9800;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="font-size: 40px;">💳</div>
                                <div style="flex: 1;">
                                    <div style="color: white; font-size: 16px; font-weight: 600; margin-bottom: 8px;">Cuotas Sociales</div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: rgba(255,255,255,0.8); font-size: 14px;">${deudoresCuotas.length} deudores</span>
                                        <span style="color: #ff9800; font-size: 20px; font-weight: 700;">${this.formatearMonto(totalDeudaCuotas)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; border-left: 4px solid #2196f3;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <div style="font-size: 40px;">🎫</div>
                                <div style="flex: 1;">
                                    <div style="color: white; font-size: 16px; font-weight: 600; margin-bottom: 8px;">Beneficios</div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: rgba(255,255,255,0.8); font-size: 14px;">${deudoresBeneficios.length} deudores</span>
                                        <span style="color: #2196f3; font-size: 20px; font-weight: 700;">${this.formatearMonto(totalDeudaBeneficios)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="padding: 30px; border-top: 2px solid rgba(255,255,255,0.1);">
                        <button onclick="sistemaBomberos.generarPDFDeudores()" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; padding: 18px; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <span style="font-size: 24px;">📄</span>
                            <span>Generar Reporte PDF Completo</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notificacion);
    }
    async exportarExcel() {
    if (this.bomberos.length === 0) {
        Utils.mostrarNotificacion('No hay bomberos para exportar', 'error');
        return;
    }

    try {
        const datosExcel = this.bomberos.map((bombero, index) => {
            const nombreCompleto = Utils.obtenerNombreCompleto(bombero);
            const antiguedad = Utils.calcularAntiguedadDetallada(bombero.fechaAntiguedad);
            const edad = Utils.calcularEdad(bombero.fechaNacimiento);
            const categoria = Utils.calcularCategoriaBombero(bombero.fechaAntiguedad);

            return {
                'N°': index + 1,
                'Clave': bombero.claveBombero,
                'Nombre': nombreCompleto,
                'RUT': bombero.rut,
                'Edad': edad,
                'Fecha Nacimiento': Utils.formatearFecha(bombero.fechaNacimiento),
                'Profesión': bombero.profesion,
                'Domicilio': bombero.domicilio,
                'N° Registro': bombero.nroRegistro,
                'Fecha Ingreso': Utils.formatearFecha(bombero.fechaIngreso),
                'Antigüedad (años)': antiguedad.años,
                'Compañía': bombero.compania,
                'Categoría': categoria.categoria,
                'Grupo Sanguíneo': bombero.grupoSanguineo,
                'Teléfono': bombero.telefono,
                'Email': bombero.email
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExcel);
        
        // Ajustar ancho de columnas
        const columnWidths = [
            { wch: 5 },  // N°
            { wch: 10 }, // Clave
            { wch: 35 }, // Nombre
            { wch: 15 }, // RUT
            { wch: 8 },  // Edad
            { wch: 15 }, // Fecha Nac
            { wch: 25 }, // Profesión
            { wch: 35 }, // Domicilio
            { wch: 15 }, // N° Registro
            { wch: 15 }, // Fecha Ingreso
            { wch: 15 }, // Antigüedad
            { wch: 20 }, // Compañía
            { wch: 35 }, // Categoría
            { wch: 15 }, // Grupo Sang
            { wch: 15 }, // Teléfono
            { wch: 30 }  // Email
        ];
        ws['!cols'] = columnWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Bomberos');
        XLSX.writeFile(wb, `Listado_Bomberos_${new Date().toISOString().split('T')[0]}.xlsx`);

        Utils.mostrarNotificacion('Excel exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error al exportar:', error);
        Utils.mostrarNotificacion('Error al exportar: ' + error.message, 'error');
    }
}

    async generarPDFDeudores() {
        if (typeof window.jspdf === 'undefined') {
            Utils.mostrarNotificacion('Cargando librería PDF...', 'info');
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.head.appendChild(script);
            
            script.onload = () => {
                const scriptAutoTable = document.createElement('script');
                scriptAutoTable.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
                document.head.appendChild(scriptAutoTable);
                scriptAutoTable.onload = () => this.generarPDFDeudoresReal();
            };
            return;
        }
        
        this.generarPDFDeudoresReal();
    }

    generarPDFDeudoresReal() {
        const { deudoresCuotas, deudoresBeneficios } = window.deudoresData || { deudoresCuotas: [], deudoresBeneficios: [] };
        
        if (deudoresCuotas.length === 0 && deudoresBeneficios.length === 0) {
            Utils.mostrarNotificacion('No hay deudores registrados', 'info');
            return;
        }
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;
            let yPos = 20;

            // Logo
            const logoCompania = localStorage.getItem('logoCompania');
            if (logoCompania) {
                try {
                    doc.addImage(logoCompania, 'PNG', 15, 10, 25, 25);
                } catch (error) {
                    console.warn('Error al cargar logo:', error);
                }
            }

            // Encabezado
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(211, 47, 47);
            doc.text('REPORTE DE DEUDORES', pageWidth / 2, yPos, { align: 'center' });
            
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);
            doc.text(`Fecha de Generación: ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, yPos, { align: 'center' });

            // Resumen general
            yPos += 15;
            const totalDeudaCuotas = deudoresCuotas.reduce((sum, d) => sum + d.deuda, 0);
            const totalDeudaBeneficios = deudoresBeneficios.reduce((sum, d) => sum + d.deuda, 0);
            const totalGeneral = totalDeudaCuotas + totalDeudaBeneficios;
            const totalDeudores = deudoresCuotas.length + deudoresBeneficios.length;

            doc.setFillColor(240, 240, 240);
            doc.rect(15, yPos, pageWidth - 30, 30, 'F');
            
            yPos += 8;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0);
            doc.text('RESUMEN GENERAL', 20, yPos);
            
            yPos += 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text(`Total de Deudores: ${totalDeudores}`, 20, yPos);
            doc.text(`Deuda Total: ${this.formatearMonto(totalGeneral)}`, pageWidth - 75, yPos);
            
            yPos += 20;
            
            if (deudoresCuotas.length > 0) {
                doc.setFontSize(13);
                doc.setTextColor(156, 39, 176);
                doc.text('DEUDORES DE CUOTAS SOCIALES', 20, yPos);
                yPos += 5;
                
                const datosCuotas = deudoresCuotas.map(d => [
                    d.bombero.claveBombero,
                    Utils.obtenerNombreCompleto(d.bombero),
                    d.mesesPendientes,
                    this.formatearMonto(d.deuda)
                ]);
                
                doc.autoTable({
                    head: [['Clave', 'Nombre', 'Meses Pendientes', 'Deuda']],
                    body: datosCuotas,
                    startY: yPos,
                    headStyles: { 
                        fillColor: [156, 39, 176],
                        textColor: 255,
                        fontStyle: 'bold',
                        fontSize: 10
                    },
                    bodyStyles: {
                        fontSize: 9,
                        cellPadding: 4, // MÁS ESPACIO entre filas
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200]
                    },
                    alternateRowStyles: {
                        fillColor: [250, 250, 250] // Filas alternadas para mejor lectura
                    },
                    margin: { left: 20, right: 20 },
                    theme: 'grid' // Grilla completa para mejor organización
                });
                
                yPos = doc.lastAutoTable.finalY + 15;
            }
            
            if (deudoresBeneficios.length > 0) {
                const deudoresPorBeneficio = {};
                
                deudoresBeneficios.forEach(d => {
                    if (!deudoresPorBeneficio[d.nombreBeneficio]) {
                        deudoresPorBeneficio[d.nombreBeneficio] = [];
                    }
                    deudoresPorBeneficio[d.nombreBeneficio].push(d);
                });
                
                Object.keys(deudoresPorBeneficio).forEach((nombreBeneficio) => {
                    const deudores = deudoresPorBeneficio[nombreBeneficio];
                    
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFontSize(13);
                    doc.setTextColor(255, 152, 0);
                    doc.text(`DEUDORES DE: ${nombreBeneficio.toUpperCase()}`, 20, yPos);
                    yPos += 3;
                    
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Total de deudores: ${deudores.length}`, 20, yPos);
                    yPos += 2;
                    
                    const datosDeudores = deudores.map(d => [
                        d.bombero.claveBombero,
                        Utils.obtenerNombreCompleto(d.bombero),
                        d.bombero.compania,
                        this.formatearMonto(d.deuda),
                        d.vencido ? 'VENCIDO' : 'Pendiente'
                    ]);
                    
                    doc.autoTable({
                        head: [['Clave', 'Nombre', 'Compañía', 'Deuda', 'Estado']],
                        body: datosDeudores,
                        startY: yPos,
                        headStyles: { 
                            fillColor: [255, 152, 0],
                            textColor: 255,
                            fontStyle: 'bold',
                            fontSize: 10
                        },
                        bodyStyles: {
                            fontSize: 9,
                            cellPadding: 4, // MÁS ESPACIO entre filas
                            lineWidth: 0.1,
                            lineColor: [200, 200, 200]
                        },
                        alternateRowStyles: {
                            fillColor: [255, 248, 225] // Filas alternadas (color naranja claro)
                        },
                        columnStyles: {
                            4: { 
                                textColor: function(data) {
                                    return data.cell.text[0] === 'VENCIDO' ? [244, 67, 54] : [100, 100, 100];
                                },
                                fontStyle: 'bold'
                            }
                        },
                        margin: { left: 20, right: 20 },
                        theme: 'grid' // Grilla completa
                    });
                    
                    yPos = doc.lastAutoTable.finalY + 12;
                    
                    const subtotal = deudores.reduce((sum, d) => sum + d.deuda, 0);
                    doc.setFontSize(10);
                    doc.setTextColor(0);
                    doc.text(`Subtotal ${nombreBeneficio}: ${this.formatearMonto(subtotal)}`, 20, yPos);
                    yPos += 15;
                });
            }
            
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }
            
            // Resumen detallado final
            doc.setFillColor(240, 248, 255);
            doc.rect(15, yPos, pageWidth - 30, 45, 'F');
            
            yPos += 8;
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0);
            doc.text('RESUMEN DETALLADO', 20, yPos);
            
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);
            doc.text(`Deudores de Cuotas Sociales:`, 25, yPos);
            doc.setTextColor(0);
            doc.text(`${deudoresCuotas.length}`, pageWidth - 70, yPos);
            
            yPos += 6;
            doc.setTextColor(100);
            doc.text(`Deuda Total en Cuotas:`, 25, yPos);
            doc.setTextColor(255, 152, 0);
            doc.setFont(undefined, 'bold');
            doc.text(`${this.formatearMonto(totalDeudaCuotas)}`, pageWidth - 70, yPos);
            
            yPos += 10;
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);
            doc.text(`Deudores de Beneficios:`, 25, yPos);
            doc.setTextColor(0);
            doc.text(`${deudoresBeneficios.length}`, pageWidth - 70, yPos);
            
            yPos += 6;
            doc.setTextColor(100);
            doc.text(`Deuda Total en Beneficios:`, 25, yPos);
            doc.setTextColor(33, 150, 243);
            doc.setFont(undefined, 'bold');
            doc.text(`${this.formatearMonto(totalDeudaBeneficios)}`, pageWidth - 70, yPos);
            
            yPos += 10;
            doc.setDrawColor(200);
            doc.line(20, yPos, pageWidth - 20, yPos);
            yPos += 8;
            
            doc.setFontSize(13);
            doc.setTextColor(244, 67, 54);
            doc.setFont(undefined, 'bold');
            doc.text(`DEUDA TOTAL GENERAL:`, 25, yPos);
            doc.text(`${this.formatearMonto(totalGeneral)}`, pageWidth - 70, yPos);
            
            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.setFont(undefined, 'normal');
                doc.text(
                    `Página ${i} de ${pageCount} | Generado por Sistema SEIS`,
                    105, 
                    doc.internal.pageSize.height - 10,
                    { align: 'center' }
                );
            }
            
            doc.save(`Reporte_Deudores_${new Date().toISOString().split('T')[0]}.pdf`);
            Utils.mostrarNotificacion('PDF de deudores generado exitosamente', 'success');
            
        } catch (error) {
            console.error('Error al generar PDF:', error);
            Utils.mostrarNotificacion('Error al generar PDF: ' + error.message, 'error');
        }
    }

    formatearMonto(monto) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(monto);
    }


    // ==================== MÉTODO PARA CARGAR LOGO ====================
async cargarLogoCompania(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
        Utils.mostrarNotificacion('El logo no debe superar 2MB', 'error');
        input.value = '';
        return;
    }
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
        Utils.mostrarNotificacion('Solo se permiten archivos de imagen', 'error');
        input.value = '';
        return;
    }
    
    try {
        // Leer imagen como Base64
        const logoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject('Error al leer el logo');
            reader.readAsDataURL(file);
        });
        
        // Guardar en localStorage
        localStorage.setItem('logoCompania', logoBase64);
        
        Utils.mostrarNotificacion('Logo de la compañía cargado exitosamente', 'success');
        
        // Previsualizar (opcional)
        console.log('[LOGO] Logo guardado, tamanio:', (logoBase64.length / 1024).toFixed(2), 'KB');
        
    } catch (error) {
        console.error('Error al cargar logo:', error);
        Utils.mostrarNotificacion('Error al cargar el logo', 'error');
    }
}

async generarPDFConsultaVoluntarios() {
    if (this.bomberos.length === 0) {
        Utils.mostrarNotificacion('No hay bomberos para exportar', 'error');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;

        // ==================== HEADER NEGRO (MÁS COMPACTO) ====================
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageWidth, 38, 'F'); // Reducido de 45 a 38

        // Logo (si existe)
        const logoCompania = localStorage.getItem('logoCompania');
        if (logoCompania) {
            try {
                doc.addImage(logoCompania, 'PNG', margin, 5, 28, 28); // Más pequeño
            } catch (error) {
                console.warn('Error al cargar logo:', error);
            }
        }

        // Texto IZQUIERDA del header (más compacto)
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont(undefined, 'bold');
        doc.text('CUERPO DE BOMBEROS', 48, 12);
        
        doc.setFontSize(13);
        doc.text('PUERTO MONTT', 48, 20);
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text('PUERTO MONTT de Junio 1865', 48, 27);

        // Texto CENTRO del header (más compacto)
        doc.setFontSize(15);
        doc.setFont(undefined, 'bold');
        doc.text('Listado de Voluntarios', pageWidth / 2, 16, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Ordenados por Antigüedad', pageWidth / 2, 24, { align: 'center' });

        // Texto DERECHA del header (más compacto)
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString('es-CL', { 
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const hora = ahora.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Fecha: ${fecha}`, pageWidth - margin, 14, { align: 'right' });
        doc.text(`Hora: ${hora}`, pageWidth - margin, 21, { align: 'right' });

        // ==================== TABLA (MÁS COMPACTA) ====================
        let yPos = 45; // Reducido de 55 a 45
        doc.setTextColor(0, 0, 0);

        // Texto "Descendente" (más cerca)
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Descendente', margin, yPos);
        yPos += 6; // Reducido de 10 a 6

        // Ordenar por antigüedad DESCENDENTE
        const bomberosOrdenados = [...this.bomberos].sort((a, b) => {
            const fechaA = new Date(a.fechaIngreso);
            const fechaB = new Date(b.fechaIngreso);
            return fechaA - fechaB;
        });

        // ENCABEZADOS DE TABLA (MÁS COMPACTOS)
        const headerY = yPos;
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, headerY, pageWidth - margin, headerY);
        
        yPos += 5; // Reducido de 7 a 5
        
        // Headers
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('Nº', margin + 2, yPos);
        doc.text('Rut', 22, yPos);
        doc.text('Nombres', 52, yPos);
        doc.text('Clave del', 135, yPos);
        doc.text('Bombero', 135, yPos + 3);
        doc.text('Compañía', 160, yPos);
        doc.text('Antigüedad', 195, yPos);
        doc.text('Fecha', 253, yPos);
        doc.text('Ingreso', 253, yPos + 3);
        
        yPos += 4; // Reducido de 5 a 4
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4; // Reducido de 6 a 4

        // ==================== FILAS DE DATOS (MÁS COMPACTAS) ====================
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);

        bomberosOrdenados.forEach((bombero, index) => {
            // Verificar si necesitamos nueva página
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = 15;
                
                // Repetir encabezados
                doc.setDrawColor(0);
                doc.setLineWidth(0.5);
                doc.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 5;
                
                doc.setFont(undefined, 'bold');
                doc.setFontSize(8);
                doc.text('Nº', margin + 2, yPos);
                doc.text('Rut', 22, yPos);
                doc.text('Nombres', 52, yPos);
                doc.text('Clave del', 135, yPos);
                doc.text('Bombero', 135, yPos + 3);
                doc.text('Compañía', 160, yPos);
                doc.text('Antigüedad', 195, yPos);
                doc.text('Fecha', 253, yPos);
                doc.text('Ingreso', 253, yPos + 3);
                
                yPos += 4;
                doc.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 4;
                
                doc.setFont(undefined, 'normal');
                doc.setFontSize(8);
            }

            // Datos del bombero
            const nombreCompleto = Utils.obtenerNombreCompleto(bombero).toUpperCase();
            const antiguedad = Utils.calcularAntiguedadDetallada(bombero.fechaAntiguedad);
            const claveBombero = bombero.claveBombero || 'N/A';
            const compania = bombero.compania || 'N/A';
            const fechaIngreso = bombero.fechaIngreso ? 
                new Date(bombero.fechaIngreso + 'T00:00:00').toLocaleDateString('es-CL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }) : 'N/A';
            
            // Formato antigüedad: "3 Años - 09 Meses - 24 Días"
            const antiguedadTexto = `${antiguedad.años} Años - ${String(antiguedad.meses).padStart(2, '0')} Meses - ${String(antiguedad.dias).padStart(2, '0')} Días`;

            // Imprimir fila
            doc.text(String(index + 1), margin + 2, yPos);
            doc.text(bombero.rut || 'N/A', 22, yPos);
            
            // Nombre más largo permitido
            const nombreMostrar = nombreCompleto.length > 50 ? 
                nombreCompleto.substring(0, 47) + '...' : 
                nombreCompleto;
            doc.text(nombreMostrar, 52, yPos);
            
            doc.text(claveBombero, 140, yPos, { align: 'center' });
            
            // Compañía
            const companiaMostrar = compania.length > 22 ? 
                compania.substring(0, 19) + '...' : 
                compania;
            doc.text(companiaMostrar, 160, yPos);
            
            doc.text(antiguedadTexto, 195, yPos);
            doc.text(fechaIngreso, 258, yPos, { align: 'center' });
            
            yPos += 5; // Reducido de 6 a 5
            
            // Línea horizontal más fina
            doc.setDrawColor(230);
            doc.setLineWidth(0.1);
            doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
        });

        // ==================== PIE DE PÁGINA ====================
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.setFont(undefined, 'normal');
            doc.text(
                `Sistema SEIS - Proyecto de Gestión Bomberil | Página ${i} de ${totalPages}`,
                pageWidth / 2,
                pageHeight - 6,
                { align: 'center' }
            );
        }

        // ==================== GUARDAR PDF ====================
        const nombreArchivo = `Listado_Voluntarios_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(nombreArchivo);
        
        Utils.mostrarNotificacion('PDF generado exitosamente', 'success');
        
    } catch (error) {
        console.error('❌ ERROR al generar PDF:', error);
        Utils.mostrarNotificacion('Error al generar PDF: ' + error.message, 'error');
    }
}

} // Fin de la clase SistemaBomberos

// ==================== FUNCIÓN GLOBAL PARA REPORTE DE ASISTENCIAS ====================
function verReporteAsistencias(bomberoId) {
    console.log('[REPORTE ASIST] Abriendo reporte para bombero:', bomberoId);
    // Guardar ID en localStorage para que el formulario lo tome
    localStorage.setItem('bomberoIdReporte', bomberoId);
    // Redirigir al formulario
    window.location.href = 'reporte-asistencias-individual.html';
}

// Inicializar sistema
document.addEventListener('DOMContentLoaded', () => {
    window.sistemaBomberos = new SistemaBomberos();
});