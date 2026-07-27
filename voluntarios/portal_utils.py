import os
import random
import unicodedata
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import (
    AsignacionBeneficio,
    AsignacionRifa,
    CicloCuotas,
    GrupoSolicitudPago,
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

# Validacion del comprobante subido por el voluntario (server-side; el
# atributo accept del input HTML es solo una sugerencia del navegador).
EXTENSIONES_COMPROBANTE_PERMITIDAS = ('.jpg', '.jpeg', '.png', '.pdf', '.webp')
MAX_TAMANO_COMPROBANTE_BYTES = 10 * 1024 * 1024


def _normalizar_decimal(value, field_name='monto'):
    try:
        monto = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'{field_name} invalido')
    if monto <= 0:
        raise ValueError(f'{field_name} debe ser mayor a 0')
    return monto


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


def validar_archivo_comprobante(archivo):
    """
    Valida el archivo de comprobante subido por el voluntario.
    Levanta ValueError con un mensaje claro si no cumple.
    """
    if not archivo:
        raise ValueError('Debes adjuntar un comprobante')

    nombre = getattr(archivo, 'name', '') or ''
    extension = os.path.splitext(nombre)[1].lower()
    if extension not in EXTENSIONES_COMPROBANTE_PERMITIDAS:
        permitidas = ', '.join(EXTENSIONES_COMPROBANTE_PERMITIDAS)
        raise ValueError(f'El comprobante debe ser un archivo {permitidas}')

    tamano = getattr(archivo, 'size', 0) or 0
    if tamano > MAX_TAMANO_COMPROBANTE_BYTES:
        maximo_mb = MAX_TAMANO_COMPROBANTE_BYTES // (1024 * 1024)
        raise ValueError(f'El comprobante no puede superar los {maximo_mb} MB')

    return archivo


def validar_item_pago(voluntario, tipo_pago, item_data, exclude_solicitud_id=None):
    """
    Valida un item de pago del portal (cuota, beneficio o rifa) y devuelve
    los datos ya normalizados y resueltos para construir la SolicitudPagoPortal.

    Es el unico lugar donde viven las validaciones de integridad del dinero:
    tanto el flujo de solicitud simple (`_crear_o_actualizar_solicitud`) como
    el flujo de grupo (`crear_grupo_solicitud`) lo usan, para que no puedan
    volver a divergir.

    item_data acepta las claves: monto, cuota_mes, cuota_anio,
    asignacion_beneficio_id, tipo_pago_beneficio, cantidad, asignacion_rifa_id.

    Levanta ValueError con un mensaje para el usuario final si algo no cuadra.
    """
    tipo_pago = str(tipo_pago or '').strip().lower()
    if tipo_pago not in ['cuota', 'beneficio', 'rifa']:
        raise ValueError('Tipo de pago invalido')

    monto = _normalizar_decimal(item_data.get('monto'))

    validado = {
        'tipo_pago': tipo_pago,
        'monto': monto,
        'nombre_pago': '',
        'cuota_mes': None,
        'cuota_anio': None,
        'asignacion_beneficio': None,
        'tipo_pago_beneficio': 'normal',
        'asignacion_rifa': None,
        'cantidad': 1,
    }

    if tipo_pago == 'cuota':
        try:
            cuota_mes = int(item_data.get('cuota_mes'))
            cuota_anio = int(item_data.get('cuota_anio'))
        except (TypeError, ValueError) as exc:
            raise ValueError('El mes y el ano de la cuota son obligatorios') from exc

        cuotas = deudas_cuotas_portal(voluntario)['items']
        if not any(item['mes'] == cuota_mes and item['anio'] == cuota_anio for item in cuotas):
            raise ValueError('La cuota seleccionada ya no esta pendiente en el ciclo activo')

        # El precio lo define el servidor: el monto no puede venir del cliente,
        # o se podria saldar una cuota completa declarando $1.
        monto_esperado = obtener_precio_cuota(voluntario)
        if monto != monto_esperado:
            raise ValueError(f'Para la cuota debes pagar el monto exacto: ${monto_esperado}')

        if validar_solicitud_duplicada(
            voluntario, 'cuota',
            cuota_mes=cuota_mes, cuota_anio=cuota_anio,
            exclude_id=exclude_solicitud_id
        ):
            raise ValueError('Ya existe una solicitud abierta para esa cuota')

        validado.update({
            'cuota_mes': cuota_mes,
            'cuota_anio': cuota_anio,
            'cantidad': 1,
            'nombre_pago': f'Cuota {cuota_mes:02d}/{cuota_anio}',
        })

    elif tipo_pago == 'beneficio':
        try:
            asignacion = AsignacionBeneficio.objects.select_related('beneficio').get(
                id=int(item_data.get('asignacion_beneficio_id')),
                voluntario=voluntario
            )
        except (TypeError, ValueError) as exc:
            raise ValueError('El beneficio seleccionado es invalido') from exc
        except AsignacionBeneficio.DoesNotExist as exc:
            raise ValueError('El beneficio seleccionado no esta asignado a ti') from exc

        tipo_beneficio = str(item_data.get('tipo_pago_beneficio') or 'normal').strip().lower() or 'normal'
        if tipo_beneficio not in ['normal', 'extra']:
            raise ValueError('Tipo de pago de beneficio invalido')

        try:
            cantidad = int(item_data.get('cantidad') or 0)
        except (TypeError, ValueError) as exc:
            raise ValueError('La cantidad de tarjetas es invalida') from exc
        if cantidad <= 0:
            raise ValueError('La cantidad debe ser mayor a 0')
        if tipo_beneficio == 'normal' and cantidad > asignacion.tarjetas_disponibles:
            raise ValueError('No puede rendir mas tarjetas de las disponibles')

        precio_unitario = (
            asignacion.beneficio.precio_tarjeta_extra if tipo_beneficio == 'extra'
            else asignacion.beneficio.precio_por_tarjeta
        )
        monto_esperado = Decimal(str(cantidad)) * precio_unitario
        if monto != monto_esperado:
            raise ValueError(f'El monto debe ser exacto para la cantidad informada: ${monto_esperado}')

        if validar_solicitud_duplicada(
            voluntario, 'beneficio',
            asignacion_beneficio_id=asignacion.id,
            exclude_id=exclude_solicitud_id
        ):
            raise ValueError('Ya existe una solicitud abierta para ese beneficio')

        validado.update({
            'asignacion_beneficio': asignacion,
            'tipo_pago_beneficio': tipo_beneficio,
            'cantidad': cantidad,
            'nombre_pago': asignacion.beneficio.nombre,
        })

    else:
        try:
            asignacion = AsignacionRifa.objects.select_related('rifa').get(
                id=int(item_data.get('asignacion_rifa_id')),
                voluntario=voluntario
            )
        except (TypeError, ValueError) as exc:
            raise ValueError('La rifa seleccionada es invalida') from exc
        except AsignacionRifa.DoesNotExist as exc:
            raise ValueError('La rifa seleccionada no esta asignada a ti') from exc

        if asignacion.estado == 'no_retirada':
            raise ValueError('Debes retirar los talonarios antes de solicitar el pago de la rifa')
        if asignacion.estado == 'liberada':
            raise ValueError('La asignacion de rifa fue liberada')
        if monto != asignacion.monto_pendiente:
            raise ValueError(f'Para la rifa debes pagar el monto pendiente exacto: ${asignacion.monto_pendiente}')

        if validar_solicitud_duplicada(
            voluntario, 'rifa',
            asignacion_rifa_id=asignacion.id,
            exclude_id=exclude_solicitud_id
        ):
            raise ValueError('Ya existe una solicitud abierta para esa rifa')

        validado.update({
            'asignacion_rifa': asignacion,
            'cantidad': 1,
            'nombre_pago': asignacion.rifa.nombre,
        })

    return validado


def _clave_referencia_item(validado):
    """Identifica a que concepto apunta un item ya validado, para detectar repetidos."""
    if validado['tipo_pago'] == 'cuota':
        return ('cuota', validado['cuota_mes'], validado['cuota_anio'])
    if validado['tipo_pago'] == 'beneficio':
        return ('beneficio', validado['asignacion_beneficio'].id)
    return ('rifa', validado['asignacion_rifa'].id)


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


@transaction.atomic
def crear_grupo_solicitud(profile, items, datos_comunes, archivo):
    """
    items: lista de dicts con al menos 'tipo_pago' y 'monto', mas las
    referencias segun tipo (cuota_mes/cuota_anio, asignacion_beneficio_id,
    tipo_pago_beneficio, cantidad, asignacion_rifa_id).
    datos_comunes: dict con 'fecha_pago' (date), 'cuenta_bancaria_destino'
    (CuentaBancaria), 'numero_comprobante', 'descripcion'.
    """
    if not items:
        raise ValueError('Debes seleccionar al menos un item para pagar')
    validar_archivo_comprobante(archivo)

    voluntario = profile.voluntario

    # Se validan TODOS los items antes de crear nada: si se creara la
    # solicitud del item 1 primero, la validacion de duplicados del item 2
    # la veria como una solicitud abierta preexistente.
    validados = []
    referencias = set()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Formato de item invalido')
        validado = validar_item_pago(voluntario, item.get('tipo_pago'), item)
        referencia = _clave_referencia_item(validado)
        if referencia in referencias:
            raise ValueError(f'El carrito tiene repetido el concepto "{validado["nombre_pago"]}"')
        referencias.add(referencia)
        validados.append(validado)

    monto_total = sum(validado['monto'] for validado in validados)

    grupo = GrupoSolicitudPago.objects.create(
        voluntario=profile.voluntario,
        portal_user=profile.user,
        fecha_pago=datos_comunes['fecha_pago'],
        cuenta_bancaria_destino=datos_comunes['cuenta_bancaria_destino'],
        numero_comprobante=datos_comunes.get('numero_comprobante', ''),
        descripcion=datos_comunes.get('descripcion', ''),
        monto_total=monto_total,
        comprobante=archivo,
    )

    for validado in validados:
        solicitud = SolicitudPagoPortal(
            voluntario=voluntario,
            portal_user=profile.user,
            tipo_pago=validado['tipo_pago'],
            nombre_pago=validado['nombre_pago'],
            monto_solicitado=validado['monto'],
            cuota_mes=validado['cuota_mes'],
            cuota_anio=validado['cuota_anio'],
            asignacion_beneficio=validado['asignacion_beneficio'],
            tipo_pago_beneficio=validado['tipo_pago_beneficio'],
            asignacion_rifa=validado['asignacion_rifa'],
            cantidad=validado['cantidad'],
            fecha_pago=datos_comunes['fecha_pago'],
            numero_comprobante=datos_comunes.get('numero_comprobante', ''),
            descripcion=datos_comunes.get('descripcion', ''),
            cuenta_bancaria_destino=datos_comunes['cuenta_bancaria_destino'],
            grupo=grupo,
        )
        # Se comparte la ruta del archivo ya guardado en el grupo en vez de
        # subir una copia por item: asi los listados de tesoreria que buscan
        # el comprobante via `pago.solicitudes_portal` siguen encontrandolo,
        # sin duplicar el archivo ni su base64 (ver _aprobar_grupo).
        if grupo.comprobante:
            solicitud.comprobante.name = grupo.comprobante.name
        solicitud.full_clean()
        solicitud.save()

    return grupo


def serializar_grupo_solicitud(grupo):
    estado_labels = {
        'pendiente': 'Pendiente',
        'observada': 'Observada',
        'aprobada': 'Pagado',
        'rechazada': 'Rechazado',
        'expirada': 'Expirada',
    }
    return {
        'id': grupo.id,
        'estado': grupo.estado,
        'estado_label': estado_labels.get(grupo.estado, grupo.estado),
        'fecha_pago': grupo.fecha_pago.isoformat() if grupo.fecha_pago else None,
        'numero_comprobante': grupo.numero_comprobante,
        'descripcion': grupo.descripcion,
        'monto_total': float(grupo.monto_total),
        'comprobante_url': grupo.comprobante.url if grupo.comprobante else None,
        'feedback_tesorero': grupo.feedback_tesorero,
        'observada_hasta': grupo.observada_hasta.isoformat() if grupo.observada_hasta else None,
        'created_at': grupo.created_at.isoformat() if grupo.created_at else None,
        'voluntario': {
            'id': grupo.voluntario_id,
            'nombre': grupo.voluntario.nombre_completo(),
            'rut': grupo.voluntario.rut,
        },
        'items': [serializar_solicitud(item) for item in grupo.items.all()],
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
