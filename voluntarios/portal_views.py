import json
import base64
import mimetypes
from datetime import date
from decimal import Decimal, InvalidOperation

from django.contrib.auth import authenticate, login, logout
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    AsignacionBeneficio,
    AsignacionRifa,
    CuentaBancaria,
    PortalVoluntarioProfile,
    SolicitudPagoPortal,
)
from .permissions import RolBomberos, obtener_rol_usuario
from .portal_utils import (
    PORTAL_PASSWORD_INICIAL,
    crear_feedback_observacion,
    deudas_beneficios_portal,
    deudas_cuotas_portal,
    deudas_rifas_portal,
    expirar_solicitudes_observadas,
    listar_solicitudes_usuario,
    registrar_pago_rifa,
    serializar_credencial_portal,
    serializar_solicitud,
    validar_solicitud_duplicada,
)
from .utils_tesoreria import registrar_pago_beneficio, registrar_pago_cuota


ROLES_TESORERIA_PORTAL = [RolBomberos.TESORERO, RolBomberos.DIRECTOR, RolBomberos.SUPER_ADMIN]


def _json_error(message, status=400):
    return JsonResponse({'success': False, 'error': message}, status=status)


def _parse_request_data(request):
    if request.content_type and 'multipart/form-data' in request.content_type:
        return request.POST
    if not request.body:
        return {}
    return json.loads(request.body)


def _require_portal_user(request):
    if not request.user.is_authenticated:
        return None, _json_error('No autenticado', 401)
    profile = getattr(request.user, 'portal_profile', None)
    if not profile or not profile.activo:
        return None, _json_error('Acceso de portal no disponible', 403)
    expirar_solicitudes_observadas()
    return profile, None


def _require_tesoreria(request):
    if not request.user.is_authenticated:
        return None, _json_error('No autenticado', 401)
    rol = obtener_rol_usuario(request.user)
    if rol not in ROLES_TESORERIA_PORTAL:
        return None, _json_error('No autorizado', 403)
    expirar_solicitudes_observadas()
    return rol, None


def _portal_user_payload(profile):
    return {
        'username': profile.user.username,
        'role': 'Voluntario',
        'must_change_password': profile.debe_cambiar_clave,
        'voluntario': {
            'id': profile.voluntario_id,
            'nombre': profile.voluntario.nombre_completo(),
            'rut': profile.voluntario.rut,
            'compania': profile.voluntario.compania,
            'email': profile.voluntario.email,
        }
    }


def _normalizar_decimal(value, field_name='monto'):
    try:
        monto = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f'{field_name} invalido')
    if monto <= 0:
        raise ValueError(f'{field_name} debe ser mayor a 0')
    return monto


def _obtener_cuenta_destino(cuenta_id):
    if not cuenta_id:
        raise ValueError('Debes seleccionar una cuenta bancaria destino')
    try:
        return CuentaBancaria.objects.get(id=cuenta_id, activa=True)
    except CuentaBancaria.DoesNotExist as exc:
        raise ValueError('Cuenta bancaria destino no encontrada') from exc


def _archivo_a_data_url(file_field):
    if not file_field:
        return None
    try:
        file_field.open('rb')
        contenido = file_field.read()
    finally:
        try:
            file_field.close()
        except Exception:
            pass
    if not contenido:
        return None
    mime_type = mimetypes.guess_type(file_field.name)[0] or 'application/octet-stream'
    encoded = base64.b64encode(contenido).decode('ascii')
    return f'data:{mime_type};base64,{encoded}'


@csrf_exempt
@require_http_methods(["POST"])
def portal_login_view(request):
    try:
        data = _parse_request_data(request)
        username = str(data.get('username', '')).strip().lower()
        password = str(data.get('password', ''))
        user = authenticate(request, username=username, password=password)
        if not user:
            return _json_error('Usuario o contrasena incorrectos', 401)

        profile = getattr(user, 'portal_profile', None)
        if not profile or not profile.activo:
            return _json_error('Este acceso no pertenece al portal de voluntarios', 403)

        login(request, user)
        profile.ultimo_acceso = timezone.now()
        profile.save(update_fields=['ultimo_acceso'])

        return JsonResponse({'success': True, 'user': _portal_user_payload(profile)})
    except json.JSONDecodeError:
        return _json_error('JSON invalido')


@csrf_exempt
@require_http_methods(["GET"])
def portal_check_auth_view(request):
    profile, error = _require_portal_user(request)
    if error:
        return JsonResponse({'authenticated': False, 'user': None}, status=error.status_code)
    return JsonResponse({'authenticated': True, 'user': _portal_user_payload(profile)})


@csrf_exempt
@require_http_methods(["POST", "GET"])
def portal_logout_view(request):
    logout(request)
    return JsonResponse({'success': True})


@csrf_exempt
@require_http_methods(["POST"])
def portal_change_password_view(request):
    profile, error = _require_portal_user(request)
    if error:
        return error

    try:
        data = _parse_request_data(request)
        current_password = str(data.get('current_password', ''))
        new_password = str(data.get('new_password', ''))
        if not profile.user.check_password(current_password):
            return _json_error('La contrasena actual no es correcta', 400)
        if len(new_password) < 6:
            return _json_error('La nueva contrasena debe tener al menos 6 caracteres', 400)

        profile.user.set_password(new_password)
        profile.user.save()
        profile.debe_cambiar_clave = False
        profile.save(update_fields=['debe_cambiar_clave'])
        login(request, profile.user)
        return JsonResponse({'success': True, 'message': 'Contrasena actualizada'})
    except json.JSONDecodeError:
        return _json_error('JSON invalido')


@require_http_methods(["GET"])
def portal_dashboard_view(request):
    profile, error = _require_portal_user(request)
    if error:
        return error

    cuotas = deudas_cuotas_portal(profile.voluntario)
    beneficios = deudas_beneficios_portal(profile.voluntario)
    rifas = deudas_rifas_portal(profile.voluntario)
    solicitudes = [serializar_solicitud(s) for s in listar_solicitudes_usuario(profile.user)]
    cuentas = list(CuentaBancaria.objects.filter(activa=True).values('id', 'nombre', 'banco', 'numero_cuenta'))

    return JsonResponse({
        'success': True,
        'dashboard': {
            'usuario': _portal_user_payload(profile),
            'cuotas': {
                'ciclo': cuotas['ciclo'].anio if cuotas['ciclo'] else None,
                'mensaje': cuotas['mensaje'],
                'pendientes': cuotas['items'],
            },
            'beneficios': beneficios,
            'rifas': rifas,
            'solicitudes': solicitudes,
            'cuentas_bancarias': cuentas,
            'password_inicial': PORTAL_PASSWORD_INICIAL if profile.debe_cambiar_clave else '',
        }
    })


def _crear_o_actualizar_solicitud(request, profile, solicitud=None):
    data = _parse_request_data(request)
    tipo_pago = str(data.get('tipo_pago', '')).strip().lower()
    if tipo_pago not in ['cuota', 'beneficio', 'rifa']:
        raise ValueError('Tipo de pago invalido')

    nombre_pago = str(data.get('nombre_pago', '')).strip()
    if not nombre_pago:
        raise ValueError('El nombre del pago es obligatorio')

    monto = _normalizar_decimal(data.get('monto_solicitado'))
    fecha_raw = data.get('fecha_pago') or timezone.localdate().isoformat()
    try:
        fecha_pago = date.fromisoformat(str(fecha_raw))
    except ValueError as exc:
        raise ValueError('Fecha de pago invalida') from exc

    descripcion = str(data.get('descripcion', '')).strip()
    numero_comprobante = str(data.get('numero_comprobante', '')).strip()
    cuenta_destino = _obtener_cuenta_destino(data.get('cuenta_bancaria_destino_id'))
    archivo = request.FILES.get('comprobante')

    common = {
        'voluntario': profile.voluntario,
        'portal_user': profile.user,
        'tipo_pago': tipo_pago,
        'nombre_pago': nombre_pago,
        'monto_solicitado': monto,
        'fecha_pago': fecha_pago,
        'descripcion': descripcion,
        'numero_comprobante': numero_comprobante,
        'cuenta_bancaria_destino': cuenta_destino,
        'estado': 'pendiente',
        'feedback_tesorero': '',
        'observada_hasta': None,
        'revisada_por': None,
        'revisada_at': None,
        'aprobada_at': None,
    }

    if tipo_pago == 'cuota':
        cuota_mes = int(data.get('cuota_mes'))
        cuota_anio = int(data.get('cuota_anio'))
        cuotas = deudas_cuotas_portal(profile.voluntario)['items']
        if not any(item['mes'] == cuota_mes and item['anio'] == cuota_anio for item in cuotas):
            raise ValueError('La cuota seleccionada ya no esta pendiente en el ciclo activo')
        if validar_solicitud_duplicada(
            profile.voluntario, 'cuota',
            cuota_mes=cuota_mes, cuota_anio=cuota_anio,
            exclude_id=solicitud.id if solicitud else None
        ):
            raise ValueError('Ya existe una solicitud abierta para esa cuota')
        common.update({
            'cuota_mes': cuota_mes,
            'cuota_anio': cuota_anio,
            'cantidad': 1,
            'tipo_pago_beneficio': 'normal',
            'asignacion_beneficio': None,
            'asignacion_rifa': None,
        })

    elif tipo_pago == 'beneficio':
        asignacion = AsignacionBeneficio.objects.select_related('beneficio').get(
            id=int(data.get('asignacion_beneficio_id')),
            voluntario=profile.voluntario
        )
        cantidad = int(data.get('cantidad') or 0)
        tipo_beneficio = str(data.get('tipo_pago_beneficio', 'normal')).strip().lower() or 'normal'
        if cantidad <= 0:
            raise ValueError('La cantidad debe ser mayor a 0')
        if tipo_beneficio not in ['normal', 'extra']:
            raise ValueError('Tipo de pago de beneficio invalido')
        if tipo_beneficio == 'normal' and cantidad > asignacion.tarjetas_disponibles:
            raise ValueError('No puede rendir mas tarjetas de las disponibles')
        precio_unitario = asignacion.beneficio.precio_tarjeta_extra if tipo_beneficio == 'extra' else asignacion.beneficio.precio_por_tarjeta
        monto_esperado = Decimal(str(cantidad)) * precio_unitario
        if monto != monto_esperado:
            raise ValueError(f'El monto debe ser exacto para la cantidad informada: ${monto_esperado}')
        if validar_solicitud_duplicada(
            profile.voluntario, 'beneficio',
            asignacion_beneficio_id=asignacion.id,
            exclude_id=solicitud.id if solicitud else None
        ):
            raise ValueError('Ya existe una solicitud abierta para ese beneficio')
        common.update({
            'cuota_mes': None,
            'cuota_anio': None,
            'asignacion_beneficio': asignacion,
            'tipo_pago_beneficio': tipo_beneficio,
            'asignacion_rifa': None,
            'cantidad': cantidad,
        })

    else:
        asignacion = AsignacionRifa.objects.select_related('rifa').get(
            id=int(data.get('asignacion_rifa_id')),
            voluntario=profile.voluntario
        )
        if asignacion.estado == 'no_retirada':
            raise ValueError('Debes retirar los talonarios antes de solicitar el pago de la rifa')
        if asignacion.estado == 'liberada':
            raise ValueError('La asignacion de rifa fue liberada')
        if monto != asignacion.monto_pendiente:
            raise ValueError(f'Para la rifa debes pagar el monto pendiente exacto: ${asignacion.monto_pendiente}')
        if validar_solicitud_duplicada(
            profile.voluntario, 'rifa',
            asignacion_rifa_id=asignacion.id,
            exclude_id=solicitud.id if solicitud else None
        ):
            raise ValueError('Ya existe una solicitud abierta para esa rifa')
        common.update({
            'cuota_mes': None,
            'cuota_anio': None,
            'asignacion_beneficio': None,
            'tipo_pago_beneficio': 'normal',
            'asignacion_rifa': asignacion,
            'cantidad': 1,
        })

    if not archivo and not (solicitud and solicitud.comprobante):
        raise ValueError('Debes adjuntar un comprobante')

    if solicitud is None:
        solicitud = SolicitudPagoPortal(**common)
    else:
        for key, value in common.items():
            setattr(solicitud, key, value)

    if archivo:
        solicitud.comprobante = archivo

    solicitud.full_clean()
    solicitud.save()
    return solicitud


@csrf_exempt
@require_http_methods(["GET", "POST"])
def portal_solicitudes_view(request):
    profile, error = _require_portal_user(request)
    if error:
        return error

    if request.method == 'GET':
        solicitudes = [serializar_solicitud(s) for s in listar_solicitudes_usuario(profile.user)]
        return JsonResponse({'success': True, 'solicitudes': solicitudes})

    try:
        solicitud = _crear_o_actualizar_solicitud(request, profile)
        return JsonResponse({'success': True, 'solicitud': serializar_solicitud(solicitud)}, status=201)
    except (ValueError, AsignacionBeneficio.DoesNotExist, AsignacionRifa.DoesNotExist) as exc:
        return _json_error(str(exc))
    except json.JSONDecodeError:
        return _json_error('JSON invalido')


@csrf_exempt
@require_http_methods(["GET", "POST"])
def portal_solicitud_detalle_view(request, solicitud_id):
    profile, error = _require_portal_user(request)
    if error:
        return error

    try:
        solicitud = SolicitudPagoPortal.objects.get(id=solicitud_id, portal_user=profile.user)
    except SolicitudPagoPortal.DoesNotExist:
        return _json_error('Solicitud no encontrada', 404)

    if request.method == 'GET':
        return JsonResponse({'success': True, 'solicitud': serializar_solicitud(solicitud)})

    if not solicitud.puede_ser_corregida:
        return _json_error('Solo se pueden corregir solicitudes observadas o expiradas', 400)

    try:
        solicitud = _crear_o_actualizar_solicitud(request, profile, solicitud=solicitud)
        return JsonResponse({'success': True, 'solicitud': serializar_solicitud(solicitud)})
    except (ValueError, AsignacionBeneficio.DoesNotExist, AsignacionRifa.DoesNotExist) as exc:
        return _json_error(str(exc))
    except json.JSONDecodeError:
        return _json_error('JSON invalido')


@require_http_methods(["GET"])
def tesoreria_solicitudes_portal_view(request):
    _, error = _require_tesoreria(request)
    if error:
        return error

    estado = str(request.GET.get('estado', '')).strip().lower()
    busqueda = str(request.GET.get('q', '')).strip()
    try:
        page = max(int(request.GET.get('page', 1)), 1)
    except ValueError:
        page = 1

    page_size = 10
    qs = SolicitudPagoPortal.objects.select_related(
        'voluntario', 'revisada_por', 'asignacion_beneficio__beneficio', 'asignacion_rifa__rifa'
    ).order_by('-created_at')

    if estado and estado not in ['todos', 'all']:
        estado_real = 'aprobada' if estado == 'pagado' else estado
        qs = qs.filter(estado=estado_real)

    if busqueda:
        qs = qs.filter(
            Q(nombre_pago__icontains=busqueda)
            | Q(voluntario__nombre__icontains=busqueda)
            | Q(voluntario__apellido_paterno__icontains=busqueda)
            | Q(voluntario__apellido_materno__icontains=busqueda)
            | Q(voluntario__rut__icontains=busqueda)
        )

    paginator = Paginator(qs, page_size)
    try:
        page_obj = paginator.page(page)
    except EmptyPage:
        page_obj = paginator.page(paginator.num_pages or 1)

    solicitudes = [serializar_solicitud(s) for s in page_obj.object_list]
    pendientes = SolicitudPagoPortal.objects.filter(estado='pendiente').count()
    resumen = {
        'total': SolicitudPagoPortal.objects.count(),
        'pendientes': SolicitudPagoPortal.objects.filter(estado='pendiente').count(),
        'pagados': SolicitudPagoPortal.objects.filter(estado='aprobada').count(),
        'observadas': SolicitudPagoPortal.objects.filter(estado='observada').count(),
        'rechazadas': SolicitudPagoPortal.objects.filter(estado='rechazada').count(),
        'expiradas': SolicitudPagoPortal.objects.filter(estado='expirada').count(),
    }
    return JsonResponse({
        'success': True,
        'solicitudes': solicitudes,
        'pendientes': pendientes,
        'summary': resumen,
        'filters': {
            'estado': estado or 'todos',
            'q': busqueda,
        },
        'pagination': {
            'page': page_obj.number,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
            'total_items': paginator.count,
            'has_previous': page_obj.has_previous(),
            'has_next': page_obj.has_next(),
            'start_index': page_obj.start_index() if paginator.count else 0,
            'end_index': page_obj.end_index() if paginator.count else 0,
        }
    })


def _aprobar_solicitud(solicitud, reviewer):
    comprobante_base64 = _archivo_a_data_url(solicitud.comprobante)
    datos_pago = {
        'fecha_pago': solicitud.fecha_pago,
        'metodo_pago': 'transferencia',
        'numero_comprobante': solicitud.numero_comprobante,
        'observaciones': solicitud.descripcion,
        'cuenta_bancaria': solicitud.cuenta_bancaria_destino,
        'comprobante_base64': comprobante_base64,
    }

    if solicitud.tipo_pago == 'cuota':
        pago = registrar_pago_cuota(
            solicitud.voluntario_id,
            solicitud.cuota_mes,
            solicitud.cuota_anio,
            solicitud.monto_solicitado,
            datos_pago,
            reviewer,
        )
        solicitud.pago_cuota = pago
    elif solicitud.tipo_pago == 'beneficio':
        pago = registrar_pago_beneficio(
            solicitud.asignacion_beneficio_id,
            solicitud.tipo_pago_beneficio,
            solicitud.cantidad,
            solicitud.monto_solicitado,
            datos_pago,
            reviewer,
        )
        solicitud.pago_beneficio = pago
    else:
        pago = registrar_pago_rifa(
            solicitud.asignacion_rifa_id,
            solicitud.monto_solicitado,
            {**datos_pago, 'es_extra': solicitud.asignacion_rifa.pagos.exists()},
            reviewer,
        )
        solicitud.pago_rifa = pago

    solicitud.estado = 'aprobada'
    solicitud.feedback_tesorero = ''
    solicitud.observada_hasta = None
    solicitud.revisada_por = reviewer
    solicitud.revisada_at = timezone.now()
    solicitud.aprobada_at = timezone.now()
    solicitud.save()


@csrf_exempt
@require_http_methods(["POST"])
def tesoreria_solicitud_accion_view(request, solicitud_id):
    _, error = _require_tesoreria(request)
    if error:
        return error

    try:
        solicitud = SolicitudPagoPortal.objects.select_related(
            'asignacion_beneficio', 'asignacion_rifa'
        ).get(id=solicitud_id)
    except SolicitudPagoPortal.DoesNotExist:
        return _json_error('Solicitud no encontrada', 404)

    if solicitud.estado not in ['pendiente', 'observada']:
        return _json_error('La solicitud ya fue cerrada', 400)

    try:
        data = _parse_request_data(request)
        accion = str(data.get('accion', '')).strip().lower()
        feedback = str(data.get('feedback', '')).strip()

        if accion == 'aprobar':
            _aprobar_solicitud(solicitud, request.user)
            return JsonResponse({'success': True, 'solicitud': serializar_solicitud(solicitud)})

        if accion == 'observar':
            if not feedback:
                return _json_error('Debes indicar retroalimentacion para observar la solicitud')
            solicitud.estado = 'observada'
            solicitud.feedback_tesorero = feedback
            solicitud.observada_hasta = crear_feedback_observacion()
            solicitud.revisada_por = request.user
            solicitud.revisada_at = timezone.now()
            solicitud.save()
            return JsonResponse({'success': True, 'solicitud': serializar_solicitud(solicitud)})

        if accion == 'rechazar':
            if not feedback:
                return _json_error('Debes indicar el motivo del rechazo')
            solicitud.estado = 'rechazada'
            solicitud.feedback_tesorero = feedback
            solicitud.observada_hasta = None
            solicitud.revisada_por = request.user
            solicitud.revisada_at = timezone.now()
            solicitud.save()
            return JsonResponse({'success': True, 'solicitud': serializar_solicitud(solicitud)})

        return _json_error('Accion invalida')
    except ValueError as exc:
        return _json_error(str(exc))
    except json.JSONDecodeError:
        return _json_error('JSON invalido')


@require_http_methods(["GET"])
def tesoreria_credenciales_portal_view(request):
    _, error = _require_tesoreria(request)
    if error:
        return error

    perfiles = PortalVoluntarioProfile.objects.select_related('user', 'voluntario').order_by(
        'voluntario__apellido_paterno', 'voluntario__nombre'
    )
    data = [serializar_credencial_portal(profile) for profile in perfiles]
    return JsonResponse({
        'success': True,
        'credenciales': data,
        'password_generica': PORTAL_PASSWORD_INICIAL,
    })
