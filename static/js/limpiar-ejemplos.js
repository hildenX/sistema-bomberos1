// ==================== SCRIPT PARA LIMPIAR EJEMPLOS ====================
// Ejecutar este script UNA VEZ para eliminar datos de ejemplo del localStorage

(function limpiarEjemplos() {
    console.log('🧹 Iniciando limpieza de ejemplos...');
    
    try {
        // Obtener bomberos actuales
        const bomberos = JSON.parse(localStorage.getItem('bomberos')) || [];
        console.log('📊 Total de bomberos antes:', bomberos.length);
        
        // Filtrar bomberos que NO sean ejemplos
        // Los ejemplos tienen IDs 1-6 típicamente
        const bomberosSinEjemplos = bomberos.filter(b => {
            // Mantener bomberos con ID > 6 o que no coincidan con los datos de ejemplo
            return b.id > 6;
        });
        
        console.log('📊 Total de bomberos después:', bomberosSinEjemplos.length);
        console.log('❌ Bomberos eliminados:', bomberos.length - bomberosSinEjemplos.length);
        
        // Guardar bomberos limpios
        localStorage.setItem('bomberos', JSON.stringify(bomberosSinEjemplos));
        
        // Limpiar sanciones de ejemplo (IDs 1-12)
        const sanciones = JSON.parse(localStorage.getItem('sancionesBomberos')) || [];
        const sancionesSinEjemplos = sanciones.filter(s => s.id > 12);
        localStorage.setItem('sancionesBomberos', JSON.stringify(sancionesSinEjemplos));
        console.log('❌ Sanciones eliminadas:', sanciones.length - sancionesSinEjemplos.length);
        
        // Limpiar cargos de ejemplo (IDs 1-18)
        const cargos = JSON.parse(localStorage.getItem('cargosBomberos')) || [];
        const cargosSinEjemplos = cargos.filter(c => c.id > 18);
        localStorage.setItem('cargosBomberos', JSON.stringify(cargosSinEjemplos));
        console.log('❌ Cargos eliminados:', cargos.length - cargosSinEjemplos.length);
        
        // Resetear contadores si no hay datos
        if (bomberosSinEjemplos.length === 0) {
            const counters = {
                bomberoId: 1,
                sancionId: 1,
                cargoId: 1
            };
            localStorage.setItem('counters', JSON.stringify(counters));
            console.log('🔄 Contadores reseteados');
        }
        
        console.log('✅ Limpieza completada exitosamente');
        alert('✅ Datos de ejemplo eliminados correctamente.\n\n' +
              `Bomberos eliminados: ${bomberos.length - bomberosSinEjemplos.length}\n` +
              `Sanciones eliminadas: ${sanciones.length - sancionesSinEjemplos.length}\n` +
              `Cargos eliminados: ${cargos.length - cargosSinEjemplos.length}\n\n` +
              'Recarga la página para ver los cambios.');
        
    } catch (error) {
        console.error('❌ Error al limpiar ejemplos:', error);
        alert('❌ Error al limpiar ejemplos: ' + error.message);
    }
})();
