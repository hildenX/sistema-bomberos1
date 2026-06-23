@echo off
echo ========================================
echo SETUP SISTEMA BOMBEROS - DJANGO
echo ========================================
echo.

echo [1/6] Creando entorno virtual...
python -m venv venv
echo ✓ Entorno virtual creado
echo.

echo [2/6] Activando entorno virtual...
call venv\Scripts\activate
echo ✓ Entorno virtual activado
echo.

echo [3/6] Instalando dependencias...
pip install -r requirements.txt
echo ✓ Dependencias instaladas
echo.

echo [4/6] Creando migraciones...
python manage.py makemigrations
echo ✓ Migraciones creadas
echo.

echo [5/6] Aplicando migraciones...
python manage.py migrate
echo ✓ Base de datos inicializada
echo.

echo [6/6] Setup completado!
echo.
echo ========================================
echo SIGUIENTE PASO:
echo Crea un superusuario ejecutando:
echo    python manage.py createsuperuser
echo.
echo Luego inicia el servidor con:
echo    python manage.py runserver
echo ========================================
pause
