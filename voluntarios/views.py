from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from datetime import datetime, date

from .models import (
    Voluntario, Cargo, Sancion, Felicitacion,
    TipoAsistencia, Asistencia,
    EventoAsistencia, DetalleAsistencia, VoluntarioExterno,
    RankingAsistencia, CicloAsistencia,
    Uniforme, PiezaUniforme, ContadorUniformes, Cuota, PagoCuota,
    Beneficio, AsignacionBeneficio, PagoBeneficio,
    LogoCompania
)

from .serializers import (
    VoluntarioSerializer, VoluntarioListSerializer,
    CargoSerializer, FelicitacionSerializer, UserSerializer,
    EventoAsistenciaSerializer, EventoAsistenciaListSerializer,
    DetalleAsistenciaSerializer, VoluntarioExternoSerializer,
    RankingAsistenciaSerializer, CicloAsistenciaSerializer,
    UniformeSerializer, CrearUniformeSerializer, PiezaUniformeSerializer,
    CuotaSerializer, PagoCuotaSerializer,
    BeneficioSerializer, AsignacionBeneficioSerializer, PagoBeneficioSerializer,
    LogoCompaniaSerializer
)

# Importar serializers de sanciones desde el archivo dedicado
from .sancion_serializers import SancionSerializer, ReintegroSerializer
from .permissions import PermisosPorModulo, obtener_rol_usuario


# ==================== VOLUNTARIOS ====================

class VoluntarioViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Voluntarios
    """
    queryset = Voluntario.objects.all()
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'voluntarios'
    acciones_permisos = {
        'activos': 'view',
        'por_estado': 'view',
        'estadisticas': 'view',
        'reintegrar': 'edit',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estado_bombero', 'compania', 'cuotas_activas', 'es_estudiante']
    search_fields = ['nombre', 'apellido_paterno', 'apellido_materno', 'rut', 'clave_bombero']
    ordering_fields = ['fecha_ingreso', 'clave_bombero', 'nombre', 'apellido_paterno']
    ordering = ['fecha_ingreso']

    def get_serializer_class(self):
        # Siempre usar VoluntarioSerializer para compatibilidad con p6p
        return VoluntarioSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def activos(self, request):
        """Retorna solo voluntarios activos"""
        voluntarios = self.queryset.filter(estado_bombero='activo')
        serializer = self.get_serializer(voluntarios, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def por_estado(self, request):
        """Retorna voluntarios filtrados por estado"""
        estado = request.query_params.get('estado', None)
        if estado:
            voluntarios = self.queryset.filter(estado_bombero=estado)
            serializer = self.get_serializer(voluntarios, many=True)
            return Response(serializer.data)
        return Response({'error': 'ParÃ¡metro estado requerido'}, status=400)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Retorna estadÃ­sticas generales de voluntarios"""
        total = self.queryset.count()
        por_estado = {}
        for estado, _ in Voluntario.ESTADO_CHOICES:
            por_estado[estado] = self.queryset.filter(estado_bombero=estado).count()

        return Response({
            'total': total,
            'por_estado': por_estado,
            'con_cuotas_activas': self.queryset.filter(cuotas_activas=True).count(),
            'estudiantes': self.queryset.filter(es_estudiante=True).count(),
        })

    @action(detail=True, methods=['post'])
    def reintegrar(self, request, pk=None):
        """
        Reintegra un voluntario renunciado o separado
        """
        voluntario = self.get_object()

        # Validar que puede reintegrarse
        puede, mensaje = voluntario.puede_reintegrarse()
        if not puede:
            return Response({'error': mensaje}, status=status.HTTP_400_BAD_REQUEST)

        # Obtener datos de la solicitud
        padrino1 = request.data.get('padrino1')
        padrino2 = request.data.get('padrino2')
        fecha_reintegracion = request.data.get('fecha_reintegracion')
        observaciones = request.data.get('observaciones', '')

        # Validar campos requeridos
        if not padrino1 or not padrino2 or not fecha_reintegracion:
            return Response({
                'error': 'padrino1, padrino2 y fecha_reintegracion son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Guardar estado anterior
        estado_anterior = voluntario.estado_bombero

        # Actualizar voluntario
        voluntario.estado_bombero = 'activo'
        voluntario.antiguedad_congelada = False
        voluntario.fecha_descongelamiento = fecha_reintegracion

        # Agregar a historial de estados
        historial_estados = voluntario.historial_estados or []
        historial_estados.append({
            'estado_anterior': estado_anterior,
            'estado_nuevo': 'activo',
            'fecha': fecha_reintegracion,
            'motivo': 'ReintegraciÃ³n formal',
            'registrado_por': request.user.username
        })
        voluntario.historial_estados = historial_estados

        # Agregar a historial de reintegraciones
        historial_reintegraciones = voluntario.historial_reintegraciones or []
        historial_reintegraciones.append({
            'fecha_reintegracion': fecha_reintegracion,
            'estado_anterior': estado_anterior,
            'nombre_padrino1': padrino1,
            'nombre_padrino2': padrino2,
            'observaciones': observaciones,
            'registrado_por': request.user.username
        })
        voluntario.historial_reintegraciones = historial_reintegraciones

        voluntario.save()

        serializer = self.get_serializer(voluntario)
        return Response(serializer.data)


# ==================== CARGOS ====================

class CargoViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Cargos
    """
    queryset = Cargo.objects.all()
    serializer_class = CargoSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cargos'
    acciones_permisos = {
        'por_voluntario': 'view',
        'por_anio': 'view',
        'estadisticas': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo_cargo', 'anio', 'voluntario']
    search_fields = ['nombre_cargo', 'voluntario__nombre', 'voluntario__apellido_paterno']
    ordering_fields = ['anio', 'fecha_inicio', 'nombre_cargo']
    ordering = ['-anio', '-fecha_inicio']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def por_voluntario(self, request):
        """Retorna cargos de un voluntario especÃ­fico"""
        voluntario_id = request.query_params.get('voluntario_id')
        if voluntario_id:
            cargos = self.queryset.filter(voluntario_id=voluntario_id)
            serializer = self.get_serializer(cargos, many=True)
            return Response(serializer.data)
        return Response({'error': 'voluntario_id requerido'}, status=400)

    @action(detail=False, methods=['get'])
    def por_anio(self, request):
        """Retorna cargos de un aÃ±o especÃ­fico"""
        anio = request.query_params.get('anio')
        if anio:
            cargos = self.queryset.filter(anio=anio)
            serializer = self.get_serializer(cargos, many=True)
            return Response(serializer.data)
        return Response({'error': 'anio requerido'}, status=400)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Retorna estadÃ­sticas de cargos"""
        anio = request.query_params.get('anio', timezone.now().year)
        cargos_anio = self.queryset.filter(anio=anio)

        por_tipo = {}
        for tipo, _ in Cargo.TIPO_CARGO_CHOICES:
            por_tipo[tipo] = cargos_anio.filter(tipo_cargo=tipo).count()

        return Response({
            'anio': anio,
            'total': cargos_anio.count(),
            'por_tipo': por_tipo,
        })


# ==================== SANCIONES ====================
# NOTA: SancionViewSet se moviÃ³ a sancion_views.py para incluir lÃ³gica de cambio de estado
# Esta versiÃ³n estÃ¡ comentada para evitar conflictos

# class SancionViewSet(viewsets.ModelViewSet):
#     """
#     API endpoints para Sanciones
#     """
#     queryset = Sancion.objects.all()
#     serializer_class = SancionSerializer
#     permission_classes = [IsAuthenticated]
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
#     filterset_fields = ['tipo_sancion', 'voluntario', 'fecha_desde']
#     search_fields = ['tipo_sancion', 'voluntario__nombre', 'voluntario__apellido_paterno', 'motivo']
#     ordering_fields = ['fecha_desde', 'fecha_hasta', 'fecha_oficio']
#     ordering = ['-fecha_desde']

#     def perform_create(self, serializer):
#         serializer.save(created_by=self.request.user)
#
#     @action(detail=False, methods=['get'])
#     def por_voluntario(self, request):
#         """Retorna sanciones de un voluntario especÃ­fico"""
#         voluntario_id = request.query_params.get('voluntario_id')
#         if voluntario_id:
#             sanciones = self.queryset.filter(voluntario_id=voluntario_id)
#             serializer = self.get_serializer(sanciones, many=True)
#             return Response(serializer.data)
#         return Response({'error': 'voluntario_id requerido'}, status=400)
#
#     @action(detail=False, methods=['get'])
#     def activas(self, request):
#         """Retorna sanciones activas (sin fecha de tÃ©rmino o con fecha futura)"""
#         hoy = date.today()
#         sanciones = self.queryset.filter(
#             Q(fecha_hasta__isnull=True) | Q(fecha_hasta__gte=hoy)
#         )
#         serializer = self.get_serializer(sanciones, many=True)
#         return Response(serializer.data)
#
#     @action(detail=False, methods=['get'])
#     def estadisticas(self, request):
#         """Retorna estadÃ­sticas de sanciones"""
#         total = self.queryset.count()
#         por_tipo = {}
#         for tipo, _ in Sancion.TIPO_SANCION_CHOICES:
#             por_tipo[tipo] = self.queryset.filter(tipo_sancion=tipo).count()
#
#         return Response({
#             'total': total,
#             'por_tipo': por_tipo,
#         })


# ==================== FELICITACIONES ====================

class FelicitacionViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Felicitaciones
    """
    queryset = Felicitacion.objects.all()
    serializer_class = FelicitacionSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'felicitaciones'
    acciones_permisos = {
        'por_voluntario': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['voluntario', 'tipo_felicitacion', 'fecha_felicitacion']
    search_fields = ['motivo', 'nombre_felicitacion', 'autoridad_otorgante', 'voluntario__nombre']
    ordering_fields = ['fecha_felicitacion', 'created_at']
    ordering = ['-fecha_felicitacion']

    def perform_create(self, serializer):
        print(f"[FELICITACIONES] Guardando felicitaciÃ³n para usuario: {self.request.user}")
        print(f"[FELICITACIONES] Datos recibidos: {self.request.data}")
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def por_voluntario(self, request):
        """Retorna felicitaciones de un voluntario especÃ­fico"""
        voluntario_id = request.query_params.get('voluntario_id')
        if voluntario_id:
            felicitaciones = self.queryset.filter(voluntario_id=voluntario_id)
            serializer = self.get_serializer(felicitaciones, many=True)
            return Response(serializer.data)
        return Response({'error': 'voluntario_id requerido'}, status=400)


# ==================== ASISTENCIAS BÃSICAS ====================
# TODO: Crear serializers para estos modelos

# class TipoAsistenciaViewSet(viewsets.ModelViewSet):
#     """
#     API endpoints para Tipos de Asistencia
#     """
#     queryset = TipoAsistencia.objects.all()
#     serializer_class = TipoAsistenciaSerializer
#     permission_classes = [IsAuthenticated]
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
#     filterset_fields = ['activo']
#     search_fields = ['nombre', 'descripcion']
#     ordering_fields = ['nombre']
#     ordering = ['nombre']


# class AsistenciaViewSet(viewsets.ModelViewSet):
#     """
#     API endpoints para Asistencias bÃ¡sicas
#     """
#     queryset = Asistencia.objects.all()
#     serializer_class = AsistenciaSerializer
#     permission_classes = [IsAuthenticated]
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
#     filterset_fields = ['voluntario', 'tipo_asistencia', 'presente', 'justificada', 'fecha_hora']
#     search_fields = ['voluntario__nombre', 'observaciones']
#     ordering_fields = ['fecha_hora']
#     ordering = ['-fecha_hora']
#
#     def perform_create(self, serializer):
#         serializer.save(created_by=self.request.user)
#
#     @action(detail=False, methods=['get'])
#     def por_voluntario(self, request):
#         """Retorna asistencias de un voluntario especÃ­fico"""
#         voluntario_id = request.query_params.get('voluntario_id')
#         if voluntario_id:
#             asistencias = self.queryset.filter(voluntario_id=voluntario_id)
#             serializer = self.get_serializer(asistencias, many=True)
#             return Response(serializer.data)
#         return Response({'error': 'voluntario_id requerido'}, status=400)


# ==================== UNIFORMES ====================

class UniformeViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Uniformes con filtrado por rol
    """
    serializer_class = UniformeSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'uniformes'
    acciones_permisos = {
        'devolver_pieza': 'edit',
        'actualizar_pieza': 'edit',
        'por_voluntario': 'view',
        'generar_pdf': 'view',
        'generar_pdf_devolucion': 'view',
        'generar_tabla_uniformes': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo_uniforme', 'estado', 'bombero']
    search_fields = ['id', 'observaciones', 'bombero__nombre', 'bombero__apellido_paterno']
    ordering_fields = ['fecha_registro', 'tipo_uniforme']
    ordering = ['-fecha_registro']
    
    def get_queryset(self):
        """Filtra uniformes segÃºn rol del usuario"""
        user = self.request.user
        queryset = Uniforme.objects.all()
        
        rol = obtener_rol_usuario(user)
        if rol == 'Tesorero':
            queryset = queryset.filter(tipo_uniforme__in=['accesorios', 'tenidaCuartel'])
        elif rol == 'Director':
            queryset = queryset.filter(tipo_uniforme='parada')
        elif rol in ['Capitán', 'Ayudante']:
            tipos_permitidos = ['estructural', 'forestal', 'rescate', 'hazmat',
                               'usar', 'agreste', 'um6', 'gersa']
            queryset = queryset.filter(tipo_uniforme__in=tipos_permitidos)
        
        return queryset.select_related('bombero').prefetch_related('piezas')
    
    def get_serializer_class(self):
        """Usa CrearUniformeSerializer para creaciÃ³n"""
        if self.action == 'create':
            return CrearUniformeSerializer
        return UniformeSerializer
    
    @action(detail=True, methods=['post'])
    def devolver_pieza(self, request, pk=None):
        """Devuelve una pieza individual"""
        from django.utils import timezone
        from .models import PiezaUniforme
        
        pieza_id = request.data.get('pieza_id')
        if not pieza_id:
            return Response({'error': 'pieza_id requerido'}, status=400)
        
        try:
            pieza = PiezaUniforme.objects.get(id=pieza_id, uniforme_id=pk)
        except PiezaUniforme.DoesNotExist:
            return Response({'error': 'Pieza no encontrada'}, status=404)
        
        # Validar campos obligatorios
        if not request.data.get('estado_devolucion'):
            return Response({'error': 'estado_devolucion es obligatorio'}, status=400)
        if not request.data.get('condicion_devolucion'):
            return Response({'error': 'condicion_devolucion es obligatoria'}, status=400)
        
        # Actualizar pieza
        pieza.estado_pieza = 'devuelto'
        pieza.fecha_devolucion = timezone.now()
        pieza.devuelto_por = request.user.username
        pieza.estado_devolucion = request.data['estado_devolucion']
        pieza.condicion_devolucion = request.data['condicion_devolucion']
        pieza.observaciones_devolucion = request.data.get('observaciones_devolucion', '')
        pieza.save()
        
        # Verificar si todas las piezas estÃ¡n devueltas
        uniforme = pieza.uniforme
        todas_devueltas = not uniforme.piezas.filter(estado_pieza='activo').exists()
        
        if todas_devueltas:
            uniforme.estado = 'devuelto'
            uniforme.fecha_devolucion = timezone.now()
            uniforme.devuelto_por = request.user.username
            uniforme.save()
        
        return Response({
            'status': 'Pieza devuelta exitosamente',
            'uniforme_completo_devuelto': todas_devueltas
        })
    
    @action(detail=True, methods=['patch'])
    def actualizar_pieza(self, request, pk=None):
        """Actualiza estado o condiciÃ³n de una pieza"""
        from django.utils import timezone
        from .models import PiezaUniforme
        
        pieza_id = request.data.get('pieza_id')
        campo = request.data.get('campo')  # 'estado_fisico' o 'condicion'
        nuevo_valor = request.data.get('valor')
        
        if not all([pieza_id, campo, nuevo_valor]):
            return Response({'error': 'pieza_id, campo y valor requeridos'}, status=400)
        
        try:
            pieza = PiezaUniforme.objects.get(id=pieza_id, uniforme_id=pk)
        except PiezaUniforme.DoesNotExist:
            return Response({'error': 'Pieza no encontrada'}, status=404)
        
        # Guardar en historial
        if not pieza.historial_cambios:
            pieza.historial_cambios = []
        pieza.historial_cambios.append({
            'campo': campo,
            'valor_anterior': getattr(pieza, campo),
            'valor_nuevo': nuevo_valor,
            'modificado_por': request.user.username,
            'fecha_modificacion': timezone.now().isoformat()
        })
        
        # Actualizar
        setattr(pieza, campo, nuevo_valor)
        pieza.ultima_modificacion = {
            'usuario': request.user.username,
            'fecha': timezone.now().isoformat(),
            'campo': campo
        }
        pieza.save()
        
        return Response({'status': 'Pieza actualizada exitosamente'})
    
    @action(detail=False, methods=['get'])
    def por_voluntario(self, request):
        """Retorna uniformes de un voluntario especÃ­fico"""
        voluntario_id = request.query_params.get('voluntario_id')
        if not voluntario_id:
            return Response({'error': 'voluntario_id requerido'}, status=400)
        
        uniformes = self.get_queryset().filter(bombero_id=voluntario_id)
        serializer = self.get_serializer(uniformes, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        """Genera PDF del comprobante de uniforme"""
        from django.http import HttpResponse
        from .pdf_uniformes import generar_pdf_uniforme
        import unicodedata
        import re
        
        try:
            uniforme = self.get_object()
            pdf_buffer = generar_pdf_uniforme(uniforme)
            
            # Nombre del archivo con nombre del voluntario
            bombero = uniforme.bombero
            nombre_completo = f"{bombero.nombre} {bombero.apellido_paterno} {bombero.apellido_materno or ''}".strip() or "Sin_Nombre"
            # Limpiar nombre para que sea vÃ¡lido como nombre de archivo
            nombre_limpio = unicodedata.normalize('NFKD', nombre_completo).encode('ASCII', 'ignore').decode('ASCII')
            nombre_limpio = re.sub(r'[^\w\s-]', '', nombre_limpio).strip()
            nombre_limpio = re.sub(r'[-\s]+', '_', nombre_limpio)
            
            nombre_archivo = f"entrega_uniforme_{nombre_limpio}.pdf"
            
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
            return response
            
        except Exception as e:
            print(f"[PDF ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)
    
    @action(detail=True, methods=['get'])
    def generar_pdf_devolucion(self, request, pk=None):
        """Genera PDF del comprobante de devoluciÃ³n de pieza"""
        from django.http import HttpResponse
        from .pdf_uniformes import generar_pdf_devolucion
        from .models import PiezaUniforme
        import unicodedata
        import re
        
        try:
            uniforme = self.get_object()
            pieza_id = request.query_params.get('pieza_id')
            
            if not pieza_id:
                return Response({'error': 'pieza_id requerido'}, status=400)
            
            try:
                pieza = PiezaUniforme.objects.get(id=pieza_id, uniforme=uniforme)
            except PiezaUniforme.DoesNotExist:
                return Response({'error': 'Pieza no encontrada'}, status=404)
            
            pdf_buffer = generar_pdf_devolucion(uniforme, pieza)
            
            # Nombre del archivo con nombre del voluntario
            bombero = uniforme.bombero
            nombre_completo = f"{bombero.nombre} {bombero.apellido_paterno} {bombero.apellido_materno or ''}".strip() or "Sin_Nombre"
            # Limpiar nombre para que sea vÃ¡lido como nombre de archivo
            nombre_limpio = unicodedata.normalize('NFKD', nombre_completo).encode('ASCII', 'ignore').decode('ASCII')
            nombre_limpio = re.sub(r'[^\w\s-]', '', nombre_limpio).strip()
            nombre_limpio = re.sub(r'[-\s]+', '_', nombre_limpio)
            
            nombre_archivo = f"devolucion_uniforme_{nombre_limpio}.pdf"
            
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
            return response
            
        except Exception as e:
            print(f"[PDF DEVOLUCION ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)
    
    @action(detail=False, methods=['get'])
    def generar_tabla_uniformes(self, request):
        """Genera PDF con tabla completa de uniformes del voluntario"""
        from django.http import HttpResponse
        from .pdf_uniformes import generar_pdf_tabla_uniformes
        from .models import Voluntario
        import unicodedata
        import re
        
        try:
            voluntario_id = request.query_params.get('voluntario_id')
            
            if not voluntario_id:
                return Response({'error': 'voluntario_id requerido'}, status=400)
            
            try:
                voluntario = Voluntario.objects.get(id=voluntario_id)
            except Voluntario.DoesNotExist:
                return Response({'error': 'Voluntario no encontrado'}, status=404)
            
            # Obtener todos los uniformes activos del voluntario
            uniformes = self.get_queryset().filter(bombero=voluntario, estado='activo').prefetch_related('piezas')
            
            pdf_buffer = generar_pdf_tabla_uniformes(voluntario, uniformes)
            
            # Nombre del archivo
            nombre_completo = f"{voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno or ''}".strip() or "Sin_Nombre"
            nombre_limpio = unicodedata.normalize('NFKD', nombre_completo).encode('ASCII', 'ignore').decode('ASCII')
            nombre_limpio = re.sub(r'[^\w\s-]', '', nombre_limpio).strip()
            nombre_limpio = re.sub(r'[-\s]+', '_', nombre_limpio)
            
            nombre_archivo = f"tabla_uniformes_{nombre_limpio}.pdf"
            
            response = HttpResponse(pdf_buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
            return response
            
        except Exception as e:
            print(f"[PDF TABLA ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)


# ==================== CUOTAS ====================

class CuotaViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Cuotas
    """
    queryset = Cuota.objects.all()
    serializer_class = CuotaSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cuotas'
    acciones_permisos = {
        'por_anio': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['mes', 'anio']
    search_fields = ['descripcion']
    ordering_fields = ['anio', 'mes']
    ordering = ['-anio', '-mes']

    @action(detail=False, methods=['get'])
    def por_anio(self, request):
        """Retorna cuotas de un aÃ±o especÃ­fico"""
        anio = request.query_params.get('anio', timezone.now().year)
        cuotas = self.queryset.filter(anio=anio)
        serializer = self.get_serializer(cuotas, many=True)
        return Response(serializer.data)


class PagoCuotaViewSetOLD(viewsets.ModelViewSet):
    """
    API endpoints para Pagos de Cuotas - OBSOLETO, usar views_tesoreria.py
    """
    queryset = PagoCuota.objects.all()
    serializer_class = PagoCuotaSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'cuotas'
    acciones_permisos = {
        'por_voluntario': 'view',
        'resumen_anual': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['voluntario', 'cuota', 'fecha_pago']
    search_fields = ['voluntario__nombre', 'numero_comprobante']
    ordering_fields = ['fecha_pago']
    ordering = ['-fecha_pago']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def por_voluntario(self, request):
        """Retorna pagos de cuotas de un voluntario especÃ­fico"""
        voluntario_id = request.query_params.get('voluntario_id')
        if voluntario_id:
            pagos = self.queryset.filter(voluntario_id=voluntario_id)
            serializer = self.get_serializer(pagos, many=True)
            return Response(serializer.data)
        return Response({'error': 'voluntario_id requerido'}, status=400)

    @action(detail=False, methods=['get'])
    def resumen_anual(self, request):
        """Retorna resumen de pagos por aÃ±o"""
        anio = request.query_params.get('anio', timezone.now().year)
        pagos = self.queryset.filter(cuota__anio=anio)

        total_recaudado = pagos.aggregate(Sum('monto_pagado'))['monto_pagado__sum'] or 0
        total_pagos = pagos.count()

        return Response({
            'anio': anio,
            'total_recaudado': total_recaudado,
            'total_pagos': total_pagos,
        })


# ==================== BENEFICIOS ====================

class BeneficioViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Beneficios
    """
    queryset = Beneficio.objects.all()
    serializer_class = BeneficioSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'beneficios'
    acciones_permisos = {
        'activos': 'view',
        'con_cupos': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estado']
    search_fields = ['nombre', 'descripcion']
    ordering_fields = ['nombre', 'monto']
    ordering = ['nombre']

    @action(detail=False, methods=['get'])
    def activos(self, request):
        """Retorna beneficios activos"""
        beneficios = self.queryset.filter(estado='activo')
        serializer = self.get_serializer(beneficios, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def con_cupos(self, request):
        """Retorna beneficios activos con cupos disponibles"""
        beneficios = self.queryset.filter(
            estado='activo',
            cupos_disponibles__gt=0
        )
        serializer = self.get_serializer(beneficios, many=True)
        return Response(serializer.data)


class AsignacionBeneficioViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Asignaciones de Beneficios
    """
    queryset = AsignacionBeneficio.objects.all()
    serializer_class = AsignacionBeneficioSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'beneficios'
    acciones_permisos = {
        'por_voluntario': 'view',
        'pendientes': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['beneficio', 'voluntario', 'estado_pago']
    search_fields = ['voluntario__nombre', 'beneficio__nombre']
    ordering_fields = ['fecha_asignacion']
    ordering = ['-fecha_asignacion']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def por_voluntario(self, request):
        """Retorna asignaciones de un voluntario especÃ­fico"""
        voluntario_id = request.query_params.get('voluntario_id')
        if voluntario_id:
            asignaciones = self.queryset.filter(voluntario_id=voluntario_id)
            serializer = self.get_serializer(asignaciones, many=True)
            return Response(serializer.data)
        return Response({'error': 'voluntario_id requerido'}, status=400)

    @action(detail=False, methods=['get'])
    def pendientes(self, request):
        """Retorna asignaciones con pagos pendientes"""
        asignaciones = self.queryset.filter(estado_pago__in=['pendiente', 'parcial'])
        serializer = self.get_serializer(asignaciones, many=True)
        return Response(serializer.data)


class PagoBeneficioViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Pagos de Beneficios
    """
    queryset = PagoBeneficio.objects.all()
    serializer_class = PagoBeneficioSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'beneficios'
    acciones_permisos = {
        'por_asignacion': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['asignacion', 'fecha_pago']
    search_fields = ['asignacion__voluntario__nombre', 'numero_comprobante']
    ordering_fields = ['fecha_pago']
    ordering = ['-fecha_pago']

    def perform_create(self, serializer):
        """Crea un pago y actualiza el estado de la asignaciÃ³n"""
        pago = serializer.save(created_by=self.request.user)

        # Actualizar estado de la asignaciÃ³n
        asignacion = pago.asignacion
        asignacion.monto_pagado = asignacion.pagos.aggregate(Sum('monto'))['monto__sum'] or 0

        if asignacion.monto_pagado >= asignacion.monto_total:
            asignacion.estado_pago = 'completo'
        elif asignacion.monto_pagado > 0:
            asignacion.estado_pago = 'parcial'
        else:
            asignacion.estado_pago = 'pendiente'

        asignacion.save()

    @action(detail=False, methods=['get'])
    def por_asignacion(self, request):
        """Retorna pagos de una asignaciÃ³n especÃ­fica"""
        asignacion_id = request.query_params.get('asignacion_id')
        if asignacion_id:
            pagos = self.queryset.filter(asignacion_id=asignacion_id)
            serializer = self.get_serializer(pagos, many=True)
            return Response(serializer.data)
        return Response({'error': 'asignacion_id requerido'}, status=400)


# ==================== SISTEMA COMPLETO DE ASISTENCIAS P6P ====================

class VoluntarioExternoViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Voluntarios Externos (Participantes y Canjes)
    """
    queryset = VoluntarioExterno.objects.all()
    serializer_class = VoluntarioExternoSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'asistencias'
    acciones_permisos = {
        'por_tipo': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo']
    search_fields = ['codigo', 'nombre_completo']
    ordering_fields = ['codigo', 'nombre_completo', 'total_asistencias']
    ordering = ['codigo']

    @action(detail=False, methods=['get'])
    def por_tipo(self, request):
        """Retorna externos filtrados por tipo"""
        tipo = request.query_params.get('tipo')
        if tipo:
            externos = self.queryset.filter(tipo=tipo)
            serializer = self.get_serializer(externos, many=True)
            return Response(serializer.data)
        return Response({'error': 'tipo requerido'}, status=400)


class EventoAsistenciaViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Eventos de Asistencia
    """
    queryset = EventoAsistencia.objects.all()
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'asistencias'
    acciones_permisos = {
        'por_tipo': 'view',
        'por_rango_fechas': 'view',
        'asistentes': 'view',
        'estadisticas_periodo': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'fecha']
    search_fields = ['descripcion', 'clave_emergencia', 'direccion']
    ordering_fields = ['fecha', 'fecha_registro', 'total_asistentes']
    ordering = ['-fecha', '-fecha_registro']

    def get_serializer_class(self):
        if self.action == 'list':
            return EventoAsistenciaListSerializer
        return EventoAsistenciaSerializer

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)

    @action(detail=False, methods=['get'])
    def por_tipo(self, request):
        """Retorna eventos filtrados por tipo"""
        tipo = request.query_params.get('tipo')
        if tipo:
            eventos = self.queryset.filter(tipo=tipo)
            serializer = self.get_serializer(eventos, many=True)
            return Response(serializer.data)
        return Response({'error': 'tipo requerido'}, status=400)

    @action(detail=False, methods=['get'])
    def por_rango_fechas(self, request):
        """Retorna eventos en un rango de fechas"""
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if not fecha_desde or not fecha_hasta:
            return Response({'error': 'fecha_desde y fecha_hasta requeridos'}, status=400)

        eventos = self.queryset.filter(fecha__range=[fecha_desde, fecha_hasta])
        serializer = self.get_serializer(eventos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def asistentes(self, request, pk=None):
        """Retorna lista de asistentes de un evento"""
        evento = self.get_object()
        asistentes = evento.asistentes.all()
        serializer = DetalleAsistenciaSerializer(asistentes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def estadisticas_periodo(self, request):
        """Retorna estadÃ­sticas de eventos en un periodo"""
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if not fecha_desde or not fecha_hasta:
            return Response({'error': 'fecha_desde y fecha_hasta requeridos'}, status=400)

        eventos = self.queryset.filter(fecha__range=[fecha_desde, fecha_hasta])

        por_tipo = {}
        for tipo, _ in EventoAsistencia.TIPO_CHOICES:
            eventos_tipo = eventos.filter(tipo=tipo)
            por_tipo[tipo] = {
                'cantidad': eventos_tipo.count(),
                'total_asistentes': eventos_tipo.aggregate(Sum('total_asistentes'))['total_asistentes__sum'] or 0,
            }

        return Response({
            'total_eventos': eventos.count(),
            'total_asistentes': eventos.aggregate(Sum('total_asistentes'))['total_asistentes__sum'] or 0,
            'por_tipo': por_tipo,
        })


class DetalleAsistenciaViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Detalles de Asistencia
    """
    queryset = DetalleAsistencia.objects.all()
    serializer_class = DetalleAsistenciaSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'asistencias'
    acciones_permisos = {
        'por_evento': 'view',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['evento', 'voluntario', 'externo', 'es_externo', 'categoria']
    search_fields = ['nombre_completo', 'clave_bombero']
    ordering_fields = ['nombre_completo', 'categoria']
    ordering = ['categoria', 'nombre_completo']

    @action(detail=False, methods=['get'])
    def por_evento(self, request):
        """Retorna asistentes de un evento especÃ­fico"""
        evento_id = request.query_params.get('evento_id')
        if evento_id:
            asistentes = self.queryset.filter(evento_id=evento_id)
            serializer = self.get_serializer(asistentes, many=True)
            return Response(serializer.data)
        return Response({'error': 'evento_id requerido'}, status=400)


class RankingAsistenciaViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Ranking de Asistencias
    """
    queryset = RankingAsistencia.objects.all()
    serializer_class = RankingAsistenciaSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'asistencias'
    acciones_permisos = {
        'por_anio': 'view',
        'actualizar_ranking': 'edit',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['anio', 'voluntario', 'externo', 'es_externo']
    search_fields = ['nombre_completo', 'clave_bombero']
    ordering_fields = ['total', 'emergencias', 'asambleas', 'ejercicios']
    ordering = ['-anio', '-total']

    @action(detail=False, methods=['get'])
    def por_anio(self, request):
        """Retorna ranking de un aÃ±o especÃ­fico"""
        anio = request.query_params.get('anio', timezone.now().year)
        ranking = self.queryset.filter(anio=anio)
        serializer = self.get_serializer(ranking, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def actualizar_ranking(self, request):
        """Recalcula el ranking de un aÃ±o especÃ­fico"""
        anio = request.data.get('anio', timezone.now().year)

        # Obtener todos los eventos del aÃ±o
        eventos = EventoAsistencia.objects.filter(fecha__year=anio)

        # Limpiar ranking existente
        RankingAsistencia.objects.filter(anio=anio).delete()

        # Calcular ranking para voluntarios regulares
        voluntarios = Voluntario.objects.filter(eventos_asistidos__evento__fecha__year=anio).distinct()

        for voluntario in voluntarios:
            detalles = DetalleAsistencia.objects.filter(
                voluntario=voluntario,
                evento__fecha__year=anio
            )

            RankingAsistencia.objects.create(
                anio=anio,
                voluntario=voluntario,
                nombre_completo=voluntario.nombre_completo(),
                clave_bombero=voluntario.clave_bombero,
                total=detalles.count(),
                emergencias=detalles.filter(evento__tipo='emergencia').count(),
                asambleas=detalles.filter(evento__tipo='asamblea').count(),
                ejercicios=detalles.filter(evento__tipo='ejercicios').count(),
                citaciones=detalles.filter(evento__tipo='citaciones').count(),
                otras=detalles.filter(evento__tipo='otras').count(),
                es_externo=False
            )

        # Calcular ranking para voluntarios externos
        externos = VoluntarioExterno.objects.filter(eventos_asistidos__evento__fecha__year=anio).distinct()

        for externo in externos:
            detalles = DetalleAsistencia.objects.filter(
                externo=externo,
                evento__fecha__year=anio
            )

            RankingAsistencia.objects.create(
                anio=anio,
                externo=externo,
                nombre_completo=externo.nombre_completo,
                clave_bombero=externo.codigo,
                total=detalles.count(),
                emergencias=detalles.filter(evento__tipo='emergencia').count(),
                asambleas=detalles.filter(evento__tipo='asamblea').count(),
                ejercicios=detalles.filter(evento__tipo='ejercicios').count(),
                citaciones=detalles.filter(evento__tipo='citaciones').count(),
                otras=detalles.filter(evento__tipo='otras').count(),
                es_externo=True,
                tipo_externo=externo.tipo
            )

        return Response({'message': f'Ranking {anio} actualizado exitosamente'})


class CicloAsistenciaViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Ciclos de Asistencia
    """
    queryset = CicloAsistencia.objects.all()
    serializer_class = CicloAsistenciaSerializer
    permission_classes = [PermisosPorModulo]
    modulo_permisos = 'asistencias'
    acciones_permisos = {
        'activo': 'view',
        'cerrar_ciclo': 'edit',
        'activar_ciclo': 'edit',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['anio', 'activo']
    search_fields = ['observaciones']
    ordering_fields = ['anio']
    ordering = ['-anio']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def activo(self, request):
        """Retorna el ciclo activo actual"""
        ciclo = self.queryset.filter(activo=True).first()
        if ciclo:
            serializer = self.get_serializer(ciclo)
            return Response(serializer.data)
        return Response({'error': 'No hay ciclo activo'}, status=404)

    @action(detail=True, methods=['post'])
    def cerrar_ciclo(self, request, pk=None):
        """Cierra un ciclo de asistencia"""
        ciclo = self.get_object()
        ciclo.activo = False
        ciclo.save()

        serializer = self.get_serializer(ciclo)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def activar_ciclo(self, request, pk=None):
        """Activa un ciclo de asistencia (desactiva los demÃ¡s)"""
        # Desactivar todos
        CicloAsistencia.objects.update(activo=False)

        # Activar el seleccionado
        ciclo = self.get_object()
        ciclo.activo = True
        ciclo.save()

        serializer = self.get_serializer(ciclo)
        return Response(serializer.data)


# ==================== AUTENTICACIÃ“N ====================

class LoginView(APIView):
    """API para login"""
    permission_classes = []

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(username=username, password=password)
        if user:
            login(request, user)
            serializer = UserSerializer(user)
            return Response(serializer.data)
        return Response({'error': 'Credenciales invÃ¡lidas'}, status=401)


class LogoutView(APIView):
    """API para logout"""
    def post(self, request):
        logout(request)
        return Response({'message': 'Logout exitoso'})


class CurrentUserView(APIView):
    """API para obtener usuario actual"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


# ==================== LOGOS ====================

class LogoCompaniaViewSet(viewsets.ModelViewSet):
    """
    API endpoints para Logos de CompaÃ±Ã­a
    """
    queryset = LogoCompania.objects.all()
    serializer_class = LogoCompaniaSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        """Guardar quiÃ©n cargÃ³ el logo"""
        serializer.save(cargado_por=self.request.user)
    
    @action(detail=False, methods=['get'])
    def pdfs(self, request):
        """Retorna el logo para PDFs"""
        logo = self.queryset.filter(usar_en_pdfs=True).first()
        if logo:
            serializer = self.get_serializer(logo)
            return Response(serializer.data)
        return Response({'error': 'No hay logo configurado para PDFs'}, status=404)
    
    @action(detail=False, methods=['get'])
    def asistencias(self, request):
        """Retorna el logo para Asistencias"""
        logo = self.queryset.filter(usar_en_asistencias=True).first()
        if logo:
            serializer = self.get_serializer(logo)
            return Response(serializer.data)
        return Response({'error': 'No hay logo configurado para Asistencias'}, status=404)
    
    @action(detail=False, methods=['get'])
    def sidebar(self, request):
        """Retorna el logo para Sidebar"""
        logo = self.queryset.filter(usar_en_sidebar=True).first()
        if logo:
            serializer = self.get_serializer(logo)
            return Response(serializer.data)
        return Response({'error': 'No hay logo configurado para Sidebar'}, status=404)
    
    @action(detail=True, methods=['post'])
    def asignar_contexto(self, request, pk=None):
        """Asignar un logo a un contexto especÃ­fico"""
        logo = self.get_object()
        contexto = request.data.get('contexto')  # 'pdfs', 'asistencias', 'sidebar'
        activar = request.data.get('activar', True)  # True/False
        
        if contexto == 'pdfs':
            logo.usar_en_pdfs = activar
        elif contexto == 'asistencias':
            logo.usar_en_asistencias = activar
        elif contexto == 'sidebar':
            logo.usar_en_sidebar = activar
        else:
            return Response({'error': 'Contexto invÃ¡lido'}, status=400)
        
        logo.save()  # El mÃ©todo save del modelo desactivarÃ¡ los demÃ¡s en ese contexto
        
        return Response({
            'message': f'Logo "{logo.nombre}" {"activado" if activar else "desactivado"} en {contexto}',
            'logo': self.get_serializer(logo).data
        })


