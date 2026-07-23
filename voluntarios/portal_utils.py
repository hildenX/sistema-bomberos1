import random
import unicodedata
from datetime import timedelta
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import (
    AsignacionBeneficio,
    AsignacionRifa,
    CicloCuotas,
    MovimientoFinanciero,
    PagoRifa,
    PortalVoluntarioProfile,
    SolicitudPagoPortal,
)
from .utils_tesoreria import (
    obtener_precio_cuota,
    puede_pagar_cuotas,
)


PORTAL_PASSWORD_INICIAL = 'Bomberos123!'
VENTANA_CORRECCION_HORAS = 48


def _ascii_slug(texto):
    texto = (texto or '').strip().lower()
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(ch for ch in texto if not unicodedata.combining(ch))
    return ''.join(ch for ch in texto if ch.isalnum())


def generar_username_portal(voluntario):
    primer_nombre = (voluntario.nombre or '').split()[0] if voluntario.nombre else 'v'
    apellido = voluntario.apellido_paterno or voluntario.apellido_materno or voluntario.rut or 'bombero'
    base = f"{_ascii_slug(primer_nombre[:1])}{_ascii_slug(apellido)}"
    base = base or f"v{_ascii_slug(voluntario.rut)}"

    candidatos = list(range(100))
    random.shuffle(candidatos)

    for numero in candidatos:
        username = f"{base}.{numero:02d}"
        if not User.objects.filter(username=username).exists():
            return username

    raise ValueError(f'No fue posible generar un usuario único para {voluntario}.')


@transaction.atomic
def crear_acceso_portal_para_voluntario(voluntario):
    if hasattr(voluntario, 'portal_profile'):
        return voluntario.portal_profile

    username = generar_username_portal(voluntario)
    user = User.objects.create(
        username=username,
        first_name=(voluntario.nombre or '').strip()[:150],
        last_name=' '.join(filter(None, [voluntario.apellido_paterno, voluntario.apellido_materno]))[:150],
        email=voluntario.email or ''
    )
    user.set_password(PORTAL_PASSWORD_INICIAL)
    user.save()

    return PortalVoluntarioProfile.objects.create(
        voluntario=voluntario,
        user=user,
        activo=True,
        debe_cambiar_clave=True,
    )


def expirar_solicitudes_observadas():
    ahora = timezone.now()
    return SolicitudPagoPortal.objects.filter(
        estado='observada',
        observada_hasta__isnull=False,
        observada_hasta__lt=ahora,
    ).update(estado='expirada')


def obtener_ciclo_cuotas_activo():
    return CicloCuotas.objects.filter(activo=True, cerrado=False).order_by('-anio').first()


def _iterar_meses_ciclo(ciclo):
    if not ciclo:
        return []

    hoy = timezone.localdate()
    limite = min(hoy, ciclo.fecha_fin)
    if limite < ciclo.fecha_inicio:
        return []

    year = ciclo.fecha_inicio.year
    month = ciclo.fecha_inicio.month
    meses = []
    while (year, month) <= (limite.year, limite.month):
        meses.append((month, year))
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    return meses


def deudas_cuotas_portal(voluntario):
    ciclo = obtener_ciclo_cuotas_activo()
    validacion = puede_pagar_cuotas(voluntario)
    if not ciclo or not validacion['puede']:
        return {'ciclo': ciclo, 'items': [], 'mensaje': validacion.get('mensaje', '')}

    pagos = set(
        voluntario.pagos_cuotas.filter(
            anio__in=[anio for _, anio in _iterar_meses_ciclo(ciclo)]
        ).values_list('mes', 'anio')
    )
    precio = obtener_precio_cuota(voluntario)
    items = []
    for mes, anio in _iterar_meses_ciclo(ciclo):
        if (mes, anio) in pagos:
            continue
        items.append({
            'mes': mes,
            'anio': anio,
            'monto': float(precio),
            'nombre': f'Cuota {mes:02d}/{anio}',
        })
    return {'ciclo': ciclo, 'items': items, 'mensaje': ''}


def deudas_beneficios_portal(voluntario):
    asignaciones = AsignacionBeneficio.objects.select_related('beneficio').filter(
        voluntario=voluntario,
        beneficio__estado='activo',
        monto_pendiente__gt=0
    ).order_by('-beneficio__fecha_evento')

    items = []
    for asignacion in asignaciones:
        items.append({
            'asignacion_id': asignacion.id,
            'beneficio_id': asignacion.beneficio_id,
            'nombre': asignacion.beneficio.nombre,
            'tipo_pago_beneficio': 'normal',
            'monto_pendiente': float(asignacion.monto_pendiente),
            'precio_por_tarjeta': float(asignacion.beneficio.precio_por_tarjeta),
            'precio_tarjeta_extra': float(asignacion.beneficio.precio_tarjeta_extra),
            'tarjetas_disponibles': asignacion.tarjetas_disponibles,
            'tarjetas_extras_vendidas': asignacion.tarjetas_extras_vendidas,
            'estado_pago': asignacion.estado_pago,
        })
    return items


def deudas_rifas_portal(voluntario):
    asignaciones = AsignacionRifa.objects.select_related('rifa').filter(
        voluntario=voluntario,
        rifa__estado='activa'
    ).order_by('-rifa__created_at')

    items = []
    for asignacion in asignaciones:
        items.append({
            'asignacion_id': asignacion.id,
            'rifa_id': asignacion.rifa_id,
            'nombre': asignacion.rifa.nombre,
            'estado': asignacion.estado,
            'monto_total': float(asignacion.monto_total),
            'monto_pagado': float(asignacion.monto_pagado),
            'monto_pendiente': float(asignacion.monto_pendiente),
            'puede_pagar': asignacion.estado != 'no_retirada' and asignacion.estado != 'liberada',
        })
    return items


def listar_solicitudes_usuario(user):
    expirar_solicitudes_observadas()
    solicitudes = SolicitudPagoPortal.objects.filter(portal_user=user).select_related(
        'voluntario', 'asignacion_beneficio__beneficio', 'asignacion_rifa__rifa'
    )
    return solicitudes


def _solicitudes_abiertas(voluntario):
    return SolicitudPagoPortal.objects.filter(
        voluntario=voluntario,
        estado__in=['pendiente', 'observada']
    )


def validar_solicitud_duplicada(voluntario, tipo_pago, cuota_mes=None, cuota_anio=None,
                                asignacion_beneficio_id=None, asignacion_rifa_id=None, exclude_id=None):
    qs = _solicitudes_abiertas(voluntario)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)

    if tipo_pago == 'cuota':
        return qs.filter(tipo_pago='cuota', cuota_mes=cuota_mes, cuota_anio=cuota_anio).exists()
    if tipo_pago == 'beneficio':
        return qs.filter(tipo_pago='beneficio', asignacion_beneficio_id=asignacion_beneficio_id).exists()
    if tipo_pago == 'rifa':
        return qs.filter(tipo_pago='rifa', asignacion_rifa_id=asignacion_rifa_id).exists()
    return False


@transaction.atomic
def registrar_pago_rifa(asignacion_id, monto, datos_pago, usuario):
    asignacion = AsignacionRifa.objects.select_for_update().select_related('rifa', 'voluntario').get(id=asignacion_id)
    metodo_pago = datos_pago.get('metodo_pago', 'transferencia')
    cuenta = datos_pago.get('cuenta_bancaria')
    es_extra = bool(datos_pago.get('es_extra', False))

    if asignacion.rifa.estado != 'activa':
        raise ValueError('La rifa ya está cerrada.')
    if asignacion.estado == 'no_retirada':
        raise ValueError('Debe retirar los talonarios antes de pagar.')
    if asignacion.estado == 'liberada':
        raise ValueError('La asignación fue liberada y no admite pagos.')
    if not es_extra and asignacion.pagos.exists():
        raise ValueError('La asignación ya tiene un pago regular registrado.')

    pago = PagoRifa.objects.create(
        asignacion=asignacion,
        monto=monto,
        fecha_pago=datos_pago.get('fecha_pago', timezone.localdate()),
        metodo_pago=metodo_pago,
        cuenta_bancaria=cuenta,
        numero_comprobante=datos_pago.get('numero_comprobante', ''),
        observaciones=datos_pago.get('observaciones', ''),
    )

    if metodo_pago == 'transferencia' and cuenta:
        MovimientoFinanciero.objects.create(
            tipo='ingreso',
            categoria='rifa',
            descripcion=f"{'Pago extra' if es_extra else 'Pago'} rifa {asignacion.rifa.nombre} - {asignacion.voluntario}",
            monto=monto,
            fecha=pago.fecha_pago,
            cuenta_bancaria=cuenta,
            metodo_pago=metodo_pago,
            numero_comprobante=datos_pago.get('numero_comprobante', ''),
            observaciones=datos_pago.get('observaciones', ''),
            pago_rifa=pago,
            created_by=usuario,
        )

    asignacion.monto_pagado += monto
    if not es_extra or asignacion.monto_pagado >= asignacion.monto_total:
        asignacion.estado = 'pagada'
    asignacion.save()

    return pago


def resumen_dashboard_portal(user):
    perfil = user.portal_profile
    voluntario = perfil.voluntario
    cuotas = deudas_cuotas_portal(voluntario)
    beneficios = deudas_beneficios_portal(voluntario)
    rifas = deudas_rifas_portal(voluntario)
    solicitudes = listar_solicitudes_usuario(user)

    return {
        'voluntario': voluntario,
        'perfil': perfil,
        'cuotas': cuotas,
        'beneficios': beneficios,
        'rifas': rifas,
        'solicitudes': solicitudes,
    }


def serializar_solicitud(solicitud):
    estado_labels = {
        'pendiente': 'Pendiente',
        'observada': 'Observada',
        'aprobada': 'Pagado',
        'rechazada': 'Rechazado',
        'expirada': 'Expirada',
    }
    tipo_labels = {
        'cuota': 'Cuota Social',
        'beneficio': 'Beneficio',
        'rifa': 'Rifa',
    }
    return {
        'id': solicitud.id,
        'tipo_pago': solicitud.tipo_pago,
        'tipo_pago_label': tipo_labels.get(solicitud.tipo_pago, solicitud.tipo_pago),
        'estado': solicitud.estado,
        'estado_label': estado_labels.get(solicitud.estado, solicitud.estado),
        'nombre_pago': solicitud.nombre_pago,
        'cantidad': solicitud.cantidad,
        'monto_solicitado': float(solicitud.monto_solicitado),
        'fecha_pago': solicitud.fecha_pago.isoformat() if solicitud.fecha_pago else None,
        'descripcion': solicitud.descripcion,
        'numero_comprobante': solicitud.numero_comprobante,
        'feedback_tesorero': solicitud.feedback_tesorero,
        'observada_hasta': solicitud.observada_hasta.isoformat() if solicitud.observada_hasta else None,
        'cuota_mes': solicitud.cuota_mes,
        'cuota_anio': solicitud.cuota_anio,
        'asignacion_beneficio_id': solicitud.asignacion_beneficio_id,
        'tipo_pago_beneficio': solicitud.tipo_pago_beneficio,
        'asignacion_rifa_id': solicitud.asignacion_rifa_id,
        'comprobante_url': solicitud.comprobante.url if solicitud.comprobante else None,
        'cuenta_bancaria_destino_id': solicitud.cuenta_bancaria_destino_id,
        'revisada_por': solicitud.revisada_por.username if solicitud.revisada_por else None,
        'revisada_at': solicitud.revisada_at.isoformat() if solicitud.revisada_at else None,
        'created_at': solicitud.created_at.isoformat() if solicitud.created_at else None,
        'voluntario': {
            'id': solicitud.voluntario_id,
            'nombre': solicitud.voluntario.nombre_completo(),
            'rut': solicitud.voluntario.rut,
        }
    }


def serializar_credencial_portal(profile):
    return {
        'voluntario_id': profile.voluntario_id,
        'voluntario': profile.voluntario.nombre_completo(),
        'rut': profile.voluntario.rut,
        'username': profile.user.username,
        'password_inicial': PORTAL_PASSWORD_INICIAL if profile.debe_cambiar_clave else '',
        'debe_cambiar_clave': profile.debe_cambiar_clave,
        'activo': profile.activo,
    }


def crear_feedback_observacion():
    return timezone.now() + timedelta(hours=VENTANA_CORRECCION_HORAS)
