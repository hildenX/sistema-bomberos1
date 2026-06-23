"""
Vistas SIMPLE sin DRF para ciclos anuales de beneficios
IMPORTANTE: Este endpoint NO requiere autenticaciÃ³n ni CSRF
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db.models import Sum
import json
from .models import CicloBeneficios, Beneficio, AsignacionBeneficio
from decimal import Decimal
from .permissions import autorizar_request, obtener_accion_desde_request


def _autorizar_ciclos_beneficios(request, accion=None):
    permiso = accion or obtener_accion_desde_request(request)
    autorizado, response = autorizar_request(request, modulo='beneficios', accion=permiso)
    return None if autorizado else response


def _stats_para_anio(anio):
    """Calcula estadÃ­sticas de beneficios para un aÃ±o dado."""
    beneficios_anio = Beneficio.objects.filter(fecha_evento__year=anio)
    asignaciones = AsignacionBeneficio.objects.filter(beneficio__fecha_evento__year=anio)

    total_beneficios = beneficios_anio.count()
    beneficios_activos = beneficios_anio.filter(estado='activo').count()
    beneficios_cerrados = beneficios_anio.filter(estado='cerrado').count()

    agg = asignaciones.aggregate(
        esperado=Sum('monto_total'),
        recaudado=Sum('monto_pagado'),
        pendiente=Sum('monto_pendiente'),
    )
    total_esperado = float(agg['esperado'] or Decimal('0'))
    total_recaudado = float(agg['recaudado'] or Decimal('0'))
    deuda_pendiente = float(agg['pendiente'] or Decimal('0'))
    voluntarios_con_deuda = asignaciones.filter(
        monto_pendiente__gt=0
    ).exclude(estado_pago='liberado').values('voluntario').distinct().count()

    return {
        'total_beneficios': total_beneficios,
        'beneficios_activos': beneficios_activos,
        'beneficios_cerrados': beneficios_cerrados,
        'total_esperado': total_esperado,
        'total_recaudado': total_recaudado,
        'deuda_pendiente': deuda_pendiente,
        'voluntarios_con_deuda': voluntarios_con_deuda,
    }


@csrf_exempt
@require_http_methods(["GET", "POST"])
def ciclos_beneficios_simple(request):
    """
    GET: Lista todos los ciclos con estadÃ­sticas. TambiÃ©n detecta aÃ±os con
         beneficios que no tienen ciclo formal registrado.
    POST: Crea un nuevo ciclo anual.
    """
    auth_response = _autorizar_ciclos_beneficios(request)
    if auth_response:
        return auth_response

    if request.method == 'GET':
        ciclos = list(CicloBeneficios.objects.order_by('-anio'))
        anios_con_ciclo = {c.anio for c in ciclos}

        # AÃ±os que tienen beneficios pero no tienen ciclo formal
        anios_sin_ciclo = set(
            Beneficio.objects.exclude(fecha_evento__year__in=anios_con_ciclo)
            .values_list('fecha_evento__year', flat=True)
            .distinct()
        )

        data = []

        for ciclo in ciclos:
            stats = _stats_para_anio(ciclo.anio)
            data.append({
                'id': ciclo.id,
                'anio': ciclo.anio,
                'fecha_inicio': str(ciclo.fecha_inicio),
                'fecha_fin': str(ciclo.fecha_fin),
                'activo': ciclo.activo,
                'cerrado': ciclo.cerrado,
                'observaciones': ciclo.observaciones or '',
                'fecha_creacion': ciclo.fecha_creacion.isoformat(),
                'fecha_cierre': ciclo.fecha_cierre.isoformat() if ciclo.fecha_cierre else None,
                'sin_ciclo_formal': False,
                **stats,
            })

        # Agregar aÃ±os sin ciclo formal (solo como filas informativas, sin id)
        for anio in sorted(anios_sin_ciclo, reverse=True):
            stats = _stats_para_anio(anio)
            data.append({
                'id': None,
                'anio': anio,
                'fecha_inicio': f'{anio}-01-01',
                'fecha_fin': f'{anio}-12-31',
                'activo': False,
                'cerrado': False,
                'observaciones': '',
                'fecha_creacion': None,
                'fecha_cierre': None,
                'sin_ciclo_formal': True,
                **stats,
            })

        # Ordenar por aÃ±o descendente
        data.sort(key=lambda x: x['anio'], reverse=True)
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        try:
            body = json.loads(request.body)

            if 'anio' not in body:
                return JsonResponse({'error': 'El aÃ±o es requerido'}, status=400)

            anio = int(body['anio'])

            if CicloBeneficios.objects.filter(anio=anio).exists():
                return JsonResponse({'error': f'Ya existe un ciclo para el aÃ±o {anio}'}, status=400)

            if body.get('activo', False):
                CicloBeneficios.objects.filter(activo=True).update(activo=False)

            ciclo = CicloBeneficios.objects.create(
                anio=anio,
                fecha_inicio=body.get('fecha_inicio', f'{anio}-01-01'),
                fecha_fin=body.get('fecha_fin', f'{anio}-12-31'),
                activo=body.get('activo', False),
                observaciones=body.get('observaciones', ''),
            )

            stats = _stats_para_anio(ciclo.anio)
            return JsonResponse({
                'id': ciclo.id,
                'anio': ciclo.anio,
                'fecha_inicio': str(ciclo.fecha_inicio),
                'fecha_fin': str(ciclo.fecha_fin),
                'activo': ciclo.activo,
                'cerrado': ciclo.cerrado,
                'observaciones': ciclo.observaciones or '',
                'fecha_creacion': ciclo.fecha_creacion.isoformat(),
                'fecha_cierre': None,
                'sin_ciclo_formal': False,
                **stats,
            }, status=201)

        except (ValueError, KeyError) as e:
            return JsonResponse({'error': f'Dato invÃ¡lido: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def activar_ciclo_beneficio(request, ciclo_id):
    """Activa un ciclo y desactiva los demÃ¡s."""
    auth_response = _autorizar_ciclos_beneficios(request, accion='edit')
    if auth_response:
        return auth_response

    try:
        ciclo = CicloBeneficios.objects.get(id=ciclo_id)
        CicloBeneficios.objects.exclude(id=ciclo_id).update(activo=False)
        ciclo.activo = True
        ciclo.save()
        return JsonResponse({
            'id': ciclo.id,
            'anio': ciclo.anio,
            'activo': ciclo.activo,
            'mensaje': f'Ciclo {ciclo.anio} activado exitosamente',
        })
    except CicloBeneficios.DoesNotExist:
        return JsonResponse({'error': 'Ciclo no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def cerrar_ciclo_beneficio(request, ciclo_id):
    """
    Cierra el ciclo anual.
    REGLA: Solo se puede cerrar si TODOS los beneficios del aÃ±o ya tienen estado='cerrado'.
    Los beneficios solo se pueden cerrar cuando sus tarjetas estÃ¡n todas vendidas o liberadas.
    """
    auth_response = _autorizar_ciclos_beneficios(request, accion='edit')
    if auth_response:
        return auth_response

    try:
        ciclo = CicloBeneficios.objects.get(id=ciclo_id)

        if ciclo.cerrado:
            return JsonResponse({'error': 'El ciclo ya estÃ¡ cerrado'}, status=400)

        # Verificar que no haya beneficios activos en el aÃ±o
        beneficios_activos = Beneficio.objects.filter(
            fecha_evento__year=ciclo.anio,
            estado='activo',
        ).values('id', 'nombre', 'fecha_evento')

        if beneficios_activos.exists():
            lista = [
                {'nombre': b['nombre'], 'fecha': str(b['fecha_evento'])}
                for b in beneficios_activos
            ]
            return JsonResponse({
                'error': f'No se puede cerrar el ciclo: hay {len(lista)} beneficio(s) aÃºn activo(s) en {ciclo.anio}. '
                         f'Cierra cada beneficio individualmente antes de cerrar el ciclo.',
                'beneficios_activos': lista,
            }, status=400)

        # Todos los beneficios estÃ¡n cerrados â†’ cerrar el ciclo
        ciclo.cerrado = True
        ciclo.activo = False
        ciclo.fecha_cierre = timezone.now()
        ciclo.save()

        stats = _stats_para_anio(ciclo.anio)
        return JsonResponse({
            'id': ciclo.id,
            'anio': ciclo.anio,
            'cerrado': ciclo.cerrado,
            'fecha_cierre': ciclo.fecha_cierre.isoformat(),
            'mensaje': f'Ciclo {ciclo.anio} cerrado exitosamente.',
            **stats,
        })

    except CicloBeneficios.DoesNotExist:
        return JsonResponse({'error': 'Ciclo no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reabrir_ciclo_beneficio(request, ciclo_id):
    """Reabre un ciclo cerrado. No reabre automÃ¡ticamente los beneficios."""
    auth_response = _autorizar_ciclos_beneficios(request, accion='edit')
    if auth_response:
        return auth_response

    try:
        ciclo = CicloBeneficios.objects.get(id=ciclo_id)
        ciclo.cerrado = False
        ciclo.fecha_cierre = None
        ciclo.save()
        return JsonResponse({
            'id': ciclo.id,
            'anio': ciclo.anio,
            'cerrado': ciclo.cerrado,
            'mensaje': f'Ciclo {ciclo.anio} reabierto exitosamente',
        })
    except CicloBeneficios.DoesNotExist:
        return JsonResponse({'error': 'Ciclo no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def estadisticas_ciclo_beneficio(request, ciclo_id):
    """EstadÃ­sticas detalladas de un ciclo."""
    auth_response = _autorizar_ciclos_beneficios(request, accion='view')
    if auth_response:
        return auth_response

    try:
        ciclo = CicloBeneficios.objects.get(id=ciclo_id)
        stats = _stats_para_anio(ciclo.anio)

        eficiencia = 0
        if stats['total_esperado'] > 0:
            eficiencia = round(stats['total_recaudado'] / stats['total_esperado'] * 100, 1)

        return JsonResponse({
            'ciclo': {
                'id': ciclo.id,
                'anio': ciclo.anio,
                'activo': ciclo.activo,
                'cerrado': ciclo.cerrado,
            },
            'eficiencia': eficiencia,
            **stats,
        })
    except CicloBeneficios.DoesNotExist:
        return JsonResponse({'error': 'Ciclo no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


