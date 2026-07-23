"""
Vista SIMPLE sin DRF para pagos de cuotas
IMPORTANTE: Este endpoint NO requiere autenticación ni CSRF
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from decimal import Decimal
import json
from .models import PagoCuota, Voluntario, MovimientoFinanciero, CuentaBancaria
from .utils_email import enviar_comprobante_cuota
from .permissions import autorizar_request, obtener_accion_desde_request


def _autorizar_cuotas(request):
    accion = obtener_accion_desde_request(request)
    autorizado, response = autorizar_request(request, modulo='cuotas', accion=accion)
    return None if autorizado else response

# DESACTIVAR CSRF para desarrollo
@csrf_exempt
@require_http_methods(["GET", "POST"])
def pagos_cuotas_simple(request):
    """
    Endpoint SIMPLE para pagos de cuotas
    SIN autenticación requerida (desarrollo)
    """
    auth_response = _autorizar_cuotas(request)
    if auth_response:
        return auth_response

    if request.method == 'GET':
        # Obtener parámetros de filtro
        voluntario_id = request.GET.get('voluntario_id')
        anio = request.GET.get('anio')
        
        # Filtrar pagos
        pagos = PagoCuota.objects.all()
        if voluntario_id:
            pagos = pagos.filter(voluntario_id=voluntario_id)
        if anio:
            pagos = pagos.filter(anio=anio)
        
        # Convertir a lista de diccionarios
        data = []
        for pago in pagos:
            data.append({
                'id': pago.id,
                'voluntario': pago.voluntario_id,
                'mes': pago.mes,
                'anio': pago.anio,
                'monto': float(pago.monto_pagado),
                'fecha_pago': str(pago.fecha_pago),
                'metodo_pago': pago.metodo_pago,
                'forma_pago': pago.metodo_pago,
                'numero_comprobante': pago.numero_comprobante or '',
                'observaciones': pago.observaciones or '',
                'tiene_comprobante': bool(pago.comprobante_base64) or pago.solicitudes_portal.filter(comprobante__isnull=False).exists(),
                'comprobante_base64': pago.comprobante_base64 or None,
                'comprobante_url': (pago.solicitudes_portal.filter(comprobante__isnull=False).order_by('-created_at').first().comprobante.url
                                    if pago.solicitudes_portal.filter(comprobante__isnull=False).exists() else None)
            })
        
        return JsonResponse({'results': data}, safe=False)
    
    elif request.method == 'POST':
        try:
            # Leer datos del request
            data = json.loads(request.body)
            
            # Obtener voluntario
            voluntario = Voluntario.objects.get(id=data['voluntario_id'])
            
            # Resolver cuenta bancaria
            metodo_pago = data.get('metodo_pago', 'Efectivo')
            cuenta_bancaria_id = data.get('cuenta_bancaria_id')
            cuenta_bancaria = None
            if cuenta_bancaria_id:
                try:
                    cuenta_bancaria = CuentaBancaria.objects.get(id=cuenta_bancaria_id)
                except CuentaBancaria.DoesNotExist:
                    return JsonResponse({'error': 'Cuenta bancaria no encontrada'}, status=404)

            # Usar transacción atómica para crear pago + movimiento
            with transaction.atomic():
                # Crear el pago
                pago = PagoCuota.objects.create(
                    voluntario=voluntario,
                    mes=data['mes'],
                    anio=data['anio'],
                    monto_pagado=data['monto'],
                    fecha_pago=data['fecha_pago'],
                    metodo_pago=metodo_pago,
                    numero_comprobante=data.get('numero_comprobante', '') or '',
                    comprobante_base64=data.get('comprobante_base64') or None,
                    observaciones=data.get('observaciones', ''),
                    cuenta_bancaria=cuenta_bancaria,
                    created_by=None  # Sin usuario por ahora
                )

                # Crear MovimientoFinanciero (INGRESO)
                MovimientoFinanciero.objects.create(
                    tipo='ingreso',
                    categoria='cuota',
                    monto=Decimal(str(data['monto'])),
                    fecha=data['fecha_pago'],
                    descripcion=f"Cuota social {data['mes']}/{data['anio']} - {voluntario.nombre} {voluntario.apellido_paterno}",
                    pago_cuota=pago,
                    metodo_pago='transferencia' if cuenta_bancaria else 'efectivo',
                    cuenta_bancaria=cuenta_bancaria,
                )
            
            # Enviar comprobante por email automáticamente
            email_enviado = False
            print('[EMAIL] Verificando envío de comprobante...')
            print(f'[EMAIL] Voluntario: {voluntario.nombre} {voluntario.apellido_paterno}')
            print(f'[EMAIL] Email del voluntario: {voluntario.email}')
            
            if voluntario.email:
                try:
                    print(f'[EMAIL] Intentando enviar a: {voluntario.email}')
                    email_enviado = enviar_comprobante_cuota(pago, voluntario)
                    if email_enviado:
                        print(f'[EMAIL] OK Comprobante enviado exitosamente a {voluntario.email}')
                    else:
                        print('[EMAIL] FALLO No se pudo enviar el comprobante')
                except Exception as e:
                    print(f'[EMAIL] ERROR al enviar email: {str(e)}')
                    import traceback
                    traceback.print_exc()
            else:
                print('[EMAIL] AVISO El voluntario NO tiene email configurado')
            
            # Retornar el pago creado
            return JsonResponse({
                'id': pago.id,
                'voluntario': pago.voluntario_id,
                'mes': pago.mes,
                'anio': pago.anio,
                'monto': float(pago.monto_pagado),
                'fecha_pago': str(pago.fecha_pago),
                'metodo_pago': pago.metodo_pago,
                'observaciones': pago.observaciones or '',
                'movimiento_creado': True,
                'comprobante_enviado': email_enviado
            }, status=201)
            
        except Voluntario.DoesNotExist:
            return JsonResponse({'error': 'Voluntario no encontrado'}, status=404)
        except KeyError as e:
            return JsonResponse({'error': f'Falta el campo: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
