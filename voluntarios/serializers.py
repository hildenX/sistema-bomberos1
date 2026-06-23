from rest_framework import serializers
from django.contrib.auth.models import User
from datetime import datetime
from .models import (
    Voluntario, Cargo, Sancion, TipoAsistencia, Asistencia, 
    Uniforme, PiezaUniforme, ContadorUniformes, Cuota, PagoCuota, 
    Beneficio, AsignacionBeneficio, PagoBeneficio, Felicitacion, Reintegro,
    EventoAsistencia, DetalleAsistencia, VoluntarioExterno, RankingAsistencia, CicloAsistencia,
    ConfiguracionCuotas, EstadoCuotasBombero, MovimientoFinanciero, CicloCuotas,
    LogoCompania
)


def _obtener_comprobante_desde_solicitud(pago):
    solicitud = pago.solicitudes_portal.order_by('-created_at').first()
    if solicitud and solicitud.comprobante:
        return solicitud.comprobante.url
    return None


def _obtener_comprobante_desde_movimiento(movimiento):
    for pago in (movimiento.pago_cuota, movimiento.pago_beneficio, movimiento.pago_rifa):
        if not pago:
            continue

        comprobante_url = _obtener_comprobante_desde_solicitud(pago)
        comprobante_base64 = getattr(pago, 'comprobante_base64', None) or None
        if comprobante_url or comprobante_base64:
            return comprobante_url, comprobante_base64

    return None, None

class VoluntarioSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.SerializerMethodField()
    edad = serializers.SerializerMethodField()
    antiguedad = serializers.SerializerMethodField()
    puede_reintegrarse = serializers.SerializerMethodField()
    
    # Campos compatibles con p6p (nombres separados)
    primerNombre = serializers.CharField(required=False, allow_blank=True)
    segundoNombre = serializers.CharField(required=False, allow_blank=True, default='')
    tercerNombre = serializers.CharField(required=False, allow_blank=True, default='')
    primerApellido = serializers.CharField(required=False, allow_blank=True)
    segundoApellido = serializers.CharField(required=False, allow_blank=True)
    
    # Campos de padrinos
    nombrePrimerPadrino = serializers.CharField(required=False, allow_blank=True)
    nombreSegundoPadrino = serializers.CharField(required=False, allow_blank=True)
    
    # Otros cuerpos de bomberos
    otrosCuerpos = serializers.CharField(required=False, allow_blank=True, default='')
    companiaOpcional = serializers.CharField(required=False, allow_blank=True, default='')
    desde = serializers.CharField(required=False, allow_blank=True, default='')
    hasta = serializers.CharField(required=False, allow_blank=True, default='')
    
    # Campos del modelo (hacerlos opcionales para que use los de p6p)
    nombre = serializers.CharField(required=False, allow_blank=True)
    apellido_paterno = serializers.CharField(required=False, allow_blank=True)
    apellido_materno = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = Voluntario
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'posicion_por_antiguedad']
        extra_kwargs = {
            'grupo_sanguineo': {'required': False},
            'nro_registro': {'required': False},
            'clave_bombero': {'required': False},
            'fecha_nacimiento': {'required': False},
            'fecha_ingreso': {'required': False},
            'estado_bombero': {'required': False},
        }
    
    def get_nombre_completo(self, obj):
        return obj.nombre_completo()
    
    def get_edad(self, obj):
        return obj.edad()
    
    def get_antiguedad(self, obj):
        return obj.antiguedad_detallada()
    
    def get_puede_reintegrarse(self, obj):
        puede, mensaje = obj.puede_reintegrarse()
        return {'puede': puede, 'mensaje': mensaje}
    
    def to_internal_value(self, data):
        """Mapear camelCase a snake_case ANTES de validar"""
        try:
            # Crear un nuevo dict en lugar de copiar
            if isinstance(data, dict):
                mapped_data = {}
                for key, value in data.items():
                    mapped_data[key] = value
            else:
                # Si es un QueryDict u otro tipo, convertir a dict
                mapped_data = dict(data)
            
            # IMPORTANTE: Extraer foto ANTES de la validación de DRF
            # DRF valida ImageField y rechaza strings que no sean archivos
            foto_data = mapped_data.pop('foto', None)
            
            # Guardar la foto temporalmente para procesarla después
            if foto_data:
                # Guardamos la foto en el contexto para procesarla en create/update
                self._foto_pendiente = foto_data
                print(f"[FOTO] Extraída antes de validación: {len(str(foto_data))} chars")
            else:
                # Limpiar foto pendiente si no hay foto nueva
                if hasattr(self, '_foto_pendiente'):
                    delattr(self, '_foto_pendiente')
                print(f"[FOTO] No hay foto en los datos")
            
            # Mapeo de campos camelCase a snake_case
            field_mapping = {
                'grupoSanguineo': 'grupo_sanguineo',
                'nroRegistro': 'nro_registro',
                'claveBombero': 'clave_bombero',
                'fechaNacimiento': 'fecha_nacimiento',
                'fechaIngreso': 'fecha_ingreso',
                'estadoBombero': 'estado_bombero',
            }
            
            for camel, snake in field_mapping.items():
                if camel in mapped_data:
                    mapped_data[snake] = mapped_data.pop(camel)
                    print(f"[MAPPING] {camel} -> {snake}: {mapped_data[snake]}")
            
            return super().to_internal_value(mapped_data)
        except Exception as e:
            print(f"[ERROR to_internal_value] {e}")
            # Si falla, intentar con los datos originales (pero sin foto)
            if isinstance(data, dict) and 'foto' in data:
                data_sin_foto = {k: v for k, v in data.items() if k != 'foto'}
                return super().to_internal_value(data_sin_foto)
            return super().to_internal_value(data)
    
    def create(self, validated_data):
        """Crea un voluntario con lógica del p6p"""
        print("[CREATE] Datos validados ANTES de procesar:")
        for k, v in validated_data.items():
            if k != 'foto':
                print(f"  - {k}: {v}")
        
        # Extraer campos del p6p (camelCase) - DRF ya mapeó los campos con source=
        primer_nombre = validated_data.pop('primerNombre', '')
        segundo_nombre = validated_data.pop('segundoNombre', '')
        tercer_nombre = validated_data.pop('tercerNombre', '')
        primer_apellido = validated_data.pop('primerApellido', '')
        segundo_apellido = validated_data.pop('segundoApellido', '')
        
        # Extraer padrinos
        padrino1 = validated_data.pop('nombrePrimerPadrino', '')
        padrino2 = validated_data.pop('nombreSegundoPadrino', '')
        
        # Construir nombre completo
        nombre_completo_parts = [primer_nombre, segundo_nombre, tercer_nombre]
        validated_data['nombre'] = ' '.join([p for p in nombre_completo_parts if p]).strip()
        
        # Asignar apellidos
        validated_data['apellido_paterno'] = primer_apellido
        validated_data['apellido_materno'] = segundo_apellido
        
        # Guardar padrinos
        validated_data['nombre_primer_padrino'] = padrino1
        validated_data['nombre_segundo_padrino'] = padrino2
        
        # Extraer y guardar otros campos p6p
        otros_cuerpos = validated_data.pop('otrosCuerpos', '')
        compania_opc = validated_data.pop('companiaOpcional', '')
        desde = validated_data.pop('desde', '')
        hasta = validated_data.pop('hasta', '')
        
        validated_data['otros_cuerpos'] = otros_cuerpos
        validated_data['compania_opcional'] = compania_opc
        validated_data['desde'] = desde
        validated_data['hasta'] = hasta
        
        # Procesar foto en base64 (solo si existe y es base64 válido) - CREATE
        # Obtener foto de _foto_pendiente (extraída en to_internal_value)
        foto_base64 = getattr(self, '_foto_pendiente', None)
        
        if foto_base64:
            if isinstance(foto_base64, str) and len(foto_base64) > 20 and foto_base64.startswith('data:image'):
                try:
                    import base64
                    import uuid
                    from django.core.files.base import ContentFile
                    
                    # Extraer formato y data
                    format, imgstr = foto_base64.split(';base64,')
                    ext = format.split('/')[-1]
                    
                    # Crear archivo
                    data = ContentFile(base64.b64decode(imgstr), name=f'voluntario_{uuid.uuid4()}.{ext}')
                    validated_data['foto'] = data
                    print(f"[FOTO CREATE] Procesada correctamente: {ext}")
                except Exception as e:
                    print(f"[ERROR CREATE] No se pudo procesar la foto: {e}")
                    # Continuar sin foto - NO agregar nada a validated_data
                    pass
            else:
                # Si no es base64 válido, NO hacer nada
                print(f"[FOTO CREATE] Ignorando valor no válido: type={type(foto_base64)}, len={len(str(foto_base64)) if foto_base64 else 0}")
        else:
            print(f"[FOTO CREATE] Sin foto en datos")
        
        # Limpiar foto pendiente después de procesarla
        if hasattr(self, '_foto_pendiente'):
            delattr(self, '_foto_pendiente')
        
        # Mapear campos de estados especiales (camelCase a snake_case)
        if 'fechaRenuncia' in validated_data:
            validated_data['fecha_renuncia'] = validated_data.pop('fechaRenuncia')
        if 'motivoRenuncia' in validated_data:
            validated_data['motivo_renuncia'] = validated_data.pop('motivoRenuncia')
        if 'fechaSeparacion' in validated_data:
            validated_data['fecha_separacion'] = validated_data.pop('fechaSeparacion')
        if 'aniosSeparacion' in validated_data:
            validated_data['anios_separacion'] = validated_data.pop('aniosSeparacion')
        if 'fechaFinSeparacion' in validated_data:
            validated_data['fecha_fin_separacion'] = validated_data.pop('fechaFinSeparacion')
        if 'fechaExpulsion' in validated_data:
            validated_data['fecha_expulsion'] = validated_data.pop('fechaExpulsion')
        if 'motivoExpulsion' in validated_data:
            validated_data['motivo_expulsion'] = validated_data.pop('motivoExpulsion')
        if 'fechaMartirio' in validated_data:
            validated_data['fecha_martir'] = validated_data.pop('fechaMartirio')
        if 'lugarMartirio' in validated_data or 'circunstanciasMartirio' in validated_data:
            # El formulario envía lugarMartirio y circunstanciasMartirio, pero el modelo tiene causa_martir
            lugar = validated_data.pop('lugarMartirio', '')
            circunstancias = validated_data.pop('circunstanciasMartirio', '')
            if lugar or circunstancias:
                validated_data['causa_martir'] = f"{lugar}. {circunstancias}".strip('. ')
        if 'fechaFallecimiento' in validated_data:
            validated_data['fecha_fallecimiento'] = validated_data.pop('fechaFallecimiento')
        if 'causaFallecimiento' in validated_data:
            validated_data['causa_fallecimiento'] = validated_data.pop('causaFallecimiento')
        
        # Control de antigüedad según estado
        estado = validated_data.get('estado_bombero', 'activo')
        if estado in ['renunciado', 'separado', 'expulsado', 'martir', 'fallecido']:
            validated_data['antiguedad_congelada'] = True
            # Usar la fecha correspondiente al estado
            if estado == 'renunciado':
                validated_data['fecha_congelamiento'] = validated_data.get('fecha_renuncia')
            elif estado == 'separado':
                validated_data['fecha_congelamiento'] = validated_data.get('fecha_separacion')
            elif estado == 'expulsado':
                validated_data['fecha_congelamiento'] = validated_data.get('fecha_expulsion')
            elif estado == 'martir':
                validated_data['fecha_congelamiento'] = validated_data.get('fecha_martir')
            elif estado == 'fallecido':
                validated_data['fecha_congelamiento'] = validated_data.get('fecha_fallecimiento')
        
        # Historial de estados
        if not validated_data.get('historial_estados'):
            validated_data['historial_estados'] = [{
                'estadoAnterior': None,
                'estadoNuevo': estado,
                'fecha': datetime.now().isoformat(),
                'motivo': 'Registro inicial',
                'registradoPor': self.context.get('request').user.username if self.context.get('request') else 'sistema'
            }]
        
        # Historial de reintegraciones vacío
        if not validated_data.get('historial_reintegraciones'):
            validated_data['historial_reintegraciones'] = []
        
        # Usuario que crea
        if self.context.get('request'):
            validated_data['created_by'] = self.context['request'].user
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Actualiza un voluntario con lógica del p6p"""
        print("[UPDATE] Datos validados:", {k: v for k, v in validated_data.items() if k not in ['foto']})
        
        # Extraer campos del p6p (camelCase)
        primer_nombre = validated_data.pop('primerNombre', '')
        segundo_nombre = validated_data.pop('segundoNombre', '')
        tercer_nombre = validated_data.pop('tercerNombre', '')
        primer_apellido = validated_data.pop('primerApellido', '')
        segundo_apellido = validated_data.pop('segundoApellido', '')
        
        # Extraer padrinos
        padrino1 = validated_data.pop('nombrePrimerPadrino', '')
        padrino2 = validated_data.pop('nombreSegundoPadrino', '')
        
        # Guardar padrinos
        if padrino1:
            validated_data['nombre_primer_padrino'] = padrino1
        if padrino2:
            validated_data['nombre_segundo_padrino'] = padrino2
        
        # Extraer y guardar otros campos p6p
        otros_cuerpos = validated_data.pop('otrosCuerpos', None)
        compania_opc = validated_data.pop('companiaOpcional', None)
        desde = validated_data.pop('desde', None)
        hasta = validated_data.pop('hasta', None)
        
        if otros_cuerpos:
            validated_data['otros_cuerpos'] = otros_cuerpos
        if compania_opc:
            validated_data['compania_opcional'] = compania_opc
        if desde:
            validated_data['desde'] = desde
        if hasta:
            validated_data['hasta'] = hasta
        
        # Procesar foto en base64 (solo si existe y es base64 válido) - UPDATE
        # Obtener foto de _foto_pendiente (extraída en to_internal_value)
        foto_base64 = getattr(self, '_foto_pendiente', None)
        
        if foto_base64:
            if isinstance(foto_base64, str) and len(foto_base64) > 20 and foto_base64.startswith('data:image'):
                try:
                    import base64
                    import uuid
                    from django.core.files.base import ContentFile
                    
                    # Extraer formato y data
                    format, imgstr = foto_base64.split(';base64,')
                    ext = format.split('/')[-1]
                    
                    # Crear archivo
                    data = ContentFile(base64.b64decode(imgstr), name=f'voluntario_{uuid.uuid4()}.{ext}')
                    validated_data['foto'] = data
                    print(f"[FOTO UPDATE] Procesada correctamente: {ext}")
                except Exception as e:
                    print(f"[ERROR UPDATE] No se pudo procesar la foto: {e}")
                    # Continuar sin foto - NO agregar nada a validated_data
                    pass
            else:
                # Si no es base64 válido, NO hacer nada (no se actualiza la foto)
                print(f"[FOTO UPDATE] Ignorando valor no válido: type={type(foto_base64)}, len={len(str(foto_base64)) if foto_base64 else 0}")
        else:
            print(f"[FOTO UPDATE] Sin foto en datos - mantendrá foto actual")
        
        # Limpiar foto pendiente después de procesarla
        if hasattr(self, '_foto_pendiente'):
            delattr(self, '_foto_pendiente')
        
        # Mapear campos de estados especiales (camelCase a snake_case)
        if 'fechaRenuncia' in validated_data:
            validated_data['fecha_renuncia'] = validated_data.pop('fechaRenuncia')
        if 'motivoRenuncia' in validated_data:
            validated_data['motivo_renuncia'] = validated_data.pop('motivoRenuncia')
        if 'fechaSeparacion' in validated_data:
            validated_data['fecha_separacion'] = validated_data.pop('fechaSeparacion')
        if 'aniosSeparacion' in validated_data:
            validated_data['anios_separacion'] = validated_data.pop('aniosSeparacion')
        if 'fechaFinSeparacion' in validated_data:
            validated_data['fecha_fin_separacion'] = validated_data.pop('fechaFinSeparacion')
        if 'fechaExpulsion' in validated_data:
            validated_data['fecha_expulsion'] = validated_data.pop('fechaExpulsion')
        if 'motivoExpulsion' in validated_data:
            validated_data['motivo_expulsion'] = validated_data.pop('motivoExpulsion')
        if 'fechaMartirio' in validated_data:
            validated_data['fecha_martir'] = validated_data.pop('fechaMartirio')
        if 'lugarMartirio' in validated_data or 'circunstanciasMartirio' in validated_data:
            lugar = validated_data.pop('lugarMartirio', '')
            circunstancias = validated_data.pop('circunstanciasMartirio', '')
            if lugar or circunstancias:
                validated_data['causa_martir'] = f"{lugar}. {circunstancias}".strip('. ')
        if 'fechaFallecimiento' in validated_data:
            validated_data['fecha_fallecimiento'] = validated_data.pop('fechaFallecimiento')
        if 'causaFallecimiento' in validated_data:
            validated_data['causa_fallecimiento'] = validated_data.pop('causaFallecimiento')
        
        # Construir nombre completo
        if primer_nombre:
            nombre_completo_parts = [primer_nombre, segundo_nombre, tercer_nombre]
            validated_data['nombre'] = ' '.join([p for p in nombre_completo_parts if p]).strip()
        
        # Asignar apellidos
        if primer_apellido:
            validated_data['apellido_paterno'] = primer_apellido
        if segundo_apellido:
            validated_data['apellido_materno'] = segundo_apellido
        
        # Detectar cambio de estado
        estado_anterior = instance.estado_bombero
        estado_nuevo = validated_data.get('estado_bombero', estado_anterior)
        
        if estado_anterior != estado_nuevo:
            # Registrar cambio en historial
            historial = instance.historial_estados or []
            historial.append({
                'estadoAnterior': estado_anterior,
                'estadoNuevo': estado_nuevo,
                'fecha': datetime.now().isoformat(),
                'motivo': 'Cambio manual desde edición',
                'registradoPor': self.context.get('request').user.username if self.context.get('request') else 'sistema'
            })
            validated_data['historial_estados'] = historial
            
            # Congelar/descongelar antigüedad según el nuevo estado
            if estado_nuevo == 'activo':
                validated_data['antiguedad_congelada'] = False
                validated_data['fecha_congelamiento'] = None
            elif estado_nuevo in ['renunciado', 'separado', 'expulsado', 'martir', 'fallecido']:
                validated_data['antiguedad_congelada'] = True
                if not instance.fecha_congelamiento:
                    # Usar la fecha correspondiente al estado
                    if estado_nuevo == 'renunciado':
                        validated_data['fecha_congelamiento'] = validated_data.get('fecha_renuncia')
                    elif estado_nuevo == 'separado':
                        validated_data['fecha_congelamiento'] = validated_data.get('fecha_separacion')
                    elif estado_nuevo == 'expulsado':
                        validated_data['fecha_congelamiento'] = validated_data.get('fecha_expulsion')
                    elif estado_nuevo == 'martir':
                        validated_data['fecha_congelamiento'] = validated_data.get('fecha_martir')
                    elif estado_nuevo == 'fallecido':
                        validated_data['fecha_congelamiento'] = validated_data.get('fecha_fallecimiento')
        
        return super().update(instance, validated_data)
    
    def to_representation(self, instance):
        """Serializa de vuelta en formato p6p - EXACTAMENTE IGUAL"""
        # NO usar super() - crear objeto desde cero para control total
        
        # Separar nombres
        nombres = (instance.nombre or '').split()
        
        ret = {
            'id': instance.id,
            'primerNombre': nombres[0] if len(nombres) > 0 else '',
            'segundoNombre': nombres[1] if len(nombres) > 1 else '',
            'tercerNombre': nombres[2] if len(nombres) > 2 else '',
            'primerApellido': instance.apellido_paterno or '',
            'segundoApellido': instance.apellido_materno or '',
            'rut': instance.rut,
            'claveBombero': instance.clave_bombero or '',
            'fechaNacimiento': instance.fecha_nacimiento.isoformat() if instance.fecha_nacimiento else None,
            'fechaIngreso': instance.fecha_ingreso.isoformat() if instance.fecha_ingreso else None,
            'profesion': instance.profesion or '',
            'domicilio': instance.domicilio or '',
            'telefono': instance.telefono or '',
            'email': instance.email or '',
            'grupoSanguineo': instance.grupo_sanguineo or '',
            'nroRegistro': instance.nro_registro or '',
            'compania': instance.compania or '',
            'estadoBombero': instance.estado_bombero,
            'foto': instance.foto.url if instance.foto else None,
            'cuotasActivas': instance.cuotas_activas,
            'esEstudiante': instance.es_estudiante,
            
            # Padrinos
            'nombrePrimerPadrino': instance.nombre_primer_padrino or '',
            'nombreSegundoPadrino': instance.nombre_segundo_padrino or '',
            
            # Otros cuerpos
            'otrosCuerpos': instance.otros_cuerpos or '',
            'companiaOpcional': instance.compania_opcional or '',
            'desde': instance.desde or '',
            'hasta': instance.hasta or '',
            
            # Campos de estados especiales
            'fechaRenuncia': instance.fecha_renuncia.isoformat() if instance.fecha_renuncia else None,
            'motivoRenuncia': instance.motivo_renuncia,
            'fechaSeparacion': instance.fecha_separacion.isoformat() if instance.fecha_separacion else None,
            'aniosSeparacion': instance.anios_separacion,
            'fechaExpulsion': instance.fecha_expulsion.isoformat() if instance.fecha_expulsion else None,
            'motivoExpulsion': instance.motivo_expulsion,
            'fechaMartirio': instance.fecha_martir.isoformat() if instance.fecha_martir else None,
            'fechaFallecimiento': instance.fecha_fallecimiento.isoformat() if instance.fecha_fallecimiento else None,
            
            # Historiales
            'historialEstados': instance.historial_estados or [],
            'historialReintegraciones': instance.historial_reintegraciones or [],
            
            # Campos calculados
            'nombreCompleto': instance.nombre_completo(),
            'edad': instance.edad() if instance.fecha_nacimiento else 0,
            'antiguedad': instance.antiguedad_detallada() if instance.fecha_ingreso else {'años': 0, 'meses': 0, 'dias': 0},
        }
        
        return ret


class VoluntarioListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    nombre_completo = serializers.SerializerMethodField()
    
    class Meta:
        model = Voluntario
        fields = ['id', 'clave_bombero', 'nombre_completo', 'rut', 'estado_bombero', 
                  'fecha_ingreso', 'compania', 'foto']
    
    def get_nombre_completo(self, obj):
        return obj.nombre_completo()


class CargoSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = Cargo
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()


class SancionSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = Sancion
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']
        read_only_fields = ['id']


# ==================== ASISTENCIAS ====================

class TipoAsistenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoAsistencia
        fields = '__all__'

class AsistenciaSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.SerializerMethodField()
    tipo_asistencia_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = Asistencia
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()
    
    def get_tipo_asistencia_nombre(self, obj):
        return obj.tipo_asistencia.nombre


# ==================== UNIFORMES ====================

class PiezaUniformeSerializer(serializers.ModelSerializer):
    nombre_display = serializers.SerializerMethodField()
    
    class Meta:
        model = PiezaUniforme
        fields = '__all__'
    
    def get_nombre_display(self, obj):
        """Devuelve nombre personalizado o componente formateado"""
        if obj.nombre_personalizado:
            return obj.nombre_personalizado
        return obj.componente.replace('_', ' ').title()


class UniformeSerializer(serializers.ModelSerializer):
    piezas = PiezaUniformeSerializer(many=True, read_only=True)
    bombero_nombre = serializers.SerializerMethodField()
    tipo_display = serializers.CharField(source='get_tipo_uniforme_display', read_only=True)
    
    class Meta:
        model = Uniforme
        fields = '__all__'
    
    def get_bombero_nombre(self, obj):
        """Retorna el nombre completo del bombero"""
        if obj.bombero:
            return obj.bombero.nombre_completo()
        return None


class CrearUniformeSerializer(serializers.Serializer):
    tipo_uniforme = serializers.ChoiceField(choices=Uniforme.TIPO_CHOICES)
    bombero_id = serializers.IntegerField()
    observaciones = serializers.CharField(required=False, allow_blank=True)
    piezas = serializers.ListField(child=serializers.DictField())
    
    def validate_piezas(self, value):
        """Valida que haya al menos 1 pieza"""
        if len(value) < 1:
            raise serializers.ValidationError('Debe registrar al menos un artículo')
        
        # Validar componente personalizado
        for pieza in value:
            if pieza.get('componente') == 'otro' and not pieza.get('nombre_personalizado'):
                raise serializers.ValidationError('Debe especificar el nombre del artículo personalizado')
        
        return value
    
    def create(self, validated_data):
        """Crea uniforme con piezas en transacción atómica"""
        from django.db import transaction
        from .utils import generar_id_uniforme, detectar_par_simple, puede_recibir_uniformes
        
        piezas_data = validated_data.pop('piezas')
        bombero = Voluntario.objects.get(id=validated_data['bombero_id'])
        
        # Validar voluntario
        validacion = puede_recibir_uniformes(bombero)
        if not validacion['puede']:
            raise serializers.ValidationError(validacion['mensaje'])
        
        with transaction.atomic():
            # Crear uniforme
            id_uniforme = generar_id_uniforme(validated_data['tipo_uniforme'])
            uniforme = Uniforme.objects.create(
                id=id_uniforme,
                bombero=bombero,
                tipo_uniforme=validated_data['tipo_uniforme'],
                observaciones=validated_data.get('observaciones', ''),
                registrado_por=self.context['request'].user.username
            )
            
            # Crear piezas
            for pieza_data in piezas_data:
                info_unidad = detectar_par_simple(pieza_data['componente'])
                PiezaUniforme.objects.create(
                    uniforme=uniforme,
                    componente=pieza_data['componente'],
                    nombre_personalizado=pieza_data.get('nombre_personalizado'),
                    marca=pieza_data.get('marca'),
                    serie=pieza_data.get('serie'),
                    talla=pieza_data.get('talla'),
                    condicion=pieza_data['condicion'],
                    estado_fisico=pieza_data['estado_fisico'],
                    fecha_entrega=pieza_data['fecha_entrega'],
                    unidad=info_unidad['unidad'],
                    par_simple=info_unidad['par_simple']
                )
        
        return uniforme
    
    def to_representation(self, instance):
        """Serializa la respuesta usando UniformeSerializer"""
        return UniformeSerializer(instance, context=self.context).data


# ==================== FINANZAS ====================

class CuotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cuota
        fields = '__all__'

class PagoCuotaSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.SerializerMethodField()
    cuota_info = serializers.SerializerMethodField()
    
    class Meta:
        model = PagoCuota
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()
    
    def get_cuota_info(self, obj):
        return str(obj.cuota)

class BeneficioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Beneficio
        fields = '__all__'

class AsignacionBeneficioSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.SerializerMethodField()
    beneficio_nombre = serializers.SerializerMethodField()
    monto_pendiente = serializers.SerializerMethodField()
    
    class Meta:
        model = AsignacionBeneficio
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()
    
    def get_beneficio_nombre(self, obj):
        return obj.beneficio.nombre
    
    def get_monto_pendiente(self, obj):
        return obj.monto_pendiente

class PagoBeneficioSerializer(serializers.ModelSerializer):
    asignacion_info = serializers.SerializerMethodField()
    
    class Meta:
        model = PagoBeneficio
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']
    
    def get_asignacion_info(self, obj):
        return f"{obj.asignacion.voluntario.nombre_completo()} - {obj.asignacion.beneficio.nombre}"


# ==================== FELICITACIONES ====================

class FelicitacionSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Felicitacion
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']

    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()


# ==================== SISTEMA COMPLETO DE ASISTENCIAS P6P ====================

class VoluntarioExternoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoluntarioExterno
        fields = '__all__'
        read_only_fields = ['codigo', 'total_asistencias', 'fecha_primera_asistencia', 
                           'fecha_ultima_asistencia', 'created_at']
    
    def create(self, validated_data):
        # Generar código único automáticamente
        tipo = validated_data.get('tipo')
        if tipo == 'participante':
            prefijo = 'EXT-P'
            ultimos = VoluntarioExterno.objects.filter(tipo='participante').count()
        else:
            prefijo = 'EXT-C'
            ultimos = VoluntarioExterno.objects.filter(tipo='canje').count()
        
        validated_data['codigo'] = f"{prefijo}-{str(ultimos + 1).zfill(3)}"
        return super().create(validated_data)


class DetalleAsistenciaSerializer(serializers.ModelSerializer):
    estado = serializers.SerializerMethodField()
    
    class Meta:
        model = DetalleAsistencia
        fields = '__all__'
        read_only_fields = ['created_at']
    
    def get_estado(self, obj):
        """Obtiene el estado del voluntario si existe"""
        if obj.voluntario:
            return obj.voluntario.estado_bombero
        return None


class EventoAsistenciaSerializer(serializers.ModelSerializer):
    asistentes = DetalleAsistenciaSerializer(many=True, read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EventoAsistencia
        fields = '__all__'
        read_only_fields = ['fecha_registro', 'registrado_por']

    def get_registrado_por_nombre(self, obj):
        return obj.registrado_por.username if obj.registrado_por else None


class EventoAsistenciaListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EventoAsistencia
        fields = ['id', 'id_evento', 'tipo', 'fecha', 'descripcion', 'clave_emergencia', 'direccion',
                 'tipo_asamblea', 'tipo_ejercicio', 'nombre_citacion', 'motivo_otras',
                 'total_asistentes', 'oficiales_comandancia', 'oficiales_compania', 'total_oficiales',
                 'cargos_confianza', 'voluntarios', 'participantes', 'canjes', 'observaciones',
                 'suma_ranking', 'porcentaje_asistencia', 'registrado_por_nombre', 'fecha_registro']

    def get_registrado_por_nombre(self, obj):
        return obj.registrado_por.username if obj.registrado_por else None


class RankingAsistenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RankingAsistencia
        fields = '__all__'
        read_only_fields = ['updated_at']


class CicloAsistenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CicloAsistencia
        fields = '__all__'
        read_only_fields = ['created_at', 'created_by']


# ==================== LOGOS ====================

class LogoCompaniaSerializer(serializers.ModelSerializer):
    cargado_por_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = LogoCompania
        fields = [
            'id', 'nombre', 'imagen', 'descripcion',
            'usar_en_pdfs', 'usar_en_asistencias', 'usar_en_sidebar',
            'fecha_carga', 'cargado_por', 'cargado_por_nombre'
        ]
        read_only_fields = ['fecha_carga', 'cargado_por']
    
    def get_cargado_por_nombre(self, obj):
        return obj.cargado_por.username if obj.cargado_por else None


# ==================== TESORERÍA ====================

class ConfiguracionCuotasSerializer(serializers.ModelSerializer):
    actualizado_por_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = ConfiguracionCuotas
        fields = [
            'id', 'precio_regular', 'precio_estudiante',
            'fecha_creacion', 'ultima_actualizacion',
            'actualizado_por', 'actualizado_por_nombre'
        ]
        read_only_fields = ['fecha_creacion', 'ultima_actualizacion', 'actualizado_por']
    
    def get_actualizado_por_nombre(self, obj):
        return obj.actualizado_por.username if obj.actualizado_por else None


class EstadoCuotasBomberoSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.CharField(source='voluntario.nombre_completo', read_only=True)
    voluntario_clave = serializers.CharField(source='voluntario.clave_bombero', read_only=True)
    
    class Meta:
        model = EstadoCuotasBombero
        fields = [
            'id', 'voluntario', 'voluntario_nombre', 'voluntario_clave',
            'es_estudiante', 'fecha_activacion_estudiante', 'observaciones_estudiante',
            'cuotas_desactivadas', 'motivo_desactivacion', 'fecha_desactivacion', 'desactivado_por',
            'fecha_creacion', 'ultima_actualizacion'
        ]
        read_only_fields = ['fecha_creacion', 'ultima_actualizacion']


class PagoCuotaSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.CharField(source='voluntario.nombre_completo', read_only=True)
    voluntario_clave = serializers.CharField(source='voluntario.clave_bombero', read_only=True)
    created_by_nombre = serializers.SerializerMethodField()
    mes_nombre = serializers.SerializerMethodField()
    comprobante_url = serializers.SerializerMethodField()
    tiene_comprobante = serializers.SerializerMethodField()
    
    class Meta:
        model = PagoCuota
        fields = [
            'id', 'voluntario', 'voluntario_nombre', 'voluntario_clave',
            'mes', 'anio', 'mes_nombre',
            'fecha_pago', 'monto_pagado', 'metodo_pago',
            'numero_comprobante', 'observaciones', 'tiene_comprobante', 'comprobante_url',
            'created_at', 'created_by', 'created_by_nombre'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_nombre(self, obj):
        return obj.created_by.username if obj.created_by else None
    
    def get_mes_nombre(self, obj):
        meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        return meses[obj.mes] if 1 <= obj.mes <= 12 else str(obj.mes)

    def get_comprobante_url(self, obj):
        return _obtener_comprobante_desde_solicitud(obj)

    def get_tiene_comprobante(self, obj):
        return bool(obj.comprobante_base64) or bool(self.get_comprobante_url(obj))


class CrearPagoCuotaSerializer(serializers.Serializer):
    """Serializer para crear un pago de cuota"""
    voluntario_id = serializers.IntegerField()
    mes = serializers.IntegerField(min_value=1, max_value=12)
    anio = serializers.IntegerField(min_value=2000)
    monto = serializers.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = serializers.DateField(required=False)
    metodo_pago = serializers.CharField(max_length=50, required=False, allow_blank=True)
    numero_comprobante = serializers.CharField(max_length=100, required=False, allow_blank=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class BeneficioSerializer(serializers.ModelSerializer):
    created_by_nombre = serializers.SerializerMethodField()
    total_asignaciones = serializers.SerializerMethodField()
    total_recaudado = serializers.SerializerMethodField()
    
    class Meta:
        model = Beneficio
        fields = [
            'id', 'nombre', 'tipo', 'descripcion', 'fecha_evento', 'fecha_limite_rendicion',
            'tarjetas_voluntarios', 'tarjetas_honorarios_cia',
            'tarjetas_honorarios_cuerpo', 'tarjetas_insignes',
            'precio_por_tarjeta', 'precio_tarjeta_extra',
            'estado', 'created_at', 'created_by', 'created_by_nombre',
            'total_asignaciones', 'total_recaudado'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_nombre(self, obj):
        return obj.created_by.username if obj.created_by else None
    
    def get_total_asignaciones(self, obj):
        return obj.asignaciones.count()
    
    def get_total_recaudado(self, obj):
        from django.db.models import Sum
        total = obj.asignaciones.aggregate(Sum('monto_pagado'))['monto_pagado__sum']
        return total or 0


class AsignacionBeneficioSerializer(serializers.ModelSerializer):
    voluntario_nombre = serializers.CharField(source='voluntario.nombre_completo', read_only=True)
    voluntario_clave = serializers.CharField(source='voluntario.clave_bombero', read_only=True)
    beneficio_nombre = serializers.CharField(source='beneficio.nombre', read_only=True)
    created_by_nombre = serializers.SerializerMethodField()
    tarjetas_disponibles = serializers.ReadOnlyField()
    total_tarjetas_vendidas = serializers.ReadOnlyField()
    
    class Meta:
        model = AsignacionBeneficio
        fields = [
            'id', 'beneficio', 'beneficio_nombre', 'voluntario', 'voluntario_nombre', 'voluntario_clave',
            'tarjetas_asignadas', 'tarjetas_vendidas', 'tarjetas_extras_vendidas', 'tarjetas_liberadas',
            'tarjetas_disponibles', 'total_tarjetas_vendidas',
            'monto_total', 'monto_pagado', 'monto_pendiente',
            'estado_pago', 'historial_liberaciones', 'observaciones',
            'created_at', 'created_by', 'created_by_nombre'
        ]
        read_only_fields = ['created_at', 'created_by', 'tarjetas_disponibles', 'total_tarjetas_vendidas']
    
    def get_created_by_nombre(self, obj):
        return obj.created_by.username if obj.created_by else None


class PagoBeneficioSerializer(serializers.ModelSerializer):
    asignacion_info = serializers.SerializerMethodField()
    created_by_nombre = serializers.SerializerMethodField()
    comprobante_url = serializers.SerializerMethodField()
    tiene_comprobante = serializers.SerializerMethodField()
    
    class Meta:
        model = PagoBeneficio
        fields = [
            'id', 'asignacion', 'asignacion_info', 'tipo_pago', 'cantidad_tarjetas',
            'fecha_pago', 'monto', 'metodo_pago',
            'numero_comprobante', 'observaciones', 'tiene_comprobante', 'comprobante_url',
            'created_at', 'created_by', 'created_by_nombre'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_nombre(self, obj):
        return obj.created_by.username if obj.created_by else None
    
    def get_asignacion_info(self, obj):
        return {
            'voluntario_nombre': obj.asignacion.voluntario.nombre_completo(),
            'voluntario_clave': obj.asignacion.voluntario.clave_bombero,
            'beneficio_nombre': obj.asignacion.beneficio.nombre
        }

    def get_comprobante_url(self, obj):
        return _obtener_comprobante_desde_solicitud(obj)

    def get_tiene_comprobante(self, obj):
        return bool(obj.comprobante_base64) or bool(self.get_comprobante_url(obj))


class CrearPagoBeneficioSerializer(serializers.Serializer):
    """Serializer para crear un pago de beneficio"""
    asignacion_id = serializers.IntegerField()
    tipo_pago = serializers.ChoiceField(choices=['normal', 'extra'])
    cantidad_tarjetas = serializers.IntegerField(min_value=1)
    monto = serializers.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = serializers.DateField(required=False)
    metodo_pago = serializers.CharField(max_length=50, required=False, allow_blank=True)
    numero_comprobante = serializers.CharField(max_length=100, required=False, allow_blank=True)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class LiberarTarjetasSerializer(serializers.Serializer):
    """Serializer para liberar tarjetas"""
    asignacion_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    motivo = serializers.CharField(max_length=200)


class MovimientoFinancieroSerializer(serializers.ModelSerializer):
    created_by_nombre = serializers.SerializerMethodField()
    comprobante_url = serializers.SerializerMethodField()
    comprobante_base64 = serializers.SerializerMethodField()
    tiene_comprobante = serializers.SerializerMethodField()
    
    class Meta:
        model = MovimientoFinanciero
        fields = [
            'id', 'tipo', 'categoria', 'monto', 'descripcion', 'fecha',
            'pago_cuota', 'pago_beneficio', 'pago_rifa',
            'numero_comprobante', 'observaciones',
            'tiene_comprobante', 'comprobante_url', 'comprobante_base64',
            'cuenta_bancaria', 'metodo_pago',
            'created_at', 'created_by', 'created_by_nombre'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_created_by_nombre(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_comprobante_url(self, obj):
        comprobante_url, _ = _obtener_comprobante_desde_movimiento(obj)
        return comprobante_url

    def get_comprobante_base64(self, obj):
        _, comprobante_base64 = _obtener_comprobante_desde_movimiento(obj)
        return comprobante_base64

    def get_tiene_comprobante(self, obj):
        comprobante_url, comprobante_base64 = _obtener_comprobante_desde_movimiento(obj)
        return bool(comprobante_url or comprobante_base64)


class ActivarEstudianteSerializer(serializers.Serializer):
    """Serializer para activar estudiante"""
    voluntario_id = serializers.IntegerField()
    fecha_activacion = serializers.DateField(required=False)
    observaciones = serializers.CharField(required=False, allow_blank=True)


class DesactivarCuotasSerializer(serializers.Serializer):
    """Serializer para desactivar cuotas"""
    voluntario_id = serializers.IntegerField()
    motivo = serializers.CharField(max_length=200)


class CicloCuotasSerializer(serializers.ModelSerializer):
    """Serializer para ciclos de cuotas anuales"""
    created_by_nombre = serializers.SerializerMethodField()
    cerrado_por_nombre = serializers.SerializerMethodField()
    total_pagos = serializers.SerializerMethodField()
    total_recaudado = serializers.SerializerMethodField()
    
    class Meta:
        model = CicloCuotas
        fields = [
            'id', 'anio', 'fecha_inicio', 'fecha_fin', 'activo', 'cerrado',
            'precio_cuota_regular', 'precio_cuota_estudiante', 'observaciones',
            'fecha_creacion', 'fecha_cierre', 'created_by', 'created_by_nombre',
            'cerrado_por', 'cerrado_por_nombre', 'total_pagos', 'total_recaudado'
        ]
        read_only_fields = ['fecha_creacion', 'fecha_cierre', 'created_by', 'cerrado_por']
    
    def get_created_by_nombre(self, obj):
        return obj.created_by.username if obj.created_by else None
    
    def get_cerrado_por_nombre(self, obj):
        return obj.cerrado_por.username if obj.cerrado_por else None
    
    def get_total_pagos(self, obj):
        """Contar pagos del año"""
        from .models import PagoCuota
        return PagoCuota.objects.filter(anio=obj.anio).count()
    
    def get_total_recaudado(self, obj):
        """Suma de pagos del año"""
        from .models import PagoCuota
        from django.db.models import Sum
        total = PagoCuota.objects.filter(anio=obj.anio).aggregate(
            total=Sum('monto_pagado')
        )['total']
        return float(total) if total else 0.0


class SubirDocumentoEstudianteSerializer(serializers.Serializer):
    """Serializer para subir documento de estudiante"""
    voluntario_id = serializers.IntegerField()
    documento_base64 = serializers.CharField()
    observaciones = serializers.CharField(required=False, allow_blank=True)
