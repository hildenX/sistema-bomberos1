from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from voluntarios.models import Voluntario

class Command(BaseCommand):
    help = 'Crear usuarios y grupos del sistema con sus permisos'

    def handle(self, *args, **kwargs):
        # Crear grupos
        grupos_permisos = {
            'Ayudante': {
                'descripcion': 'Solo asistencia y uniformes',
                'permisos': ['view_asistencia', 'add_asistencia', 'view_uniforme', 'add_uniforme', 'change_uniforme']
            },
            'Capitán': {
                'descripcion': 'Ver voluntarios, solo suspensiones, asistencia y uniformes',
                'permisos': ['view_voluntario', 'view_sancion', 'add_sancion', 'view_asistencia', 'add_asistencia', 
                           'view_uniforme', 'add_uniforme', 'change_uniforme']
            },
            'Secretario': {
                'descripcion': 'Full acceso voluntarios, sanciones, cargos, felicitaciones',
                'permisos': ['add_voluntario', 'change_voluntario', 'delete_voluntario', 'view_voluntario',
                           'add_sancion', 'change_sancion', 'delete_sancion', 'view_sancion',
                           'add_cargo', 'change_cargo', 'delete_cargo', 'view_cargo',
                           'add_felicitacion', 'change_felicitacion', 'delete_felicitacion', 'view_felicitacion',
                           'view_uniforme', 'add_uniforme', 'change_uniforme']
            },
            'Tesorero': {
                'descripcion': 'Full finanzas + ver voluntarios',
                'permisos': ['view_voluntario', 'add_cuota', 'change_cuota', 'view_cuota',
                           'add_pagocuota', 'change_pagocuota', 'view_pagocuota',
                           'add_beneficio', 'change_beneficio', 'view_beneficio',
                           'add_asignacionbeneficio', 'change_asignacionbeneficio', 'view_asignacionbeneficio',
                           'view_uniforme', 'add_uniforme', 'change_uniforme']
            },
            'Director': {
                'descripcion': 'Todo del secretario + ver finanzas + asistencia',
                'permisos': ['add_voluntario', 'change_voluntario', 'delete_voluntario', 'view_voluntario',
                           'add_sancion', 'change_sancion', 'delete_sancion', 'view_sancion',
                           'add_cargo', 'change_cargo', 'delete_cargo', 'view_cargo',
                           'add_felicitacion', 'change_felicitacion', 'delete_felicitacion', 'view_felicitacion',
                           'view_cuota', 'view_pagocuota', 'view_beneficio', 'view_asignacionbeneficio',
                           'view_asistencia', 'add_asistencia',
                           'view_uniforme', 'add_uniforme', 'change_uniforme']
            },
            'Super Administrador': {
                'descripcion': 'Acceso total',
                'permisos': []  # Se le dará is_staff y is_superuser
            }
        }

        # Crear/actualizar grupos
        for nombre_grupo, info in grupos_permisos.items():
            grupo, created = Group.objects.get_or_create(name=nombre_grupo)
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'✅ Grupo creado: {nombre_grupo}'))
            else:
                self.stdout.write(f'ℹ️  Grupo existente: {nombre_grupo}')
            
            # Limpiar permisos existentes
            grupo.permissions.clear()
            
            # Asignar permisos
            for perm_codename in info['permisos']:
                try:
                    permission = Permission.objects.get(codename=perm_codename)
                    grupo.permissions.add(permission)
                except Permission.DoesNotExist:
                    self.stdout.write(self.style.WARNING(f'⚠️  Permiso no encontrado: {perm_codename}'))

        # Crear usuarios con sus roles
        usuarios = [
            {
                'username': 'director',
                'password': 'dir2024',
                'role': 'Director',
                'first_name': 'Director',
                'last_name': 'del Sistema',
                'is_staff': True
            },
            {
                'username': 'secretario',
                'password': 'sec2024',
                'role': 'Secretario',
                'first_name': 'Secretario',
                'last_name': 'del Sistema',
                'is_staff': True
            },
            {
                'username': 'tesorero',
                'password': 'tes2024',
                'role': 'Tesorero',
                'first_name': 'Tesorero',
                'last_name': 'del Sistema',
                'is_staff': False
            },
            {
                'username': 'capitan',
                'password': 'cap2024',
                'role': 'Capitán',
                'first_name': 'Capitán',
                'last_name': 'del Sistema',
                'is_staff': False
            },
            {
                'username': 'ayudante',
                'password': 'ayu2024',
                'role': 'Ayudante',
                'first_name': 'Ayudante',
                'last_name': 'del Sistema',
                'is_staff': False
            },
            {
                'username': 'superadmin',
                'password': 'admin2024',
                'role': 'Super Administrador',
                'first_name': 'Super',
                'last_name': 'Administrador',
                'is_staff': True,
                'is_superuser': True
            }
        ]

        for user_data in usuarios:
            username = user_data['username']
            password = user_data['password']
            role = user_data['role']
            
            # Crear o actualizar usuario
            user, created = User.objects.get_or_create(username=username)
            
            if created:
                user.set_password(password)
                user.first_name = user_data['first_name']
                user.last_name = user_data['last_name']
                user.is_staff = user_data.get('is_staff', False)
                user.is_superuser = user_data.get('is_superuser', False)
                user.save()
                self.stdout.write(self.style.SUCCESS(f'✅ Usuario creado: {username} | Contraseña: {password} | Rol: {role}'))
            else:
                # Actualizar contraseña por si cambió
                user.set_password(password)
                user.first_name = user_data['first_name']
                user.last_name = user_data['last_name']
                user.is_staff = user_data.get('is_staff', False)
                user.is_superuser = user_data.get('is_superuser', False)
                user.save()
                self.stdout.write(f'🔄 Usuario actualizado: {username}')
            
            # Asignar grupo
            try:
                grupo = Group.objects.get(name=role)
                user.groups.clear()
                user.groups.add(grupo)
                self.stdout.write(f'   👥 Grupo asignado: {role}')
            except Group.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'⚠️  Grupo no encontrado: {role}'))

        self.stdout.write(self.style.SUCCESS('\n🎉 ¡USUARIOS Y GRUPOS CREADOS EXITOSAMENTE!'))
        self.stdout.write('\n📝 USUARIOS DISPONIBLES:')
        self.stdout.write('=' * 60)
        for user_data in usuarios:
            self.stdout.write(f"👤 Usuario: {user_data['username']:15} | 🔑 Contraseña: {user_data['password']:10} | 🎭 Rol: {user_data['role']}")
        self.stdout.write('=' * 60)
