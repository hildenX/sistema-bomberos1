// ==================== SISTEMA DE CICLOS DE ASISTENCIAS ====================
// Gestiona períodos personalizados para conteo de asistencias

class CiclosAsistencias {
    constructor() {
        this.ciclos = this.cargarCiclos();
    }

    /**
     * Cargar ciclos desde localStorage
     */
    cargarCiclos() {
        const ciclos = JSON.parse(localStorage.getItem('ciclosAsistencias')) || [];
        
        // Si no hay ciclos, crear uno por defecto
        if (ciclos.length === 0) {
            const cicloDefault = this.crearCicloDefault();
            ciclos.push(cicloDefault);
            this.guardarCiclos(ciclos);
        }
        
        return ciclos;
    }

    /**
     * Crear ciclo por defecto (12 oct año pasado - 11 oct año actual)
     */
    crearCicloDefault() {
        const hoy = new Date();
        const añoActual = hoy.getFullYear();
        
        // Si estamos antes del 12 de octubre, el ciclo empezó el año pasado
        // Si estamos después del 12 de octubre, el ciclo empezó este año
        const mesActual = hoy.getMonth(); // 0-11
        const diaActual = hoy.getDate();
        
        let añoInicio, añoFin;
        if (mesActual < 9 || (mesActual === 9 && diaActual < 12)) {
            // Antes del 12 de octubre
            añoInicio = añoActual - 1;
            añoFin = añoActual;
        } else {
            // Después del 12 de octubre
            añoInicio = añoActual;
            añoFin = añoActual + 1;
        }
        
        return {
            id: `ciclo_${añoInicio}_${añoFin}`,
            nombre: `Ciclo ${añoInicio}-${añoFin}`,
            fechaInicio: `${añoInicio}-10-12`, // 12 octubre
            fechaFin: `${añoFin}-10-11`, // 11 octubre
            estado: 'activo', // activo, cerrado
            fechaCreacion: new Date().toISOString(),
            fechaCierre: null,
            descripcion: `Ciclo de asistencias del 12 de octubre ${añoInicio} al 11 de octubre ${añoFin}`
        };
    }

    /**
     * Guardar ciclos en localStorage
     */
    guardarCiclos(ciclos) {
        localStorage.setItem('ciclosAsistencias', JSON.stringify(ciclos));
        this.ciclos = ciclos;
    }

    /**
     * Obtener ciclo activo
     */
    obtenerCicloActivo() {
        return this.ciclos.find(c => c.estado === 'activo');
    }

    /**
     * Obtener todos los ciclos
     */
    obtenerTodosCiclos() {
        return this.ciclos.sort((a, b) => {
            return new Date(b.fechaInicio) - new Date(a.fechaInicio);
        });
    }

    /**
     * Crear nuevo ciclo
     */
    crearNuevoCiclo(fechaInicio, fechaFin, nombre, descripcion) {
        // Validar fechas
        if (new Date(fechaInicio) >= new Date(fechaFin)) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha de fin');
        }

        // Cerrar ciclo activo si existe
        const cicloActivo = this.obtenerCicloActivo();
        if (cicloActivo) {
            this.cerrarCiclo(cicloActivo.id);
        }

        const nuevoCiclo = {
            id: `ciclo_${Date.now()}`,
            nombre: nombre || `Ciclo ${fechaInicio} - ${fechaFin}`,
            fechaInicio,
            fechaFin,
            estado: 'activo',
            fechaCreacion: new Date().toISOString(),
            fechaCierre: null,
            descripcion: descripcion || ''
        };

        this.ciclos.push(nuevoCiclo);
        this.guardarCiclos(this.ciclos);

        console.log('✅ Nuevo ciclo creado:', nuevoCiclo);
        return nuevoCiclo;
    }

    /**
     * Cerrar ciclo
     */
    cerrarCiclo(cicloId) {
        const ciclo = this.ciclos.find(c => c.id === cicloId);
        if (!ciclo) {
            throw new Error('Ciclo no encontrado');
        }

        if (ciclo.estado === 'cerrado') {
            throw new Error('El ciclo ya está cerrado');
        }

        ciclo.estado = 'cerrado';
        ciclo.fechaCierre = new Date().toISOString();

        this.guardarCiclos(this.ciclos);

        console.log('✅ Ciclo cerrado:', ciclo);
        return ciclo;
    }

    /**
     * Reabrir ciclo
     */
    reabrirCiclo(cicloId) {
        // Cerrar cualquier ciclo activo
        const cicloActivo = this.obtenerCicloActivo();
        if (cicloActivo && cicloActivo.id !== cicloId) {
            this.cerrarCiclo(cicloActivo.id);
        }

        const ciclo = this.ciclos.find(c => c.id === cicloId);
        if (!ciclo) {
            throw new Error('Ciclo no encontrado');
        }

        ciclo.estado = 'activo';
        ciclo.fechaCierre = null;

        this.guardarCiclos(this.ciclos);

        console.log('✅ Ciclo reabierto:', ciclo);
        return ciclo;
    }

    /**
     * Verificar si una fecha está dentro de un ciclo
     */
    estaEnCiclo(fecha, ciclo) {
        const fechaObj = new Date(fecha);
        const fechaInicio = new Date(ciclo.fechaInicio);
        const fechaFin = new Date(ciclo.fechaFin);

        return fechaObj >= fechaInicio && fechaObj <= fechaFin;
    }

    /**
     * Obtener ciclo de una fecha específica
     */
    obtenerCicloPorFecha(fecha) {
        return this.ciclos.find(c => this.estaEnCiclo(fecha, c));
    }

    /**
     * Obtener estadísticas de un ciclo
     */
    obtenerEstadisticasCiclo(cicloId) {
        const ciclo = this.ciclos.find(c => c.id === cicloId);
        if (!ciclo) return null;

        // Obtener asistencias del ciclo
        const asistencias = JSON.parse(localStorage.getItem('asistencias')) || [];
        const asistenciasCiclo = asistencias.filter(a => this.estaEnCiclo(a.fecha, ciclo));

        // Obtener ranking del ciclo
        const ranking = this.obtenerRankingCiclo(cicloId);

        return {
            ciclo,
            totalAsistencias: asistenciasCiclo.length,
            asistenciasPorTipo: this.contarPorTipo(asistenciasCiclo),
            totalVoluntarios: Object.keys(ranking).length,
            ranking: ranking
        };
    }

    /**
     * Contar asistencias por tipo
     */
    contarPorTipo(asistencias) {
        return asistencias.reduce((acc, a) => {
            const tipo = a.tipo || 'sin_tipo';
            acc[tipo] = (acc[tipo] || 0) + 1;
            return acc;
        }, {});
    }

    /**
     * Obtener ranking de un ciclo específico
     */
    obtenerRankingCiclo(cicloId) {
        const ciclo = this.ciclos.find(c => c.id === cicloId);
        if (!ciclo) return {};

        // Obtener todas las asistencias
        const asistencias = JSON.parse(localStorage.getItem('asistencias')) || [];
        
        // Filtrar asistencias del ciclo
        const asistenciasCiclo = asistencias.filter(a => this.estaEnCiclo(a.fecha, ciclo));

        // Construir ranking
        const ranking = {};

        asistenciasCiclo.forEach(asistencia => {
            if (!asistencia.asistentes) return;

            asistencia.asistentes.forEach(asistente => {
                if (asistente.bomberoId) {
                    const id = asistente.bomberoId;

                    if (!ranking[id]) {
                        ranking[id] = {
                            nombre: asistente.nombre,
                            claveBombero: asistente.claveBombero,
                            total: 0,
                            emergencias: 0,
                            asambleas: 0,
                            ejercicios: 0,
                            citaciones: 0,
                            otras: 0
                        };
                    }

                    ranking[id].total++;

                    const tipo = asistencia.tipo;
                    if (tipo === 'emergencia') ranking[id].emergencias++;
                    else if (tipo === 'asamblea') ranking[id].asambleas++;
                    else if (tipo === 'ejercicios') ranking[id].ejercicios++;
                    else if (tipo === 'citaciones') ranking[id].citaciones++;
                    else if (tipo === 'otras') ranking[id].otras++;
                }
            });
        });

        return ranking;
    }

    /**
     * Eliminar ciclo
     */
    eliminarCiclo(cicloId) {
        const ciclo = this.ciclos.find(c => c.id === cicloId);
        if (!ciclo) {
            throw new Error('Ciclo no encontrado');
        }

        if (ciclo.estado === 'activo') {
            throw new Error('No se puede eliminar un ciclo activo. Ciérralo primero.');
        }

        this.ciclos = this.ciclos.filter(c => c.id !== cicloId);
        this.guardarCiclos(this.ciclos);

        console.log('✅ Ciclo eliminado:', cicloId);
        return true;
    }

    /**
     * Formatear fecha para mostrar
     */
    formatearFecha(fecha) {
        const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(fecha).toLocaleDateString('es-ES', opciones);
    }

    /**
     * Obtener duración del ciclo en días
     */
    obtenerDuracionCiclo(ciclo) {
        const inicio = new Date(ciclo.fechaInicio);
        const fin = new Date(ciclo.fechaFin);
        const diferencia = fin - inicio;
        return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    }
}

// Instancia global
window.ciclosAsistencias = new CiclosAsistencias();
