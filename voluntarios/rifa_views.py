"""
Vistas para el Sistema de Rifas
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from datetime import date
import json
import re

from .models import (
    Voluntario, Rifa, AsignacionRifa, PagoRifa,
    MovimientoFinanciero, CuentaBancaria
)
from dateutil.relativedelta import relativedelta
from .permissions import autorizar_request, RolBomberos


ROLES_RIFAS = (
    RolBomberos.TESORERO,
    RolBomberos.SUPER_ADMIN,
)


def _autorizar_rifas(request):
    autorizado, response = autorizar_request(request, roles=ROLES_RIFAS)
    return None if autorizado else response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rifa_stats(rifa):
    asigs = rifa.asignaciones.all()
    total = asigs.count()
    no_retirada = asigs.filter(estado='no_retirada').count()
    retirada    = asigs.filter(estado='retirada').count()
    pagada      = asigs.filter(estado='pagada').count()
    liberada    = asigs.filter(estado='liberada').count()
    recaudado_transferencia = PagoRifa.objects.filter(
        asignacion__rifa=rifa, metodo_pago='transferencia'
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
    recaudado_efectivo = PagoRifa.objects.filter(
        asignacion__rifa=rifa, metodo_pago='efectivo'
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
    return {
        'total':                    total,
        'no_retirada':              no_retirada,
        'retirada':                 retirada,
        'pagada':                   pagada,
        'liberada':                 liberada,
        'recaudado_transferencia':  float(recaudado_transferencia),
        'recaudado_efectivo':       float(recaudado_efectivo),
    }


def _rifa_to_dict(rifa, include_stats=True):
    d = {
        'id':                        rifa.id,
        'ciclo':                     rifa.ciclo,
        'nombre':                    rifa.nombre,
        'fecha_inicio':              rifa.fecha_inicio.isoformat(),
        'fecha_cierre':              rifa.fecha_cierre.isoformat(),
        'precio_numero':             float(rifa.precio_numero),
        'numeros_por_talonario':     rifa.numeros_por_talonario,
        'talonarios_voluntarios':    rifa.talonarios_voluntarios,
        'talonarios_honorarios_cia': rifa.talonarios_honorarios_cia,
        'talonarios_honorarios_cuerpo': rifa.talonarios_honorarios_cuerpo,
        'talonarios_insignes':       rifa.talonarios_insignes,
        'estado':                    rifa.estado,
        'created_at':                rifa.created_at.isoformat() if rifa.created_at else None,
    }
    if include_stats:
        d['stats'] = _rifa_stats(rifa)
    return d


def _asignacion_to_dict(asig, include_pagos=False):
    vol = asig.voluntario
    hoy = timezone.now().date()
    _fbase = vol.fecha_base_antiguedad
    antiguedad = relativedelta(hoy, _fbase).years if _fbase else 0
    d = {
        'id':                 asig.id,
        'voluntario_id':      vol.id,
        'voluntario_nombre':  f"{vol.nombre or ''} {vol.apellido_paterno or ''} {vol.apellido_materno or ''}".strip(),
        'voluntario_clave':   vol.clave_bombero or '',
        'voluntario_email':   vol.email or '',
        'antiguedad':         antiguedad,
        'talonarios_asignados': asig.talonarios_asignados,
        'numeros':            json.loads(asig.numeros or '[]'),
        'estado':             asig.estado,
        'monto_total':        float(asig.monto_total),
        'monto_pagado':       float(asig.monto_pagado),
        'monto_pendiente':    float(asig.monto_pendiente),
        'historial_liberaciones': json.loads(asig.historial_liberaciones or '[]'),
        'fecha_retiro':       asig.fecha_retiro.isoformat() if asig.fecha_retiro else None,
        'created_at':         asig.created_at.isoformat() if asig.created_at else None,
    }
    if include_pagos:
        pagos = []
        for p in asig.pagos.all().order_by('-created_at'):
            solicitud = p.solicitudes_portal.filter(comprobante__isnull=False).order_by('-created_at').first()
            pagos.append({
                'id':                    p.id,
                'monto':                 float(p.monto),
                'fecha_pago':            p.fecha_pago.isoformat(),
                'metodo_pago':           p.metodo_pago,
                'cuenta_bancaria_id':    p.cuenta_bancaria_id,
                'cuenta_bancaria_nombre': p.cuenta_bancaria.nombre if p.cuenta_bancaria else None,
                'numero_comprobante':    p.numero_comprobante or '',
                'tiene_comprobante':     bool(p.comprobante_base64) or bool(solicitud and solicitud.comprobante),
                'comprobante_base64':    p.comprobante_base64 or None,
                'comprobante_url':       solicitud.comprobante.url if solicitud and solicitud.comprobante else None,
                'observaciones':         p.observaciones or '',
                'created_at':            p.created_at.isoformat() if p.created_at else None,
            })
        d['pagos'] = pagos
    return d


def _validar_ciclo(ciclo):
    """Valida que ciclo sea un año de 4 dígitos entre 2000 y 2099."""
    if not re.fullmatch(r'20\d{2}', ciclo):
        return 'El ciclo debe ser un año válido (ej: 2025)'
    return None


def _contar_numeros_rangos(rangos):
    """Cuenta el total de números en una lista de rangos [{desde, hasta}]."""
    return sum(int(r['hasta']) - int(r['desde']) + 1 for r in rangos)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@csrf_exempt
def rifas_simple(request):
    """
    GET  /api/voluntarios/rifas-simple/   → lista rifas con stats
    POST /api/voluntarios/rifas-simple/   → crear rifa + auto-asignaciones
    """
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    if request.method == 'GET':
        try:
            rifas = Rifa.objects.all()
            return JsonResponse([_rifa_to_dict(r) for r in rifas], safe=False)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)

            ciclo  = str(data.get('ciclo', '')).strip()
            nombre = str(data.get('nombre', '')).strip()
            fecha_inicio_str = data.get('fecha_inicio', '')
            fecha_cierre_str = data.get('fecha_cierre', '')

            # ── Validaciones obligatorias ──────────────────────────────────
            if not ciclo or not nombre:
                return JsonResponse({'error': 'Ciclo y nombre son obligatorios'}, status=400)

            err_ciclo = _validar_ciclo(ciclo)
            if err_ciclo:
                return JsonResponse({'error': err_ciclo}, status=400)

            if not fecha_inicio_str:
                return JsonResponse({'error': 'La fecha de inicio es obligatoria'}, status=400)

            try:
                precio_numero = Decimal(str(data.get('precio_numero', 0)))
                if precio_numero <= 0:
                    raise ValueError
            except (ValueError, InvalidOperation):
                return JsonResponse({'error': 'El precio por número debe ser mayor a 0'}, status=400)

            try:
                numeros_por_talonario = int(data.get('numeros_por_talonario', 0))
                if numeros_por_talonario <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                return JsonResponse({'error': 'Los números por talonario deben ser mayor a 0'}, status=400)

            # ── Talonarios por categoría ────────────────────────────────────
            try:
                tal_vol     = max(0, int(data.get('talonarios_voluntarios', 0)))
                tal_hcia    = max(0, int(data.get('talonarios_honorarios_cia', 0)))
                tal_hcuerpo = max(0, int(data.get('talonarios_honorarios_cuerpo', 0)))
                tal_insignes = max(0, int(data.get('talonarios_insignes', 0)))
            except (ValueError, TypeError):
                return JsonResponse({'error': 'Los valores de talonarios deben ser números enteros'}, status=400)

            if tal_vol + tal_hcia + tal_hcuerpo + tal_insignes == 0:
                return JsonResponse({'error': 'Debe asignar al menos un talonario en alguna categoría'}, status=400)

            # ── Fechas ─────────────────────────────────────────────────────
            try:
                fecha_inicio = date.fromisoformat(fecha_inicio_str)
            except ValueError:
                return JsonResponse({'error': 'Fecha de inicio inválida'}, status=400)

            if fecha_cierre_str:
                try:
                    fecha_cierre = date.fromisoformat(fecha_cierre_str)
                except ValueError:
                    return JsonResponse({'error': 'Fecha de cierre inválida'}, status=400)
            else:
                fecha_cierre = date(int(ciclo), 12, 30)

            if fecha_inicio > fecha_cierre:
                return JsonResponse({'error': 'La fecha de inicio no puede ser posterior a la fecha de cierre'}, status=400)

            # ── Duplicidad de ciclo ────────────────────────────────────────
            if Rifa.objects.filter(ciclo=ciclo).exists():
                return JsonResponse({'error': f'Ya existe una rifa para el ciclo {ciclo}'}, status=400)

            # ── Creación ────────────────────────────────────────────────────
            with transaction.atomic():
                rifa = Rifa.objects.create(
                    ciclo=ciclo,
                    nombre=nombre,
                    fecha_inicio=fecha_inicio,
                    fecha_cierre=fecha_cierre,
                    precio_numero=precio_numero,
                    numeros_por_talonario=numeros_por_talonario,
                    talonarios_voluntarios=tal_vol,
                    talonarios_honorarios_cia=tal_hcia,
                    talonarios_honorarios_cuerpo=tal_hcuerpo,
                    talonarios_insignes=tal_insignes,
                )

                voluntarios = Voluntario.objects.filter(estado_bombero='activo')
                asignaciones_creadas = 0
                hoy = timezone.now().date()

                for voluntario in voluntarios:
                    # Antiguedad reconocida (fecha efectiva si existe). Sin fecha -> regular (0)
                    _fbase = voluntario.fecha_base_antiguedad
                    if _fbase:
                        antiguedad = relativedelta(hoy, _fbase).years
                    else:
                        antiguedad = 0

                    if antiguedad >= 50:
                        talonarios = tal_insignes
                    elif antiguedad >= 25:
                        talonarios = tal_hcuerpo
                    elif antiguedad >= 20:
                        talonarios = tal_hcia
                    else:
                        talonarios = tal_vol

                    if talonarios <= 0:
                        continue

                    monto_total = Decimal(talonarios) * Decimal(numeros_por_talonario) * precio_numero
                    AsignacionRifa.objects.create(
                        rifa=rifa,
                        voluntario=voluntario,
                        talonarios_asignados=talonarios,
                        monto_total=monto_total,
                    )
                    asignaciones_creadas += 1

            return JsonResponse({
                'mensaje':             'Rifa creada con asignaciones automáticas',
                'rifa_id':             rifa.id,
                'nombre':              rifa.nombre,
                'asignaciones_creadas': asignaciones_creadas,
            }, status=201)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'JSON inválido'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Método no permitido'}, status=405)


@csrf_exempt
@require_http_methods(["GET"])
def rifa_detalle_simple(request, rifa_id):
    """GET /api/voluntarios/rifas-simple/<id>/"""
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        rifa  = Rifa.objects.get(id=rifa_id)
        d     = _rifa_to_dict(rifa, include_stats=True)
        asigs = rifa.asignaciones.select_related('voluntario').all()
        d['asignaciones'] = [_asignacion_to_dict(a, include_pagos=True) for a in asigs]
        return JsonResponse(d)
    except Rifa.DoesNotExist:
        return JsonResponse({'error': 'Rifa no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def asignar_numeros_rifa(request):
    """POST /api/voluntarios/asignar-numeros-rifa/"""
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        data          = json.loads(request.body)
        asignacion_id = data.get('asignacion_id')
        numeros_nuevos = data.get('numeros', [])

        if not asignacion_id:
            return JsonResponse({'error': 'Falta el ID de asignación'}, status=400)
        if not numeros_nuevos:
            return JsonResponse({'error': 'Debes ingresar al menos un número o rango'}, status=400)

        asignacion = AsignacionRifa.objects.select_related('rifa', 'voluntario').get(id=asignacion_id)

        if asignacion.rifa.estado != 'activa':
            return JsonResponse({'error': 'La rifa ya está cerrada'}, status=400)

        # No se puede re-asignar si ya está pagada o liberada
        if asignacion.estado in ('pagada', 'liberada'):
            return JsonResponse({'error': 'No se puede modificar una asignación ya pagada o liberada'}, status=400)

        # ── Validar cada rango ─────────────────────────────────────────────
        for rango in numeros_nuevos:
            try:
                desde = int(rango['desde'])
                hasta = int(rango['hasta'])
            except (KeyError, ValueError, TypeError):
                return JsonResponse({'error': 'Rango inválido: los valores deben ser números enteros'}, status=400)
            if desde < 1:
                return JsonResponse({'error': f'Los números de rifa deben ser mayores a 0 (rango: {desde}–{hasta})'}, status=400)
            if desde > hasta:
                return JsonResponse({'error': f'Rango inválido: {desde} es mayor que {hasta}'}, status=400)

        # ── Validar solapamiento entre rangos ingresados ───────────────────
        rangos_ordenados = sorted(numeros_nuevos, key=lambda r: int(r['desde']))
        for i in range(len(rangos_ordenados) - 1):
            a, b = rangos_ordenados[i], rangos_ordenados[i + 1]
            if int(a['hasta']) >= int(b['desde']):
                return JsonResponse({'error': f'Los rangos {a["desde"]}–{a["hasta"]} y {b["desde"]}–{b["hasta"]} se solapan'}, status=400)

        # ── Validar total de números = talonarios × números/talonario ─────
        total_esperado = asignacion.talonarios_asignados * asignacion.rifa.numeros_por_talonario
        total_ingresado = _contar_numeros_rangos(numeros_nuevos)
        if total_ingresado != total_esperado:
            return JsonResponse({
                'error': f'La cantidad de números no coincide: se esperan {total_esperado} '
                         f'({asignacion.talonarios_asignados} talonarios × {asignacion.rifa.numeros_por_talonario} números), '
                         f'pero se ingresaron {total_ingresado}'
            }, status=400)

        # ── Solapamiento con otros voluntarios ─────────────────────────────
        otras_asigs = AsignacionRifa.objects.filter(rifa=asignacion.rifa).exclude(id=asignacion_id)
        numeros_usados = set()
        for otra in otras_asigs:
            for rango in json.loads(otra.numeros or '[]'):
                for n in range(int(rango['desde']), int(rango['hasta']) + 1):
                    numeros_usados.add(n)

        for rango in numeros_nuevos:
            for n in range(int(rango['desde']), int(rango['hasta']) + 1):
                if n in numeros_usados:
                    return JsonResponse({'error': f'El número {n} ya está asignado a otro voluntario'}, status=400)

        with transaction.atomic():
            asignacion.numeros      = json.dumps(numeros_nuevos)
            asignacion.estado       = 'retirada'
            asignacion.fecha_retiro = timezone.now()
            asignacion.save()

        return JsonResponse({
            'mensaje':      'Números asignados correctamente',
            'asignacion_id': asignacion.id,
            'estado':        asignacion.estado,
            'numeros':       numeros_nuevos,
        })

    except AsignacionRifa.DoesNotExist:
        return JsonResponse({'error': 'Asignación no encontrada'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def pagar_rifa_simple(request):
    """POST /api/voluntarios/pagar-rifa-simple/"""
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        data           = json.loads(request.body)
        asignacion_id  = data.get('asignacion_id')
        metodo_pago    = str(data.get('metodo_pago', 'efectivo')).strip()
        cuenta_bancaria_id = data.get('cuenta_bancaria_id')
        numero_comprobante = str(data.get('numero_comprobante', '')).strip()
        comprobante_base64 = data.get('comprobante_base64')
        observaciones  = str(data.get('observaciones', '')).strip()
        es_extra       = bool(data.get('es_extra', False))

        # ── Validaciones básicas ───────────────────────────────────────────
        if not asignacion_id:
            return JsonResponse({'error': 'Falta el ID de asignación'}, status=400)

        try:
            monto = Decimal(str(data.get('monto', 0)))
        except (ValueError, InvalidOperation):
            return JsonResponse({'error': 'Monto inválido'}, status=400)

        if monto <= 0:
            return JsonResponse({'error': 'El monto debe ser mayor a 0'}, status=400)

        if metodo_pago not in ('efectivo', 'transferencia'):
            return JsonResponse({'error': 'Método de pago inválido. Use "efectivo" o "transferencia"'}, status=400)

        if metodo_pago == 'transferencia' and not cuenta_bancaria_id:
            return JsonResponse({'error': 'Debe seleccionar una cuenta bancaria para transferencia'}, status=400)

        # ── Asignación ─────────────────────────────────────────────────────
        asignacion = AsignacionRifa.objects.select_related('rifa', 'voluntario').get(id=asignacion_id)

        if asignacion.rifa.estado != 'activa':
            return JsonResponse({'error': 'La rifa ya está cerrada'}, status=400)

        if asignacion.estado == 'no_retirada':
            return JsonResponse({'error': 'No se puede registrar un pago hasta que el voluntario retire sus talonarios'}, status=400)

        if asignacion.estado == 'liberada':
            return JsonResponse({'error': 'Esta asignación ya fue liberada'}, status=400)

        # Solo un pago regular por asignación
        if not es_extra and asignacion.pagos.exists():
            return JsonResponse({'error': 'Esta asignación ya tiene un pago registrado. Use "Pago Extra" para registrar pagos adicionales'}, status=400)

        # ── Fecha ──────────────────────────────────────────────────────────
        fecha_pago_str = data.get('fecha_pago')
        try:
            fecha_pago = date.fromisoformat(fecha_pago_str) if fecha_pago_str else timezone.now().date()
        except ValueError:
            return JsonResponse({'error': 'Fecha de pago inválida'}, status=400)

        # ── Cuenta bancaria ────────────────────────────────────────────────
        cuenta = None
        if metodo_pago == 'transferencia':
            try:
                cuenta = CuentaBancaria.objects.get(id=cuenta_bancaria_id, activa=True)
            except CuentaBancaria.DoesNotExist:
                return JsonResponse({'error': 'Cuenta bancaria no encontrada o inactiva'}, status=404)

        # ── Observaciones con comprobante ──────────────────────────────────
        obs_final = observaciones
        if numero_comprobante and metodo_pago == 'transferencia':
            obs_final = f"Comprobante: {numero_comprobante}" + (f" — {observaciones}" if observaciones else "")
        if es_extra:
            obs_final = ("[EXTRA] " + obs_final).strip()

        with transaction.atomic():
            pago = PagoRifa.objects.create(
                asignacion=asignacion,
                monto=monto,
                fecha_pago=fecha_pago,
                metodo_pago=metodo_pago,
                cuenta_bancaria=cuenta,
                numero_comprobante=numero_comprobante,
                comprobante_base64=comprobante_base64,
                observaciones=obs_final,
            )

            # Registrar el ingreso SIEMPRE (efectivo -> caja virtual, transferencia -> cuenta)
            MovimientoFinanciero.objects.create(
                tipo='ingreso',
                categoria='rifa',
                descripcion=f"{'Pago extra' if es_extra else 'Pago'} rifa {asignacion.rifa.nombre} — {asignacion.voluntario}",
                monto=monto,
                fecha=fecha_pago,
                cuenta_bancaria=cuenta,  # None cuando es efectivo
                pago_rifa=pago,
            )

            asignacion.monto_pagado += monto
            if not es_extra:
                asignacion.estado = 'pagada'
            elif asignacion.monto_pagado >= asignacion.monto_total:
                asignacion.estado = 'pagada'
            asignacion.save()

        try:
            from .utils_email import enviar_comprobante_rifa
            enviar_comprobante_rifa(pago, asignacion.voluntario, asignacion.rifa)
        except Exception:
            pass

        return JsonResponse({
            'mensaje':         'Pago registrado correctamente',
            'pago_id':         pago.id,
            'monto':           float(pago.monto),
            'monto_pagado':    float(asignacion.monto_pagado),
            'monto_pendiente': float(asignacion.monto_pendiente),
            'estado':          asignacion.estado,
        }, status=201)

    except AsignacionRifa.DoesNotExist:
        return JsonResponse({'error': 'Asignación no encontrada'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def liberar_rifa_simple(request):
    """POST /api/voluntarios/liberar-rifa-simple/"""
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        data = json.loads(request.body)
        asignacion_id     = data.get('asignacion_id')
        motivo            = str(data.get('motivo', '')).strip()
        autorizado_por    = str(data.get('autorizado_por', '')).strip()

        if not asignacion_id:
            return JsonResponse({'error': 'Falta el ID de asignación'}, status=400)

        try:
            cantidad_talonarios = int(data.get('cantidad_talonarios', 0))
        except (ValueError, TypeError):
            return JsonResponse({'error': 'La cantidad de talonarios debe ser un número entero'}, status=400)

        if cantidad_talonarios < 1:
            return JsonResponse({'error': 'La cantidad de talonarios a liberar debe ser al menos 1'}, status=400)

        if not motivo:
            return JsonResponse({'error': 'El motivo es obligatorio'}, status=400)

        asignacion = AsignacionRifa.objects.select_related('rifa').get(id=asignacion_id)

        if asignacion.rifa.estado != 'activa':
            return JsonResponse({'error': 'La rifa ya está cerrada'}, status=400)

        if asignacion.estado == 'liberada':
            return JsonResponse({'error': 'Esta asignación ya fue liberada previamente'}, status=400)

        if cantidad_talonarios > asignacion.talonarios_asignados:
            return JsonResponse({
                'error': f'No se pueden liberar {cantidad_talonarios} talonarios: '
                         f'solo tiene {asignacion.talonarios_asignados} asignados'
            }, status=400)

        with transaction.atomic():
            precio_talonario = asignacion.rifa.precio_numero * asignacion.rifa.numeros_por_talonario
            monto_liberado   = Decimal(cantidad_talonarios) * precio_talonario

            asignacion.monto_total = max(Decimal('0'), asignacion.monto_total - monto_liberado)
            asignacion.estado = 'liberada'

            historial = json.loads(asignacion.historial_liberaciones or '[]')
            historial.append({
                'fecha':               timezone.now().isoformat(),
                'cantidad_talonarios': cantidad_talonarios,
                'monto_liberado':      float(monto_liberado),
                'motivo':              motivo,
                'autorizado_por':      autorizado_por,
            })
            asignacion.historial_liberaciones = json.dumps(historial)
            asignacion.save()

        return JsonResponse({
            'mensaje':           'Talonarios liberados correctamente',
            'cantidad_liberada': cantidad_talonarios,
            'monto_liberado':    float(monto_liberado),
            'estado':            asignacion.estado,
        })

    except AsignacionRifa.DoesNotExist:
        return JsonResponse({'error': 'Asignación no encontrada'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def cerrar_rifa_simple(request, rifa_id):
    """
    POST /api/voluntarios/cerrar-rifa-simple/<id>/
    Valida que todas las asignaciones sean pagada o liberada,
    genera egresos automáticos por cuenta bancaria y cierra la rifa.
    """
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        rifa = Rifa.objects.get(id=rifa_id)

        if rifa.estado == 'cerrada':
            return JsonResponse({'error': 'La rifa ya está cerrada'}, status=400)

        pendientes = rifa.asignaciones.filter(estado__in=['no_retirada', 'retirada'])
        if pendientes.exists():
            return JsonResponse({
                'error': f'Hay {pendientes.count()} asignación(es) pendiente(s) de pago o entrega'
            }, status=400)

        with transaction.atomic():
            cuentas_con_rifa = PagoRifa.objects.filter(
                asignacion__rifa=rifa,
                metodo_pago='transferencia',
                cuenta_bancaria__isnull=False,
            ).values('cuenta_bancaria').distinct()

            egresos_creados = []
            for item in cuentas_con_rifa:
                cuenta = CuentaBancaria.objects.get(id=item['cuenta_bancaria'])
                total_rifa = PagoRifa.objects.filter(
                    asignacion__rifa=rifa,
                    metodo_pago='transferencia',
                    cuenta_bancaria=cuenta,
                ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

                if total_rifa > 0:
                    MovimientoFinanciero.objects.create(
                        tipo='egreso',
                        categoria='rifa_retiro',
                        descripcion=f"Retiro fondos rifa {rifa.nombre}",
                        monto=total_rifa,
                        fecha=timezone.now().date(),
                        cuenta_bancaria=cuenta,
                    )
                    egresos_creados.append({'cuenta': cuenta.nombre, 'monto': float(total_rifa)})

            rifa.estado = 'cerrada'
            rifa.save()

        return JsonResponse({
            'mensaje':           f'Rifa "{rifa.nombre}" cerrada correctamente',
            'egresos_generados': egresos_creados,
        })

    except Rifa.DoesNotExist:
        return JsonResponse({'error': 'Rifa no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def rifa_activa_voluntario(request, voluntario_id):
    """GET /api/voluntarios/<vol_id>/rifa-activa-simple/"""
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        voluntario = Voluntario.objects.get(id=voluntario_id)
        asignacion = AsignacionRifa.objects.filter(
            voluntario=voluntario,
            rifa__estado='activa',
        ).select_related('rifa').first()

        if not asignacion:
            return JsonResponse({'tiene_rifa': False})

        d = _asignacion_to_dict(asignacion, include_pagos=True)
        d['tiene_rifa'] = True
        d['rifa'] = _rifa_to_dict(asignacion.rifa, include_stats=False)
        return JsonResponse(d)

    except Voluntario.DoesNotExist:
        return JsonResponse({'error': 'Voluntario no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def fondos_rifas_simple(request):
    """GET /api/voluntarios/fondos-rifas-simple/"""
    auth_response = _autorizar_rifas(request)
    if auth_response:
        return auth_response

    try:
        rifas_activas = Rifa.objects.filter(estado='activa')
        result = []
        for rifa in rifas_activas:
            efectivo = PagoRifa.objects.filter(
                asignacion__rifa=rifa, metodo_pago='efectivo'
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
            transferencia = PagoRifa.objects.filter(
                asignacion__rifa=rifa, metodo_pago='transferencia'
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
            result.append({
                'rifa_id':                rifa.id,
                'nombre':                 rifa.nombre,
                'ciclo':                  rifa.ciclo,
                'recaudado_efectivo':     float(efectivo),
                'recaudado_transferencia': float(transferencia),
                'total':                  float(efectivo + transferencia),
            })
        return JsonResponse(result, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
