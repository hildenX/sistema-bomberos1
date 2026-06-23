"""
Vistas SIMPLE sin DRF para Cuentas Bancarias y Caja de la Compañía.
IMPORTANTE: Este endpoint NO requiere autenticación ni CSRF.
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Sum, Q
from django.utils import timezone
import json
from decimal import Decimal
from .models import CuentaBancaria, DepositoCaja, PagoCuota, PagoBeneficio, MovimientoFinanciero
from .permissions import autorizar_request, RolBomberos


ROLES_FINANZAS_VIEW = (
    RolBomberos.TESORERO,
    RolBomberos.DIRECTOR,
    RolBomberos.SUPER_ADMIN,
)
ROLES_FINANZAS_EDIT = (
    RolBomberos.TESORERO,
    RolBomberos.SUPER_ADMIN,
)


def _autorizar_finanzas(request, solo_lectura=False):
    roles = ROLES_FINANZAS_VIEW if solo_lectura else ROLES_FINANZAS_EDIT
    autorizado, response = autorizar_request(request, roles=roles)
    return None if autorizado else response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _saldo_cuenta(cuenta_id):
    """
    Saldo de una CuentaBancaria usando MovimientoFinanciero como fuente única.
    Cada pago (cuota/beneficio) ya crea un MovimientoFinanciero en la misma
    transacción, así que no hay doble conteo.
    """
    ingresos = MovimientoFinanciero.objects.filter(
        cuenta_bancaria_id=cuenta_id, tipo='ingreso'
    ).aggregate(s=Sum('monto'))['s'] or Decimal('0')

    egresos = MovimientoFinanciero.objects.filter(
        cuenta_bancaria_id=cuenta_id, tipo='egreso'
    ).aggregate(s=Sum('monto'))['s'] or Decimal('0')

    # Los depósitos desde Caja también suman al saldo de la cuenta
    depositos = DepositoCaja.objects.filter(
        cuenta_destino_id=cuenta_id
    ).aggregate(s=Sum('monto'))['s'] or Decimal('0')

    return float(ingresos - egresos + depositos)


def _saldo_caja():
    """
    Saldo de Caja usando MovimientoFinanciero como fuente única.
    cuenta_bancaria IS NULL = efectivo/caja.
    Los depósitos reducen la caja (traslado a banco).
    """
    ingresos = MovimientoFinanciero.objects.filter(
        cuenta_bancaria__isnull=True, tipo='ingreso'
    ).aggregate(s=Sum('monto'))['s'] or Decimal('0')

    egresos = MovimientoFinanciero.objects.filter(
        cuenta_bancaria__isnull=True, tipo='egreso'
    ).aggregate(s=Sum('monto'))['s'] or Decimal('0')

    depositos = DepositoCaja.objects.aggregate(
        s=Sum('monto')
    )['s'] or Decimal('0')

    return float(ingresos - egresos - depositos)


def _cuenta_to_dict(cuenta):
    saldo = _saldo_cuenta(cuenta.id)
    return {
        'id': cuenta.id,
        'nombre': cuenta.nombre,
        'rut_titular': cuenta.rut_titular or '',
        'banco': cuenta.banco,
        'numero_cuenta': cuenta.numero_cuenta,
        'tipo_cuenta': cuenta.tipo_cuenta,
        'activa': cuenta.activa,
        'saldo': saldo,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def cuentas_bancarias_simple(request):
    """
    GET: Lista cuentas bancarias activas con saldo calculado.
    POST: Crea una nueva CuentaBancaria.
    """
    auth_response = _autorizar_finanzas(request, solo_lectura=request.method == 'GET')
    if auth_response:
        return auth_response

    if request.method == 'GET':
        solo_activas = request.GET.get('activas', '1') == '1'
        qs = CuentaBancaria.objects.all()
        if solo_activas:
            qs = qs.filter(activa=True)
        return JsonResponse([_cuenta_to_dict(c) for c in qs], safe=False)

    # POST — crear nueva cuenta
    try:
        body = json.loads(request.body)
        nombre = body.get('nombre', '').strip()
        banco = body.get('banco', '').strip()
        numero_cuenta = body.get('numero_cuenta', '').strip()
        rut_titular = body.get('rut_titular', '').strip()

        if not nombre or not banco:
            return JsonResponse({'error': 'Titular y banco son requeridos'}, status=400)

        if not numero_cuenta:
            return JsonResponse({'error': 'El número de cuenta es requerido'}, status=400)

        # Verificar número de cuenta duplicado (obligatorio y único)
        if CuentaBancaria.objects.filter(numero_cuenta=numero_cuenta).exists():
            return JsonResponse(
                {'error': f'Ya existe una cuenta registrada con el número "{numero_cuenta}". Verifica el número.'},
                status=400
            )

        cuenta = CuentaBancaria.objects.create(
            nombre=nombre,
            rut_titular=rut_titular,
            banco=banco,
            numero_cuenta=numero_cuenta,
            tipo_cuenta=body.get('tipo_cuenta', 'corriente'),
        )
        return JsonResponse(_cuenta_to_dict(cuenta), status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def desactivar_cuenta_bancaria(request, cuenta_id):
    """Desactiva (no elimina) una cuenta bancaria."""
    auth_response = _autorizar_finanzas(request)
    if auth_response:
        return auth_response

    try:
        cuenta = CuentaBancaria.objects.get(id=cuenta_id)
        cuenta.activa = False
        cuenta.save()
        return JsonResponse({'ok': True, 'mensaje': f'Cuenta "{cuenta.nombre}" desactivada'})
    except CuentaBancaria.DoesNotExist:
        return JsonResponse({'error': 'Cuenta no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reactivar_cuenta_bancaria(request, cuenta_id):
    """Reactiva una cuenta bancaria desactivada."""
    auth_response = _autorizar_finanzas(request)
    if auth_response:
        return auth_response

    try:
        cuenta = CuentaBancaria.objects.get(id=cuenta_id)
        cuenta.activa = True
        cuenta.save()
        return JsonResponse({'ok': True, 'mensaje': f'Cuenta "{cuenta.nombre}" reactivada'})
    except CuentaBancaria.DoesNotExist:
        return JsonResponse({'error': 'Cuenta no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def eliminar_cuenta_bancaria(request, cuenta_id):
    """
    Elimina permanentemente una cuenta bancaria SOLO si no tiene movimientos asociados.
    """
    auth_response = _autorizar_finanzas(request)
    if auth_response:
        return auth_response

    try:
        from .models import MovimientoFinanciero, PagoCuota, PagoBeneficio
        cuenta = CuentaBancaria.objects.get(id=cuenta_id)

        # Verificar que no tenga movimientos
        tiene_movimientos = (
            MovimientoFinanciero.objects.filter(cuenta_bancaria=cuenta).exists() or
            PagoCuota.objects.filter(cuenta_bancaria=cuenta).exists() or
            PagoBeneficio.objects.filter(cuenta_bancaria=cuenta).exists() or
            DepositoCaja.objects.filter(cuenta_destino=cuenta).exists()
        )
        if tiene_movimientos:
            return JsonResponse(
                {'error': 'No se puede eliminar: la cuenta tiene movimientos registrados. Puedes desactivarla.'},
                status=400
            )

        nombre = cuenta.nombre
        cuenta.delete()
        return JsonResponse({'ok': True, 'mensaje': f'Cuenta "{nombre}" eliminada permanentemente'})
    except CuentaBancaria.DoesNotExist:
        return JsonResponse({'error': 'Cuenta no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def caja_simple(request):
    """
    Retorna saldo de Caja + resumen de movimientos en efectivo.
    """
    auth_response = _autorizar_finanzas(request, solo_lectura=True)
    if auth_response:
        return auth_response

    try:
        saldo = _saldo_caja()

        # Últimos ingresos a caja (cuotas + beneficios efectivo)
        cuotas = list(
            PagoCuota.objects.filter(cuenta_bancaria__isnull=True)
            .order_by('-fecha_pago')[:50]
            .values('fecha_pago', 'monto_pagado', 'voluntario__nombre', 'voluntario__apellido_paterno')
        )
        benef = list(
            PagoBeneficio.objects.filter(cuenta_bancaria__isnull=True)
            .order_by('-fecha_pago')[:50]
            .values('fecha_pago', 'monto',
                    'asignacion__voluntario__nombre', 'asignacion__voluntario__apellido_paterno',
                    'asignacion__beneficio__nombre')
        )
        depositos = list(
            DepositoCaja.objects.all().order_by('-fecha', '-created_at')[:20]
            .values('fecha', 'monto', 'numero_comprobante', 'observaciones',
                    'cuenta_destino__nombre', 'cuenta_destino__banco')
        )

        return JsonResponse({
            'saldo_caja': saldo,
            'ultimas_cuotas_efectivo': [
                {
                    'fecha': str(c['fecha_pago']),
                    'monto': float(c['monto_pagado']),
                    'voluntario': f"{c['voluntario__nombre']} {c['voluntario__apellido_paterno']}",
                    'tipo': 'cuota',
                }
                for c in cuotas
            ],
            'ultimos_beneficios_efectivo': [
                {
                    'fecha': str(b['fecha_pago']),
                    'monto': float(b['monto']),
                    'voluntario': f"{b['asignacion__voluntario__nombre']} {b['asignacion__voluntario__apellido_paterno']}",
                    'beneficio': b['asignacion__beneficio__nombre'],
                    'tipo': 'beneficio',
                }
                for b in benef
            ],
            'depositos': [
                {
                    'fecha': str(d['fecha']),
                    'monto': float(d['monto']),
                    'numero_comprobante': d['numero_comprobante'],
                    'observaciones': d['observaciones'] or '',
                    'cuenta': f"{d['cuenta_destino__nombre']} ({d['cuenta_destino__banco']})",
                }
                for d in depositos
            ],
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def depositos_caja_simple(request):
    """
    GET: Lista depósitos (traslados de Caja a Banco).
    POST: Registra un nuevo depósito.
    """
    auth_response = _autorizar_finanzas(request, solo_lectura=request.method == 'GET')
    if auth_response:
        return auth_response

    if request.method == 'GET':
        cuenta_id = request.GET.get('cuenta')
        qs = DepositoCaja.objects.select_related('cuenta_destino').order_by('-fecha', '-created_at')
        if cuenta_id:
            qs = qs.filter(cuenta_destino_id=cuenta_id)

        data = []
        for d in qs[:100]:
            data.append({
                'id': d.id,
                'fecha': str(d.fecha),
                'hora': str(d.hora) if d.hora else None,
                'monto': float(d.monto),
                'numero_comprobante': d.numero_comprobante,
                'tiene_comprobante': bool(d.comprobante_base64),
                'comprobante_base64': d.comprobante_base64,
                'observaciones': d.observaciones or '',
                'cuenta_destino': {
                    'id': d.cuenta_destino.id,
                    'nombre': d.cuenta_destino.nombre,
                    'banco': d.cuenta_destino.banco,
                },
            })
        return JsonResponse(data, safe=False)

    # POST — registrar depósito
    try:
        body = json.loads(request.body)
        cuenta_id = body.get('cuenta_destino_id')
        monto = body.get('monto')

        if not cuenta_id:
            return JsonResponse({'error': 'cuenta_destino_id es requerido'}, status=400)
        if not monto or float(monto) <= 0:
            return JsonResponse({'error': 'Monto debe ser mayor a 0'}, status=400)

        cuenta = CuentaBancaria.objects.get(id=cuenta_id)

        deposito = DepositoCaja.objects.create(
            cuenta_destino=cuenta,
            monto=Decimal(str(monto)),
            fecha=body.get('fecha', str(timezone.now().date())),
            hora=body.get('hora') or None,
            numero_comprobante=body.get('numero_comprobante', '').strip(),
            comprobante_base64=body.get('comprobante_base64') or None,
            observaciones=body.get('observaciones', '').strip() or None,
        )

        return JsonResponse({
            'id': deposito.id,
            'fecha': str(deposito.fecha),
            'hora': str(deposito.hora) if deposito.hora else None,
            'monto': float(deposito.monto),
            'numero_comprobante': deposito.numero_comprobante,
            'tiene_comprobante': bool(deposito.comprobante_base64),
            'comprobante_base64': deposito.comprobante_base64,
            'observaciones': deposito.observaciones or '',
            'cuenta_destino': {
                'id': cuenta.id,
                'nombre': cuenta.nombre,
                'banco': cuenta.banco,
            },
            'mensaje': f'Depósito de ${float(deposito.monto):,.0f} registrado en {cuenta.nombre}',
        }, status=201)

    except CuentaBancaria.DoesNotExist:
        return JsonResponse({'error': 'Cuenta bancaria no encontrada'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
