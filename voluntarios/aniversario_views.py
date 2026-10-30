"""
Cuota de aniversario: monto único al año fijado en asamblea.
Tesorería crea la cuota, registra pagos completos y descarga la nómina de deudores.
"""
import json
import threading
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods

from .models import CuentaBancaria, CuotaAniversario, LogoCompania, Voluntario
from .pdf_nominas import _orden_antiguedad, generar_pdf_nomina_deudores_aniversario
from .permissions import autorizar_request, obtener_accion_desde_request
from .utils_email import enviar_comprobante_aniversario
from .utils_tesoreria import (anular_pago_aniversario, calcular_deudores_aniversario,
                              puede_pagar_cuotas, registrar_pago_aniversario)


def _autorizar(request, accion=None):
    autorizado, respuesta = autorizar_request(request, modulo='cuotas',
                                              accion=accion or obtener_accion_desde_request(request))
    return None if autorizado else respuesta


def _cuota_dict(cuota):
    pagos = list(cuota.pagos.all())
    deudores = calcular_deudores_aniversario(cuota)
    return {
        'id': cuota.id,
        'anio': cuota.anio,
        'monto': float(cuota.monto),
        'fecha_asamblea': cuota.fecha_asamblea.isoformat() if cuota.fecha_asamblea else None,
        'acta': cuota.acta,
        'observaciones': cuota.observaciones,
        'pagados': len(pagos),
        'deudores': len(deudores),
        'recaudado': float(sum((p.monto_pagado for p in pagos), Decimal('0'))),
        'pendiente': float(sum((d['monto'] for d in deudores), Decimal('0'))),
    }


@require_http_methods(["GET", "POST"])
def cuotas_aniversario(request):
    """
    GET  /api/voluntarios/cuotas-aniversario/  -> cuotas creadas con su avance
    POST /api/voluntarios/cuotas-aniversario/  -> crea o edita la cuota de un año
    """
    error = _autorizar(request)
    if error:
        return error

    if request.method == 'GET':
        return JsonResponse({'cuotas': [_cuota_dict(c) for c in CuotaAniversario.objects.all()]})

    try:
        data = json.loads(request.body or '{}')
        anio = int(data.get('anio'))
        monto = Decimal(str(data.get('monto')))
    except (TypeError, ValueError, InvalidOperation, json.JSONDecodeError):
        return JsonResponse({'error': 'Indica el año y un monto válido'}, status=400)
    if monto <= 0:
        return JsonResponse({'error': 'El monto debe ser mayor a cero'}, status=400)

    fecha_asamblea = None
    if data.get('fecha_asamblea'):
        try:
            fecha_asamblea = date.fromisoformat(data['fecha_asamblea'])
        except ValueError:
            return JsonResponse({'error': 'Fecha de asamblea inválida'}, status=400)

    cuota = CuotaAniversario.objects.filter(anio=anio).first()
    if cuota and cuota.monto != monto and cuota.pagos.exists():
        return JsonResponse({'error': 'No se puede cambiar el monto: ya hay voluntarios que pagaron esta cuota'}, status=400)
    if not cuota:
        cuota = CuotaAniversario(anio=anio, created_by=request.user)
    cuota.monto = monto
    cuota.fecha_asamblea = fecha_asamblea
    cuota.acta = str(data.get('acta') or '').strip()[:120]
    cuota.observaciones = str(data.get('observaciones') or '').strip()
    cuota.save()
    return JsonResponse({'cuota': _cuota_dict(cuota)}, status=201)


@require_http_methods(["GET"])
def estado_cuota_aniversario(request, cuota_id):
    """Voluntarios que deben pagar la cuota, con su estado (del más antiguo al más nuevo)."""
    error = _autorizar(request, 'view')
    if error:
        return error
    try:
        cuota = CuotaAniversario.objects.get(id=cuota_id)
    except CuotaAniversario.DoesNotExist:
        return JsonResponse({'error': 'Cuota no encontrada'}, status=404)

    pagos = {p.voluntario_id: p for p in cuota.pagos.select_related('created_by', 'cuenta_bancaria')}
    filas = []
    voluntarios = Voluntario.objects.filter(estado_bombero='activo')
    for v in sorted(voluntarios, key=_orden_antiguedad):
        pago = pagos.get(v.id)
        if not pago and not puede_pagar_cuotas(v)['puede']:
            continue  # exentos que no pagaron no deben la cuota
        filas.append({
            'voluntario_id': v.id,
            'clave': v.clave_bombero or '',
            'nombre': v.nombre_completo(),
            'pagado': bool(pago),
            'pago': {
                'id': pago.id,
                'fecha_pago': pago.fecha_pago.isoformat(),
                'monto': float(pago.monto_pagado),
                'metodo_pago': pago.metodo_pago or '',
                'cuenta': pago.cuenta_bancaria.nombre if pago.cuenta_bancaria else '',
                'numero_comprobante': pago.numero_comprobante or '',
                'registrado_por': pago.created_by.username if pago.created_by else '',
            } if pago else None,
        })
    return JsonResponse({'cuota': _cuota_dict(cuota), 'voluntarios': filas})


@require_http_methods(["POST"])
def registrar_pago_cuota_aniversario(request, cuota_id):
    error = _autorizar(request, 'create')
    if error:
        return error
    try:
        data = json.loads(request.body or '{}')
        cuenta = None
        if data.get('cuenta_bancaria_id'):
            cuenta = CuentaBancaria.objects.get(id=int(data['cuenta_bancaria_id']))
        if data.get('metodo_pago') == 'Transferencia' and not cuenta:
            return JsonResponse({'error': 'Selecciona la cuenta bancaria de destino'}, status=400)
        pago = registrar_pago_aniversario(cuota_id, int(data.get('voluntario_id')), {
            'fecha_pago': date.fromisoformat(data['fecha_pago']) if data.get('fecha_pago') else None,
            'metodo_pago': data.get('metodo_pago') or 'Efectivo',
            'numero_comprobante': str(data.get('numero_comprobante') or '').strip(),
            'observaciones': str(data.get('observaciones') or '').strip(),
            'cuenta_bancaria': cuenta,
        }, request.user)
    except (CuotaAniversario.DoesNotExist, Voluntario.DoesNotExist, CuentaBancaria.DoesNotExist):
        return JsonResponse({'error': 'Cuota, voluntario o cuenta no encontrados'}, status=404)
    except (ValueError, TypeError, json.JSONDecodeError) as e:
        return JsonResponse({'error': str(e) or 'Datos inválidos'}, status=400)
    except IntegrityError:
        return JsonResponse({'error': 'Este voluntario ya pagó la cuota de aniversario'}, status=400)
    if pago.voluntario.email:
        threading.Thread(target=enviar_comprobante_aniversario, args=(pago, pago.voluntario), daemon=True).start()
    return JsonResponse({'id': pago.id, 'comprobante_enviado': bool(pago.voluntario.email)}, status=201)


@require_http_methods(["DELETE"])
def anular_pago_cuota_aniversario(request, pago_id):
    error = _autorizar(request, 'delete')
    if error:
        return error
    try:
        anular_pago_aniversario(pago_id)
    except Exception:
        return JsonResponse({'error': 'Pago no encontrado'}, status=404)
    return JsonResponse({'ok': True})


@require_http_methods(["GET"])
def pdf_deudores_aniversario(request, cuota_id):
    error = _autorizar(request, 'view')
    if error:
        return error
    try:
        cuota = CuotaAniversario.objects.get(id=cuota_id)
    except CuotaAniversario.DoesNotExist:
        return HttpResponse('Cuota no encontrada', status=404)
    logo = LogoCompania.objects.filter(usar_en_pdfs=True).first()
    pdf = generar_pdf_nomina_deudores_aniversario(cuota, calcular_deudores_aniversario(cuota),
                                                 logo_base64=logo.imagen if logo else None)
    response = HttpResponse(pdf.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="deudores_aniversario_{cuota.anio}.pdf"'
    return response
