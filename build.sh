#!/usr/bin/env bash
# Script de build para Render
set -o errexit

pip install -r requirements-deploy.txt
python manage.py collectstatic --no-input
python manage.py migrate
python manage.py crear_usuarios_p6p
