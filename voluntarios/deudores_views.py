"""
Vista simplificada para obtener deudores con toda la información necesaria
"""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .utils_tesoreria import calcular_deudores_cuotas, calcular_deudas_beneficios_y_rifas
from datetime import datetime
from .permissions import autorizar_request
from .pdf_nominas import _orden_antiguedad


def _autorizar_finanzas(request):
    autorizado, response = autorizar_request(request, modulo='finanzas', accion='view')
    return None if autorizado else response


@csrf_exempt
@require_http_methods(["GET"])
def listar_deudores_cuotas(request):
    """
    Endpoint simplificado que devuelve deudores de cuotas con toda la info
    GET /api/voluntarios/deudores-cuotas-listado/
    """
    auth_response = _autorizar_finanzas(request)
    if auth_response:
        return auth_response

    try:
        anio = request.GET.get('anio')
        if anio:
            anio = int(anio)
        else:
            anio = datetime.now().year
        
        # Obtener deudores usando la función de utils
        deudores = calcular_deudores_cuotas(anio)
        
        # Formatear respuesta
        meses_nombres = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        
        resultado = []
        for d in deudores:
            vol = d['voluntario']
            # Convertir lista de meses a nombres legibles
            meses_str = ', '.join([meses_nombres[m['mes']] for m in d['meses_pendientes']])
            
            resultado.append({
                'id': vol.id,
                'nombre_completo': f"{vol.nombre} {vol.apellido_paterno}",
                'clave_bombero': vol.clave_bombero or 'N/A',
                'meses_pendientes': meses_str,
                'cantidad_meses': len(d['meses_pendientes']),
                'monto': float(d['monto']),
                'precio_cuota': float(d['precio_cuota'])
            })
        
        return JsonResponse({
            'success': True,
            'total': len(resultado),
            'deudores': resultado
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def listar_deudores_beneficios(request):
    """
    Endpoint simplificado que devuelve deudores de beneficios con toda la info
    GET /api/voluntarios/deudores-beneficios-listado/
    """
    auth_response = _autorizar_finanzas(request)
    if auth_response:
        return auth_response

    try:
        # Beneficios y rifas: misma fuente que el PDF de la nómina
        resultado = []
        # Más antiguo primero, igual que las nóminas en PDF
        for d in sorted(calcular_deudas_beneficios_y_rifas(), key=lambda d: _orden_antiguedad(d['voluntario'])):
            v = d['voluntario']
            resultado.append({
                'id': d['id'],
                'tipo': d['tipo'],
                'voluntario_id': v.id,
                'voluntario_nombre': f"{v.nombre} {v.apellido_paterno}",
                'voluntario_clave': v.clave_bombero or 'N/A',
                'voluntario_antiguedad': v.fecha_base_antiguedad.isoformat() if v.fecha_base_antiguedad else None,
                'beneficio_id': d['grupo'][1],
                'beneficio_nombre': d['grupo_nombre'],
                'tarjetas_asignadas': d['cantidad_asignada'],
                'debe': d['debe'],
                'monto_pendiente': float(d['monto_pendiente'])
            })

        return JsonResponse({
            'success': True,
            'total': len(resultado),
            'deudores': resultado
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
