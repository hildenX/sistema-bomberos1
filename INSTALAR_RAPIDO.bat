@echo off
echo ========================================
echo   INSTALANDO DEPENDENCIAS
echo ========================================
echo.

python -m pip install Django==5.0.0
python -m pip install djangorestframework==3.14.0
python -m pip install django-cors-headers==4.3.1
python -m pip install python-decouple==3.8
python -m pip install Pillow
python -m pip install reportlab==4.0.7
python -m pip install python-dateutil==2.8.2

echo.
echo ========================================
echo   CREANDO BASE DE DATOS
echo ========================================
echo.

python manage.py makemigrations
python manage.py migrate

echo.
echo ========================================
echo   CREANDO ROLES Y USUARIOS
echo ========================================
echo.

python manage.py inicializar_roles
python manage.py crear_usuarios_p6p

echo.
echo ========================================
echo   LISTO! AHORA EJECUTA:
echo   python manage.py runserver
echo ========================================
echo.
pause
