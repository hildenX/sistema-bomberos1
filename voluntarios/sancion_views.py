from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Sancion, Reintegro, Voluntario
from .sancion_serializers import SancionSerializer, ReintegroSerializer
from .permissions import PermisosSancionesCapitan, EsSecretarioOSuperior


class SancionViewSet(viewsets.ModelViewSet):
    """ViewSet para manejar sanciones"""
    queryset = Sancion.objects.all()
    serializer_class = SancionSerializer
    permission_classes = [PermisosSancionesCapitan]
    
    def get_queryset(self):
        """Filtrar por voluntario si se proporciona"""
        queryset = Sancion.objects.all().select_related('voluntario', 'created_by')
        voluntario_id = self.request.query_params.get('voluntario', None)
        if voluntario_id:
            queryset = queryset.filter(voluntario_id=voluntario_id)
        return queryset
    
    def perform_create(self, serializer):
        """Guardar quien creó la sanción"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def por_tipo(self, request):
        """Obtener sanciones agrupadas por tipo"""
        tipo = request.query_params.get('tipo', None)
        if tipo:
            sanciones = Sancion.objects.filter(tipo_sancion=tipo).select_related('voluntario')
            serializer = self.get_serializer(sanciones, many=True)
            return Response(serializer.data)
        return Response({'error': 'Debe especificar el tipo de sanción'}, status=400)


class ReintegroViewSet(viewsets.ModelViewSet):
    """ViewSet para manejar reintegros"""
    queryset = Reintegro.objects.all()
    serializer_class = ReintegroSerializer
    permission_classes = [EsSecretarioOSuperior]
    
    def get_queryset(self):
        """Filtrar por voluntario si se proporciona"""
        queryset = Reintegro.objects.all().select_related('voluntario', 'created_by')
        voluntario_id = self.request.query_params.get('voluntario', None)
        if voluntario_id:
            queryset = queryset.filter(voluntario_id=voluntario_id)
        return queryset
    
    def perform_create(self, serializer):
        """Guardar quien creó el reintegro"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['post'])
    def verificar_elegibilidad(self, request):
        """Verificar si un voluntario puede reintegrarse"""
        voluntario_id = request.data.get('voluntario_id')
        
        if not voluntario_id:
            return Response(
                {'error': 'Debe proporcionar el ID del voluntario'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            voluntario = Voluntario.objects.get(id=voluntario_id)
            puede, mensaje = voluntario.puede_reintegrarse()
            
            return Response({
                'puede_reintegrarse': puede,
                'mensaje': mensaje,
                'estado_actual': voluntario.estado_bombero,
                'clave': voluntario.clave_bombero,
                'nombre': voluntario.nombre_completo(),
                'fecha_salida': (
                    voluntario.fecha_renuncia or 
                    voluntario.fecha_separacion or 
                    voluntario.fecha_expulsion
                )
            })
        except Voluntario.DoesNotExist:
            return Response(
                {'error': 'Voluntario no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def elegibles(self, request):
        """Listar voluntarios elegibles para reintegro"""
        voluntarios = Voluntario.objects.filter(
            estado_bombero__in=['renunciado', 'separado', 'expulsado']
        )
        
        elegibles = []
        for vol in voluntarios:
            puede, mensaje = vol.puede_reintegrarse()
            elegibles.append({
                'id': vol.id,
                'clave': vol.clave_bombero,
                'nombre': vol.nombre_completo(),
                'estado': vol.estado_bombero,
                'puede_reintegrarse': puede,
                'mensaje': mensaje
            })
        
        return Response(elegibles)
