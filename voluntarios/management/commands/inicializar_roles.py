"""
Comando para inicializar los grupos/roles del sistema
Ejecutar: python manage.py inicializar_roles
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from voluntarios.permissions import RolBomberos


class Command(BaseCommand):
    help = 'Inicializa los grupos y permisos del sistema de bomberos'
    
    def handle(self, *args, **options):
        self.stdout.write('🔥 Iniciando configuración de roles y permisos...')
        
        # Crear grupos si no existen
        grupos_creados = 0
        for rol in RolBomberos.TODOS_LOS_ROLES:
            grupo, created = Group.objects.get_or_create(name=rol)
            if created:
                grupos_creados += 1
                self.stdout.write(self.style.SUCCESS(f'✅ Grupo creado: {rol}'))
            else:
                self.stdout.write(f'   Grupo existente: {rol}')
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'✅ {grupos_creados} nuevos grupos creados'))
        self.stdout.write(f'   Total de grupos: {len(RolBomberos.TODOS_LOS_ROLES)}')
        
        self.stdout.write('')
        self.stdout.write('📋 Grupos del sistema:')
        for rol in RolBomberos.TODOS_LOS_ROLES:
            permisos = RolBomberos.PERMISOS[rol]
            self.stdout.write(f'   • {rol}')
            self.stdout.write(f'     - Voluntarios: {permisos["voluntarios"]}')
            self.stdout.write(f'     - Asistencias: {permisos["asistencias"]}')
            self.stdout.write(f'     - Uniformes: {permisos["uniformes"]}')
            self.stdout.write(f'     - Finanzas: {permisos["finanzas"]}')
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('🎉 ¡Configuración completada!'))
        self.stdout.write('')
        self.stdout.write('Para asignar un rol a un usuario:')
        self.stdout.write('  1. Ir al admin de Django: http://localhost:8000/admin/')
        self.stdout.write('  2. Seleccionar el usuario')
        self.stdout.write('  3. En "Grupos" agregar el rol deseado')
        self.stdout.write('')
