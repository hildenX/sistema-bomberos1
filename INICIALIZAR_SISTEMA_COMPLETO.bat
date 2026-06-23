@echo off
cls
echo ========================================
echo   INICIALIZACION COMPLETA DEL SISTEMA
echo   Sistema P6P Migrado a Django
echo ========================================
echo.

echo [1/6] Instalando dependencias...
python -m pip install -q Django==5.0.0 djangorestframework==3.14.0 django-cors-headers==4.3.1 python-decouple==3.8 Pillow reportlab==4.0.7 python-dateutil==2.8.2
echo OK Dependencias instaladas!
echo.

echo [2/6] Creando base de datos...
python manage.py makemigrations
python manage.py migrate
echo OK Base de datos creada!
echo.

echo [3/6] Inicializando roles y grupos...
python manage.py inicializar_roles
echo OK Roles inicializados!
echo.

echo [4/6] Creando usuarios del p6p...
python manage.py crear_usuarios_p6p
echo OK Usuarios creados!
echo.

echo [5/6] Recolectando archivos estaticos...
python manage.py collectstatic --noinput
echo OK Archivos estaticos listos!
echo.

echo ========================================
echo   SISTEMA LISTO!
echo ========================================
echo.
echo USUARIOS DISPONIBLES:
echo.
echo   director     / dir2024    (Director)
echo   secretario   / sec2024    (Secretario)
echo   tesorero     / tes2024    (Tesorero)
echo   capitan      / cap2024    (Capitan)
echo   ayudante     / ayu2024    (Ayudante)
echo   superadmin   / admin2024  (Super Admin)
echo.
echo ========================================
echo.
echo [6/6] Iniciando servidor...
echo.
echo El navegador se abrira automaticamente en http://localhost:8000
echo.
echo Presiona Ctrl+C para detener el servidor
echo.
timeout /t 3
start http://localhost:8000
python manage.py runserver
