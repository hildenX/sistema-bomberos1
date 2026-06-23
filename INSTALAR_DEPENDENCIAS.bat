@echo off
echo ========================================
echo  INSTALANDO DEPENDENCIAS DEL SISTEMA
echo ========================================
echo.

python --version
echo.

echo Instalando Django...
python -m pip install Django==5.0.0

echo Instalando Django REST Framework...
python -m pip install djangorestframework==3.14.0

echo Instalando CORS Headers...
python -m pip install django-cors-headers==4.3.1

echo Instalando Python Decouple...
python -m pip install python-decouple==3.8

echo Instalando Pillow (imagenes)...
python -m pip install Pillow

echo Instalando ReportLab (PDFs)...
python -m pip install reportlab==4.0.7

echo Instalando Python DateUtil...
python -m pip install python-dateutil==2.8.2

echo.
echo ========================================
echo  DEPENDENCIAS INSTALADAS!
echo ========================================
echo.
echo Ahora ejecuta: python manage.py runserver
echo.
pause
