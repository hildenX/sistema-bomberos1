"""
Vista SIMPLE para gestionar estado de cuotas (activar/desactivar)
IMPORTANTE: Este endpoint NO requiere autenticación ni CSRF
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.utils import timezone
from django.core.files.storage import default_storage
import json
from .models import EstadoCuotasBombero, Voluntario, CicloCuotas
from .permissions import autorizar_request, obtener_accion_desde_request


def _autorizar_estado_cuotas(request):
    accion = obtener_accion_desde_request(request)
    autorizado, response = autorizar_request(request, modulo='cuotas', accion=accion)
    return None if autorizado else response

@csrf_exempt
@require_http_methods(["GET", "POST"])
def estado_cuotas_simple(request, voluntario_id):
    """
    Endpoint SIMPLE para ver/modificar estado de cuotas
    SIN autenticación requerida (desarrollo)
    auth_response = _autorizar_estado_cuotas(request)
    if auth_response:
        return auth_response

    GET: Ver estado actual
    POST: Activar/Desactivar cuotas
    """
    
    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
    except Voluntario.DoesNotExist:
        return JsonResponse({'error': 'Voluntario no encontrado'}, status=404)
    
    if request.method == 'GET':
        # Obtener o crear estado
        estado, created = EstadoCuotasBombero.objects.get_or_create(
            voluntario=voluntario
        )
        
        return JsonResponse({
            'voluntario_id': voluntario.id,
            'voluntario_nombre': f"{voluntario.nombre} {voluntario.apellido_paterno}",
            'cuotas_desactivadas': estado.cuotas_desactivadas,
            'motivo_desactivacion': estado.motivo_desactivacion or '',
            'es_estudiante': estado.es_estudiante,
            'fecha_desactivacion': str(estado.fecha_desactivacion) if estado.fecha_desactivacion else None,
            'desactivado_por': estado.desactivado_por or ''
        })
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            accion = data.get('accion')  # 'desactivar' o 'reactivar'
            
            with transaction.atomic():
                # Obtener o crear estado
                estado, created = EstadoCuotasBombero.objects.get_or_create(
                    voluntario=voluntario
                )
                
                if accion == 'desactivar':
                    estado.cuotas_desactivadas = True
                    estado.motivo_desactivacion = data.get('motivo', 'Sin motivo especificado')
                    estado.desactivado_por = data.get('usuario', 'Sistema')
                    from django.utils import timezone
                    estado.fecha_desactivacion = timezone.now()
                    mensaje = 'Cuotas desactivadas exitosamente'
                    
                elif accion == 'reactivar':
                    estado.cuotas_desactivadas = False
                    estado.motivo_desactivacion = None
                    estado.fecha_desactivacion = None
                    estado.desactivado_por = None
                    mensaje = 'Cuotas reactivadas exitosamente'
                    
                else:
                    return JsonResponse({'error': 'Acción inválida. Use "desactivar" o "reactivar"'}, status=400)
                
                estado.save()
            
            return JsonResponse({
                'mensaje': mensaje,
                'voluntario_id': voluntario.id,
                'cuotas_desactivadas': estado.cuotas_desactivadas,
                'motivo_desactivacion': estado.motivo_desactivacion or '',
                'es_estudiante': estado.es_estudiante
            }, status=200)
            
        except KeyError as e:
            return JsonResponse({'error': f'Falta el campo: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def activar_estudiante_simple(request, voluntario_id):
    """
    Endpoint SIMPLE para activar estudiante
    SIN autenticación requerida (desarrollo)
    """
    auth_response = _autorizar_estado_cuotas(request)
    if auth_response:
        return auth_response

    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
    except Voluntario.DoesNotExist:
        return JsonResponse({'error': 'Voluntario no encontrado'}, status=404)
    
    try:
        # Obtener datos del formulario
        ciclo_id = request.POST.get('ciclo_id')
        mes_inicio = request.POST.get('mes_inicio')
        observaciones = request.POST.get('observaciones', '')
        certificado = request.FILES.get('certificado')
        
        if not ciclo_id or not mes_inicio:
            return JsonResponse({'error': 'Faltan campos requeridos'}, status=400)
        
        if not certificado:
            return JsonResponse({'error': 'Debe adjuntar el certificado de alumno regular'}, status=400)

        # Validar que el certificado sea PDF
        if not certificado.name.lower().endswith('.pdf') or certificado.content_type != 'application/pdf':
            return JsonResponse({'error': 'El certificado debe ser un archivo PDF'}, status=400)

        # Verificar que el ciclo existe
        try:
            ciclo = CicloCuotas.objects.get(id=ciclo_id)
        except CicloCuotas.DoesNotExist:
            return JsonResponse({'error': 'Ciclo no encontrado'}, status=404)
        
        with transaction.atomic():
            # Obtener o crear estado
            estado, created = EstadoCuotasBombero.objects.get_or_create(
                voluntario=voluntario
            )
            
            # Guardar certificado
            file_name = f'certificados_estudiante/{voluntario_id}_{timezone.now().strftime("%Y%m%d_%H%M%S")}_{certificado.name}'
            file_path = default_storage.save(file_name, certificado)
            
            # Activar estudiante
            estado.es_estudiante = True
            estado.fecha_activacion_estudiante = timezone.now()
            estado.observaciones_estudiante = f"Ciclo {ciclo.anio} - Desde mes {mes_inicio}. {observaciones}".strip()
            estado.save()
        
        return JsonResponse({
            'mensaje': 'Estudiante activado exitosamente',
            'voluntario_id': voluntario.id,
            'es_estudiante': True,
            'ciclo': ciclo.anio,
            'mes_inicio': mes_inicio,
            'certificado_guardado': True
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def desactivar_estudiante_simple(request, voluntario_id):
    """
    Endpoint SIMPLE para desactivar estudiante
    SIN autenticación requerida (desarrollo)
    """
    auth_response = _autorizar_estado_cuotas(request)
    if auth_response:
        return auth_response

    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
    except Voluntario.DoesNotExist:
        return JsonResponse({'error': 'Voluntario no encontrado'}, status=404)
    
    try:
        with transaction.atomic():
            # Obtener estado
            try:
                estado = EstadoCuotasBombero.objects.get(voluntario=voluntario)
            except EstadoCuotasBombero.DoesNotExist:
                return JsonResponse({'error': 'El voluntario no tiene estado de cuotas'}, status=404)
            
            if not estado.es_estudiante:
                return JsonResponse({'error': 'El voluntario no está marcado como estudiante'}, status=400)
            
            # Desactivar estudiante
            estado.es_estudiante = False
            estado.fecha_activacion_estudiante = None
            estado.observaciones_estudiante = ''
            estado.save()
        
        return JsonResponse({
            'mensaje': 'Estudiante desactivado exitosamente',
            'voluntario_id': voluntario.id,
            'es_estudiante': False
        }, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
