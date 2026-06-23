@echo off
REM =========================================================
REM Script para MOVER archivos obsoletos a carpeta de respaldo
REM Sistema de Gestión de Bomberos P6P
REM Fecha: 2025-11-25
REM =========================================================

echo.
echo =========================================================
echo MOVER ARCHIVOS OBSOLETOS - Sistema Bomberos P6P
echo =========================================================
echo.
echo Este script movera 106 archivos obsoletos a una carpeta
echo de respaldo llamada: archivos_obsoletos_2025_11_25
echo.
echo Los archivos seran MOVIDOS (no eliminados), podras
echo restaurarlos si algo falla.
echo.
echo =========================================================
echo.

pause

echo.
echo [1/8] Creando estructura de carpetas...
mkdir archivos_obsoletos_2025_11_25
mkdir archivos_obsoletos_2025_11_25\js_antiguo
mkdir archivos_obsoletos_2025_11_25\css_antiguo
mkdir archivos_obsoletos_2025_11_25\templates_backup
mkdir archivos_obsoletos_2025_11_25\scripts_testing
mkdir archivos_obsoletos_2025_11_25\scripts_utilidades
mkdir archivos_obsoletos_2025_11_25\sql
mkdir archivos_obsoletos_2025_11_25\temporales
echo Carpetas creadas OK

echo.
echo [2/8] Moviendo archivos JavaScript antiguos (31 archivos)...
move "static\js\agregar-voluntario.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\asistencia-asamblea.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\asistencia-citaciones.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\asistencia-ejercicios.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\asistencia-otras.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\asistencias.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\asistencias-externos-mixin.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\auth.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\beneficios.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\cargos.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\crear-bombero.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\cuotas.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\cuotas-beneficios.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\editar-bombero.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\finanzas.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\gestor-logos.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\historial-asistencias.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\informes.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\informes-cargos.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\js.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\mapa-auto.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\pagar-beneficio.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\pagination.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\reintegracion.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\sanciones.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\sidebar.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\sistema.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\storage.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\uniformes-backup.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\uniformes-nuevo.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\uniformes-voluntario.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
move "static\js\verificador-datos.js" "archivos_obsoletos_2025_11_25\js_antiguo\" 2>nul
echo JavaScript movidos OK

echo.
echo [3/8] Moviendo archivos CSS antiguos (3 archivos)...
move "static\css\sistema-compacto.css" "archivos_obsoletos_2025_11_25\css_antiguo\" 2>nul
move "static\css\sistema-final-compacto.css" "archivos_obsoletos_2025_11_25\css_antiguo\" 2>nul
move "static\css\sistema-separado.css" "archivos_obsoletos_2025_11_25\css_antiguo\" 2>nul
echo CSS movidos OK

echo.
echo [4/8] Moviendo templates backup (5 archivos)...
move "templates\crear-bombero-old.html" "archivos_obsoletos_2025_11_25\templates_backup\" 2>nul
move "templates\editar-bombero-old.html" "archivos_obsoletos_2025_11_25\templates_backup\" 2>nul
move "templates\registro-asistencia-backup.html" "archivos_obsoletos_2025_11_25\templates_backup\" 2>nul
move "templates\registro-directorio-new.html" "archivos_obsoletos_2025_11_25\templates_backup\" 2>nul
move "templates\registro-directorio-OLD.html" "archivos_obsoletos_2025_11_25\templates_backup\" 2>nul
echo Templates backup movidos OK

echo.
echo [5/8] Moviendo scripts de testing (33 archivos)...
move test_*.py "archivos_obsoletos_2025_11_25\scripts_testing\" 2>nul
echo Scripts de testing movidos OK

echo.
echo [6/8] Moviendo scripts de verificacion (8 archivos)...
move verificar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move ver_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
echo Scripts de verificacion movidos OK

echo.
echo [7/8] Moviendo scripts de utilidades (21 archivos)...
move activar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move actualizar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move arreglar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move asignar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move borrar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move cambiar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move corregir_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move crear_voluntarios_ejemplo.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move generar_sql_mysql.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move limpiar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move probar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move reiniciar_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move reset_*.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
move PRUEBAS_FINALES_ESTUDIANTE.py "archivos_obsoletos_2025_11_25\scripts_utilidades\" 2>nul
echo Scripts de utilidades movidos OK

echo.
echo [8/8] Moviendo archivos temporales (1 archivo)...
REM Los archivos SQL NO se mueven (se mantienen por solicitud del usuario)
REM move *.sql "archivos_obsoletos_2025_11_25\sql\" 2>nul
move cookies.txt "archivos_obsoletos_2025_11_25\temporales\" 2>nul
echo Archivos temporales movidos OK

echo.
echo =========================================================
echo PROCESO COMPLETADO
echo =========================================================
echo.
echo Total de archivos movidos: ~104 archivos (SQL excluidos)
echo Ubicacion: archivos_obsoletos_2025_11_25\
echo.
echo IMPORTANTE:
echo 1. Prueba el sistema AHORA para verificar que funciona
echo 2. Si algo falla, restaura archivos desde la carpeta de respaldo
echo 3. Si todo funciona bien por 1 semana, elimina la carpeta
echo.
echo Para restaurar archivos (si hay problemas):
echo   xcopy archivos_obsoletos_2025_11_25\* . /E /Y
echo.
echo =========================================================
echo.

pause
