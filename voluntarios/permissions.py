"""
Sistema de permisos basado en roles
Replica el sistema de permisos del p6p con 6 roles
"""
from rest_framework import permissions


class RolBomberos:
    """
    Definición de roles del sistema
    """
    AYUDANTE = 'Ayudante'
    CAPITAN = 'Capitán'
    SECRETARIO = 'Secretario'
    TESORERO = 'Tesorero'
    DIRECTOR = 'Director'
    SUPER_ADMIN = 'Super Administrador'
    
    TODOS_LOS_ROLES = [
        AYUDANTE,
        CAPITAN,
        SECRETARIO,
        TESORERO,
        DIRECTOR,
        SUPER_ADMIN,
    ]
    
    # Definición de permisos por rol
    PERMISOS = {
        AYUDANTE: {
            'voluntarios': {'view': True, 'create': False, 'edit': False, 'delete': False},
            'asistencias': {'view': True, 'create': True, 'edit': False, 'delete': False},
            'sanciones': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'cargos': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'felicitaciones': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'uniformes': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'cuotas': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'beneficios': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'finanzas': {'view': False},
            'pdfs': {'view': True, 'create': True},  # Solo PDF voluntarios por antigüedad
            'admin': {'view': False},
        },
        CAPITAN: {
            'voluntarios': {'view': True, 'create': False, 'edit': False, 'delete': False},
            'asistencias': {'view': True, 'create': True, 'edit': True, 'delete': False},
            'sanciones': {'view': True, 'create': True, 'edit': False, 'delete': False},  # Solo suspensiones
            'cargos': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'felicitaciones': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'uniformes': {'view': True, 'create': True, 'edit': True, 'delete': False},  # Entrega/devolución
            'cuotas': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'beneficios': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'finanzas': {'view': False},
            'pdfs': {'view': True, 'create': True},
            'admin': {'view': False},
        },
        SECRETARIO: {
            'voluntarios': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'asistencias': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'sanciones': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'cargos': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'felicitaciones': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'uniformes': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'cuotas': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'beneficios': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'finanzas': {'view': False},
            'pdfs': {'view': True, 'create': True},
            'admin': {'view': False},
        },
        TESORERO: {
            'voluntarios': {'view': True, 'create': False, 'edit': False, 'delete': False},
            'asistencias': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'sanciones': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'cargos': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'felicitaciones': {'view': False, 'create': False, 'edit': False, 'delete': False},
            'uniformes': {'view': True, 'create': False, 'edit': False, 'delete': False},  # Puede VER uniformes
            'cuotas': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'beneficios': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'finanzas': {'view': True},
            'pdfs': {'view': True, 'create': True},
            'admin': {'view': False},
        },
        DIRECTOR: {
            'voluntarios': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'asistencias': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'sanciones': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'cargos': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'felicitaciones': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'uniformes': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'cuotas': {'view': True, 'create': False, 'edit': False, 'delete': False},  # Solo lectura
            'beneficios': {'view': True, 'create': False, 'edit': False, 'delete': False},  # Solo lectura
            'finanzas': {'view': True},  # Solo lectura
            'pdfs': {'view': True, 'create': True},
            'admin': {'view': False},
        },
        SUPER_ADMIN: {
            'voluntarios': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'asistencias': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'sanciones': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'cargos': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'felicitaciones': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'uniformes': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'cuotas': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'beneficios': {'view': True, 'create': True, 'edit': True, 'delete': True},
            'finanzas': {'view': True},
            'pdfs': {'view': True, 'create': True},
            'admin': {'view': True},
        },
    }


def obtener_rol_usuario(user):
    """
    Obtiene el rol de un usuario basado en sus grupos
    Retorna el rol con mayor jerarquía si tiene múltiples
    """
    if not user or not user.is_authenticated:
        return None
    
    # Super Admin si es superuser
    if user.is_superuser:
        return RolBomberos.SUPER_ADMIN
    
    # Obtener grupos del usuario
    grupos = user.groups.values_list('name', flat=True)
    
    # Jerarquía de roles (de mayor a menor)
    jerarquia = [
        RolBomberos.SUPER_ADMIN,
        RolBomberos.DIRECTOR,
        RolBomberos.SECRETARIO,
        RolBomberos.TESORERO,
        RolBomberos.CAPITAN,
        RolBomberos.AYUDANTE,
    ]
    
    for rol in jerarquia:
        if rol in grupos:
            return rol
    
    return None


def tiene_permiso(user, modulo, accion):
    """
    Verifica si un usuario tiene permiso para una acción en un módulo
    
    Args:
        user: Usuario de Django
        modulo: str - Nombre del módulo ('voluntarios', 'asistencias', etc.)
        accion: str - Acción a verificar ('view', 'create', 'edit', 'delete')
    
    Returns:
        bool - True si tiene permiso, False si no
    """
    rol = obtener_rol_usuario(user)
    
    if not rol:
        return False
    
    permisos_rol = RolBomberos.PERMISOS.get(rol, {})
    permisos_modulo = permisos_rol.get(modulo, {})
    
    return permisos_modulo.get(accion, False)


def obtener_permisos_usuario(user):
    """
    Obtiene todos los permisos de un usuario
    Útil para enviar al frontend
    """
    rol = obtener_rol_usuario(user)
    
    if not rol:
        return {}
    
    return {
        'rol': rol,
        'permisos': RolBomberos.PERMISOS.get(rol, {}),
        'es_super_admin': rol == RolBomberos.SUPER_ADMIN,
    }


# ==================== PERMISOS DE REST FRAMEWORK ====================

class EsAyudanteOSuperior(permissions.BasePermission):
    """Permiso: Ayudante o superior"""
    def has_permission(self, request, view):
        rol = obtener_rol_usuario(request.user)
        return rol in RolBomberos.TODOS_LOS_ROLES


class EsCapitanOSuperior(permissions.BasePermission):
    """Permiso: Capitán o superior"""
    def has_permission(self, request, view):
        rol = obtener_rol_usuario(request.user)
        return rol in [
            RolBomberos.CAPITAN,
            RolBomberos.SECRETARIO,
            RolBomberos.TESORERO,
            RolBomberos.DIRECTOR,
            RolBomberos.SUPER_ADMIN,
        ]


class EsSecretarioOSuperior(permissions.BasePermission):
    """Permiso: Secretario o superior"""
    def has_permission(self, request, view):
        rol = obtener_rol_usuario(request.user)
        return rol in [
            RolBomberos.SECRETARIO,
            RolBomberos.DIRECTOR,
            RolBomberos.SUPER_ADMIN,
        ]


class EsTesoreroOSuperior(permissions.BasePermission):
    """Permiso: Tesorero o superior (para finanzas)"""
    def has_permission(self, request, view):
        rol = obtener_rol_usuario(request.user)
        return rol in [
            RolBomberos.TESORERO,
            RolBomberos.DIRECTOR,
            RolBomberos.SUPER_ADMIN,
        ]


class EsDirectorOSuperior(permissions.BasePermission):
    """Permiso: Director o superior"""
    def has_permission(self, request, view):
        rol = obtener_rol_usuario(request.user)
        return rol in [
            RolBomberos.DIRECTOR,
            RolBomberos.SUPER_ADMIN,
        ]


class EsSuperAdmin(permissions.BasePermission):
    """Permiso: Solo Super Admin"""
    def has_permission(self, request, view):
        return obtener_rol_usuario(request.user) == RolBomberos.SUPER_ADMIN


class PermisosPorModulo(permissions.BasePermission):
    """
    Permiso genérico basado en módulo y acción
    Usar en ViewSets especificando el módulo
    
    Ejemplo:
        permission_classes = [PermisosPorModulo]
        modulo_permisos = 'voluntarios'
    """
    
    def has_permission(self, request, view):
        # Obtener módulo del view
        modulo = getattr(view, 'modulo_permisos', None)
        if not modulo:
            return False

        accion = resolver_accion_permiso(request, view=view)

        return tiene_permiso(request.user, modulo, accion)


class PermisosSancionesCapitan(permissions.BasePermission):
    """
    Permiso especial para sanciones:
    - Capitán solo puede crear SUSPENSIONES
    - Secretario y superior pueden todo
    """
    
    def has_permission(self, request, view):
        rol = obtener_rol_usuario(request.user)
        
        # Secretario y superior: acceso completo
        if rol in [RolBomberos.SECRETARIO, RolBomberos.DIRECTOR, RolBomberos.SUPER_ADMIN]:
            return True
        
        # Capitán: solo ver y crear
        if rol == RolBomberos.CAPITAN:
            if request.method in ['GET', 'HEAD', 'OPTIONS', 'POST']:
                # En POST verificaremos que sea suspensión en el serializer
                return True
        
        return False
    
    def has_object_permission(self, request, view, obj):
        rol = obtener_rol_usuario(request.user)
        
        # Secretario y superior: acceso completo
        if rol in [RolBomberos.SECRETARIO, RolBomberos.DIRECTOR, RolBomberos.SUPER_ADMIN]:
            return True
        
        # Capitán: solo lectura
        if rol == RolBomberos.CAPITAN:
            return request.method in permissions.SAFE_METHODS
        
        return False


# ==================== DECORADORES PARA VISTAS ====================

from functools import wraps
from django.http import JsonResponse


def requiere_rol(*roles_permitidos):
    """
    Decorador para vistas que requieren ciertos roles
    
    Uso:
        @requiere_rol(RolBomberos.SECRETARIO, RolBomberos.SUPER_ADMIN)
        def mi_vista(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            rol = obtener_rol_usuario(request.user)
            
            if rol not in roles_permitidos:
                return JsonResponse({
                    'error': 'No autorizado',
                    'mensaje': f'Se requiere uno de los siguientes roles: {", ".join(roles_permitidos)}'
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    return decorator


def requiere_permiso(modulo, accion):
    """
    Decorador para vistas que requieren permiso específico
    
    Uso:
        @requiere_permiso('voluntarios', 'create')
        def crear_voluntario(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not tiene_permiso(request.user, modulo, accion):
                return JsonResponse({
                    'error': 'No autorizado',
                    'mensaje': f'No tienes permiso para {accion} en {modulo}'
                }, status=403)
            
            return view_func(request, *args, **kwargs)
        
        return wrapper
    return decorator


def obtener_accion_desde_request(request):
    """
    Mapea el método HTTP a la acción de permisos por defecto.
    """
    acciones_map = {
        'GET': 'view',
        'HEAD': 'view',
        'OPTIONS': 'view',
        'POST': 'create',
        'PUT': 'edit',
        'PATCH': 'edit',
        'DELETE': 'delete',
    }
    return acciones_map.get(request.method, 'view')


def resolver_accion_permiso(request, view=None, accion_por_defecto=None):
    """
    Resuelve la acción de permiso a partir del método HTTP y, si existe,
    del nombre de la action del ViewSet.
    """
    accion = accion_por_defecto or obtener_accion_desde_request(request)

    if view is not None:
        acciones_personalizadas = getattr(view, 'acciones_permisos', {})
        action_name = getattr(view, 'action', None)
        if action_name and action_name in acciones_personalizadas:
            return acciones_personalizadas[action_name]

    return accion


def autorizar_request(request, modulo=None, accion=None, roles=None):
    """
    Valida autenticación y autorización para vistas Django tradicionales.

    Retorna una tupla: (autorizado: bool, response: JsonResponse|None)
    """
    if not request.user.is_authenticated:
        return False, JsonResponse({
            'error': 'No autenticado',
            'mensaje': 'Debes iniciar sesión para acceder a este recurso'
        }, status=401)

    rol = obtener_rol_usuario(request.user)

    if roles is not None and rol not in roles:
        return False, JsonResponse({
            'error': 'No autorizado',
            'mensaje': 'Tu rol no tiene acceso a este recurso'
        }, status=403)

    if modulo and accion and not tiene_permiso(request.user, modulo, accion):
        return False, JsonResponse({
            'error': 'No autorizado',
            'mensaje': f'No tienes permiso para {accion} en {modulo}'
        }, status=403)

    return True, None
