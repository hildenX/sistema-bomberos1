"""
Vista SIMPLE para configuración de cuotas
Sin autenticación para desarrollo
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import ConfiguracionCuotas, CicloCuotas
from decimal import Decimal
import json
from .permissions import autorizar_request, obtener_accion_desde_request


def _autorizar_configuracion_cuotas(request):
    accion = obtener_accion_desde_request(request)
    autorizado, response = autorizar_request(request, modulo='cuotas', accion=accion)
    return None if autorizado else response


@csrf_exempt
@require_http_methods(["GET", "POST"])
def configuracion_cuotas_simple(request):
    """
    GET: Retorna la configuración de precios de cuotas
    POST: Actualiza la configuración de precios
    """
    auth_response = _autorizar_configuracion_cuotas(request)
    if auth_response:
        return auth_response

    if request.method == 'GET':
        try:
            # Preferir precios del ciclo activo (fuente de verdad)
            ciclo_activo = CicloCuotas.objects.filter(activo=True).first()
            if ciclo_activo:
                return JsonResponse({
                    'precio_regular': str(ciclo_activo.precio_cuota_regular),
                    'precio_estudiante': str(ciclo_activo.precio_cuota_estudiante)
                })

            config = ConfiguracionCuotas.objects.first()

            if not config:
                # Crear configuración por defecto si no existe
                config = ConfiguracionCuotas.objects.create(
                    precio_regular=Decimal('5000'),
                    precio_estudiante=Decimal('3000')
                )

            return JsonResponse({
                'precio_regular': str(config.precio_regular),
                'precio_estudiante': str(config.precio_estudiante)
            })

        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)
    
    else:  # POST
        try:
            data = json.loads(request.body)
            precio_regular = Decimal(str(data.get('precio_regular', 5000)))
            precio_estudiante = Decimal(str(data.get('precio_estudiante', 3000)))
            
            # Obtener o crear la configuración
            config = ConfiguracionCuotas.objects.first()
            if not config:
                config = ConfiguracionCuotas.objects.create(
                    precio_regular=precio_regular,
                    precio_estudiante=precio_estudiante
                )
            else:
                config.precio_regular = precio_regular
                config.precio_estudiante = precio_estudiante
                config.save()
            
            # Actualizar también el ciclo activo si existe
            ciclo_activo = CicloCuotas.objects.filter(activo=True).first()
            if ciclo_activo:
                ciclo_activo.precio_cuota_regular = precio_regular
                ciclo_activo.precio_cuota_estudiante = precio_estudiante
                ciclo_activo.save()
            
            return JsonResponse({
                'success': True,
                'precio_regular': str(config.precio_regular),
                'precio_estudiante': str(config.precio_estudiante),
                'ciclo_actualizado': ciclo_activo is not None,
                'message': 'Configuración actualizada exitosamente'
            })
            
        except Exception as e:
            return JsonResponse({
                'error': str(e)
            }, status=500)
