"""
ViewSets y endpoints de API para el módulo de Tesorería
Convierte las llamadas localStorage del P6P a endpoints REST
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from decimal import Decimal
from .models import (
    Voluntario,
    ConfiguracionCuotas, EstadoCuotasBombero, PagoCuota,
    Beneficio, AsignacionBeneficio, PagoBeneficio, MovimientoFinanciero,
    CicloCuotas
)
from .serializers import (
    ConfiguracionCuotasSerializer, EstadoCuotasBomberoSerializer,
    PagoCuotaSerializer, CrearPagoCuotaSerializer,
    BeneficioSerializer,
    AsignacionBeneficioSerializer,
    PagoBeneficioSerializer, CrearPagoBeneficioSerializer,
    MovimientoFinancieroSerializer,
    ActivarEstudianteSerializer, DesactivarCuotasSerializer, LiberarTarjetasSerializer,
    CicloCuotasSerializer, SubirDocumentoEstudianteSerializer
)
from .utils_tesoreria import (
    puede_pagar_cuotas, calcular_deuda_cuotas, calcular_deudores_cuotas,
    registrar_pago_cuota, activar_estudiante, desactivar_estudiante,
    desactivar_cuotas_voluntario, reactivar_cuotas_voluntario,
    crear_beneficio_con_asignaciones, registrar_pago_beneficio,
    liberar_tarjetas, calcular_saldo_compania, obtener_estadisticas_beneficio,
    obtener_precio_cuota, calcular_deudores_beneficio, puede_cerrar_beneficio
)
from .permissions import PermisosPorModulo


class ConfiguracionCuotasViewSet(viewsets.ModelViewSet):
    """
    API para configuración de precios de cuotas
    Solo puede existir una instancia (Singleton)
    """
    queryset = ConfiguracionCuotas.objects.all()
    serializer_class = ConfiguracionCuotasSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cuotas'
    
    def get_queryset(self):
        # Asegurar que siempre exista una instancia
        if not ConfiguracionCuotas.objects.exists():
            ConfiguracionCuotas.objects.create(
                precio_regular=Decimal('5000'),
                precio_estudiante=Decimal('3000')
            )
        return ConfiguracionCuotas.objects.all()
    
    def perform_update(self, serializer):
        serializer.save(actualizado_por=self.request.user)
    
    def create(self, request, *args, **kwargs):
        # No permitir crear más de una instancia
        if ConfiguracionCuotas.objects.exists():
            return Response(
                {'error': 'Ya existe una configuración. Use PUT para actualizar.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)


class EstadoCuotasBomberoViewSet(viewsets.ModelViewSet):
    """
    API para estados de cuotas de voluntarios
    """
    queryset = EstadoCuotasBombero.objects.all()
    serializer_class = EstadoCuotasBomberoSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cuotas'
    acciones_permisos = {
        'activar_estudiante': 'edit',
        'desactivar_estudiante_action': 'edit',
        'desactivar_cuotas': 'edit',
        'reactivar_cuotas_action': 'edit',
    }
    
    def get_queryset(self):
        queryset = EstadoCuotasBombero.objects.select_related('voluntario').all()
        
        # Filtros opcionales
        voluntario_id = self.request.query_params.get('voluntario_id')
        if voluntario_id:
            queryset = queryset.filter(voluntario_id=voluntario_id)
        
        es_estudiante = self.request.query_params.get('es_estudiante')
        if es_estudiante is not None:
            queryset = queryset.filter(es_estudiante=es_estudiante.lower() == 'true')
        
        cuotas_desactivadas = self.request.query_params.get('cuotas_desactivadas')
        if cuotas_desactivadas is not None:
            queryset = queryset.filter(cuotas_desactivadas=cuotas_desactivadas.lower() == 'true')
        
        return queryset
    
    @action(detail=False, methods=['post'], url_path='activar-estudiante')
    def activar_estudiante(self, request):
        """Activa el estado de estudiante para un voluntario"""
        serializer = ActivarEstudianteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            estado = activar_estudiante(
                serializer.validated_data['voluntario_id'],
                {
                    'fecha_activacion': serializer.validated_data.get('fecha_activacion'),
                    'observaciones': serializer.validated_data.get('observaciones')
                },
                request.user
            )
            return Response(
                EstadoCuotasBomberoSerializer(estado).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='desactivar-estudiante')
    def desactivar_estudiante_action(self, request, pk=None):
        """Desactiva el estado de estudiante"""
        try:
            estado = desactivar_estudiante(pk)
            if estado:
                return Response(
                    EstadoCuotasBomberoSerializer(estado).data,
                    status=status.HTTP_200_OK
                )
            return Response(
                {'error': 'No se encontró el estado de cuotas'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'], url_path='desactivar-cuotas')
    def desactivar_cuotas(self, request):
        """Desactiva las cuotas de un voluntario"""
        serializer = DesactivarCuotasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            estado = desactivar_cuotas_voluntario(
                serializer.validated_data['voluntario_id'],
                serializer.validated_data['motivo'],
                request.user
            )
            return Response(
                EstadoCuotasBomberoSerializer(estado).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='reactivar-cuotas')
    def reactivar_cuotas_action(self, request, pk=None):
        """Reactiva las cuotas de un voluntario"""
        try:
            estado = reactivar_cuotas_voluntario(pk)
            if estado:
                return Response(
                    EstadoCuotasBomberoSerializer(estado).data,
                    status=status.HTTP_200_OK
                )
            return Response(
                {'error': 'No se encontró el estado de cuotas'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@method_decorator(csrf_exempt, name='dispatch')
class PagoCuotaViewSet(viewsets.ModelViewSet):
    """
    API para pagos de cuotas mensuales - SIN AUTENTICACIÓN (desarrollo)
    """
    queryset = PagoCuota.objects.all()
    serializer_class = PagoCuotaSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cuotas'
    acciones_permisos = {
        'deuda_voluntario': 'view',
    }
    
    def get_queryset(self):
        queryset = PagoCuota.objects.select_related('voluntario', 'created_by').all()
        
        # Filtros
        voluntario_id = self.request.query_params.get('voluntario_id')
        if voluntario_id:
            queryset = queryset.filter(voluntario_id=voluntario_id)
        
        mes = self.request.query_params.get('mes')
        if mes:
            queryset = queryset.filter(mes=mes)
        
        anio = self.request.query_params.get('anio')
        if anio:
            queryset = queryset.filter(anio=anio)
        
        return queryset.order_by('-anio', '-mes', '-fecha_pago')
    
    def create(self, request, *args, **kwargs):
        """Crea un pago de cuota y el movimiento financiero automático"""
        serializer = CrearPagoCuotaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            # Obtener usuario si está autenticado, sino None
            user = request.user if request.user.is_authenticated else None
            
            pago = registrar_pago_cuota(
                serializer.validated_data['voluntario_id'],
                serializer.validated_data['mes'],
                serializer.validated_data['anio'],
                serializer.validated_data['monto'],
                {
                    'fecha_pago': serializer.validated_data.get('fecha_pago'),
                    'metodo_pago': serializer.validated_data.get('metodo_pago'),
                    'numero_comprobante': serializer.validated_data.get('numero_comprobante'),
                    'observaciones': serializer.validated_data.get('observaciones')
                },
                user
            )
            return Response(
                PagoCuotaSerializer(pago).data,
                status=status.HTTP_201_CREATED
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error al registrar pago: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='deuda/(?P<voluntario_id>[^/.]+)')
    def deuda_voluntario(self, request, voluntario_id=None):
        """Calcula la deuda de un voluntario específico"""
        anio = request.query_params.get('anio')
        if anio:
            anio = int(anio)
        
        try:
            voluntario = Voluntario.objects.get(id=voluntario_id)
            validacion = puede_pagar_cuotas(voluntario)
            
            if not validacion['puede']:
                return Response({
                    'puede_pagar': False,
                    'mensaje': validacion['mensaje'],
                    'tipo': validacion['tipo'],
                    'deuda': 0,
                    'meses_pendientes': []
                })
            
            deuda = calcular_deuda_cuotas(voluntario, anio)
            precio = obtener_precio_cuota(voluntario)
            
            return Response({
                'puede_pagar': True,
                'deuda': deuda['monto'],
                'meses_pendientes': deuda['meses_pendientes'],
                'precio_cuota': precio
            })
        except Voluntario.DoesNotExist:
            return Response(
                {'error': 'Voluntario no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )


class FinanzasViewSet(viewsets.ViewSet):
    """
    Endpoints especiales para finanzas (saldo, deudores, etc.)
    """
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'finanzas'
    acciones_permisos = {
        'saldo_compania': 'view',
        'deudores_cuotas': 'view',
    }
    
    @action(detail=False, methods=['get'], url_path='saldo-compania')
    def saldo_compania(self, request):
        """Calcula el saldo actual de la compañía"""
        saldo_info = calcular_saldo_compania()
        return Response(saldo_info)
    
    @action(detail=False, methods=['get'], url_path='deudores-cuotas')
    def deudores_cuotas(self, request):
        """Lista de deudores de cuotas mensuales"""
        anio = request.query_params.get('anio')
        if anio:
            anio = int(anio)
        
        deudores = calcular_deudores_cuotas(anio)
        
        # Serializar la respuesta
        resultado = []
        for d in deudores:
            resultado.append({
                'voluntario': {
                    'id': d['voluntario'].id,
                    'nombre_completo': d['voluntario'].nombre_completo(),
                    'clave_bombero': d['voluntario'].clave_bombero
                },
                'monto': str(d['monto']),
                'precio_cuota': str(d['precio_cuota']),
                'cantidad_meses': len(d['meses_pendientes']),
                'meses_pendientes': d['meses_pendientes']
            })
        
        return Response({
            'total_deudores': len(resultado),
            'deudores': resultado
        })


class BeneficioViewSet(viewsets.ModelViewSet):
    """
    API para beneficios (eventos con tarjetas)
    """
    queryset = Beneficio.objects.all()
    serializer_class = BeneficioSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'beneficios'
    acciones_permisos = {
        'estadisticas': 'view',
        'deudores': 'view',
        'cerrar': 'edit',
    }
    
    def get_queryset(self):
        queryset = Beneficio.objects.all()
        
        # Filtros
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
        
        return queryset.order_by('-fecha_evento')
    
    def create(self, request, *args, **kwargs):
        """Crea un beneficio y asigna automáticamente a todos los voluntarios"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            beneficio, asignaciones = crear_beneficio_con_asignaciones(
                serializer.validated_data,
                request.user
            )
            return Response(
                {
                    'beneficio': BeneficioSerializer(beneficio).data,
                    'total_asignaciones': len(asignaciones)
                },
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {'error': f'Error al crear beneficio: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request, pk=None):
        """Obtiene estadísticas completas del beneficio"""
        try:
            stats = obtener_estadisticas_beneficio(pk)
            return Response({
                'beneficio': BeneficioSerializer(stats['beneficio']).data,
                'total_asignaciones': stats['total_asignaciones'],
                'total_tarjetas_asignadas': stats['total_tarjetas_asignadas'],
                'total_tarjetas_vendidas': stats['total_tarjetas_vendidas'],
                'total_tarjetas_extras': stats['total_tarjetas_extras'],
                'total_tarjetas_liberadas': stats['total_tarjetas_liberadas'],
                'monto_total_esperado': str(stats['monto_total_esperado']),
                'monto_recaudado': str(stats['monto_recaudado']),
                'monto_pendiente': str(stats['monto_pendiente']),
                'porcentaje_recaudado': float(stats['porcentaje_recaudado']),
                'estados': stats['estados'],
                'puede_cerrar': stats['puede_cerrar']
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'], url_path='deudores')
    def deudores(self, request, pk=None):
        """Lista de deudores del beneficio"""
        deudores = calcular_deudores_beneficio(pk)
        
        resultado = []
        for d in deudores:
            resultado.append({
                'voluntario': {
                    'id': d['voluntario'].id,
                    'nombre_completo': d['voluntario'].nombre_completo(),
                    'clave_bombero': d['voluntario'].clave_bombero
                },
                'tarjetas_asignadas': d['tarjetas_asignadas'],
                'tarjetas_vendidas': d['tarjetas_vendidas'],
                'tarjetas_disponibles': d['tarjetas_disponibles'],
                'monto_total': str(d['monto_total']),
                'monto_pagado': str(d['monto_pagado']),
                'monto_pendiente': str(d['monto_pendiente'])
            })
        
        return Response({
            'total_deudores': len(resultado),
            'deudores': resultado
        })
    
    @action(detail=True, methods=['post'], url_path='cerrar')
    def cerrar(self, request, pk=None):
        """Cierra un beneficio (solo si no hay deudores)"""
        if not puede_cerrar_beneficio(pk):
            return Response(
                {'error': 'No se puede cerrar el beneficio. Hay deudores pendientes.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            beneficio = self.get_object()
            beneficio.estado = 'cerrado'
            beneficio.save()
            return Response(
                BeneficioSerializer(beneficio).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class AsignacionBeneficioViewSet(viewsets.ModelViewSet):
    """
    API para asignaciones de beneficios a voluntarios
    """
    queryset = AsignacionBeneficio.objects.all()
    serializer_class = AsignacionBeneficioSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'beneficios'
    acciones_permisos = {
        'liberar_tarjetas_action': 'edit',
    }
    
    def get_queryset(self):
        queryset = AsignacionBeneficio.objects.select_related(
            'beneficio', 'voluntario', 'created_by'
        ).all()
        
        # Filtros
        beneficio_id = self.request.query_params.get('beneficio_id')
        if beneficio_id:
            queryset = queryset.filter(beneficio_id=beneficio_id)
        
        voluntario_id = self.request.query_params.get('voluntario_id')
        if voluntario_id:
            queryset = queryset.filter(voluntario_id=voluntario_id)
        
        estado_pago = self.request.query_params.get('estado_pago')
        if estado_pago:
            queryset = queryset.filter(estado_pago=estado_pago)
        
        return queryset.order_by('-beneficio__fecha_evento', 'voluntario__clave_bombero')
    
    @action(detail=False, methods=['post'], url_path='liberar-tarjetas')
    def liberar_tarjetas_action(self, request):
        """Libera tarjetas de una asignación"""
        serializer = LiberarTarjetasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            asignacion = liberar_tarjetas(
                serializer.validated_data['asignacion_id'],
                serializer.validated_data['cantidad'],
                serializer.validated_data['motivo'],
                request.user
            )
            return Response(
                AsignacionBeneficioSerializer(asignacion).data,
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error al liberar tarjetas: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PagoBeneficioViewSet(viewsets.ModelViewSet):
    """
    API para pagos de beneficios (normales y extras)
    """
    queryset = PagoBeneficio.objects.all()
    serializer_class = PagoBeneficioSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'beneficios'
    
    def get_queryset(self):
        queryset = PagoBeneficio.objects.select_related(
            'asignacion', 'asignacion__voluntario', 'asignacion__beneficio', 'created_by'
        ).all()
        
        # Filtros
        asignacion_id = self.request.query_params.get('asignacion_id')
        if asignacion_id:
            queryset = queryset.filter(asignacion_id=asignacion_id)
        
        tipo_pago = self.request.query_params.get('tipo_pago')
        if tipo_pago:
            queryset = queryset.filter(tipo_pago=tipo_pago)
        
        return queryset.order_by('-fecha_pago')
    
    def create(self, request, *args, **kwargs):
        """Crea un pago de beneficio y el movimiento financiero automático"""
        serializer = CrearPagoBeneficioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            pago = registrar_pago_beneficio(
                serializer.validated_data['asignacion_id'],
                serializer.validated_data['tipo_pago'],
                serializer.validated_data['cantidad_tarjetas'],
                serializer.validated_data['monto'],
                {
                    'fecha_pago': serializer.validated_data.get('fecha_pago'),
                    'metodo_pago': serializer.validated_data.get('metodo_pago'),
                    'numero_comprobante': serializer.validated_data.get('numero_comprobante'),
                    'observaciones': serializer.validated_data.get('observaciones')
                },
                request.user
            )
            return Response(
                PagoBeneficioSerializer(pago).data,
                status=status.HTTP_201_CREATED
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Error al registrar pago: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MovimientoFinancieroViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API de solo lectura para movimientos financieros
    Los movimientos se crean automáticamente con los pagos
    """
    queryset = MovimientoFinanciero.objects.all()
    serializer_class = MovimientoFinancieroSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'finanzas'
    
    def get_queryset(self):
        queryset = MovimientoFinanciero.objects.select_related(
            'created_by',
            'cuenta_bancaria',
            'pago_cuota',
            'pago_cuota__voluntario',
            'pago_beneficio',
            'pago_beneficio__asignacion',
            'pago_beneficio__asignacion__voluntario',
            'pago_rifa',
            'pago_rifa__asignacion',
            'pago_rifa__asignacion__voluntario',
        ).all()
        
        # Filtros
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        
        categoria = self.request.query_params.get('categoria')
        if categoria:
            queryset = queryset.filter(categoria=categoria)
        
        fecha_desde = self.request.query_params.get('fecha_desde')
        if fecha_desde:
            queryset = queryset.filter(fecha__gte=fecha_desde)
        
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_hasta:
            queryset = queryset.filter(fecha__lte=fecha_hasta)
        
        return queryset.order_by('-fecha', '-created_at')


class CicloCuotasViewSet(viewsets.ModelViewSet):
    """
    API para gestión de ciclos de cuotas anuales
    Similar a CicloAsistencia pero para cuotas
    """
    queryset = CicloCuotas.objects.all()
    serializer_class = CicloCuotasSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cuotas'
    acciones_permisos = {
        'activar': 'edit',
        'cerrar': 'edit',
        'reabrir': 'edit',
        'estadisticas': 'view',
    }
    
    def get_queryset(self):
        queryset = CicloCuotas.objects.all()
        
        # Filtros
        activo = self.request.query_params.get('activo')
        if activo is not None:
            queryset = queryset.filter(activo=activo.lower() == 'true')
        
        cerrado = self.request.query_params.get('cerrado')
        if cerrado is not None:
            queryset = queryset.filter(cerrado=cerrado.lower() == 'true')
        
        anio = self.request.query_params.get('anio')
        if anio:
            queryset = queryset.filter(anio=anio)
        
        return queryset.order_by('-anio')
    
    def perform_create(self, serializer):
        # Asignar usuario si está autenticado
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(created_by=user)
    
    @action(detail=True, methods=['post'], url_path='activar')
    def activar(self, request, pk=None):
        """Activa este ciclo y desactiva los demás"""
        try:
            ciclo = self.get_object()
            
            # Desactivar todos los demás
            CicloCuotas.objects.exclude(pk=ciclo.pk).update(activo=False)
            
            # Activar este
            ciclo.activo = True
            ciclo.save()
            
            return Response(
                CicloCuotasSerializer(ciclo).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='cerrar')
    def cerrar(self, request, pk=None):
        """Cierra el ciclo (no se pueden registrar más pagos)"""
        try:
            ciclo = self.get_object()
            
            if ciclo.cerrado:
                return Response(
                    {'error': 'El ciclo ya está cerrado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Cerrar ciclo
            from django.utils import timezone
            ciclo.cerrado = True
            ciclo.fecha_cierre = timezone.now()
            ciclo.activo = False
            if request.user.is_authenticated:
                ciclo.cerrado_por = request.user
            ciclo.save()
            
            return Response(
                CicloCuotasSerializer(ciclo).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], url_path='reabrir')
    def reabrir(self, request, pk=None):
        """Reabre un ciclo cerrado"""
        try:
            ciclo = self.get_object()
            
            ciclo.cerrado = False
            ciclo.fecha_cierre = None
            ciclo.cerrado_por = None
            ciclo.save()
            
            return Response(
                CicloCuotasSerializer(ciclo).data,
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request, pk=None):
        """Obtiene estadísticas detalladas del ciclo"""
        try:
            ciclo = self.get_object()
            from django.db.models import Sum, Count, Q
            
            # Pagos del año
            pagos = PagoCuota.objects.filter(anio=ciclo.anio)
            
            total_pagos = pagos.count()
            total_recaudado = pagos.aggregate(total=Sum('monto_pagado'))['total'] or Decimal('0')
            
            # Voluntarios únicos que pagaron
            voluntarios_pagaron = pagos.values('voluntario').distinct().count()
            
            # Total de voluntarios activos (que deberían pagar)
            from .utils_tesoreria import puede_pagar_cuotas
            voluntarios_activos = Voluntario.objects.filter(
                estado_bombero='activo'
            ).count()
            
            return Response({
                'ciclo': CicloCuotasSerializer(ciclo).data,
                'total_pagos': total_pagos,
                'total_recaudado': float(total_recaudado),
                'voluntarios_que_pagaron': voluntarios_pagaron,
                'voluntarios_activos': voluntarios_activos,
                'porcentaje_cumplimiento': round((voluntarios_pagaron / voluntarios_activos * 100), 2) if voluntarios_activos > 0 else 0
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class EstadoCuotasBomberoViewSetExtended(EstadoCuotasBomberoViewSet):
    """
    Extensión del ViewSet de EstadoCuotasBombero para agregar funcionalidades
    """
    
    @action(detail=False, methods=['post'], url_path='subir-documento-estudiante')
    def subir_documento_estudiante(self, request):
        """Sube el certificado de alumno regular en Base64"""
        serializer = SubirDocumentoEstudianteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            voluntario = Voluntario.objects.get(id=serializer.validated_data['voluntario_id'])
            
            # Obtener o crear estado de cuotas
            estado, created = EstadoCuotasBombero.objects.get_or_create(
                voluntario=voluntario
            )
            
            # Guardar documento
            estado.documento_estudiante = serializer.validated_data['documento_base64']
            if serializer.validated_data.get('observaciones'):
                estado.observaciones_estudiante = serializer.validated_data['observaciones']
            estado.save()
            
            return Response(
                {
                    'mensaje': 'Documento subido exitosamente',
                    'estado': EstadoCuotasBomberoSerializer(estado).data
                },
                status=status.HTTP_200_OK
            )
        except Voluntario.DoesNotExist:
            return Response(
                {'error': 'Voluntario no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Error al subir documento: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
