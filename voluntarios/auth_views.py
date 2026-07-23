"""
Vistas de autenticación - Migrado desde auth.js del p6p
"""
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User, Group
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from datetime import datetime
from .permissions import obtener_permisos_usuario, obtener_rol_usuario


# Usuarios por defecto del p6p
USUARIOS_DEFAULT = {
    'director': {'password': 'dir2024', 'role': 'Director'},
    'secretario': {'password': 'sec2024', 'role': 'Secretario'},
    'tesorero': {'password': 'tes2024', 'role': 'Tesorero'},
    'capitan': {'password': 'cap2024', 'role': 'Capitán'},
    'ayudante': {'password': 'ayu2024', 'role': 'Ayudante'},
    'superadmin': {'password': 'admin2024', 'role': 'Super Administrador'},
}


def crear_usuarios_default():
    """Crea los usuarios por defecto del p6p si no existen"""
    for username, data in USUARIOS_DEFAULT.items():
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'is_staff': username == 'superadmin',
                'is_superuser': username == 'superadmin',
            }
        )
        
        if created:
            user.set_password(data['password'])
            user.save()
            
            # Asignar grupo/rol
            group, _ = Group.objects.get_or_create(name=data['role'])
            user.groups.add(group)
            
            print(f"✓ Usuario creado: {username} ({data['role']})")


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    """
    API de login - Compatible con auth.js del p6p
    
    POST /api/auth/login/
    Body: {"username": "...", "password": "..."}
    
    Response: {
        "success": true,
        "user": {
            "username": "...",
            "role": "...",
            "loginTime": "...",
            "permissions": {...}
        }
    }
    """
    try:
        data = json.loads(request.body)
        username = data.get('username', '').strip().lower()
        password = data.get('password', '')
        
        # Intentar autenticar
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            if obtener_rol_usuario(user) is None:
                return JsonResponse({
                    'success': False,
                    'error': 'Este usuario no pertenece al panel interno. Usa el portal de voluntarios.'
                }, status=403)

            # Login exitoso
            login(request, user)
            
            # FORZAR que se guarde la sesión
            request.session.modified = True
            request.session.save()
            
            print(f"[LOGIN] Exitoso: {username}")
            print(f"[SESSION] Key: {request.session.session_key}")
            print(f"[SESSION] Saved: {request.session.session_key is not None}")
            print(f"[USER] Autenticado: {request.user.is_authenticated}")
            print("[COOKIES] Will set sessionid cookie")
            
            # Obtener permisos
            permisos_data = obtener_permisos_usuario(user)
            
            # Preparar respuesta (formato p6p)
            response_data = {
                'success': True,
                'user': {
                    'username': username,
                    'role': permisos_data.get('rol', 'Usuario'),
                    'loginTime': datetime.now().isoformat(),
                    'permissions': permisos_data.get('permisos', {})
                },
                'message': f'¡Bienvenido, {permisos_data.get("rol", "Usuario")}!'
            }
            
            response = JsonResponse(response_data)
            
            # IMPORTANTE: Asegurar que la cookie de sesión se envíe
            if request.session.session_key:
                response.set_cookie(
                    'sessionid',
                    request.session.session_key,
                    max_age=86400,  # 24 horas
                    httponly=True,
                    samesite='Lax',
                    secure=False  # False para localhost HTTP
                )
                print(f"[RESPONSE] Cookie sessionid seteada: {request.session.session_key[:10]}...")
            
            print("[RESPONSE] Enviando respuesta de login")
            return response
        else:
            # Login fallido
            return JsonResponse({
                'success': False,
                'error': 'Usuario o contraseña incorrectos'
            }, status=401)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Datos inválidos'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST", "GET"])
def logout_view(request):
    """
    API de logout - Compatible con auth.js del p6p
    
    POST /api/auth/logout/
    
    Response: {"success": true}
    """
    logout(request)
    return JsonResponse({
        'success': True,
        'message': 'Sesión cerrada correctamente'
    })


@csrf_exempt
@require_http_methods(["GET"])
def check_auth_view(request):
    """
    Verifica si el usuario está autenticado
    
    GET /api/auth/check/
    
    Response: {
        "authenticated": true/false,
        "user": {...} o null
    }
    """
    print(f"[CHECK_AUTH] Usuario: {request.user}, Autenticado: {request.user.is_authenticated}")
    
    if request.user.is_authenticated:
        permisos_data = obtener_permisos_usuario(request.user)
        
        print(f"[AUTH] Usuario autenticado: {request.user.username}, Rol: {permisos_data.get('rol')}")
        
        return JsonResponse({
            'authenticated': True,
            'user': {
                'username': request.user.username,
                'role': permisos_data.get('rol', 'Usuario'),
                'permissions': permisos_data.get('permisos', {})
            }
        })
    else:
        print("[AUTH] Usuario NO autenticado")
        return JsonResponse({
            'authenticated': False,
            'user': None
        })


@require_http_methods(["GET"])
def get_permissions_view(request):
    """
    Obtiene los permisos del usuario actual
    
    GET /api/auth/permissions/
    
    Response: {
        "role": "...",
        "permissions": {...}
    }
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'No autenticado'
        }, status=401)
    
    permisos_data = obtener_permisos_usuario(request.user)
    
    return JsonResponse(permisos_data)


@require_http_methods(["GET"])
def list_users_view(request):
    """
    Lista todos los usuarios disponibles (solo para super admin)

    GET /api/auth/users/
    """
    if not request.user.is_authenticated:
        return JsonResponse({
            'error': 'No autenticado'
        }, status=401)

    # Verificar que sea Super Administrador
    permisos_data = obtener_permisos_usuario(request.user)
    if permisos_data.get('rol') != 'Super Administrador':
        return JsonResponse({
            'error': 'No autorizado - Solo Super Administrador'
        }, status=403)

    # Obtener usuarios reales de la base de datos
    users_list = []
    all_users = User.objects.all().order_by('username')

    for user in all_users:
        permisos_user = obtener_permisos_usuario(user)
        users_list.append({
            'username': user.username,
            'role': permisos_user.get('rol', 'Usuario'),
            'is_active': user.is_active,
            'is_superuser': user.is_superuser
        })

    return JsonResponse(users_list, safe=False)


@csrf_exempt
@require_http_methods(["POST"])
def change_password_view(request):
    """
    Cambia la contraseña de un usuario (solo para super admin)

    POST /api/auth/change-password/
    Body: {
        "username": "...",
        "new_password": "..."
    }

    Response: {"success": true, "message": "..."}
    """
    try:
        # Verificar que esté autenticado
        if not request.user.is_authenticated:
            return JsonResponse({
                'success': False,
                'error': 'No autenticado'
            }, status=401)

        # Verificar que sea Super Administrador
        permisos_data = obtener_permisos_usuario(request.user)
        if permisos_data.get('rol') != 'Super Administrador':
            return JsonResponse({
                'success': False,
                'error': 'No autorizado - Solo Super Administrador'
            }, status=403)

        # Obtener datos del request
        data = json.loads(request.body)
        target_username = data.get('username', '').strip()
        new_password = data.get('new_password', '').strip()

        # Validaciones
        if not target_username:
            return JsonResponse({
                'success': False,
                'error': 'Username es requerido'
            }, status=400)

        if not new_password:
            return JsonResponse({
                'success': False,
                'error': 'Nueva contraseña es requerida'
            }, status=400)

        if len(new_password) < 4:
            return JsonResponse({
                'success': False,
                'error': 'La contraseña debe tener al menos 4 caracteres'
            }, status=400)

        # Buscar usuario
        try:
            target_user = User.objects.get(username=target_username)
        except User.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': f'Usuario {target_username} no encontrado'
            }, status=404)

        # Cambiar contraseña
        target_user.set_password(new_password)
        target_user.save()

        print(f"[ADMIN] Contraseña cambiada para usuario: {target_username} por {request.user.username}")

        return JsonResponse({
            'success': True,
            'message': f'Contraseña de {target_username} cambiada exitosamente'
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Datos JSON inválidos'
        }, status=400)
    except Exception as e:
        print(f"[ERROR] Cambio de contraseña: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Error interno: {str(e)}'
        }, status=500)
