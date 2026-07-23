from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import Voluntario

def login_view(request):
    """Vista de login - Replicando lógica del sistema original"""
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip().lower()
        password = request.POST.get('password', '')
        
        # Autenticar
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            auth_login(request, user)
            
            # Obtener rol del usuario (desde su grupo)
            role = 'Usuario'
            if user.groups.exists():
                role = user.groups.first().name
            
            # Mensaje de éxito con rol
            messages.success(request, f'¡Bienvenido, {role}!')
            
            # Guardar rol en sesión para usar en templates
            request.session['user_role'] = role
            
            return redirect('dashboard')
        else:
            messages.error(request, 'Usuario o contraseña incorrectos')
    
    return render(request, 'login.html')

def logout_view(request):
    """Vista de logout"""
    auth_logout(request)
    messages.info(request, 'Has cerrado sesión exitosamente')
    return redirect('login')

@login_required(login_url='login')
def dashboard_view(request):
    """Sistema principal - Lista de voluntarios con permisos"""
    # Obtener rol del usuario
    user_role = request.session.get('user_role', 'Usuario')
    
    # Obtener permisos según rol
    permisos = obtener_permisos_rol(user_role)
    
    # Verificar si puede ver voluntarios
    if not permisos.get('canViewVoluntarios', False):
        messages.warning(request, 'No tienes permisos para ver voluntarios')
        return redirect('login')
    
    # Obtener voluntarios ordenados por antigüedad (fecha_ingreso más antigua primero)
    voluntarios = Voluntario.objects.all().order_by('fecha_ingreso')
    
    # Estadísticas
    total_voluntarios = voluntarios.count()
    activos = voluntarios.filter(estado_bombero='activo').count()
    renunciados = voluntarios.filter(estado_bombero='renunciado').count()
    separados = voluntarios.filter(estado_bombero='separado').count()
    expulsados = voluntarios.filter(estado_bombero='expulsado').count()
    
    context = {
        'voluntarios': voluntarios,
        'user_role': user_role,
        'permisos': permisos,
        'total_voluntarios': total_voluntarios,
        'activos': activos,
        'renunciados': renunciados,
        'separados': separados,
        'expulsados': expulsados,
    }
    
    return render(request, 'voluntarios/sistema.html', context)

def obtener_permisos_rol(role):
    """Obtener permisos según el rol - Igual que auth.js"""
    permisos_por_rol = {
        'Ayudante': {
            'canEdit': False,
            'canDelete': False,
            'canCreate': False,
            'canViewVoluntarios': False,
            'canEditVoluntarios': False,
            'canActivateVoluntarios': False,
            'canViewCargos': False,
            'canEditCargos': False,
            'canViewSanciones': False,
            'canEditSanciones': False,
            'canOnlySuspensions': False,
            'canViewFelicitaciones': False,
            'canEditFelicitaciones': False,
            'canViewAsistencia': True,
            'canEditAsistencia': True,
            'canViewHistorialAsistencia': True,
            'canViewRanking': True,
            'canViewFinanzas': False,
            'canEditFinanzas': False,
            'canViewUniformes': True,
            'canEditUniformes': True,
            'canViewTablaUniformes': True,
            'canGeneratePDFFicha': False,
            'canGeneratePDFVoluntarios': True,
            'canUploadLogos': False,
            'canViewAdminModules': False
        },
        'Capitán': {
            'canEdit': False,
            'canDelete': False,
            'canCreate': False,
            'canViewVoluntarios': True,
            'canEditVoluntarios': False,
            'canActivateVoluntarios': False,
            'canViewCargos': False,
            'canEditCargos': False,
            'canViewSanciones': True,
            'canEditSanciones': True,
            'canOnlySuspensions': True,
            'canViewFelicitaciones': False,
            'canEditFelicitaciones': False,
            'canViewAsistencia': True,
            'canEditAsistencia': True,
            'canViewHistorialAsistencia': True,
            'canViewRanking': True,
            'canViewFinanzas': False,
            'canEditFinanzas': False,
            'canViewUniformes': True,
            'canEditUniformes': True,
            'canViewTablaUniformes': True,
            'canGeneratePDFFicha': False,
            'canGeneratePDFVoluntarios': True,
            'canUploadLogos': False,
            'canViewAdminModules': False
        },
        'Secretario': {
            'canEdit': True,
            'canDelete': True,
            'canCreate': True,
            'canViewVoluntarios': True,
            'canEditVoluntarios': True,
            'canActivateVoluntarios': True,
            'canViewCargos': True,
            'canEditCargos': True,
            'canViewSanciones': True,
            'canEditSanciones': True,
            'canOnlySuspensions': False,
            'canViewFelicitaciones': True,
            'canEditFelicitaciones': True,
            'canViewAsistencia': False,
            'canEditAsistencia': False,
            'canViewHistorialAsistencia': False,
            'canViewRanking': False,
            'canViewFinanzas': False,
            'canEditFinanzas': False,
            'canViewUniformes': False,
            'canEditUniformes': False,
            'canViewTablaUniformes': True,
            'canGeneratePDFFicha': True,
            'canGeneratePDFVoluntarios': True,
            'canUploadLogos': True,
            'canViewAdminModules': False
        },
        'Tesorero': {
            'canEdit': False,
            'canDelete': False,
            'canCreate': False,
            'canViewVoluntarios': True,
            'canEditVoluntarios': False,
            'canActivateVoluntarios': False,
            'canViewCargos': False,
            'canEditCargos': False,
            'canViewSanciones': False,
            'canEditSanciones': False,
            'canOnlySuspensions': False,
            'canViewFelicitaciones': False,
            'canEditFelicitaciones': False,
            'canViewAsistencia': False,
            'canEditAsistencia': False,
            'canViewHistorialAsistencia': False,
            'canViewRanking': False,
            'canViewFinanzas': True,
            'canEditFinanzas': True,
            'canViewUniformes': True,
            'canEditUniformes': True,
            'canViewTablaUniformes': False,
            'canGeneratePDFFicha': False,
            'canGeneratePDFVoluntarios': False,
            'canUploadLogos': False,
            'canViewAdminModules': False
        },
        'Director': {
            'canEdit': True,
            'canDelete': True,
            'canCreate': True,
            'canViewVoluntarios': True,
            'canEditVoluntarios': True,
            'canActivateVoluntarios': True,
            'canViewCargos': True,
            'canEditCargos': True,
            'canViewSanciones': True,
            'canEditSanciones': True,
            'canOnlySuspensions': False,
            'canViewFelicitaciones': True,
            'canEditFelicitaciones': True,
            'canViewAsistencia': True,
            'canEditAsistencia': False,
            'canViewHistorialAsistencia': True,
            'canViewRanking': True,
            'canViewFinanzas': True,
            'canEditFinanzas': False,
            'canViewUniformes': True,
            'canEditUniformes': True,
            'canViewTablaUniformes': True,
            'canGeneratePDFFicha': True,
            'canGeneratePDFVoluntarios': True,
            'canUploadLogos': True,
            'canViewAdminModules': False
        },
        'Super Administrador': {
            'canEdit': True,
            'canDelete': True,
            'canCreate': True,
            'canViewVoluntarios': True,
            'canEditVoluntarios': True,
            'canActivateVoluntarios': True,
            'canViewCargos': True,
            'canEditCargos': True,
            'canViewSanciones': True,
            'canEditSanciones': True,
            'canOnlySuspensions': False,
            'canViewFelicitaciones': True,
            'canEditFelicitaciones': True,
            'canViewAsistencia': True,
            'canEditAsistencia': True,
            'canViewHistorialAsistencia': True,
            'canViewRanking': True,
            'canViewFinanzas': True,
            'canEditFinanzas': True,
            'canViewUniformes': True,
            'canEditUniformes': True,
            'canViewTablaUniformes': True,
            'canGeneratePDFFicha': True,
            'canGeneratePDFVoluntarios': True,
            'canUploadLogos': True,
            'canViewAdminModules': True
        }
    }
    
    return permisos_por_rol.get(role, {})
