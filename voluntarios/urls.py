from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VoluntarioViewSet, CargoViewSet, FelicitacionViewSet,
    # TipoAsistenciaViewSet, AsistenciaViewSet,  # TODO: Crear serializers
    UniformeViewSet,
    CuotaViewSet,
    EventoAsistenciaViewSet, DetalleAsistenciaViewSet,
    VoluntarioExternoViewSet, RankingAsistenciaViewSet, CicloAsistenciaViewSet,
    LogoCompaniaViewSet,
    LoginView, LogoutView, CurrentUserView
)
from .sancion_views import SancionViewSet, ReintegroViewSet
from .views_tesoreria import (
    ConfiguracionCuotasViewSet, EstadoCuotasBomberoViewSet,
    PagoCuotaViewSet, BeneficioViewSet, AsignacionBeneficioViewSet,
    PagoBeneficioViewSet, MovimientoFinancieroViewSet, FinanzasViewSet,
    CicloCuotasViewSet
)
from . import auth_views
from . import finanzas_views
from . import cuotas_simple_views
from . import estado_cuotas_simple_views
from . import beneficios_simple_views
from . import deudores_views
from . import portal_views

router = DefaultRouter()
# Voluntarios y relacionados
router.register(r'voluntarios', VoluntarioViewSet, basename='voluntario')
router.register(r'cargos', CargoViewSet, basename='cargo')
router.register(r'sanciones', SancionViewSet, basename='sancion')
router.register(r'reintegros', ReintegroViewSet, basename='reintegro')
router.register(r'felicitaciones', FelicitacionViewSet, basename='felicitacion')

# Asistencias básicas (TODO: Descomentar cuando existan serializers)
# router.register(r'tipos-asistencia', TipoAsistenciaViewSet, basename='tipo-asistencia')
# router.register(r'asistencias-basicas', AsistenciaViewSet, basename='asistencia-basica')

# Uniformes
router.register(r'uniformes', UniformeViewSet, basename='uniforme')

# Cuotas y Tesorería
router.register(r'cuotas', CuotaViewSet, basename='cuota')  # Modelo antiguo (mantener compatibilidad)
router.register(r'configuracion-cuotas', ConfiguracionCuotasViewSet, basename='configuracion-cuota')  # NUEVO
router.register(r'estado-cuotas', EstadoCuotasBomberoViewSet, basename='estado-cuota')  # NUEVO
router.register(r'pagos-cuotas', PagoCuotaViewSet, basename='pago-cuota')  # Actualizado con nuevos endpoints
router.register(r'ciclos-cuotas', CicloCuotasViewSet, basename='ciclo-cuota')  # NUEVO - Gestión de periodos anuales
# Finanzas - Endpoints especiales (saldo, deudores)
router.register(r'finanzas', FinanzasViewSet, basename='finanzas')
router.register(r'movimientos-financieros', MovimientoFinancieroViewSet, basename='movimiento-financiero')

# Beneficios (actualizados con nuevos endpoints)
router.register(r'beneficios', BeneficioViewSet, basename='beneficio')
router.register(r'asignaciones-beneficios', AsignacionBeneficioViewSet, basename='asignacion-beneficio')
router.register(r'pagos-beneficios', PagoBeneficioViewSet, basename='pago-beneficio')

# Sistema completo de asistencias P6P
router.register(r'eventos-asistencia', EventoAsistenciaViewSet, basename='evento-asistencia')
router.register(r'detalles-asistencia', DetalleAsistenciaViewSet, basename='detalle-asistencia')
router.register(r'externos', VoluntarioExternoViewSet, basename='externo')
router.register(r'ranking-asistencias', RankingAsistenciaViewSet, basename='ranking-asistencia')
router.register(r'ciclos-asistencia', CicloAsistenciaViewSet, basename='ciclo-asistencia')

# Logos
router.register(r'logos', LogoCompaniaViewSet, basename='logo')

urlpatterns = [
    path('', include(router.urls)),
    
    # Autenticación (migrado desde auth.js del p6p)
    path('auth/login/', auth_views.login_view, name='api_login'),
    path('auth/logout/', auth_views.logout_view, name='api_logout'),
    path('auth/check/', auth_views.check_auth_view, name='api_check_auth'),
    path('auth/permissions/', auth_views.get_permissions_view, name='api_permissions'),
    path('auth/users/', auth_views.list_users_view, name='api_list_users'),
    path('auth/change-password/', auth_views.change_password_view, name='api_change_password'),

    # Portal voluntarios
    path('portal/auth/login/', portal_views.portal_login_view, name='portal_login'),
    path('portal/auth/logout/', portal_views.portal_logout_view, name='portal_logout'),
    path('portal/auth/check/', portal_views.portal_check_auth_view, name='portal_check_auth'),
    path('portal/auth/change-password/', portal_views.portal_change_password_view, name='portal_change_password'),
    path('portal/dashboard/', portal_views.portal_dashboard_view, name='portal_dashboard'),
    path('portal/solicitudes/', portal_views.portal_solicitudes_view, name='portal_solicitudes'),
    path('portal/solicitudes/<int:solicitud_id>/', portal_views.portal_solicitud_detalle_view, name='portal_solicitud_detalle'),
    path('portal/tesoreria/solicitudes/', portal_views.tesoreria_solicitudes_portal_view, name='portal_tesoreria_solicitudes'),
    path('portal/tesoreria/solicitudes/<int:solicitud_id>/accion/', portal_views.tesoreria_solicitud_accion_view, name='portal_tesoreria_solicitud_accion'),
    path('portal/tesoreria/credenciales/', portal_views.tesoreria_credenciales_portal_view, name='portal_tesoreria_credenciales'),
    
    # Finanzas - Endpoints SIMPLES
    path('movimientos-financieros/', finanzas_views.movimientos_api, name='movimientos_financieros'),
    path('finanzas/saldo-compania/', finanzas_views.saldo_api, name='saldo_compania'),
    
    # Cuotas SIMPLE - SIN DRF
    path('pagos-cuotas-simple/', cuotas_simple_views.pagos_cuotas_simple, name='pagos_cuotas_simple'),
    
    # Estado de Cuotas SIMPLE - SIN DRF
    path('<int:voluntario_id>/estado-cuotas-simple/', estado_cuotas_simple_views.estado_cuotas_simple, name='estado_cuotas_simple'),
    path('<int:voluntario_id>/activar-estudiante-simple/', estado_cuotas_simple_views.activar_estudiante_simple, name='activar_estudiante_simple'),
    path('<int:voluntario_id>/desactivar-estudiante-simple/', estado_cuotas_simple_views.desactivar_estudiante_simple, name='desactivar_estudiante_simple'),
    
    # Beneficios SIMPLE - SIN DRF
    path('beneficios-simple/', beneficios_simple_views.listar_beneficios_simple, name='listar_beneficios_simple'),
    path('asignaciones-beneficios-simple/', beneficios_simple_views.listar_asignaciones_simple, name='listar_asignaciones_simple'),
    path('crear-beneficio-simple/', beneficios_simple_views.crear_beneficio_simple, name='crear_beneficio_simple'),
    path('<int:voluntario_id>/beneficios-asignados-simple/', beneficios_simple_views.beneficios_asignados_simple, name='beneficios_asignados_simple'),
    path('pagar-beneficio-simple/', beneficios_simple_views.pagar_beneficio_simple, name='pagar_beneficio_simple'),
    path('venta-extra-simple/', beneficios_simple_views.venta_extra_simple, name='venta_extra_simple'),
    path('liberar-tarjetas-simple/', beneficios_simple_views.liberar_tarjetas_simple, name='liberar_tarjetas_simple'),
    
    # Deudores - Endpoints simplificados para tablas
    path('deudores-cuotas-listado/', deudores_views.listar_deudores_cuotas, name='deudores_cuotas_listado'),
    path('deudores-beneficios-listado/', deudores_views.listar_deudores_beneficios, name='deudores_beneficios_listado'),
]
