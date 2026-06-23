"""
Vistas SIMPLES para voluntarios (sin DRF, sin autenticación)
Para uso en asistencias y otros módulos sin login
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from datetime import date

from .models import Voluntario, Cargo
from .permissions import autorizar_request


def _autorizar_voluntarios(request):
    autorizado, response = autorizar_request(request, modulo='voluntarios', accion='view')
    return None if autorizado else response


@csrf_exempt
@require_http_methods(["GET"])
def listar_voluntarios_simple(request):
    """
    Listar voluntarios activos y mártires con categorías calculadas
    GET /api/voluntarios/lista-activos-simple/
    """
    auth_response = _autorizar_voluntarios(request)
    if auth_response:
        return auth_response

    try:
        # Obtener voluntarios activos y mártires
        voluntarios = Voluntario.objects.filter(
            estado_bombero__in=['activo', 'martir']
        ).order_by('apellido_paterno', 'nombre')
        
        resultado = []
        
        for vol in voluntarios:
            # Calcular categoría
            if vol.fecha_ingreso:
                antiguedad = (date.today() - vol.fecha_ingreso).days // 365
                
                if antiguedad < 20:
                    categoria = 'Voluntario'
                elif antiguedad < 25:
                    categoria = 'Honorario Compañía'
                elif antiguedad < 50:
                    categoria = 'Honorario Cuerpo'
                else:
                    categoria = 'Insigne'
            else:
                categoria = 'Voluntario'
                antiguedad = 0
            
            # Buscar cargo vigente
            cargo_vigente = Cargo.objects.filter(
                voluntario=vol,
                fecha_fin__isnull=True
            ).first()
            
            # Construir objeto
            vol_data = {
                'id': vol.id,
                'nombre': vol.nombre or '',
                'apellido_paterno': vol.apellido_paterno or '',
                'apellido_materno': vol.apellido_materno or '',
                'nombreCompleto': f"{vol.nombre or ''} {vol.apellido_paterno or ''} {vol.apellido_materno or ''}".strip(),
                'rut': vol.rut,
                'clave_bombero': vol.clave_bombero or '',
                'fecha_ingreso': vol.fecha_ingreso.isoformat() if vol.fecha_ingreso else None,
                'fecha_nacimiento': vol.fecha_nacimiento.isoformat() if vol.fecha_nacimiento else None,
                'compania': vol.compania or 'Sexta Compañía',
                'estado_bombero': vol.estado_bombero,
                'estadoBombero': vol.estado_bombero,  # Alias para compatibilidad
                'categoria_bombero': categoria,
                'antiguedad_anos': antiguedad,
                'telefono': vol.telefono or '',
                'email': vol.email or '',
                'domicilio': vol.domicilio or '',
            }
            
            # Agregar cargo si tiene
            if cargo_vigente:
                vol_data['cargo_actual'] = {
                    'id': cargo_vigente.id,
                    'nombre_cargo': cargo_vigente.nombre_cargo,
                    'tipo_cargo': cargo_vigente.tipo_cargo
                }
            else:
                vol_data['cargo_actual'] = None
            
            resultado.append(vol_data)
        
        return JsonResponse(resultado, safe=False, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def obtener_voluntario_simple(request, voluntario_id):
    """
    Obtener un voluntario específico
    GET /api/voluntarios/{id}/detalle-simple/
    """
    auth_response = _autorizar_voluntarios(request)
    if auth_response:
        return auth_response

    try:
        vol = Voluntario.objects.get(id=voluntario_id)
        
        # Calcular categoría
        if vol.fecha_ingreso:
            antiguedad = (date.today() - vol.fecha_ingreso).days // 365
            
            if antiguedad < 20:
                categoria = 'Voluntario'
            elif antiguedad < 25:
                categoria = 'Honorario Compañía'
            elif antiguedad < 50:
                categoria = 'Honorario Cuerpo'
            else:
                categoria = 'Insigne'
        else:
            categoria = 'Voluntario'
            antiguedad = 0
        
        # Buscar cargos
        cargos = Cargo.objects.filter(voluntario=vol).order_by('-fecha_inicio')
        
        cargo_vigente = cargos.filter(fecha_fin__isnull=True).first()
        
        vol_data = {
            'id': vol.id,
            'nombre': vol.nombre or '',
            'apellido_paterno': vol.apellido_paterno or '',
            'apellido_materno': vol.apellido_materno or '',
            'nombreCompleto': f"{vol.nombre or ''} {vol.apellido_paterno or ''} {vol.apellido_materno or ''}".strip(),
            'rut': vol.rut,
            'clave_bombero': vol.clave_bombero or '',
            'fecha_ingreso': vol.fecha_ingreso.isoformat() if vol.fecha_ingreso else None,
            'fecha_nacimiento': vol.fecha_nacimiento.isoformat() if vol.fecha_nacimiento else None,
            'compania': vol.compania or 'Sexta Compañía',
            'estado_bombero': vol.estado_bombero,
            'categoria_bombero': categoria,
            'antiguedad_anos': antiguedad,
            'telefono': vol.telefono or '',
            'email': vol.email or '',
            'domicilio': vol.domicilio or '',
            'profesion': vol.profesion or '',
            'grupo_sanguineo': vol.grupo_sanguineo or '',
        }
        
        # Agregar cargo actual
        if cargo_vigente:
            vol_data['cargo_actual'] = {
                'id': cargo_vigente.id,
                'nombre_cargo': cargo_vigente.nombre_cargo,
                'tipo_cargo': cargo_vigente.tipo_cargo,
                'fecha_inicio': cargo_vigente.fecha_inicio.isoformat() if cargo_vigente.fecha_inicio else None
            }
        
        # Agregar historial de cargos
        vol_data['cargos_historial'] = [
            {
                'nombre_cargo': c.nombre_cargo,
                'tipo_cargo': c.tipo_cargo,
                'fecha_inicio': c.fecha_inicio.isoformat() if c.fecha_inicio else None,
                'fecha_fin': c.fecha_fin.isoformat() if c.fecha_fin else None
            }
            for c in cargos
        ]
        
        return JsonResponse(vol_data, status=200)
        
    except Voluntario.DoesNotExist:
        return JsonResponse({'error': 'Voluntario no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
