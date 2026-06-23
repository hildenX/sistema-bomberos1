"""
Utilidades y lógica de negocio para el módulo de Tesorería
Convierte la lógica JavaScript de P6P a Python/Django
"""

from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import datetime, date
from decimal import Decimal
import json

from .models import (
    Voluntario, ConfiguracionCuotas, EstadoCuotasBombero,
    PagoCuota, Beneficio, AsignacionBeneficio, PagoBeneficio,
    MovimientoFinanciero
)


# ==================== CATEGORÍAS DE VOLUNTARIOS ====================

def calcular_categoria_bombero(fecha_ingreso):
    """
    Calcula la categoría del bombero según su antigüedad
    Replica la lógica de Utils.calcularCategoriaBombero del P6P
    """
    if not fecha_ingreso:
        return 'Voluntario'
    
    hoy = date.today()
    anos_servicio = (hoy - fecha_ingreso).days / 365.25
    
    if anos_servicio >= 50:
        return 'Insigne de 50 Años'
    elif anos_servicio >= 25:
        return 'Insigne de 25 Años'
    elif anos_servicio >= 20:
        return 'Honorario del Cuerpo'
    elif anos_servicio >= 5:
        return 'Honorario de Compañía'
    else:
        return 'Voluntario'


def obtener_tarjetas_por_categoria(categoria):
    """
    Retorna la cantidad de tarjetas de beneficio según categoría
    """
    tarjetas_map = {
        'Voluntario': 5,
        'Honorario de Compañía': 3,
        'Honorario del Cuerpo': 3,
        'Insigne de 25 Años': 2,
        'Insigne de 50 Años': 2,
    }
    return tarjetas_map.get(categoria, 5)


# ==================== CUOTAS MENSUALES ====================

def puede_pagar_cuotas(voluntario):
    """
    Verifica si un voluntario puede pagar cuotas mensuales
    
    PRIORIDADES:
    1. cuotas_desactivadas=True → NO (exención explícita manual)
    2. Estado bloqueado (renunciado, separado, expulsado, fallecido, mártir) → NO
    3. Resto → SÍ (independiente de años de servicio o categoría)

    Returns:
        dict: {
            'puede': bool,
            'mensaje': str,
            'tipo': 'activo'|'desactivado'|'bloqueado'
        }
    """
    # 1. Verificar desactivación explícita
    try:
        estado = voluntario.estado_cuotas
        if estado.cuotas_desactivadas:
            return {
                'puede': False,
                'mensaje': f'Cuotas desactivadas: {estado.motivo_desactivacion or "Sin motivo"}',
                'tipo': 'desactivado'
            }
    except EstadoCuotasBombero.DoesNotExist:
        pass
    
    # 2. Estados bloqueados
    if voluntario.estado_bombero in ['renunciado', 'separado', 'expulsado', 'fallecido']:
        return {
            'puede': False,
            'mensaje': f'Estado {voluntario.estado_bombero}',
            'tipo': 'bloqueado'
        }
    
    # 3. Mártir bloqueado
    if voluntario.estado_bombero == 'martir':
        return {
            'puede': False,
            'mensaje': 'Estado mártir',
            'tipo': 'bloqueado'
        }

    return {'puede': True, 'mensaje': '', 'tipo': 'activo'}


def obtener_precio_cuota(voluntario):
    """
    Obtiene el precio de cuota que debe pagar el voluntario
    """
    config = ConfiguracionCuotas.objects.first()
    if not config:
        # Valores por defecto
        config = ConfiguracionCuotas.objects.create(
            precio_regular=Decimal('5000'),
            precio_estudiante=Decimal('3000')
        )
    
    # Verificar si es estudiante
    try:
        estado = voluntario.estado_cuotas
        if estado.es_estudiante:
            return config.precio_estudiante
    except EstadoCuotasBombero.DoesNotExist:
        pass
    
    return config.precio_regular


def calcular_deuda_cuotas(voluntario, anio=None):
    """
    Calcula la deuda de cuotas de un voluntario
    
    Returns:
        dict: {
            'monto': Decimal,
            'meses_pendientes': list of dict
        }
    """
    if anio is None:
        anio = timezone.now().year
    
    # Verificar si puede pagar
    validacion = puede_pagar_cuotas(voluntario)
    if not validacion['puede']:
        return {'monto': Decimal('0'), 'meses_pendientes': []}
    
    # Obtener precio
    precio = obtener_precio_cuota(voluntario)
    
    # Buscar cuotas pagadas
    pagos = PagoCuota.objects.filter(
        voluntario=voluntario,
        anio=anio
    ).values_list('mes', flat=True)
    
    # Mes actual
    mes_actual = timezone.now().month if anio == timezone.now().year else 12
    
    # Calcular pendientes
    meses_pendientes = []
    for mes in range(1, mes_actual + 1):
        if mes not in pagos:
            meses_pendientes.append({
                'mes': mes,
                'anio': anio,
                'monto': precio
            })
    
    monto_total = precio * len(meses_pendientes)
    
    return {
        'monto': monto_total,
        'meses_pendientes': meses_pendientes
    }


def calcular_deudores_cuotas(anio=None):
    """
    Calcula la lista de voluntarios deudores de cuotas
    
    EXCLUYE:
    - Exentos automáticos
    - Estados bloqueados
    - Con cuotas_desactivadas=True
    
    Returns:
        list: [
            {
                'voluntario': Voluntario,
                'monto': Decimal,
                'meses_pendientes': list,
                'precio_cuota': Decimal
            }
        ]
    """
    if anio is None:
        anio = timezone.now().year
    
    deudores = []
    voluntarios = Voluntario.objects.filter(estado_bombero='activo')
    
    for v in voluntarios:
        validacion = puede_pagar_cuotas(v)
        if not validacion['puede']:
            continue  # Saltar exentos, bloqueados y desactivados
        
        deuda = calcular_deuda_cuotas(v, anio)
        if deuda['monto'] > 0:
            deudores.append({
                'voluntario': v,
                'monto': deuda['monto'],
                'meses_pendientes': deuda['meses_pendientes'],
                'precio_cuota': obtener_precio_cuota(v)
            })
    
    return deudores


@transaction.atomic
def registrar_pago_cuota(voluntario_id, mes, anio, monto, datos_pago, usuario):
    """
    Registra un pago de cuota y crea el movimiento financiero automáticamente
    """
    from django.contrib.auth.models import User
    
    voluntario = Voluntario.objects.get(id=voluntario_id)
    
    # Validar que puede pagar
    validacion = puede_pagar_cuotas(voluntario)
    if not validacion['puede']:
        raise ValueError(f"No puede pagar cuotas: {validacion['mensaje']}")
    
    # Verificar que no exista ya un pago para ese mes/año
    if PagoCuota.objects.filter(voluntario=voluntario, mes=mes, anio=anio).exists():
        raise ValueError(f"Ya existe un pago para {mes}/{anio}")
    
    # Crear pago
    pago = PagoCuota.objects.create(
        voluntario=voluntario,
        mes=mes,
        anio=anio,
        fecha_pago=datos_pago.get('fecha_pago', timezone.now().date()),
        monto_pagado=monto,
        metodo_pago=datos_pago.get('metodo_pago'),
        numero_comprobante=datos_pago.get('numero_comprobante'),
        comprobante_base64=datos_pago.get('comprobante_base64'),
        observaciones=datos_pago.get('observaciones'),
        cuenta_bancaria=datos_pago.get('cuenta_bancaria'),
        created_by=usuario
    )
    
    # Crear movimiento financiero automático
    meses_nombre = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    
    movimiento = MovimientoFinanciero.objects.create(
        tipo='ingreso',
        categoria='cuota',
        monto=monto,
        descripcion=f'Cuota {meses_nombre[mes]} {anio} - {voluntario.nombre_completo()}',
        fecha=pago.fecha_pago,
        pago_cuota=pago,
        cuenta_bancaria=datos_pago.get('cuenta_bancaria'),
        metodo_pago=datos_pago.get('metodo_pago', 'efectivo'),
        numero_comprobante=datos_pago.get('numero_comprobante'),
        observaciones=datos_pago.get('observaciones'),
        created_by=usuario
    )
    
    return pago


# ==================== ESTADO DE CUOTAS ====================

@transaction.atomic
def activar_estudiante(voluntario_id, datos, usuario):
    """
    Activa el estado de estudiante para un voluntario
    """
    voluntario = Voluntario.objects.get(id=voluntario_id)
    estado, created = EstadoCuotasBombero.objects.get_or_create(voluntario=voluntario)
    
    estado.es_estudiante = True
    estado.fecha_activacion_estudiante = datos.get('fecha_activacion', timezone.now().date())
    estado.observaciones_estudiante = datos.get('observaciones', '')
    estado.save()
    
    return estado


@transaction.atomic
def desactivar_estudiante(voluntario_id):
    """
    Desactiva el estado de estudiante
    """
    try:
        estado = EstadoCuotasBombero.objects.get(voluntario_id=voluntario_id)
        estado.es_estudiante = False
        estado.fecha_activacion_estudiante = None
        estado.observaciones_estudiante = None
        estado.save()
        return estado
    except EstadoCuotasBombero.DoesNotExist:
        return None


@transaction.atomic
def desactivar_cuotas_voluntario(voluntario_id, motivo, usuario):
    """
    Desactiva cuotas para un voluntario
    NO aparecerá en lista de deudores
    """
    voluntario = Voluntario.objects.get(id=voluntario_id)
    estado, created = EstadoCuotasBombero.objects.get_or_create(voluntario=voluntario)
    
    estado.cuotas_desactivadas = True
    estado.motivo_desactivacion = motivo
    estado.fecha_desactivacion = timezone.now()
    estado.desactivado_por = usuario.username if usuario else 'Sistema'
    estado.save()
    
    return estado


@transaction.atomic
def reactivar_cuotas_voluntario(voluntario_id):
    """
    Reactiva las cuotas de un voluntario
    """
    try:
        estado = EstadoCuotasBombero.objects.get(voluntario_id=voluntario_id)
        estado.cuotas_desactivadas = False
        estado.motivo_desactivacion = None
        estado.fecha_desactivacion = None
        estado.desactivado_por = None
        estado.save()
        return estado
    except EstadoCuotasBombero.DoesNotExist:
        return None


# ==================== BENEFICIOS ====================

@transaction.atomic
def crear_beneficio_con_asignaciones(datos_beneficio, usuario):
    """
    Crea un beneficio y asigna automáticamente tarjetas a TODOS los voluntarios
    según su categoría de antigüedad
    """
    # Crear beneficio
    beneficio = Beneficio.objects.create(
        nombre=datos_beneficio['nombre'],
        descripcion=datos_beneficio['descripcion'],
        fecha_evento=datos_beneficio['fecha_evento'],
        tarjetas_voluntarios=datos_beneficio.get('tarjetas_voluntarios', 5),
        tarjetas_honorarios_cia=datos_beneficio.get('tarjetas_honorarios_cia', 3),
        tarjetas_honorarios_cuerpo=datos_beneficio.get('tarjetas_honorarios_cuerpo', 3),
        tarjetas_insignes=datos_beneficio.get('tarjetas_insignes', 2),
        precio_por_tarjeta=datos_beneficio['precio_por_tarjeta'],
        precio_tarjeta_extra=datos_beneficio['precio_tarjeta_extra'],
        created_by=usuario
    )
    
    # Asignar a TODOS los voluntarios activos/inactivos
    voluntarios = Voluntario.objects.filter(
        Q(estado_bombero='activo') | Q(estado_bombero='inactivo')
    )
    
    asignaciones = []
    for voluntario in voluntarios:
        categoria = calcular_categoria_bombero(voluntario.fecha_ingreso)
        
        # Determinar tarjetas según categoría
        if 'Insigne' in categoria:
            tarjetas = beneficio.tarjetas_insignes
        elif 'Honorario del Cuerpo' in categoria:
            tarjetas = beneficio.tarjetas_honorarios_cuerpo
        elif 'Honorario de Compañía' in categoria:
            tarjetas = beneficio.tarjetas_honorarios_cia
        else:
            tarjetas = beneficio.tarjetas_voluntarios
        
        # Calcular monto total
        monto_total = Decimal(str(tarjetas)) * beneficio.precio_por_tarjeta
        
        asignacion = AsignacionBeneficio.objects.create(
            beneficio=beneficio,
            voluntario=voluntario,
            tarjetas_asignadas=tarjetas,
            monto_total=monto_total,
            monto_pendiente=monto_total,
            created_by=usuario
        )
        asignaciones.append(asignacion)
    
    return beneficio, asignaciones


@transaction.atomic
def registrar_pago_beneficio(asignacion_id, tipo_pago, cantidad_tarjetas, monto, datos_pago, usuario):
    """
    Registra un pago de beneficio (normal o extra)
    y crea el movimiento financiero automáticamente
    """
    asignacion = AsignacionBeneficio.objects.select_for_update().get(id=asignacion_id)
    
    # Validaciones
    if tipo_pago == 'normal':
        if asignacion.tarjetas_disponibles < cantidad_tarjetas:
            raise ValueError(f"Solo tiene {asignacion.tarjetas_disponibles} tarjetas disponibles")
        
        # Actualizar asignación
        asignacion.tarjetas_vendidas += cantidad_tarjetas
    else:  # extra
        # No hay límite para ventas extras
        asignacion.tarjetas_extras_vendidas += cantidad_tarjetas
    
    # Actualizar montos
    asignacion.monto_pagado += monto
    asignacion.monto_pendiente = asignacion.monto_total - asignacion.monto_pagado
    
    # Actualizar estado
    if asignacion.monto_pendiente <= 0 and asignacion.tarjetas_disponibles == 0:
        asignacion.estado_pago = 'completo'
    elif asignacion.monto_pagado > 0:
        asignacion.estado_pago = 'parcial'
    
    asignacion.save()
    
    # Crear pago
    pago = PagoBeneficio.objects.create(
        asignacion=asignacion,
        tipo_pago=tipo_pago,
        cantidad_tarjetas=cantidad_tarjetas,
        fecha_pago=datos_pago.get('fecha_pago', timezone.now().date()),
        monto=monto,
        metodo_pago=datos_pago.get('metodo_pago'),
        numero_comprobante=datos_pago.get('numero_comprobante'),
        comprobante_base64=datos_pago.get('comprobante_base64'),
        observaciones=datos_pago.get('observaciones'),
        cuenta_bancaria=datos_pago.get('cuenta_bancaria'),
        created_by=usuario
    )
    
    # Crear movimiento financiero automático
    tipo_texto = "Extra" if tipo_pago == 'extra' else "Normal"
    movimiento = MovimientoFinanciero.objects.create(
        tipo='ingreso',
        categoria='beneficio',
        monto=monto,
        descripcion=f'Beneficio {asignacion.beneficio.nombre} - {asignacion.voluntario.nombre_completo()} ({tipo_texto}, {cantidad_tarjetas} tarjetas)',
        fecha=pago.fecha_pago,
        pago_beneficio=pago,
        cuenta_bancaria=datos_pago.get('cuenta_bancaria'),
        metodo_pago=datos_pago.get('metodo_pago', 'efectivo'),
        numero_comprobante=datos_pago.get('numero_comprobante'),
        observaciones=datos_pago.get('observaciones'),
        created_by=usuario
    )
    
    return pago


@transaction.atomic
def liberar_tarjetas(asignacion_id, cantidad, motivo, usuario):
    """
    Libera tarjetas de una asignación
    """
    asignacion = AsignacionBeneficio.objects.select_for_update().get(id=asignacion_id)
    
    if asignacion.tarjetas_disponibles < cantidad:
        raise ValueError(f"Solo tiene {asignacion.tarjetas_disponibles} tarjetas disponibles")
    
    # Actualizar asignación
    asignacion.tarjetas_liberadas += cantidad
    
    # Actualizar monto pendiente (restar el costo de las tarjetas liberadas)
    monto_liberado = Decimal(str(cantidad)) * asignacion.beneficio.precio_por_tarjeta
    asignacion.monto_pendiente -= monto_liberado
    asignacion.monto_total -= monto_liberado
    
    # Actualizar estado
    if asignacion.tarjetas_disponibles == 0:
        if asignacion.monto_pendiente <= 0:
            asignacion.estado_pago = 'completo'
        else:
            asignacion.estado_pago = 'liberado'
    
    # Agregar al historial
    historial = []
    if asignacion.historial_liberaciones:
        try:
            historial = json.loads(asignacion.historial_liberaciones)
        except:
            historial = []
    
    historial.append({
        'fecha': timezone.now().isoformat(),
        'cantidad': cantidad,
        'motivo': motivo,
        'usuario': usuario.username if usuario else 'Sistema'
    })
    
    asignacion.historial_liberaciones = json.dumps(historial)
    asignacion.save()
    
    return asignacion


def calcular_deudores_beneficio(beneficio_id):
    """
    Calcula los deudores de un beneficio específico
    """
    asignaciones = AsignacionBeneficio.objects.filter(
        beneficio_id=beneficio_id,
        monto_pendiente__gt=0
    ).select_related('voluntario')
    
    deudores = []
    for asig in asignaciones:
        deudores.append({
            'voluntario': asig.voluntario,
            'tarjetas_asignadas': asig.tarjetas_asignadas,
            'tarjetas_vendidas': asig.tarjetas_vendidas,
            'tarjetas_disponibles': asig.tarjetas_disponibles,
            'monto_total': asig.monto_total,
            'monto_pagado': asig.monto_pagado,
            'monto_pendiente': asig.monto_pendiente
        })
    
    return deudores


def puede_cerrar_beneficio(beneficio_id):
    """
    Verifica si un beneficio puede ser cerrado
    NO puede cerrarse si hay deudores
    """
    deudores = calcular_deudores_beneficio(beneficio_id)
    return len(deudores) == 0


# ==================== FINANZAS ====================

def calcular_saldo_compania():
    """
    Calcula el saldo de la compañía (ingresos - egresos)
    """
    ingresos = MovimientoFinanciero.objects.filter(
        tipo='ingreso'
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
    
    egresos = MovimientoFinanciero.objects.filter(
        tipo='egreso'
    ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
    
    return {
        'saldo': ingresos - egresos,
        'ingresos': ingresos,
        'egresos': egresos
    }


def obtener_estadisticas_beneficio(beneficio_id):
    """
    Obtiene estadísticas completas de un beneficio
    Para el dashboard de beneficios
    """
    beneficio = Beneficio.objects.get(id=beneficio_id)
    asignaciones = AsignacionBeneficio.objects.filter(beneficio=beneficio)
    
    total_asignaciones = asignaciones.count()
    total_tarjetas_asignadas = asignaciones.aggregate(Sum('tarjetas_asignadas'))['tarjetas_asignadas__sum'] or 0
    total_tarjetas_vendidas = asignaciones.aggregate(Sum('tarjetas_vendidas'))['tarjetas_vendidas__sum'] or 0
    total_tarjetas_extras = asignaciones.aggregate(Sum('tarjetas_extras_vendidas'))['tarjetas_extras_vendidas__sum'] or 0
    total_tarjetas_liberadas = asignaciones.aggregate(Sum('tarjetas_liberadas'))['tarjetas_liberadas__sum'] or 0
    
    monto_total_esperado = asignaciones.aggregate(Sum('monto_total'))['monto_total__sum'] or Decimal('0')
    monto_recaudado = asignaciones.aggregate(Sum('monto_pagado'))['monto_pagado__sum'] or Decimal('0')
    monto_pendiente = asignaciones.aggregate(Sum('monto_pendiente'))['monto_pendiente__sum'] or Decimal('0')
    
    # Contar por estado
    estados = {}
    for estado, _ in AsignacionBeneficio.ESTADO_PAGO_CHOICES:
        estados[estado] = asignaciones.filter(estado_pago=estado).count()
    
    return {
        'beneficio': beneficio,
        'total_asignaciones': total_asignaciones,
        'total_tarjetas_asignadas': total_tarjetas_asignadas,
        'total_tarjetas_vendidas': total_tarjetas_vendidas,
        'total_tarjetas_extras': total_tarjetas_extras,
        'total_tarjetas_liberadas': total_tarjetas_liberadas,
        'monto_total_esperado': monto_total_esperado,
        'monto_recaudado': monto_recaudado,
        'monto_pendiente': monto_pendiente,
        'porcentaje_recaudado': (monto_recaudado / monto_total_esperado * 100) if monto_total_esperado > 0 else 0,
        'estados': estados,
        'puede_cerrar': puede_cerrar_beneficio(beneficio_id)
    }
