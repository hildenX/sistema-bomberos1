// =====================================================
// SISTEMA DE CLAVES RADIALES - BOMBEROS
// =====================================================

const CLAVES_RADIALES = {
    // 10-0: LLAMADOS ESTRUCTURALES
    "10-0": {
        nombre: "Llamado estructural",
        subclaves: {
            "10-0-1": "Inflamación de ducto evacuador de gases",
            "10-0-2": "Principio de incendio en vivienda",
            "10-0-3": "Llamado estructural en altura (estructura sobre 3 pisos)",
            "10-0-4": "Llamado estructural industrial",
            "10-0-5": "Llamado estructural menor o rebrote de incendio",
            "10-0-6": "Llamado en embarcación"
        }
    },
    
    // 10-1: INCENDIOS DE VEHÍCULOS
    "10-1": {
        nombre: "Llamado por incendio de vehículo",
        subclaves: {
            "10-1-1": "Incendio de vehículo menor",
            "10-1-2": "Incendio de vehículo con pasajeros",
            "10-1-3": "Incendio de vehículo con transporte de carga"
        }
    },
    
    // 10-2: FUEGO EN PASTIZALES O BASURERO
    "10-2": {
        nombre: "Llamado por fuego en pastizales o basurero",
        subclaves: {}
    },
    
    // 10-3: RESCATE DE PERSONAS
    "10-3": {
        nombre: "Llamado a rescate de personas de emergencia",
        subclaves: {
            "10-3-1": "Llamado de rescate de persona encerrada",
            "10-3-2": "Llamado de rescate de persona",
            "10-3-3": "Llamado de rescate de persona en altura o desnivel",
            "10-3-4": "Llamado de rescate de persona en aguas en movimiento",
            "10-3-5": "Llamado de rescate de persona atrapada en estructura colapsada",
            "10-3-6": "Llamado de rescate de persona en espacios confinados"
        }
    },
    
    // 10-4: RESCATE VEHICULAR
    "10-4": {
        nombre: "Llamado a rescate vehicular",
        subclaves: {
            "10-4-1": "Rescate vehicular de vehículo menor",
            "10-4-2": "Rescate vehicular de vehículo de transporte de pasajeros (bus, camión, minibus, furgón, etc)",
            "10-4-3": "Rescate vehicular de camión con carga de materiales peligrosos",
            "10-4-4": "Rescate vehicular en desnivel, aguas o quebradas"
        }
    },
    
    // 10-5: HAZ-MAT
    "10-5": {
        nombre: "Llamado haz-mat",
        subclaves: {
            "10-5-1": "Llamado de derrame de hidrocarburos",
            "10-5-2": "Llamado de incidente con materiales peligrosos"
        }
    },
    
    // 10-6: GASES
    "10-6": {
        nombre: "Llamado a emanación de gases",
        subclaves: {
            "10-6-1": "Verificar olor a combustible",
            "10-6-2": "Verificar fuga o olor a gas licuado o gas natural",
            "10-6-3": "Explosión de gas",
            "10-6-4": "Explosión de gas con fuego"
        }
    },
    
    // 10-7: ELÉCTRICO
    "10-7": {
        nombre: "Llamado eléctrico",
        subclaves: {}
    },
    
    // 10-8: NO CLASIFICADO
    "10-8": {
        nombre: "Llamado no clasificado",
        subclaves: {}
    },
    
    // 10-9: OTROS SERVICIOS
    "10-9": {
        nombre: "Llamado a otros servicios",
        subclaves: {}
    },
    
    // 10-10: INCENDIO DECLARADO
    "10-10": {
        nombre: "INCENDIO DECLARADO",
        subclaves: {}
    },
    
    // 10-11: SERVICIO AÉREO
    "10-11": {
        nombre: "Llamado a servicio o accidente aéreo",
        subclaves: {}
    },
    
    // 10-12: APOYO A OTROS CUERPOS
    "10-12": {
        nombre: "Apoyo a otros Cuerpos de Bomberos",
        subclaves: {}
    },
    
    // 10-13: ATENTADO TERRORISTA
    "10-13": {
        nombre: "Llamado a bomba, atentado terrorista, etc",
        subclaves: {}
    },
    
    // 10-14: SIMULACRO
    "10-14": {
        nombre: "Simulacro",
        subclaves: {}
    }
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Obtiene todas las claves en formato plano para selectores
 * @returns {Array} Array de objetos {value, text, grupo}
 */
function obtenerClavesPlanas() {
    const claves = [];
    
    for (const [codigoPadre, datos] of Object.entries(CLAVES_RADIALES)) {
        // Agregar clave padre
        claves.push({
            value: codigoPadre,
            text: `${codigoPadre} - ${datos.nombre}`,
            grupo: codigoPadre,
            esPadre: true
        });
        
        // Agregar subclaves
        if (datos.subclaves && Object.keys(datos.subclaves).length > 0) {
            for (const [codigoHijo, descripcion] of Object.entries(datos.subclaves)) {
                claves.push({
                    value: codigoHijo,
                    text: `  ${codigoHijo} - ${descripcion}`,
                    grupo: codigoPadre,
                    esPadre: false
                });
            }
        }
    }
    
    return claves;
}

/**
 * Obtiene solo las claves padre para filtros
 * @returns {Array} Array de objetos {value, text}
 */
function obtenerClavesPadre() {
    return Object.entries(CLAVES_RADIALES).map(([codigo, datos]) => ({
        value: codigo,
        text: `${codigo} - ${datos.nombre}`
    }));
}

/**
 * Verifica si una clave pertenece a un grupo padre
 * @param {string} clave - Clave a verificar (ej: "10-0-1")
 * @param {string} padre - Código padre (ej: "10-0")
 * @returns {boolean}
 */
function perteneceAGrupo(clave, padre) {
    if (clave === padre) return true;
    return clave.startsWith(padre + "-");
}

/**
 * Obtiene la descripción de una clave
 * @param {string} clave - Código de la clave
 * @returns {string} Descripción de la clave
 */
function obtenerDescripcionClave(clave) {
    // Buscar en claves padre
    if (CLAVES_RADIALES[clave]) {
        return CLAVES_RADIALES[clave].nombre;
    }
    
    // Buscar en subclaves
    for (const [codigoPadre, datos] of Object.entries(CLAVES_RADIALES)) {
        if (datos.subclaves[clave]) {
            return datos.subclaves[clave];
        }
    }
    
    return clave; // Si no se encuentra, devolver el código
}

/**
 * Genera HTML de un selector de claves radiales
 * @param {string} id - ID del select
 * @param {string} claveSeleccionada - Clave a preseleccionar (opcional)
 * @returns {string} HTML del select
 */
function generarSelectorClaves(id, claveSeleccionada = '') {
    const claves = obtenerClavesPlanas();
    let html = `<select id="${id}" name="${id}" class="form-control" required>`;
    html += `<option value="">Seleccione una clave</option>`;
    
    for (const clave of claves) {
        const selected = clave.value === claveSeleccionada ? 'selected' : '';
        const style = clave.esPadre ? 'font-weight: bold;' : 'padding-left: 20px;';
        html += `<option value="${clave.value}" ${selected} style="${style}">${clave.text}</option>`;
    }
    
    html += `</select>`;
    return html;
}

/**
 * Genera HTML de un filtro de claves (solo padres + opción "Todas")
 * @param {string} id - ID del select
 * @returns {string} HTML del select
 */
function generarFiltroClaves(id) {
    const clavesPadre = obtenerClavesPadre();
    let html = `<select id="${id}" name="${id}" class="form-control">`;
    html += `<option value="">Todas las claves</option>`;
    
    for (const clave of clavesPadre) {
        html += `<option value="${clave.value}">${clave.text}</option>`;
    }
    
    html += `</select>`;
    return html;
}

/**
 * Obtiene solo las claves SELECCIONABLES (sin hijos + todas las subclaves)
 * Las claves padre que tienen subclaves NO deben ser seleccionables
 * @returns {Array} Array de objetos {value, text, grupo}
 */
function obtenerClavesSeleccionables() {
    console.log('[CLAVES] Generando claves seleccionables...');
    const claves = [];
    
    for (const [codigoPadre, datos] of Object.entries(CLAVES_RADIALES)) {
        const tieneSubclaves = datos.subclaves && Object.keys(datos.subclaves).length > 0;
        
        // Si NO tiene subclaves, la clave padre es seleccionable
        if (!tieneSubclaves) {
            claves.push({
                value: codigoPadre,
                text: `${codigoPadre} - ${datos.nombre}`,
                grupo: codigoPadre
            });
            console.log(`[CLAVES] Agregada clave hoja: ${codigoPadre}`);
        } else {
            // Si tiene subclaves, agregar solo las subclaves (no el padre)
            const numSubclaves = Object.keys(datos.subclaves).length;
            console.log(`[CLAVES] ${codigoPadre} tiene ${numSubclaves} subclaves, agregando solo hijos`);
            
            for (const [codigoHijo, descripcion] of Object.entries(datos.subclaves)) {
                claves.push({
                    value: codigoHijo,
                    text: `${codigoHijo} - ${descripcion}`,
                    grupo: codigoPadre
                });
            }
        }
    }
    
    console.log(`[CLAVES] Total de claves seleccionables: ${claves.length}`);
    return claves;
}

/**
 * Verifica si una clave es HOJA (no tiene hijos)
 * @param {string} clave - Código de la clave
 * @returns {boolean}
 */
function esClaveHoja(clave) {
    // Si la clave está en CLAVES_RADIALES
    if (CLAVES_RADIALES[clave]) {
        const datos = CLAVES_RADIALES[clave];
        // Es hoja si NO tiene subclaves
        return !datos.subclaves || Object.keys(datos.subclaves).length === 0;
    }
    
    // Si no está en el diccionario principal, buscar en subclaves
    for (const [codigoPadre, datos] of Object.entries(CLAVES_RADIALES)) {
        if (datos.subclaves && datos.subclaves[clave]) {
            // Es una subclave, por lo tanto es hoja
            return true;
        }
    }
    
    return false;
}
