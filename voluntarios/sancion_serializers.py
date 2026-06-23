from rest_framework import serializers
from .models import Sancion, Reintegro, Voluntario
from datetime import date, timedelta


class SancionSerializer(serializers.ModelSerializer):
    """Serializer para registrar sanciones"""
    voluntario_nombre = serializers.SerializerMethodField()
    registrado_por = serializers.SerializerMethodField()
    
    class Meta:
        model = Sancion
        fields = [
            'id', 'voluntario', 'voluntario_nombre', 'tipo_sancion',
            'compania_autoridad', 'autoridad_sancionatoria',
            'fecha_desde', 'dias_sancion', 'fecha_hasta',
            'oficio_numero', 'fecha_oficio', 'motivo',
            'documento_oficio', 'created_at', 'created_by', 'registrado_por'
        ]
        read_only_fields = ['created_at', 'created_by']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()
    
    def get_registrado_por(self, obj):
        return obj.created_by.username if obj.created_by else 'Sistema'
    
    def create(self, validated_data):
        """Crear sanción y cambiar estado del voluntario automáticamente"""
        voluntario = validated_data['voluntario']
        tipo_sancion = validated_data['tipo_sancion']
        fecha_desde = validated_data['fecha_desde']
        
        # Crear la sanción
        sancion = super().create(validated_data)
        
        # Cambiar estado del voluntario según el tipo de sanción
        estado_anterior = voluntario.estado_bombero
        
        if tipo_sancion == 'renuncia':
            voluntario.estado_bombero = 'renunciado'
            voluntario.fecha_renuncia = fecha_desde
            voluntario.motivo_renuncia = validated_data['motivo']
            voluntario.antiguedad_congelada = True
            voluntario.fecha_congelamiento = fecha_desde
            
        elif tipo_sancion == 'separacion':
            voluntario.estado_bombero = 'separado'
            voluntario.fecha_separacion = fecha_desde
            # Para separación, no usamos días (es indefinido, mínimo 1 año para reintegrarse)
            voluntario.anios_separacion = None
            voluntario.fecha_fin_separacion = None
            voluntario.antiguedad_congelada = True
            voluntario.fecha_congelamiento = fecha_desde
            
        elif tipo_sancion == 'expulsion':
            voluntario.estado_bombero = 'expulsado'
            voluntario.fecha_expulsion = fecha_desde
            voluntario.motivo_expulsion = validated_data['motivo']
            voluntario.antiguedad_congelada = True
            voluntario.fecha_congelamiento = fecha_desde
        
        elif tipo_sancion == 'suspension':
            # Suspensión no cambia el estado, solo registra
            pass
        
        # Agregar al historial de estados
        if tipo_sancion in ['renuncia', 'separacion', 'expulsion']:
            if not voluntario.historial_estados:
                voluntario.historial_estados = []
            
            voluntario.historial_estados.append({
                'estadoAnterior': estado_anterior,
                'estadoNuevo': voluntario.estado_bombero,
                'fecha': fecha_desde.isoformat(),
                'motivo': f"Sanción: {validated_data['motivo']}",
                'tipo_sancion': tipo_sancion,
                'oficio': validated_data['oficio_numero'],
                'registradoPor': self.context.get('request').user.username if self.context.get('request') else 'sistema'
            })
        
        voluntario.save()
        
        print(f"[SANCIÓN] {tipo_sancion.upper()} registrada para {voluntario.clave_bombero}")
        print(f"[SANCIÓN] Estado cambió de '{estado_anterior}' a '{voluntario.estado_bombero}'")
        
        return sancion


class ReintegroSerializer(serializers.ModelSerializer):
    """Serializer para registrar reintegros"""
    voluntario_nombre = serializers.SerializerMethodField()
    puede_reintegrarse = serializers.SerializerMethodField()
    mensaje_validacion = serializers.SerializerMethodField()
    
    class Meta:
        model = Reintegro
        fields = [
            'id', 'voluntario', 'voluntario_nombre', 'estado_anterior',
            'fecha_reintegro', 'motivo_reintegro', 'oficio_numero',
            'fecha_oficio', 'documento_reintegro', 'fecha_salida',
            'tiempo_ausencia_dias', 'aprobado', 'observaciones',
            'created_at', 'created_by',
            'puede_reintegrarse', 'mensaje_validacion'
        ]
        read_only_fields = ['created_at', 'created_by', 'estado_anterior', 
                             'fecha_salida', 'tiempo_ausencia_dias']
    
    def get_voluntario_nombre(self, obj):
        return obj.voluntario.nombre_completo()
    
    def get_puede_reintegrarse(self, obj):
        puede, _ = obj.voluntario.puede_reintegrarse()
        return puede
    
    def get_mensaje_validacion(self, obj):
        _, mensaje = obj.voluntario.puede_reintegrarse()
        return mensaje
    
    def validate(self, data):
        """Validar que el voluntario pueda reintegrarse"""
        voluntario = data['voluntario']
        fecha_reintegro = data['fecha_reintegro']
        
        # Verificar estado actual
        if voluntario.estado_bombero not in ['renunciado', 'separado', 'expulsado']:
            raise serializers.ValidationError(
                f"El voluntario está en estado '{voluntario.estado_bombero}'. Solo pueden reintegrarse voluntarios renunciados, separados o expulsados."
            )
        
        # Verificar tiempos mínimos
        puede_reintegrar, mensaje = voluntario.puede_reintegrarse()
        
        if not puede_reintegrar:
            raise serializers.ValidationError(mensaje)
        
        # Validar fecha de reintegro
        if fecha_reintegro > date.today():
            raise serializers.ValidationError("La fecha de reintegro no puede ser futura.")
        
        return data
    
    def create(self, validated_data):
        """Crear reintegro y reactivar al voluntario"""
        voluntario = validated_data['voluntario']
        fecha_reintegro = validated_data['fecha_reintegro']
        
        # Guardar estado anterior
        estado_anterior = voluntario.estado_bombero
        validated_data['estado_anterior'] = estado_anterior
        
        # Calcular fecha de salida y tiempo de ausencia
        if voluntario.fecha_renuncia:
            validated_data['fecha_salida'] = voluntario.fecha_renuncia
            validated_data['tiempo_ausencia_dias'] = (fecha_reintegro - voluntario.fecha_renuncia).days
        elif voluntario.fecha_separacion:
            validated_data['fecha_salida'] = voluntario.fecha_separacion
            validated_data['tiempo_ausencia_dias'] = (fecha_reintegro - voluntario.fecha_separacion).days
        elif voluntario.fecha_expulsion:
            validated_data['fecha_salida'] = voluntario.fecha_expulsion
            validated_data['tiempo_ausencia_dias'] = (fecha_reintegro - voluntario.fecha_expulsion).days
        
        # Crear el reintegro
        reintegro = super().create(validated_data)
        
        # Reactivar al voluntario
        voluntario.estado_bombero = 'activo'
        voluntario.antiguedad_congelada = False
        voluntario.fecha_congelamiento = None
        voluntario.fecha_descongelamiento = fecha_reintegro
        
        # Agregar al historial de reintegraciones
        if not voluntario.historial_reintegraciones:
            voluntario.historial_reintegraciones = []
        
        voluntario.historial_reintegraciones.append({
            'estadoAnterior': estado_anterior,
            'fechaSalida': validated_data['fecha_salida'].isoformat() if validated_data.get('fecha_salida') else None,
            'fechaReintegro': fecha_reintegro.isoformat(),
            'diasAusencia': validated_data.get('tiempo_ausencia_dias', 0),
            'motivo': validated_data['motivo_reintegro'],
            'oficio': validated_data['oficio_numero'],
            'registradoPor': self.context.get('request').user.username if self.context.get('request') else 'sistema'
        })
        
        # Agregar al historial de estados
        if not voluntario.historial_estados:
            voluntario.historial_estados = []
        
        voluntario.historial_estados.append({
            'estadoAnterior': estado_anterior,
            'estadoNuevo': 'activo',
            'fecha': fecha_reintegro.isoformat(),
            'motivo': f"Reintegro: {validated_data['motivo_reintegro']}",
            'oficio': validated_data['oficio_numero'],
            'registradoPor': self.context.get('request').user.username if self.context.get('request') else 'sistema'
        })
        
        voluntario.save()
        
        print(f"[REINTEGRO] {voluntario.clave_bombero} reintegrado exitosamente")
        print(f"[REINTEGRO] Estado: '{estado_anterior}' → 'activo'")
        print(f"[REINTEGRO] Tiempo ausencia: {validated_data.get('tiempo_ausencia_dias', 0)} días")
        
        return reintegro
