// ==================== UTILIDADES COMUNES ====================
class Utils {
    // ==================== FUNCIÓN HELPER PARA NOMBRES ====================
    static obtenerNombreCompleto(bombero) {
        if (!bombero) return 'N/A';
        
        // Si tiene la estructura nueva
        if (bombero.primerNombre) {
            const partes = [
                bombero.primerNombre,
                bombero.segundoNombre,
                bombero.tercerNombre,
                bombero.primerApellido,
                bombero.segundoApellido
            ].filter(p => p && p.trim());
            return partes.join(' ');
        }
        
        // Si tiene la estructura antigua (compatibilidad)
        if (bombero.nombre) {
            return bombero.nombre;
        }
        
        return 'N/A';
    }

    // ==================== VALIDACIONES ====================
    static validarRUN(run) {
        if (!run) return false;
        
        run = run.replace(/\./g, '').replace(/-/g, '');
        if (run.length < 8 || run.length > 9) return false;
        
        let cuerpo = run.slice(0, -1);
        let dv = run.slice(-1).toUpperCase();
        
        if (!/^\d+$/.test(cuerpo)) return false;
        
        let suma = 0;
        let multiplo = 2;
        
        for (let i = cuerpo.length - 1; i >= 0; i--) {
            suma += parseInt(cuerpo[i]) * multiplo;
            multiplo = multiplo < 7 ? multiplo + 1 : 2;
        }
        
        let resto = suma % 11;
        let dvCalculado = 11 - resto;
        
        if (dvCalculado === 11) dvCalculado = '0';
        if (dvCalculado === 10) dvCalculado = 'K';
        
        return dv === dvCalculado.toString();
    }

    static validarTelefono(telefono) {
        if (!telefono) return false;
        const regex = /^(\+56|56)?[2-9]\d{7,8}$/;
        return regex.test(telefono.replace(/\s/g, ''));
    }

    static validarEmail(email) {
        if (!email) return true;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static formatearRUN(run) {
        if (!run) return '';
        let valor = run.replace(/\D/g, '');
        if (valor.length > 1) {
            valor = valor.replace(/(\d{1,2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
        }
        return valor;
    }

    // ==================== FECHAS ====================
    static calcularEdad(fechaNacimiento) {
        if (!fechaNacimiento) return 0;
        
        const hoy = new Date();
        const nacimiento = new Date(fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const mes = hoy.getMonth() - nacimiento.getMonth();
        
        if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
            edad--;
        }
        return edad;
    }

    static calcularAntiguedadDetallada(fechaIngreso) {
        if (!fechaIngreso) return { años: 0, meses: 0, dias: 0 };
        
        const hoy = new Date();
        const ingreso = new Date(fechaIngreso + 'T00:00:00');
        
        let años = hoy.getFullYear() - ingreso.getFullYear();
        let meses = hoy.getMonth() - ingreso.getMonth();
        let dias = hoy.getDate() - ingreso.getDate();
        
        if (dias < 0) {
            meses--;
            const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
            dias += ultimoDiaMesAnterior;
        }
        
        if (meses < 0) {
            años--;
            meses += 12;
        }
        
        return { años, meses, dias };
    }

    static calcularCategoriaBombero(fechaIngreso) {
        const antiguedad = this.calcularAntiguedadDetallada(fechaIngreso);
        const anosCompletos = antiguedad.años;
        
        if (anosCompletos < 20) {
            return { categoria: 'Voluntario', color: '#1976d2', icono: '🔰' };
        } else if (anosCompletos >= 20 && anosCompletos <= 24) {
            return { categoria: 'Voluntario Honorario de Compañía', color: '#388e3c', icono: '🏅' };
        } else if (anosCompletos >= 25 && anosCompletos <= 49) {
            return { categoria: 'Voluntario Honorario del Cuerpo', color: '#f57c00', icono: '🎖️' };
        } else {
            return { categoria: 'Voluntario Insigne de Chile', color: '#d32f2f', icono: '🏆' };
        }
    }

    static formatearFecha(fecha) {
        if (!fecha) return '';
        return new Date(fecha).toLocaleDateString('es-CL');
    }

    // ==================== ARCHIVOS E IMÁGENES ====================
    static leerArchivoComoBase64(archivo) {
        return new Promise((resolve, reject) => {
            if (!archivo) {
                resolve(null);
                return;
            }

            if (archivo.size > 5 * 1024 * 1024) {
                reject(new Error('La imagen no debe superar los 5MB'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(archivo);
        });
    }

    static validarImagen(archivo) {
        if (!archivo) return true;
        
        const tiposPermitidos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        
        if (!tiposPermitidos.includes(archivo.type)) {
            return 'Solo se permiten imágenes JPEG, PNG, GIF o WebP';
        }
        
        if (archivo.size > maxSize) {
            return 'La imagen no debe superar los 5MB';
        }
        
        return true;
    }

    // ==================== BÚSQUEDA Y FILTROS ====================
    static filtrarBomberos(bomberos, termino) {
        if (!termino) return bomberos;
        
        const terminoLower = termino.toLowerCase();
        return bomberos.filter(bombero => {
            const nombreCompleto = this.obtenerNombreCompleto(bombero).toLowerCase();
            return nombreCompleto.includes(terminoLower) ||
                   (bombero.claveBombero && bombero.claveBombero.toLowerCase().includes(terminoLower)) ||
                   (bombero.rut && bombero.rut.toLowerCase().includes(terminoLower)) ||
                   (bombero.compania && bombero.compania.toLowerCase().includes(terminoLower));
        });
    }

    static ordenarBomberosPorAntiguedad(bomberos, ascendente = false) {
        return [...bomberos].sort((a, b) => {
            const antiguedadA = this.calcularAntiguedadDetallada(a.fechaIngreso).años;
            const antiguedadB = this.calcularAntiguedadDetallada(b.fechaIngreso).años;
            return ascendente ? antiguedadA - antiguedadB : antiguedadB - antiguedadA;
        });
    }

    // ==================== UI Y NOTIFICACIONES ====================
    static mostrarNotificacion(mensaje, tipo = 'success', duracion = 5000) {
        const notificacionExistente = document.getElementById('notificacion-global');
        if (notificacionExistente) {
            notificacionExistente.remove();
        }

        const notificacion = document.createElement('div');
        notificacion.id = 'notificacion-global';
        notificacion.className = `notificacion ${tipo}`;
        
        let icono = '✅';
        let color = '#4caf50';
        
        if (tipo === 'error') {
            icono = '❌';
            color = '#f44336';
        } else if (tipo === 'warning') {
            icono = '⚠️';
            color = '#ff9800';
        } else if (tipo === 'info') {
            icono = 'ℹ️';
            color = '#2196f3';
        }
        
        notificacion.innerHTML = `
            <div class="notificacion-contenido">
                <span class="notificacion-icono">${icono}</span>
                <span class="notificacion-mensaje">${mensaje}</span>
                <button class="notificacion-cerrar" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            min-width: 300px;
            max-width: 500px;
            background: ${color};
            color: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(notificacion);

        if (duracion > 0) {
            setTimeout(() => {
                if (notificacion.parentElement) {
                    notificacion.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => notificacion.remove(), 300);
                }
            }, duracion);
        }

        return notificacion;
    }

    static confirmarAccion(mensaje) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-confirmacion';
            modal.innerHTML = `
                <div class="modal-contenido">
                    <h3>⚠️ Confirmar acción</h3>
                    <p>${mensaje}</p>
                    <div class="modal-botones">
                        <button class="btn btn-secondary" id="cancelarBtn">❌ Cancelar</button>
                        <button class="btn btn-primary" id="confirmarBtn">✅ Confirmar</button>
                    </div>
                </div>
            `;

            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;

            modal.querySelector('.modal-contenido').style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            `;

            document.body.appendChild(modal);

            modal.querySelector('#confirmarBtn').onclick = () => {
                modal.remove();
                resolve(true);
            };

            modal.querySelector('#cancelarBtn').onclick = () => {
                modal.remove();
                resolve(false);
            };

            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            };
        });
    }

    // ==================== EXPORTACIÓN ====================
    static exportarAExcel(datos, nombreArchivo, nombreHoja = 'Datos') {
        return new Promise((resolve, reject) => {
            try {
                if (typeof XLSX === 'undefined') {
                    throw new Error('La librería XLSX no está cargada');
                }

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(datos);
                XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
                
                XLSX.writeFile(wb, nombreArchivo);
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    }

    // ==================== MISCELÁNEOS ====================
    static generarId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static sanitizarHTML(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    // ==================== FORMATEO DE NÚMEROS ====================
    static formatearMonto(monto) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(monto);
    }

    static formatearNumero(numero) {
        return new Intl.NumberFormat('es-CL').format(numero);
    }

    // ==================== VALIDACIONES DE ESTADO DE VOLUNTARIO ====================
    
    /**
     * Verifica si un voluntario puede pagar cuotas según su estado
     * @param {Object} bombero - Objeto del voluntario
     * @returns {Object} {puede: boolean, mensaje: string}
     */
    static puedePagarCuotas(bombero) {
        if (!bombero) return {puede: false, mensaje: 'Voluntario no encontrado'};
        
        const estado = bombero.estadoBombero;
        
        // Solo ACTIVOS pueden pagar
        if (estado === 'activo') {
            return {puede: true, mensaje: ''};
        }
        
        const mensajes = {
            'renunciado': '❌ Voluntario renunciado. No puede pagar cuotas.',
            'separado': '❌ Voluntario separado. No puede pagar cuotas.',
            'expulsado': '❌ Voluntario expulsado. No puede pagar cuotas.',
            'martir': '🕊️ Voluntario mártir. Exento de pago de cuotas.',
            'fallecido': '☠️ Voluntario fallecido. No puede pagar cuotas.'
        };
        
        return {
            puede: false,
            mensaje: mensajes[estado] || '❌ Estado del voluntario no permite pagos'
        };
    }

    /**
     * Verifica si un voluntario puede recibir uniformes
     */
    static puedeRecibirUniformes(bombero) {
        if (!bombero) return {puede: false, mensaje: 'Voluntario no encontrado'};
        
        const estado = bombero.estadoBombero;
        
        // Solo ACTIVOS pueden recibir uniformes
        if (estado === 'activo') {
            return {puede: true, mensaje: ''};
        }
        
        const mensajes = {
            'renunciado': '❌ Voluntario renunciado. No puede recibir uniformes.',
            'separado': '❌ Voluntario separado. No puede recibir uniformes.',
            'expulsado': '❌ Voluntario expulsado. No puede recibir uniformes.',
            'martir': '🕊️ Voluntario mártir. No puede recibir uniformes.',
            'fallecido': '☠️ Voluntario fallecido. No puede recibir uniformes.'
        };
        
        return {
            puede: false,
            mensaje: mensajes[estado] || '❌ Estado del voluntario no permite asignación de uniformes'
        };
    }

    /**
     * Verifica si un voluntario puede ser sancionado
     */
    static puedeSerSancionado(bombero) {
        if (!bombero) return {puede: false, mensaje: 'Voluntario no encontrado'};
        
        const estado = bombero.estadoBombero;
        
        // ACTIVOS, RENUNCIADOS y SEPARADOS pueden ser sancionados
        if (['activo', 'renunciado', 'separado'].includes(estado)) {
            return {puede: true, mensaje: ''};
        }
        
        const mensajes = {
            'expulsado': '❌ Voluntario ya expulsado. No se pueden registrar más sanciones.',
            'martir': '🕊️ Voluntario mártir. No se pueden registrar sanciones.',
            'fallecido': '☠️ Voluntario fallecido. No se pueden registrar sanciones.'
        };
        
        return {
            puede: false,
            mensaje: mensajes[estado] || '❌ Estado del voluntario no permite sanciones'
        };
    }

    /**
     * Verifica si un voluntario puede registrar asistencia
     */
    static puedeRegistrarAsistencia(bombero) {
        if (!bombero) return {puede: false, mensaje: 'Voluntario no encontrado'};
        
        const estado = bombero.estadoBombero;
        
        // ACTIVOS y MÁRTIRES pueden registrar asistencia
        if (['activo', 'martir'].includes(estado)) {
            return {puede: true, mensaje: ''};
        }
        
        const mensajes = {
            'renunciado': '❌ Voluntario renunciado. No puede registrar asistencia.',
            'separado': '❌ Voluntario separado. No puede registrar asistencia.',
            'expulsado': '❌ Voluntario expulsado. No puede registrar asistencia.',
            'fallecido': '☠️ Voluntario fallecido. No puede registrar asistencia.'
        };
        
        return {
            puede: false,
            mensaje: mensajes[estado] || '❌ Estado del voluntario no permite registro de asistencia'
        };
    }

    /**
     * Verifica si un voluntario puede recibir cargos/felicitaciones
     */
    static puedeRecibirCargosOFelicitaciones(bombero) {
        if (!bombero) return {puede: false, mensaje: 'Voluntario no encontrado'};
        
        const estado = bombero.estadoBombero;
        
        // Solo ACTIVOS pueden recibir cargos/felicitaciones
        if (estado === 'activo') {
            return {puede: true, mensaje: ''};
        }
        
        const mensajes = {
            'renunciado': '❌ Voluntario renunciado. No puede recibir cargos/felicitaciones.',
            'separado': '❌ Voluntario separado. No puede recibir cargos/felicitaciones.',
            'expulsado': '❌ Voluntario expulsado. No puede recibir cargos/felicitaciones.',
            'martir': '🕊️ Voluntario mártir. No puede recibir cargos/felicitaciones nuevos.',
            'fallecido': '☠️ Voluntario fallecido. No puede recibir cargos/felicitaciones.'
        };
        
        return {
            puede: false,
            mensaje: mensajes[estado] || '❌ Estado del voluntario no permite esta acción'
        };
    }

    /**
     * Verifica si un voluntario participa en el ranking
     */
    static participaEnRanking(bombero) {
        if (!bombero) return false;
        // Solo los ACTIVOS participan en el ranking
        return bombero.estadoBombero === 'activo';
    }

    /**
     * Verifica si un voluntario suma antigüedad
     */
    static sumaAntiguedad(bombero) {
        if (!bombero) return false;
        // Solo los ACTIVOS suman antigüedad
        return bombero.estadoBombero === 'activo';
    }

    /**
     * Verifica si un voluntario puede reintegrarse
     * REGLAS:
     * - Renunciado: 0 días (inmediato)
     * - Separado: 365 días (1 año)
     * - Expulsado: 730 días (2 años)
     * - Mártir/Fallecido: NO puede
     */
    static puedeReintegrarse(bombero) {
        if (!bombero) return {puede: false, mensaje: 'Voluntario no encontrado'};
        
        const estado = bombero.estadoBombero;
        const hoy = new Date();
        
        switch(estado) {
            case 'activo':
            case 'inactivo':
                return {
                    puede: false,
                    mensaje: 'El voluntario ya está activo'
                };
                
            case 'renunciado':
                // Puede reintegrarse inmediatamente
                return {
                    puede: true,
                    mensaje: 'Puede reintegrarse inmediatamente (sin tiempo mínimo)'
                };
                
            case 'separado':
                // Mínimo 1 año (365 días) desde la fecha de separación
                const fechaSepStr = bombero.fechaSeparacion || bombero.fecha_separacion;
                if (!fechaSepStr) {
                    return {puede: false, mensaje: 'Fecha de separación no encontrada'};
                }
                
                // Parsear fecha correctamente (formato YYYY-MM-DD de Django)
                const fechaSeparacion = new Date(fechaSepStr + 'T00:00:00');
                if (isNaN(fechaSeparacion.getTime())) {
                    console.error('[REINTEGRO] Fecha inválida:', fechaSepStr);
                    return {puede: false, mensaje: 'Fecha de separación no válida'};
                }
                
                const diasDesdeSeparacion = Math.floor((hoy - fechaSeparacion) / (1000*60*60*24));
                const DIAS_MIN_SEPARACION = 365;
                
                console.log('[REINTEGRO] Separación:', {
                    fechaSepStr,
                    fechaSeparacion,
                    diasDesdeSeparacion,
                    DIAS_MIN_SEPARACION
                });
                
                if (diasDesdeSeparacion >= DIAS_MIN_SEPARACION) {
                    return {
                        puede: true,
                        mensaje: `Puede reintegrarse (han pasado ${diasDesdeSeparacion} días)`
                    };
                } else {
                    const diasRestantes = DIAS_MIN_SEPARACION - diasDesdeSeparacion;
                    const fechaElegible = new Date(fechaSeparacion);
                    fechaElegible.setDate(fechaElegible.getDate() + DIAS_MIN_SEPARACION);
                    return {
                        puede: false,
                        mensaje: `Debe esperar hasta ${fechaElegible.toLocaleDateString('es-CL')} (${diasRestantes} días restantes)`
                    };
                }
                
            case 'expulsado':
                // Mínimo 2 años (730 días) desde la fecha de expulsión
                const fechaExpStr = bombero.fechaExpulsion || bombero.fecha_expulsion;
                if (!fechaExpStr) {
                    return {puede: false, mensaje: 'Fecha de expulsión no encontrada'};
                }
                
                // Parsear fecha correctamente (formato YYYY-MM-DD de Django)
                const fechaExpulsion = new Date(fechaExpStr + 'T00:00:00');
                if (isNaN(fechaExpulsion.getTime())) {
                    console.error('[REINTEGRO] Fecha inválida:', fechaExpStr);
                    return {puede: false, mensaje: 'Fecha de expulsión no válida'};
                }
                
                const diasDesdeExpulsion = Math.floor((hoy - fechaExpulsion) / (1000*60*60*24));
                const DIAS_MIN_EXPULSION = 730;
                
                console.log('[REINTEGRO] Expulsión:', {
                    fechaExpStr,
                    fechaExpulsion,
                    diasDesdeExpulsion,
                    DIAS_MIN_EXPULSION
                });
                
                if (diasDesdeExpulsion >= DIAS_MIN_EXPULSION) {
                    return {
                        puede: true,
                        mensaje: `Puede reintegrarse (han pasado ${diasDesdeExpulsion} días, más de 2 años)`
                    };
                } else {
                    const diasRestantes = DIAS_MIN_EXPULSION - diasDesdeExpulsion;
                    const fechaElegible = new Date(fechaExpulsion);
                    fechaElegible.setDate(fechaElegible.getDate() + DIAS_MIN_EXPULSION);
                    return {
                        puede: false,
                        mensaje: `Debe esperar hasta ${fechaElegible.toLocaleDateString('es-CL')} (${diasRestantes} días restantes)`
                    };
                }
                
            case 'martir':
            case 'fallecido':
                return {
                    puede: false,
                    mensaje: 'No aplica reintegración'
                };
                
            default:
                return {
                    puede: false,
                    mensaje: 'Estado no válido para reintegración'
                };
        }
    }

    /**
     * Obtiene el badge/etiqueta visual del estado
     */
    static obtenerBadgeEstado(estado) {
        const badges = {
            'activo': '✅ Activo',
            'renunciado': '🔄 Renunciado',
            'separado': '⏸️ Separado',
            'expulsado': '❌ Expulsado',
            'martir': '🕊️ Mártir',
            'fallecido': '☠️ Fallecido'
        };
        
        return badges[estado] || estado;
    }
}

// Añadir estilos CSS para las notificaciones
const estilosNotificaciones = document.createElement('style');
estilosNotificaciones.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notificacion-contenido {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notificacion-mensaje {
        flex: 1;
    }
    
    .notificacion-cerrar {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        margin-left: auto;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    }
    
    .notificacion-cerrar:hover {
        background: rgba(255,255,255,0.2);
    }
    
    .modal-botones {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
    }
    
    .modal-contenido h3 {
        margin: 0 0 15px 0;
        color: #333;
    }
    
    .modal-contenido p {
        margin: 0 0 20px 0;
        color: #666;
        line-height: 1.5;
    }
`;
document.head.appendChild(estilosNotificaciones);