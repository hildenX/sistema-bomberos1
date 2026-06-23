"""
Comando para crear los usuarios por defecto del sistema p6p
Ejecutar: python manage.py crear_usuarios_p6p
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from voluntarios.auth_views import USUARIOS_DEFAULT


class Command(BaseCommand):
    help = 'Crea los usuarios por defecto del sistema p6p'
    
    def handle(self, *args, **options):
        self.stdout.write('=' * 60)
        self.stdout.write(' CREANDO USUARIOS DEL SISTEMA P6P')
        self.stdout.write('=' * 60)
        self.stdout.write('')
        
        usuarios_creados = 0
        usuarios_existentes = 0
        
        for username, data in USUARIOS_DEFAULT.items():
            try:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'is_staff': username == 'superadmin',
                        'is_superuser': username == 'superadmin',
                        'email': f'{username}@bomberos.cl',
                    }
                )
                
                if created:
                    user.set_password(data['password'])
                    user.save()
                    
                    # Asignar grupo/rol
                    group, _ = Group.objects.get_or_create(name=data['role'])
                    user.groups.add(group)
                    
                    usuarios_creados += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'OK Usuario creado: {username:12} | Password: {data["password"]:10} | Rol: {data["role"]}'
                        )
                    )
                else:
                    usuarios_existentes += 1
                    self.stdout.write(
                        f'   Usuario existente: {username:12} | Rol: {data["role"]}'
                    )
                    
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'ERROR creando {username}: {e}')
                )
        
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write(f' Usuarios creados: {usuarios_creados}')
        self.stdout.write(f' Usuarios existentes: {usuarios_existentes}')
        self.stdout.write(f' Total: {len(USUARIOS_DEFAULT)}')
        self.stdout.write('=' * 60)
        self.stdout.write('')
        
        if usuarios_creados > 0:
            self.stdout.write(self.style.SUCCESS('USUARIOS DEL P6P LISTOS!'))
            self.stdout.write('')
            self.stdout.write('Credenciales para login:')
            self.stdout.write('')
            for username, data in USUARIOS_DEFAULT.items():
                self.stdout.write(f'  Usuario: {username:12} | Password: {data["password"]:10} | Rol: {data["role"]}')
            self.stdout.write('')
