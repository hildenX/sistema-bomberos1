"""
Views SIMPLES para finanzas - Sin complicaciones
"""
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
import json
from decimal import Decimal
from datetime import datetime
from .models import MovimientoFinanciero
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

@csrf_exempt
@require_http_methods(["GET", "POST"])
def movimientos_api(request):
    """Endpoint SIMPLE para movimientos financieros - SIN autenticaciÃ³n por ahora"""
    auth_response = _autorizar_finanzas(request, solo_lectura=request.method == 'GET')
    if auth_response:
        return auth_response

    if request.method == 'GET':
        # Listar movimientos
        movimientos = MovimientoFinanciero.objects.all().order_by('-fecha', '-created_at')[:100]
        
        data = []
        for m in movimientos:
            data.append({
                'id': m.id,
                'tipo': m.tipo,
                'categoria': m.categoria,
                'monto': float(m.monto),
                'descripcion': m.descripcion or '',
                'fecha': m.fecha.strftime('%Y-%m-%d'),
                'numero_comprobante': m.numero_comprobante or '',
                'created_at': m.created_at.isoformat(),
                'created_by_nombre': m.created_by.username if m.created_by else 'Sistema'
            })
        
        return JsonResponse({'results': data, 'count': len(data)})
    
    elif request.method == 'POST':
        # Crear movimiento
        try:
            body = json.loads(request.body)
            
            # Validar datos requeridos
            tipo = body.get('tipo')
            categoria = body.get('categoria')
            monto = body.get('monto')
            
            if not tipo or not categoria or not monto:
                return JsonResponse({'error': 'Faltan datos requeridos'}, status=400)
            
            # Crear movimiento
            movimiento = MovimientoFinanciero.objects.create(
                tipo=tipo,
                categoria=categoria,
                monto=Decimal(str(monto)),
                descripcion=body.get('descripcion', ''),
                fecha=body.get('fecha') or datetime.now().date(),
                numero_comprobante=body.get('numero_comprobante', ''),
                created_by=request.user if request.user.is_authenticated else None
            )
            
            return JsonResponse({
                'id': movimiento.id,
                'tipo': movimiento.tipo,
                'categoria': movimiento.categoria,
                'monto': float(movimiento.monto),
                'mensaje': 'Movimiento creado exitosamente'
            }, status=201)
            
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

@require_http_methods(["GET"])
def saldo_api(request):
    """Endpoint SIMPLE para calcular saldo"""
    auth_response = _autorizar_finanzas(request, solo_lectura=True)
    if auth_response:
        return auth_response

    try:
        movimientos = MovimientoFinanciero.objects.all()
        
        ingresos = sum(float(m.monto) for m in movimientos if m.tipo == 'ingreso')
        egresos = sum(float(m.monto) for m in movimientos if m.tipo == 'egreso')
        saldo = ingresos - egresos
        
        return JsonResponse({
            'saldo': saldo,
            'ingresos': ingresos,
            'egresos': egresos,
            'total_movimientos': movimientos.count()
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


