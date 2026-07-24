"""
URL configuration for Bomberos project - SISTEMA P6P COMPLETO
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from voluntarios import cuotas_simple_views, ciclos_cuotas_simple_views, pdf_cuotas_views, configuracion_cuotas_simple_views, estado_cuotas_simple_views, beneficios_simple_views, voluntarios_simple_views, deudores_views, carga_masiva_views, ciclos_beneficios_simple_views, cuentas_views, rifa_views

# Helper para servir templates
def template(name):
    return TemplateView.as_view(template_name=name)

urlpatterns = [
    # ADMIN DE DJANGO
    path('admin/', admin.site.urls),
    
    # ENDPOINTS SIMPLES SIN DRF (sin autenticación) - DEBEN IR ANTES DEL INCLUDE
    path('api/voluntarios/configuracion-cuotas-simple/', configuracion_cuotas_simple_views.configuracion_cuotas_simple, name='configuracion_cuotas_simple'),
    path('api/voluntarios/pagos-cuotas-simple/', cuotas_simple_views.pagos_cuotas_simple, name='pagos_cuotas_simple_direct'),
    path('api/voluntarios/ciclos-cuotas-simple/', ciclos_cuotas_simple_views.ciclos_cuotas_simple, name='ciclos_cuotas_simple'),
    path('api/voluntarios/ciclos-cuotas-simple/<int:ciclo_id>/activar/', ciclos_cuotas_simple_views.activar_ciclo_cuota, name='activar_ciclo'),
    path('api/voluntarios/ciclos-cuotas-simple/<int:ciclo_id>/cerrar/', ciclos_cuotas_simple_views.cerrar_ciclo_cuota, name='cerrar_ciclo'),
    path('api/voluntarios/ciclos-cuotas-simple/<int:ciclo_id>/reabrir/', ciclos_cuotas_simple_views.reabrir_ciclo_cuota, name='reabrir_ciclo'),
    path('api/voluntarios/ciclos-cuotas-simple/<int:ciclo_id>/estadisticas/', ciclos_cuotas_simple_views.estadisticas_ciclo_cuota, name='estadisticas_ciclo'),

    # Cuentas Bancarias y Caja SIMPLE - SIN DRF
    path('api/voluntarios/cuentas-bancarias-simple/', cuentas_views.cuentas_bancarias_simple, name='cuentas_bancarias_simple'),
    path('api/voluntarios/cuentas-bancarias-simple/<int:cuenta_id>/desactivar/', cuentas_views.desactivar_cuenta_bancaria, name='desactivar_cuenta_bancaria'),
    path('api/voluntarios/cuentas-bancarias-simple/<int:cuenta_id>/reactivar/', cuentas_views.reactivar_cuenta_bancaria, name='reactivar_cuenta_bancaria'),
    path('api/voluntarios/cuentas-bancarias-simple/<int:cuenta_id>/eliminar/', cuentas_views.eliminar_cuenta_bancaria, name='eliminar_cuenta_bancaria'),
    path('api/voluntarios/caja-simple/', cuentas_views.caja_simple, name='caja_simple'),
    path('api/voluntarios/depositos-caja-simple/', cuentas_views.depositos_caja_simple, name='depositos_caja_simple'),

    # Ciclos de Beneficios SIMPLE - SIN DRF
    path('api/voluntarios/ciclos-beneficios-simple/', ciclos_beneficios_simple_views.ciclos_beneficios_simple, name='ciclos_beneficios_simple'),
    path('api/voluntarios/ciclos-beneficios-simple/<int:ciclo_id>/activar/', ciclos_beneficios_simple_views.activar_ciclo_beneficio, name='activar_ciclo_beneficio'),
    path('api/voluntarios/ciclos-beneficios-simple/<int:ciclo_id>/cerrar/', ciclos_beneficios_simple_views.cerrar_ciclo_beneficio, name='cerrar_ciclo_beneficio'),
    path('api/voluntarios/ciclos-beneficios-simple/<int:ciclo_id>/reabrir/', ciclos_beneficios_simple_views.reabrir_ciclo_beneficio, name='reabrir_ciclo_beneficio'),
    path('api/voluntarios/ciclos-beneficios-simple/<int:ciclo_id>/estadisticas/', ciclos_beneficios_simple_views.estadisticas_ciclo_beneficio, name='estadisticas_ciclo_beneficio'),

    # PDFs de cuotas
    path('api/voluntarios/<int:voluntario_id>/pdf-cuotas/', pdf_cuotas_views.pdf_cuotas_voluntario, name='pdf_cuotas_voluntario'),
    path('api/voluntarios/<int:voluntario_id>/pdf-cuotas/<int:anio>/', pdf_cuotas_views.pdf_cuotas_voluntario, name='pdf_cuotas_voluntario_anio'),
    path('api/voluntarios/pdf-deudores-cuotas/', pdf_cuotas_views.pdf_deudores_cuotas, name='pdf_deudores_cuotas'),
    path('api/voluntarios/pdf-deudores-cuotas/<int:anio>/', pdf_cuotas_views.pdf_deudores_cuotas, name='pdf_deudores_cuotas_anio'),
    
    # Estado de Cuotas SIMPLE - SIN DRF
    path('api/voluntarios/<int:voluntario_id>/estado-cuotas-simple/', estado_cuotas_simple_views.estado_cuotas_simple, name='estado_cuotas_simple_direct'),
    path('api/voluntarios/<int:voluntario_id>/activar-estudiante-simple/', estado_cuotas_simple_views.activar_estudiante_simple, name='activar_estudiante_simple_direct'),
    path('api/voluntarios/<int:voluntario_id>/desactivar-estudiante-simple/', estado_cuotas_simple_views.desactivar_estudiante_simple, name='desactivar_estudiante_simple_direct'),
    
    # Voluntarios SIMPLE - SIN DRF (para asistencias)
    path('api/voluntarios/lista-activos-simple/', voluntarios_simple_views.listar_voluntarios_simple, name='listar_voluntarios_simple'),
    path('api/voluntarios/<int:voluntario_id>/detalle-simple/', voluntarios_simple_views.obtener_voluntario_simple, name='obtener_voluntario_simple'),
    
    # Beneficios SIMPLE - SIN DRF
    path('api/voluntarios/logo-simple/', beneficios_simple_views.obtener_logo_simple, name='obtener_logo_simple'),
    path('api/voluntarios/beneficios/', beneficios_simple_views.listar_beneficios_simple, name='listar_beneficios_simple_direct'),
    path('api/voluntarios/asignaciones-beneficios/', beneficios_simple_views.listar_asignaciones_simple, name='listar_asignaciones_simple_direct'),
    path('api/voluntarios/crear-beneficio-simple/', beneficios_simple_views.crear_beneficio_simple, name='crear_beneficio_simple_direct'),
    path('api/voluntarios/<int:voluntario_id>/beneficios-asignados-simple/', beneficios_simple_views.beneficios_asignados_simple, name='beneficios_asignados_simple_direct'),
    path('api/voluntarios/pagar-beneficio-simple/', beneficios_simple_views.pagar_beneficio_simple, name='pagar_beneficio_simple_direct'),
    path('api/voluntarios/venta-extra-simple/', beneficios_simple_views.venta_extra_simple, name='venta_extra_simple_direct'),
    path('api/voluntarios/liberar-tarjetas-simple/', beneficios_simple_views.liberar_tarjetas_simple, name='liberar_tarjetas_simple_direct'),
    path('api/voluntarios/cerrar-beneficio-simple/', beneficios_simple_views.cerrar_beneficio_simple, name='cerrar_beneficio_simple_direct'),
    path('api/voluntarios/pagos-beneficios/', beneficios_simple_views.obtener_historial_pagos_simple, name='obtener_historial_pagos_simple'),

    # Rifas SIMPLE - SIN DRF
    path('api/voluntarios/rifas-simple/', rifa_views.rifas_simple, name='rifas_simple'),
    path('api/voluntarios/rifas-simple/<int:rifa_id>/', rifa_views.rifa_detalle_simple, name='rifa_detalle_simple'),
    path('api/voluntarios/asignar-numeros-rifa/', rifa_views.asignar_numeros_rifa, name='asignar_numeros_rifa'),
    path('api/voluntarios/pagar-rifa-simple/', rifa_views.pagar_rifa_simple, name='pagar_rifa_simple'),
    path('api/voluntarios/liberar-rifa-simple/', rifa_views.liberar_rifa_simple, name='liberar_rifa_simple'),
    path('api/voluntarios/cerrar-rifa-simple/<int:rifa_id>/', rifa_views.cerrar_rifa_simple, name='cerrar_rifa_simple'),
    path('api/voluntarios/<int:voluntario_id>/rifa-activa-simple/', rifa_views.rifa_activa_voluntario, name='rifa_activa_voluntario'),
    path('api/voluntarios/fondos-rifas-simple/', rifa_views.fondos_rifas_simple, name='fondos_rifas_simple'),
    
    # Deudores - Endpoints simplificados para tablas (SIN AUTENTICACIÓN)
    path('api/voluntarios/deudores-cuotas-listado/', deudores_views.listar_deudores_cuotas, name='deudores_cuotas_listado_direct'),
    path('api/voluntarios/deudores-beneficios-listado/', deudores_views.listar_deudores_beneficios, name='deudores_beneficios_listado_direct'),
    
    # Carga Masiva - Importación desde Excel (SIN AUTENTICACIÓN)
    path('api/voluntarios/descargar-plantilla-masiva/', carga_masiva_views.descargar_plantilla_masiva, name='descargar_plantilla_masiva_direct'),
    path('api/voluntarios/importar-masiva/', carga_masiva_views.importar_masiva, name='importar_masiva_direct'),
    
    # API REST (include de DRF)
    path('api/', include('voluntarios.urls')),
    
    # ==================== LOGIN PRIMERO ====================
    path('', template('index.html'), name='home'),  # Login principal
    
    # ==================== TEST DE AUTENTICACIÓN ====================
    # MOVIDOS A OBSOLETOS - 2025-11-25
    # path('test-auth.html', template('test_auth.html'), name='test_auth'),
    # path('sistema-debug.html', template('sistema_debug.html'), name='sistema_debug'),
    
    # ==================== SISTEMA PRINCIPAL ====================
    path('sistema.html', template('voluntarios/sistema.html'), name='sistema'),
    # path('dashboard.html', template('dashboard.html'), name='dashboard'),  # MOVIDO A OBSOLETOS 2025-11-25
    
    # ==================== VOLUNTARIOS ====================
    path('crear-bombero.html', template('voluntarios/crear-bombero.html'), name='crear_bombero'),
    path('editar-bombero.html', template('voluntarios/editar-bombero.html'), name='editar_bombero'),
    path('reintegracion-voluntario.html', template('voluntarios/reintegracion-voluntario.html'), name='reintegracion'),
    
    # ==================== ASISTENCIAS ====================
    # path('asistencias.html', template('asistencias.html'), name='asistencias'),  # MOVIDO A OBSOLETOS 2025-11-26
    path('registro-asistencia.html', template('asistencias/registro-asistencia.html'), name='registro_asistencia'),
    path('registro-asamblea.html', template('asistencias/registro-asamblea.html'), name='registro_asamblea'),
    path('registro-ejercicios.html', template('asistencias/registro-ejercicios.html'), name='registro_ejercicios'),
    path('registro-citaciones.html', template('asistencias/registro-citaciones.html'), name='registro_citaciones'),
    path('registro-otras.html', template('asistencias/registro-otras.html'), name='registro_otras'),
    path('historial-asistencias.html', template('asistencias/historial-asistencias.html'), name='historial_asistencias'),
    path('historial-emergencias.html', template('asistencias/historial-emergencias.html'), name='historial_emergencias'),
    path('detalle-asistencia.html', template('asistencias/detalle-asistencia.html'), name='detalle_asistencia'),
    path('reporte-asistencias-individual.html', template('asistencias/reporte-asistencias-individual.html'), name='reporte_asistencias'),
    
    # ==================== SANCIONES Y CARGOS ====================
    path('sanciones.html', template('sanciones/lista.html'), name='sanciones'),
    path('listado-sanciones.html', template('sanciones/listado.html'), name='listado_sanciones'),
    path('cargos.html', template('cargos/lista.html'), name='cargos'),
    path('registro-directorio.html', template('asistencias/registro-directorio.html'), name='registro_directorio'),
    path('felicitaciones.html', template('felicitaciones/lista.html'), name='felicitaciones'),
    
    # ==================== UNIFORMES ====================
    path('uniformes.html', template('uniformes/lista.html'), name='uniformes'),
    path('tabla-uniformes-voluntario.html', template('uniformes/tabla-voluntario.html'), name='tabla_uniformes'),
    
    # ==================== CARGA MASIVA ====================
    path('carga-masiva.html', template('voluntarios/carga-masiva.html'), name='carga_masiva'),
    
    # ==================== FINANZAS ====================
    path('cuotas-beneficios.html', template('tesoreria/cuotas-beneficios.html'), name='cuotas_beneficios'),
    path('deudores-cuotas.html', template('tesoreria/deudores-cuotas.html'), name='deudores_cuotas'),
    path('deudores-beneficios.html', template('tesoreria/deudores-beneficios.html'), name='deudores_beneficios'),
    path('beneficios.html', template('tesoreria/beneficios.html'), name='beneficios'),
    path('pagar-beneficio.html', template('tesoreria/pagar-beneficio.html'), name='pagar_beneficio'),
    path('finanzas.html', template('tesoreria/finanzas.html'), name='finanzas'),
    path('configurar-cuotas.html', template('tesoreria/configurar-cuotas.html'), name='configurar_cuotas'),
    path('solicitudes-pagos-portal.html', template('tesoreria/solicitudes-pagos-portal.html'), name='solicitudes_pagos_portal'),
    path('credenciales-portal-voluntarios.html', template('tesoreria/credenciales-portal-voluntarios.html'), name='credenciales_portal_voluntarios'),
    
    # ==================== ADMIN Y UTILIDADES ====================
    path('admin-ciclos.html', template('admin/admin-ciclos.html'), name='admin_ciclos'),
    path('admin-ciclos-cuotas.html', template('admin/ciclos-cuotas.html'), name='admin_ciclos_cuotas'),
    path('admin-ciclos-beneficios.html', template('admin/admin-ciclos-beneficios.html'), name='admin_ciclos_beneficios'),
    path('tipos-asistencia.html', template('asistencias/tipos-asistencia.html'), name='tipos_asistencia'),
    # HERRAMIENTAS ADMIN MOVIDAS A OBSOLETOS - 2025-11-25
    # path('generar-datos-prueba.html', template('generar-datos-prueba.html'), name='generar_datos'),
    # path('limpiar-datos.html', template('limpiar-datos.html'), name='limpiar_datos'),
    # path('debug-bomberos.html', template('debug-bomberos.html'), name='debug_bomberos'),
    # path('limpiar-ejemplos.html', template('limpiar-ejemplos.html'), name='limpiar_ejemplos'),
    # path('arreglar-ids-duplicados.html', template('arreglar-ids-duplicados.html'), name='arreglar_ids'),
    # path('arreglar-nombres.html', template('arreglar-nombres.html'), name='arreglar_nombres'),
    # path('limpiar-cargos-duplicados.html', template('limpiar-cargos-duplicados.html'), name='limpiar_cargos'),
    # path('verificar-asignaciones.html', template('verificar-asignaciones.html'), name='verificar_asignaciones'),
    path('cuentas-compania.html', template('tesoreria/cuentas-compania.html'), name='cuentas_compania'),
    path('rifas.html', template('tesoreria/rifas.html'), name='rifas'),
    path('rifa-entregar.html', template('tesoreria/rifa-entregar.html'), name='rifa_entregar'),
    path('reasignar-beneficios-manual.html', template('tesoreria/reasignar-beneficios-manual.html'), name='reasignar_beneficios'),
    path('test-ranking-externos.html', template('asistencias/test-ranking-externos.html'), name='test_ranking'),
    path('portal/', template('portal_voluntario/login.html'), name='portal_login_page'),
    path('portal/panel/', template('portal_voluntario/panel.html'), name='portal_panel_page'),
]

# Servir archivos estáticos en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0] if settings.STATICFILES_DIRS else settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
