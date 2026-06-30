from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinLengthValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
import json

class Voluntario(models.Model):
    """
    Modelo principal de Voluntario/Bombero
    Replica TODOS los campos del sistema JavaScript actual
    """
    
    # Estados posibles
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('inactivo', 'Inactivo'),
        ('renunciado', 'Renunciado'),
        ('separado', 'Separado'),
        ('expulsado', 'Expulsado'),
        ('martir', 'Mártir'),
        ('fallecido', 'Fallecido'),
    ]
    
    # Información básica
    nombre = models.CharField(max_length=100, blank=True, null=True)
    apellido_paterno = models.CharField(max_length=100, blank=True, null=True)
    apellido_materno = models.CharField(max_length=100, blank=True, null=True)
    rut = models.CharField(max_length=12, unique=True, validators=[MinLengthValidator(9)])
    clave_bombero = models.CharField(max_length=20, blank=True, null=True)
    
    # Datos personales
    fecha_nacimiento = models.DateField(blank=True, null=True)
    domicilio = models.CharField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    profesion = models.CharField(max_length=100, blank=True, null=True)
    grupo_sanguineo = models.CharField(max_length=5, blank=True, null=True)
    
    # Datos de bombero
    fecha_ingreso = models.DateField(blank=True, null=True)
    # Fecha base para calcular la antiguedad reconocida (ajustada por reintegros / servicio
    # previo reconocido). Si esta seteada, se usa ESTA en vez de fecha_ingreso para la
    # antiguedad y la categoria (Honorario / Insigne). Si es None, se usa fecha_ingreso.
    fecha_ingreso_efectiva = models.DateField(blank=True, null=True)
    nro_registro = models.CharField(max_length=50, blank=True, null=True)
    compania = models.CharField(max_length=100, blank=True, null=True)
    
    # Padrinos (requeridos en p6p)
    nombre_primer_padrino = models.CharField(max_length=200, blank=True, null=True)
    nombre_segundo_padrino = models.CharField(max_length=200, blank=True, null=True)
    
    # Otros cuerpos de bomberos
    otros_cuerpos = models.CharField(max_length=200, blank=True, null=True)
    compania_opcional = models.CharField(max_length=100, blank=True, null=True)
    desde = models.CharField(max_length=50, blank=True, null=True)
    hasta = models.CharField(max_length=50, blank=True, null=True)
    
    # Estado del voluntario
    estado_bombero = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activo')
    
    # Campos para estados especiales
    # Renunciado
    fecha_renuncia = models.DateField(blank=True, null=True)
    motivo_renuncia = models.TextField(blank=True, null=True)
    oficionum_renuncia = models.CharField(max_length=100, blank=True, null=True)
    documento_renuncia = models.FileField(upload_to='renuncias/', blank=True, null=True)
    
    # Separado
    fecha_separacion = models.DateField(blank=True, null=True)
    anios_separacion = models.IntegerField(blank=True, null=True)
    fecha_fin_separacion = models.DateField(blank=True, null=True)
    motivo_separacion = models.TextField(blank=True, null=True)
    oficionum_separacion = models.CharField(max_length=100, blank=True, null=True)
    documento_separacion = models.FileField(upload_to='separaciones/', blank=True, null=True)
    
    # Expulsado
    fecha_expulsion = models.DateField(blank=True, null=True)
    motivo_expulsion = models.TextField(blank=True, null=True)
    oficionum_expulsion = models.CharField(max_length=100, blank=True, null=True)
    documento_expulsion = models.FileField(upload_to='expulsiones/', blank=True, null=True)
    
    # Mártir
    fecha_martir = models.DateField(blank=True, null=True)
    causa_martir = models.TextField(blank=True, null=True)
    oficionum_martir = models.CharField(max_length=100, blank=True, null=True)
    documento_martir = models.FileField(upload_to='martires/', blank=True, null=True)
    
    # Fallecido
    fecha_fallecimiento = models.DateField(blank=True, null=True)
    causa_fallecimiento = models.TextField(blank=True, null=True)
    oficionum_fallecimiento = models.CharField(max_length=100, blank=True, null=True)
    documento_fallecimiento = models.FileField(upload_to='fallecimientos/', blank=True, null=True)
    
    # Antigüedad congelada
    antiguedad_congelada = models.BooleanField(default=False)
    fecha_congelamiento = models.DateField(blank=True, null=True)
    fecha_descongelamiento = models.DateField(blank=True, null=True)
    
    # Foto
    foto = models.ImageField(upload_to='fotos/', blank=True, null=True)
    
    # Cuotas
    cuotas_activas = models.BooleanField(default=True)
    fecha_cambio_cuotas = models.DateTimeField(blank=True, null=True)
    
    # Estudiante
    es_estudiante = models.BooleanField(default=False)
    fecha_inicio_estudiante = models.DateField(blank=True, null=True)
    fecha_fin_estudiante = models.DateField(blank=True, null=True)
    certificado_estudiante = models.FileField(upload_to='certificados/', blank=True, null=True)
    fecha_activacion_estudiante = models.DateTimeField(blank=True, null=True)
    
    # Historial (JSON fields)
    historial_estados = models.JSONField(default=list, blank=True)
    historial_reintegraciones = models.JSONField(default=list, blank=True)
    
    # Posición por antigüedad (calculado)
    posicion_por_antiguedad = models.IntegerField(blank=True, null=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='voluntarios_creados')
    
    class Meta:
        ordering = ['fecha_ingreso']  # Ordenar por antigüedad
        verbose_name = 'Voluntario'
        verbose_name_plural = 'Voluntarios'
    
    def __str__(self):
        return f"{self.clave_bombero} - {self.nombre} {self.apellido_paterno}"
    
    def nombre_completo(self):
        """Retorna el nombre completo"""
        if self.apellido_materno:
            return f"{self.nombre} {self.apellido_paterno} {self.apellido_materno}"
        return f"{self.nombre} {self.apellido_paterno}"
    
    def edad(self):
        """Calcula la edad del voluntario"""
        from datetime import date
        today = date.today()
        return today.year - self.fecha_nacimiento.year - (
            (today.month, today.day) < (self.fecha_nacimiento.month, self.fecha_nacimiento.day)
        )
    
    @property
    def fecha_base_antiguedad(self):
        """
        Fecha que se usa para calcular la antiguedad reconocida.
        Usa fecha_ingreso_efectiva (ajustada por reintegros / servicio previo)
        si existe; si no, cae a la fecha_ingreso real.
        """
        return self.fecha_ingreso_efectiva or self.fecha_ingreso

    def antiguedad_detallada(self):
        """Calcula la antigüedad en años, meses y días"""
        from datetime import date

        # Si está congelada, usar fecha de congelamiento
        if self.antiguedad_congelada and self.fecha_congelamiento:
            fecha_hasta = self.fecha_congelamiento
        else:
            fecha_hasta = date.today()

        fecha_desde = self.fecha_base_antiguedad
        
        años = fecha_hasta.year - fecha_desde.year
        meses = fecha_hasta.month - fecha_desde.month
        dias = fecha_hasta.day - fecha_desde.day
        
        if dias < 0:
            meses -= 1
            dias += 30
        
        if meses < 0:
            años -= 1
            meses += 12
        
        return {
            'años': años,
            'meses': meses,
            'dias': dias
        }
    
    def puede_reintegrarse(self):
        """
        Verifica si el voluntario puede reintegrarse según las reglas:
        - Renunciado: Puede reintegrarse inmediatamente (0 días)
        - Separado: Debe esperar mínimo 1 año desde fecha de separación
        - Expulsado: Debe esperar mínimo 2 años desde fecha de expulsión
        - Mártir/Fallecido: No puede reintegrarse
        """
        from datetime import date, timedelta
        
        # Mártir y Fallecido no pueden reintegrarse
        if self.estado_bombero in ['martir', 'fallecido']:
            return False, "Voluntarios mártires o fallecidos no pueden reintegrarse"
        
        # Activo o Inactivo no necesitan reintegrarse
        if self.estado_bombero in ['activo', 'inactivo']:
            return False, "El voluntario ya está activo"
        
        # Solo renunciado, separado y expulsado pueden reintegrarse
        if self.estado_bombero not in ['renunciado', 'separado', 'expulsado']:
            return False, "Solo voluntarios renunciados, separados o expulsados pueden reintegrarse"
        
        hoy = date.today()
        
        # RENUNCIADO: Puede reintegrarse inmediatamente
        if self.estado_bombero == 'renunciado':
            return True, "✅ Puede reintegrarse inmediatamente (sin tiempo mínimo)"
        
        # SEPARADO: Debe esperar mínimo 1 año
        if self.estado_bombero == 'separado':
            if not self.fecha_separacion:
                return False, "❌ No hay fecha de separación registrada"
            
            fecha_minima = self.fecha_separacion + timedelta(days=365)  # 1 año
            dias_transcurridos = (hoy - self.fecha_separacion).days
            
            if hoy >= fecha_minima:
                return True, f"✅ Puede reintegrarse (han pasado {dias_transcurridos} días, mínimo 365)"
            else:
                dias_faltan = (fecha_minima - hoy).days
                return False, f"❌ Debe esperar hasta {fecha_minima.strftime('%d/%m/%Y')} ({dias_faltan} días restantes)"
        
        # EXPULSADO: Debe esperar mínimo 2 años
        if self.estado_bombero == 'expulsado':
            if not self.fecha_expulsion:
                return False, "❌ No hay fecha de expulsión registrada"
            
            fecha_minima = self.fecha_expulsion + timedelta(days=730)  # 2 años
            dias_transcurridos = (hoy - self.fecha_expulsion).days
            
            if hoy >= fecha_minima:
                return True, f"✅ Puede reintegrarse (han pasado {dias_transcurridos} días, mínimo 730)"
            else:
                dias_faltan = (fecha_minima - hoy).days
                return False, f"❌ Debe esperar hasta {fecha_minima.strftime('%d/%m/%Y')} ({dias_faltan} días restantes)"
        
        return False, "❌ No se puede determinar elegibilidad"


class Cargo(models.Model):
    """Modelo para registrar cargos de voluntarios"""
    
    TIPO_CARGO_CHOICES = [
        ('comandancia', 'Comandancia'),
        ('compania', 'Compañía'),
        ('consejo', 'Consejo de Compañía'),
        ('tecnico', 'Confianza'),
    ]
    
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='cargos')
    tipo_cargo = models.CharField(max_length=20, choices=TIPO_CARGO_CHOICES)
    nombre_cargo = models.CharField(max_length=100)
    anio = models.IntegerField()
    fecha_inicio = models.DateField(blank=True, null=True)
    fecha_fin = models.DateField(blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-anio', '-fecha_inicio']
        verbose_name = 'Cargo'
        verbose_name_plural = 'Cargos'
    
    def __str__(self):
        return f"{self.voluntario.clave_bombero} - {self.nombre_cargo} ({self.anio})"


class Sancion(models.Model):
    """Modelo para registrar sanciones"""
    
    TIPO_SANCION_CHOICES = [
        ('suspension', 'Suspensión'),
        ('renuncia', 'Renuncia'),
        ('separacion', 'Separación'),
        ('expulsion', 'Expulsión'),
    ]
    
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='sanciones')
    tipo_sancion = models.CharField(max_length=20, choices=TIPO_SANCION_CHOICES)
    compania_autoridad = models.CharField(max_length=100, blank=True, null=True)
    autoridad_sancionatoria = models.CharField(max_length=100, blank=True, null=True)
    fecha_desde = models.DateField()
    dias_sancion = models.IntegerField(blank=True, null=True)
    fecha_hasta = models.DateField(blank=True, null=True)
    oficio_numero = models.CharField(max_length=100)
    fecha_oficio = models.DateField()
    motivo = models.TextField()
    documento_oficio = models.FileField(upload_to='sanciones/', blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha_desde']
        verbose_name = 'Sanción'
        verbose_name_plural = 'Sanciones'
    
    def __str__(self):
        return f"{self.voluntario.clave_bombero} - {self.tipo_sancion} ({self.fecha_desde})"


class Reintegro(models.Model):
    """Modelo para registrar reintegros de voluntarios"""
    
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='reintegros')
    estado_anterior = models.CharField(max_length=20)
    fecha_reintegro = models.DateField()
    motivo_reintegro = models.TextField()
    oficio_numero = models.CharField(max_length=100)
    fecha_oficio = models.DateField()
    documento_reintegro = models.FileField(upload_to='reintegros/', blank=True, null=True)
    
    fecha_salida = models.DateField(null=True, blank=True)
    tiempo_ausencia_dias = models.IntegerField(null=True, blank=True)
    
    aprobado = models.BooleanField(default=True)
    observaciones = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha_reintegro']
        verbose_name = 'Reintegro'
        verbose_name_plural = 'Reintegros'
    
    def __str__(self):
        return f"{self.voluntario.clave_bombero} - Reintegro ({self.fecha_reintegro})"


# ==================== ASISTENCIAS ====================

class TipoAsistencia(models.Model):
    """Tipos de asistencia: Asamblea, Citación, Ejercicio, Otras"""
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Tipo de Asistencia'
        verbose_name_plural = 'Tipos de Asistencia'
        ordering = ['nombre']
    
    def __str__(self):
        return self.nombre


class Asistencia(models.Model):
    """Registro de asistencia a actividades"""
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='asistencias')
    tipo_asistencia = models.ForeignKey(TipoAsistencia, on_delete=models.PROTECT)
    fecha_hora = models.DateTimeField()
    presente = models.BooleanField(default=True)
    justificada = models.BooleanField(default=False)
    motivo_inasistencia = models.TextField(blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = 'Asistencia'
        verbose_name_plural = 'Asistencias'
        unique_together = ['voluntario', 'tipo_asistencia', 'fecha_hora']
    
    def __str__(self):
        estado = "Presente" if self.presente else "Ausente"
        return f"{self.voluntario.clave_bombero} - {self.tipo_asistencia.nombre} - {estado} ({self.fecha_hora.date()})"


# ==================== UNIFORMES ====================

class ContadorUniformes(models.Model):
    """Singleton para contadores independientes por tipo de uniforme"""
    id_estructural = models.IntegerField(default=1)
    id_forestal = models.IntegerField(default=1)
    id_rescate = models.IntegerField(default=1)
    id_hazmat = models.IntegerField(default=1)
    id_tenida_cuartel = models.IntegerField(default=1)
    id_accesorios = models.IntegerField(default=1)
    id_parada = models.IntegerField(default=1)
    id_usar = models.IntegerField(default=1)
    id_agreste = models.IntegerField(default=1)
    id_um6 = models.IntegerField(default=1)
    id_gersa = models.IntegerField(default=1)
    
    class Meta:
        verbose_name = 'Contador de Uniformes'
        verbose_name_plural = 'Contadores de Uniformes'
    
    @classmethod
    def obtener_siguiente_id(cls, tipo_uniforme):
        """Obtiene y actualiza el contador para un tipo específico"""
        contador, created = cls.objects.get_or_create(pk=1)
        # Normalizar nombre del campo
        campo_contador = f'id_{tipo_uniforme.lower().replace("-", "_")}'
        if hasattr(contador, campo_contador):
            valor_actual = getattr(contador, campo_contador)
            setattr(contador, campo_contador, valor_actual + 1)
            contador.save()
            return valor_actual
        return 1


class Uniforme(models.Model):
    """Registro principal de uniformes con ID custom"""
    TIPO_CHOICES = [
        ('estructural', 'Estructural'),
        ('forestal', 'Forestal'),
        ('rescate', 'Rescate'),
        ('hazmat', 'Hazmat'),
        ('tenidaCuartel', 'Tenida de Cuartel'),
        ('accesorios', 'Accesorios'),
        ('parada', 'Parada'),
        ('usar', 'USAR'),
        ('agreste', 'AGRESTE'),
        ('um6', 'UM-6'),
        ('gersa', 'GERSA')
    ]
    
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('devuelto', 'Devuelto')
    ]
    
    # Identificación
    id = models.CharField(max_length=20, primary_key=True)  # TIPO-NNN
    bombero = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='uniformes')
    tipo_uniforme = models.CharField(max_length=20, choices=TIPO_CHOICES)
    
    # Metadatos
    fecha_registro = models.DateTimeField(auto_now_add=True)
    registrado_por = models.CharField(max_length=100)
    observaciones = models.TextField(blank=True, null=True)
    
    # Estado
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='activo')
    fecha_devolucion = models.DateTimeField(blank=True, null=True)
    devuelto_por = models.CharField(max_length=100, blank=True, null=True)
    
    class Meta:
        ordering = ['-fecha_registro']
        verbose_name = 'Uniforme'
        verbose_name_plural = 'Uniformes'
    
    def __str__(self):
        return f"{self.id} - {self.get_tipo_uniforme_display()}"


class PiezaUniforme(models.Model):
    """Artículos individuales de cada uniforme"""
    CONDICION_CHOICES = [
        ('nuevo', 'Nuevo'),
        ('semi-nuevo', 'Semi-Nuevo'),
        ('usado', 'Usado')
    ]
    
    ESTADO_FISICO_CHOICES = [
        ('bueno', 'Bueno'),
        ('regular', 'Regular'),
        ('malo', 'Malo')
    ]
    
    ESTADO_PIEZA_CHOICES = [
        ('activo', 'Activo'),
        ('devuelto', 'Devuelto')
    ]
    
    PAR_SIMPLE_CHOICES = [
        ('Simple', 'Simple'),
        ('Par', 'Par')
    ]
    
    CONDICION_DEVOLUCION_CHOICES = [
        ('nuevo', 'Como Nuevo'),
        ('semi-nuevo', 'Semi-Nuevo'),
        ('usado', 'Usado'),
        ('muy_usado', 'Muy Usado')
    ]
    
    ESTADO_DEVOLUCION_CHOICES = [
        ('bueno', 'Bueno'),
        ('regular', 'Regular'),
        ('malo', 'Malo'),
        ('deteriorado', 'Muy Deteriorado')
    ]
    
    # Relación
    uniforme = models.ForeignKey(Uniforme, on_delete=models.CASCADE, related_name='piezas')
    
    # Información del artículo
    componente = models.CharField(max_length=100)
    nombre_personalizado = models.CharField(max_length=200, blank=True, null=True)
    marca = models.CharField(max_length=100, blank=True, null=True)
    serie = models.CharField(max_length=100, blank=True, null=True)
    talla = models.CharField(max_length=20, blank=True, null=True)
    
    # Estado y Condición
    condicion = models.CharField(max_length=20, choices=CONDICION_CHOICES)
    estado_fisico = models.CharField(max_length=20, choices=ESTADO_FISICO_CHOICES)
    
    # Control de unidades
    unidad = models.IntegerField(default=1)  # 1=Simple, 2=Par
    par_simple = models.CharField(max_length=10, choices=PAR_SIMPLE_CHOICES, default='Simple')
    
    # Fechas
    fecha_entrega = models.DateField()
    
    # Estado
    estado_pieza = models.CharField(max_length=10, choices=ESTADO_PIEZA_CHOICES, default='activo')
    
    # Devolución
    fecha_devolucion = models.DateTimeField(blank=True, null=True)
    devuelto_por = models.CharField(max_length=100, blank=True, null=True)
    estado_devolucion = models.CharField(max_length=20, choices=ESTADO_DEVOLUCION_CHOICES, blank=True, null=True)
    condicion_devolucion = models.CharField(max_length=20, choices=CONDICION_DEVOLUCION_CHOICES, blank=True, null=True)
    observaciones_devolucion = models.TextField(blank=True, null=True)
    
    # Control de modificaciones
    ultima_modificacion = models.JSONField(blank=True, null=True)
    historial_cambios = models.JSONField(default=list, blank=True)
    
    class Meta:
        ordering = ['id']
        verbose_name = 'Pieza de Uniforme'
        verbose_name_plural = 'Piezas de Uniformes'
    
    def __str__(self):
        nombre = self.nombre_personalizado or self.componente
        return f"{self.uniforme.id} - {nombre}"


# ==================== FINANZAS ====================

class Cuota(models.Model):
    """Cuotas mensuales del cuerpo"""
    mes = models.IntegerField()  # 1-12
    anio = models.IntegerField()
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-anio', '-mes']
        verbose_name = 'Cuota'
        verbose_name_plural = 'Cuotas'
        unique_together = ['mes', 'anio']
    
    def __str__(self):
        meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        return f"{meses[self.mes]} {self.anio} - ${self.monto}"


class PagoCuota(models.Model):
    """Registro de pagos de cuotas mensuales por voluntarios"""
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='pagos_cuotas')
    
    # Período de la cuota
    mes = models.IntegerField()  # 1-12
    anio = models.IntegerField()
    
    # Pago
    fecha_pago = models.DateField(default=timezone.now)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(max_length=50, blank=True, null=True)  # Efectivo, Transferencia, etc.
    numero_comprobante = models.CharField(max_length=100, blank=True, null=True)
    comprobante_base64 = models.TextField(blank=True, null=True, help_text="Imagen/PDF del comprobante en Base64")
    observaciones = models.TextField(blank=True, null=True)
    cuenta_bancaria = models.ForeignKey(
        'CuentaBancaria', on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Null = Efectivo/Caja"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-anio', '-mes', '-fecha_pago']
        verbose_name = 'Pago de Cuota'
        verbose_name_plural = 'Pagos de Cuotas'
        unique_together = ['voluntario', 'mes', 'anio']  # Un pago por mes/año
    
    def __str__(self):
        meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        return f"{self.voluntario.clave_bombero} - {meses[self.mes]} {self.anio} - ${self.monto_pagado}"


class Beneficio(models.Model):
    """
    Eventos/Beneficios con venta de tarjetas
    Asignación automática a todos los voluntarios por categoría
    """
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('cerrado', 'Cerrado'),
    ]
    
    TIPO_CHOICES = [
        ('Curanto', 'Curanto'),
        ('Bingo', 'Bingo'),
        ('Rifa', 'Rifa'),
        ('Asado', 'Asado'),
        ('Otro', 'Otro'),
    ]

    nombre = models.CharField(max_length=200, help_text="Nombre del evento/beneficio")
    tipo = models.CharField(max_length=100, blank=True, null=True, help_text="Tipo de beneficio")
    descripcion = models.TextField(blank=True, default='')
    fecha_evento = models.DateField(help_text="Fecha del evento")
    fecha_limite_rendicion = models.DateField(null=True, blank=True, help_text="Fecha límite para rendir tarjetas")
    
    # Tarjetas por categoría de antigüedad
    tarjetas_voluntarios = models.IntegerField(default=5, help_text="0-19 años")
    tarjetas_honorarios_cia = models.IntegerField(default=3, help_text="20-24 años")
    tarjetas_honorarios_cuerpo = models.IntegerField(default=3, help_text="25-49 años")
    tarjetas_insignes = models.IntegerField(default=2, help_text="50+ años")
    
    # Precios
    precio_por_tarjeta = models.DecimalField(max_digits=10, decimal_places=2)
    precio_tarjeta_extra = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Precio para ventas extras (más allá de las asignadas)"
    )
    
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='activo')
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha_evento']
        verbose_name = 'Beneficio'
        verbose_name_plural = 'Beneficios'
    
    def __str__(self):
        return f"{self.nombre} - {self.fecha_evento}"


class CicloBeneficios(models.Model):
    """
    Ciclo anual de beneficios (tarjetas)
    Define el periodo anual de gestión de beneficios, similar a CicloCuotas
    """
    anio = models.IntegerField(unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    activo = models.BooleanField(default=False, help_text="Solo un ciclo activo a la vez")
    cerrado = models.BooleanField(default=False, help_text="Si está cerrado, no se pueden crear más beneficios")
    observaciones = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(blank=True, null=True, help_text="Fecha en que se cerró el ciclo")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    cerrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='ciclos_beneficios_cerrados')

    class Meta:
        ordering = ['-anio']
        verbose_name = 'Ciclo de Beneficios'
        verbose_name_plural = 'Ciclos de Beneficios'

    def save(self, *args, **kwargs):
        if self.activo:
            CicloBeneficios.objects.exclude(pk=self.pk if self.pk else 0).filter(activo=True).update(activo=False)
        super().save(*args, **kwargs)

    def __str__(self):
        estado = 'Cerrado' if self.cerrado else ('Activo' if self.activo else 'Inactivo')
        return f"Ciclo Beneficios {self.anio} ({estado})"


class AsignacionBeneficio(models.Model):
    """
    Asignación de tarjetas de beneficio a voluntarios
    Creado automáticamente al crear un beneficio
    """
    ESTADO_PAGO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('parcial', 'Parcial'),
        ('completo', 'Completo'),
        ('liberado', 'Liberado'),
    ]
    
    beneficio = models.ForeignKey(Beneficio, on_delete=models.PROTECT, related_name='asignaciones')
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='beneficios_asignados')
    
    # Tarjetas
    tarjetas_asignadas = models.IntegerField(help_text="Tarjetas asignadas según categoría")
    tarjetas_vendidas = models.IntegerField(default=0, help_text="Tarjetas vendidas (normal)")
    tarjetas_extras_vendidas = models.IntegerField(default=0, help_text="Tarjetas vendidas extra")
    tarjetas_liberadas = models.IntegerField(default=0, help_text="Tarjetas liberadas")
    
    # Montos
    monto_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_pendiente = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    estado_pago = models.CharField(max_length=20, choices=ESTADO_PAGO_CHOICES, default='pendiente')
    
    # Historial de liberaciones (JSON)
    historial_liberaciones = models.TextField(blank=True, null=True, help_text="JSON con historial")
    
    observaciones = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-beneficio__fecha_evento']
        verbose_name = 'Asignación de Beneficio'
        verbose_name_plural = 'Asignaciones de Beneficios'
        unique_together = ['beneficio', 'voluntario']  # Una asignación por voluntario por beneficio
    
    def __str__(self):
        return f"{self.voluntario.clave_bombero} - {self.beneficio.nombre}"
    
    @property
    def tarjetas_disponibles(self):
        """Tarjetas que aún puede vender (asignadas - vendidas - liberadas)"""
        return self.tarjetas_asignadas - self.tarjetas_vendidas - self.tarjetas_liberadas
    
    @property
    def total_tarjetas_vendidas(self):
        """Total de tarjetas vendidas (normales + extras)"""
        return self.tarjetas_vendidas + self.tarjetas_extras_vendidas


class PagoBeneficio(models.Model):
    """
    Registro de pagos de beneficios
    Puede ser pago normal o venta extra
    """
    TIPO_PAGO_CHOICES = [
        ('normal', 'Pago Normal'),
        ('extra', 'Venta Extra'),
    ]
    
    asignacion = models.ForeignKey(AsignacionBeneficio, on_delete=models.CASCADE, related_name='pagos')
    tipo_pago = models.CharField(max_length=10, choices=TIPO_PAGO_CHOICES, default='normal')
    
    # Si es normal: cantidad de tarjetas asignadas que se venden
    # Si es extra: cantidad de tarjetas extras que se venden
    cantidad_tarjetas = models.IntegerField(default=1)
    
    fecha_pago = models.DateField(default=timezone.now)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(max_length=50, blank=True, null=True)
    numero_comprobante = models.CharField(max_length=100, blank=True, null=True)
    comprobante_base64 = models.TextField(blank=True, null=True, help_text="Imagen/PDF del comprobante en Base64")
    observaciones = models.TextField(blank=True, null=True)
    cuenta_bancaria = models.ForeignKey(
        'CuentaBancaria', on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Null = Efectivo/Caja"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-fecha_pago']
        verbose_name = 'Pago de Beneficio'
        verbose_name_plural = 'Pagos de Beneficios'
    
    def __str__(self):
        tipo = "Extra" if self.tipo_pago == 'extra' else "Normal"
        return f"{self.asignacion.voluntario.clave_bombero} - {tipo} - ${self.monto} ({self.fecha_pago})"


# ==================== FELICITACIONES ====================

class Felicitacion(models.Model):
    """Felicitaciones y reconocimientos a voluntarios"""
    TIPO_CHOICES = [
        ('destacado', 'Desempeño Destacado'),
        ('merito', 'Mérito Extraordinario'),
        ('valor', 'Acto de Valor'),
        ('servicio', 'Servicio Distinguido'),
        ('antiguedad', 'Reconocimiento por Antigüedad'),
        ('otra', 'Otra Felicitación'),
    ]
    
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, related_name='felicitaciones')
    tipo_felicitacion = models.CharField(max_length=20, choices=TIPO_CHOICES, default='destacado')
    nombre_felicitacion = models.CharField(max_length=200, blank=True, null=True, help_text='Nombre específico cuando el tipo es "Otra"')
    compania_otorgante = models.CharField(max_length=200, blank=True, null=True)
    autoridad_otorgante = models.CharField(max_length=200, blank=True, null=True)
    fecha_felicitacion = models.DateField(default=timezone.now)
    oficio_numero = models.CharField(max_length=100, default='S/N')
    fecha_oficio = models.DateField(blank=True, null=True)
    motivo = models.TextField(default='Sin especificar')
    documento_felicitacion = models.TextField(blank=True, null=True, help_text='Documento en base64')
    documento_nombre_original = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha_felicitacion']
        verbose_name = 'Felicitación'
        verbose_name_plural = 'Felicitaciones'
    
    def __str__(self):
        return f"{self.voluntario.clave_bombero} - {self.get_tipo_felicitacion_display()} - {self.fecha_felicitacion}"


# ==================== SISTEMA DE ASISTENCIAS COMPLETO (P6P) ====================

class VoluntarioExterno(models.Model):
    """Catálogo de voluntarios externos (participantes y canjes)"""
    TIPO_CHOICES = [
        ('participante', 'Participante'),
        ('canje', 'Canje'),
    ]
    
    codigo = models.CharField(max_length=20, unique=True)  # EXT-P-001, EXT-C-001
    nombre_completo = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    total_asistencias = models.IntegerField(default=0)
    fecha_primera_asistencia = models.DateField(blank=True, null=True)
    fecha_ultima_asistencia = models.DateField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['codigo']
        verbose_name = 'Voluntario Externo'
        verbose_name_plural = 'Voluntarios Externos'
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre_completo}"


class EventoAsistencia(models.Model):
    """
    Evento/Actividad con asistencia grupal
    Replica el sistema de asistencias del p6p
    """
    TIPO_CHOICES = [
        ('emergencia', 'Emergencia'),
        ('asamblea', 'Asamblea'),
        ('ejercicios', 'Ejercicios'),
        ('citaciones', 'Citaciones'),
        ('otras', 'Otras'),
        ('directorio', 'Directorio de Compañía'),
    ]
    
    TIPO_ASAMBLEA_CHOICES = [
        ('ordinaria', 'Ordinaria'),
        ('extraordinaria', 'Extraordinaria'),
    ]
    
    TIPO_EJERCICIO_CHOICES = [
        ('compania', 'Compañía'),
        ('cuerpo', 'Cuerpo'),
    ]
    
    # Identificación
    id_evento = models.BigIntegerField(unique=True)  # Timestamp como en p6p
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    fecha = models.DateField()
    descripcion = models.TextField()
    
    # Campos específicos por tipo
    clave_emergencia = models.CharField(max_length=50, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    hora_emergencia = models.TimeField(blank=True, null=True)  # DEPRECATED - usar hora_inicio/hora_termino
    hora_inicio = models.TimeField(blank=True, null=True, verbose_name="Hora de inicio")
    hora_termino = models.TimeField(blank=True, null=True, verbose_name="Hora de término")
    
    tipo_asamblea = models.CharField(max_length=20, choices=TIPO_ASAMBLEA_CHOICES, blank=True, null=True)
    tipo_ejercicio = models.CharField(max_length=20, choices=TIPO_EJERCICIO_CHOICES, blank=True, null=True)
    nombre_citacion = models.CharField(max_length=200, blank=True, null=True)
    motivo_otras = models.CharField(max_length=200, blank=True, null=True)
    
    # Estadísticas
    total_asistentes = models.IntegerField(default=0)
    oficiales_comandancia = models.IntegerField(default=0)
    oficiales_compania = models.IntegerField(default=0)
    total_oficiales = models.IntegerField(default=0)
    cargos_confianza = models.IntegerField(default=0)
    voluntarios = models.IntegerField(default=0)
    participantes = models.IntegerField(default=0)  # Externos participantes
    canjes = models.IntegerField(default=0)  # Externos canjes
    porcentaje_asistencia = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Metadata
    observaciones = models.TextField(blank=True, null=True)
    suma_ranking = models.BooleanField(default=True, help_text="Si False, no cuenta para el ranking anual (ej: directorio)")
    fecha_registro = models.DateTimeField(auto_now_add=True)
    registrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha', '-fecha_registro']
        verbose_name = 'Evento de Asistencia'
        verbose_name_plural = 'Eventos de Asistencia'
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.fecha} ({self.total_asistentes} asistentes)"


class DetalleAsistencia(models.Model):
    """
    Detalle de asistentes a un evento
    Puede ser voluntario regular o externo
    """
    evento = models.ForeignKey(EventoAsistencia, on_delete=models.CASCADE, related_name='asistentes')
    
    # Voluntario regular o externo
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, null=True, blank=True, related_name='eventos_asistidos')
    externo = models.ForeignKey(VoluntarioExterno, on_delete=models.CASCADE, null=True, blank=True, related_name='eventos_asistidos')
    
    # Información del asistente en el momento del evento
    nombre_completo = models.CharField(max_length=200)
    clave_bombero = models.CharField(max_length=20, blank=True, null=True)
    categoria = models.CharField(max_length=100, blank=True, null=True)
    cargo = models.CharField(max_length=100, blank=True, null=True)
    anio_cargo = models.IntegerField(blank=True, null=True)
    
    # Flags
    es_externo = models.BooleanField(default=False)
    tipo_externo = models.CharField(max_length=20, blank=True, null=True)  # participante/canje
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['categoria', 'nombre_completo']
        verbose_name = 'Detalle de Asistencia'
        verbose_name_plural = 'Detalles de Asistencia'
    
    def __str__(self):
        return f"{self.nombre_completo} → {self.evento.tipo} ({self.evento.fecha})"


class RankingAsistencia(models.Model):
    """
    Ranking anual de asistencias por voluntario
    """
    anio = models.IntegerField()
    
    # Voluntario regular o externo
    voluntario = models.ForeignKey(Voluntario, on_delete=models.CASCADE, null=True, blank=True, related_name='ranking_anual')
    externo = models.ForeignKey(VoluntarioExterno, on_delete=models.CASCADE, null=True, blank=True, related_name='ranking_anual')
    
    # Información
    nombre_completo = models.CharField(max_length=200)
    clave_bombero = models.CharField(max_length=20, blank=True, null=True)
    
    # Contadores por tipo
    total = models.IntegerField(default=0)
    emergencias = models.IntegerField(default=0)
    asambleas = models.IntegerField(default=0)
    ejercicios = models.IntegerField(default=0)
    citaciones = models.IntegerField(default=0)
    otras = models.IntegerField(default=0)
    
    # Flags
    es_externo = models.BooleanField(default=False)
    tipo_externo = models.CharField(max_length=20, blank=True, null=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-anio', '-total']
        verbose_name = 'Ranking de Asistencia'
        verbose_name_plural = 'Rankings de Asistencia'
        unique_together = [
            ['anio', 'voluntario'],
            ['anio', 'externo'],
        ]
    
    def __str__(self):
        return f"{self.nombre_completo} - {self.anio} ({self.total} asistencias)"


class CicloAsistencia(models.Model):
    """
    Ciclo anual de asistencias
    Define periodos y configuraciones
    """
    anio = models.IntegerField(unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    activo = models.BooleanField(default=True)
    
    # Configuraciones
    minimo_asistencias_emergencias = models.IntegerField(default=0)
    minimo_asistencias_asambleas = models.IntegerField(default=0)
    minimo_asistencias_ejercicios = models.IntegerField(default=0)
    
    observaciones = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-anio']
        verbose_name = 'Ciclo de Asistencia'
        verbose_name_plural = 'Ciclos de Asistencia'
    
    def __str__(self):
        return f"Ciclo {self.anio} ({'Activo' if self.activo else 'Inactivo'})"


# ==================== LOGOS DE COMPAÑÍA ====================

class LogoCompania(models.Model):
    """Logos de la compañía para usar en diferentes contextos del sistema"""
    nombre = models.CharField(max_length=100, help_text="Nombre descriptivo del logo (ej: Logo Oficial, Logo Aniversario)")
    imagen = models.TextField(help_text="Imagen en formato Base64")
    descripcion = models.TextField(blank=True, null=True, help_text="Descripción u ocasión de uso")
    
    # Contextos de uso (un logo puede estar en múltiples lugares)
    usar_en_pdfs = models.BooleanField(default=False, help_text="Usar en PDFs (fichas, certificados, etc.)")
    usar_en_asistencias = models.BooleanField(default=False, help_text="Usar en headers de asistencias")
    usar_en_sidebar = models.BooleanField(default=False, help_text="Usar en el sidebar del sistema")
    
    # Metadata
    fecha_carga = models.DateTimeField(auto_now_add=True)
    cargado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-fecha_carga']
        verbose_name = 'Logo de Compañía'
        verbose_name_plural = 'Logos de Compañía'
    
    def __str__(self):
        usos = []
        if self.usar_en_pdfs:
            usos.append("PDFs")
        if self.usar_en_asistencias:
            usos.append("Asistencias")
        if self.usar_en_sidebar:
            usos.append("Sidebar")
        
        if usos:
            return f"{self.nombre} ({', '.join(usos)})"
        return f"{self.nombre} (Sin uso)"
    
    def save(self, *args, **kwargs):
        # Si este logo se marca para PDFs, desactivar PDFs en otros
        if self.usar_en_pdfs:
            LogoCompania.objects.filter(usar_en_pdfs=True).exclude(pk=self.pk).update(usar_en_pdfs=False)
        
        # Si este logo se marca para Asistencias, desactivar Asistencias en otros
        if self.usar_en_asistencias:
            LogoCompania.objects.filter(usar_en_asistencias=True).exclude(pk=self.pk).update(usar_en_asistencias=False)
        
        # Si este logo se marca para Sidebar, desactivar Sidebar en otros
        if self.usar_en_sidebar:
            LogoCompania.objects.filter(usar_en_sidebar=True).exclude(pk=self.pk).update(usar_en_sidebar=False)
        
        super().save(*args, **kwargs)


# ==================== CONFIGURACIÓN DE TESORERÍA ====================

class ConfiguracionCuotas(models.Model):
    """
    Configuración Singleton para precios de cuotas
    Solo puede existir UNA instancia
    """
    precio_regular = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=5000,
        help_text="Precio cuota mensual regular"
    )
    precio_estudiante = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=3000,
        help_text="Precio cuota mensual estudiante"
    )
    
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_actualizacion = models.DateTimeField(auto_now=True)
    actualizado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        verbose_name = 'Configuración de Cuotas'
        verbose_name_plural = 'Configuración de Cuotas'
    
    def __str__(self):
        return f"Regular: ${self.precio_regular} | Estudiante: ${self.precio_estudiante}"
    
    def save(self, *args, **kwargs):
        # Singleton: solo puede haber una instancia
        if not self.pk and ConfiguracionCuotas.objects.exists():
            # Si ya existe, actualizar la existente
            existing = ConfiguracionCuotas.objects.first()
            existing.precio_regular = self.precio_regular
            existing.precio_estudiante = self.precio_estudiante
            existing.actualizado_por = self.actualizado_por
            existing.save()
            return existing
        return super().save(*args, **kwargs)


class EstadoCuotasBombero(models.Model):
    """
    Control individual de cuotas por voluntario
    - es_estudiante: Cobra precio estudiante
    - cuotas_desactivadas: NO aparece como deudor
    """
    voluntario = models.OneToOneField(
        Voluntario, 
        on_delete=models.CASCADE, 
        related_name='estado_cuotas'
    )
    
    # ESTUDIANTE
    es_estudiante = models.BooleanField(
        default=False,
        help_text="Si está activo, cobra precio estudiante"
    )
    fecha_activacion_estudiante = models.DateField(blank=True, null=True)
    documento_estudiante = models.TextField(
        blank=True, 
        null=True,
        help_text="Certificado de alumno regular en Base64"
    )
    observaciones_estudiante = models.TextField(blank=True, null=True)
    
    # DESACTIVACIÓN DE CUOTAS (Honorarios/Insignes)
    cuotas_desactivadas = models.BooleanField(
        default=False,
        help_text="Si está activo, NO aparece en lista de deudores"
    )
    motivo_desactivacion = models.CharField(max_length=200, blank=True, null=True)
    fecha_desactivacion = models.DateTimeField(blank=True, null=True)
    desactivado_por = models.CharField(max_length=100, blank=True, null=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Estado de Cuotas de Voluntario'
        verbose_name_plural = 'Estados de Cuotas de Voluntarios'
    
    def __str__(self):
        estado = []
        if self.es_estudiante:
            estado.append("Estudiante")
        if self.cuotas_desactivadas:
            estado.append("Cuotas Desactivadas")
        
        if estado:
            return f"{self.voluntario.clave_bombero} - {', '.join(estado)}"
        return f"{self.voluntario.clave_bombero} - Regular"


class CuentaBancaria(models.Model):
    """
    Cuenta bancaria de la compañía.
    El efectivo se registra en la Caja virtual (cuenta_bancaria=None).
    """
    TIPO_CHOICES = [
        ('corriente', 'Corriente'),
        ('ahorro', 'Ahorro'),
        ('vista', 'Vista'),
    ]
    nombre = models.CharField(max_length=150, help_text="Ej: Cuerpo de Bomberos de Puerto Montt")
    rut_titular = models.CharField(max_length=20, blank=True, default='', help_text="Ej: 61.123.456-7")
    banco = models.CharField(max_length=100)
    numero_cuenta = models.CharField(max_length=50, blank=True)
    tipo_cuenta = models.CharField(max_length=20, choices=TIPO_CHOICES, default='corriente')
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Cuenta Bancaria'
        verbose_name_plural = 'Cuentas Bancarias'

    def __str__(self):
        return f"{self.nombre} ({self.banco})"


class DepositoCaja(models.Model):
    """
    Registro de traslado de efectivo (Caja) a una Cuenta Bancaria.
    Reduce el saldo de Caja y aumenta el saldo de la cuenta destino.
    """
    cuenta_destino = models.ForeignKey(
        CuentaBancaria, on_delete=models.PROTECT, related_name='depositos'
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha = models.DateField(default=timezone.now)
    hora = models.TimeField(blank=True, null=True)
    numero_comprobante = models.CharField(max_length=100, blank=True)
    comprobante_base64 = models.TextField(blank=True, null=True, help_text="Imagen/PDF en Base64")
    observaciones = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-fecha', '-created_at']
        verbose_name = 'Depósito de Caja'
        verbose_name_plural = 'Depósitos de Caja'

    def __str__(self):
        return f"Depósito ${self.monto} → {self.cuenta_destino.nombre} ({self.fecha})"


class MovimientoFinanciero(models.Model):
    """
    Libro contable automático
    Registra todos los ingresos y egresos
    """
    TIPO_CHOICES = [
        ('ingreso', 'Ingreso'),
        ('egreso', 'Egreso'),
    ]
    
    CATEGORIA_CHOICES = [
        ('cuota', 'Cuota Mensual'),
        ('beneficio', 'Beneficio'),
        ('rifa', 'Rifa'),
        ('rifa_retiro', 'Retiro Fondos Rifa'),
        ('donacion', 'Donación'),
        ('multa', 'Multa'),
        ('otro_ingreso', 'Otro Ingreso'),
        ('gasto_operacional', 'Gasto Operacional'),
        ('gasto_equipamiento', 'Gasto Equipamiento'),
        ('otro_egreso', 'Otro Egreso'),
    ]
    
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.TextField()
    fecha = models.DateField(default=timezone.now)
    
    # Referencias opcionales
    pago_cuota = models.ForeignKey(
        'PagoCuota', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='movimientos'
    )
    pago_beneficio = models.ForeignKey(
        PagoBeneficio,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos'
    )
    pago_rifa = models.ForeignKey(
        'PagoRifa',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos'
    )

    numero_comprobante = models.CharField(max_length=100, blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)

    # Trazabilidad de cuenta
    cuenta_bancaria = models.ForeignKey(
        'CuentaBancaria', on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Null = Caja/Efectivo"
    )
    metodo_pago = models.CharField(max_length=20, default='efectivo',
                                   help_text="efectivo | transferencia")

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-fecha', '-created_at']
        verbose_name = 'Movimiento Financiero'
        verbose_name_plural = 'Movimientos Financieros'
    
    def __str__(self):
        signo = "+" if self.tipo == 'ingreso' else "-"
        return f"{signo}${self.monto} - {self.get_categoria_display()} ({self.fecha})"


class CicloCuotas(models.Model):
    """
    Ciclo anual de cuotas
    Define periodos y configuraciones similares a CicloAsistencia
    """
    anio = models.IntegerField(unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    activo = models.BooleanField(default=True)
    cerrado = models.BooleanField(default=False, help_text="Si está cerrado, no se pueden registrar más pagos")
    
    # Configuraciones
    precio_cuota_regular = models.DecimalField(max_digits=10, decimal_places=2, default=5000)
    precio_cuota_estudiante = models.DecimalField(max_digits=10, decimal_places=2, default=3000)
    
    observaciones = models.TextField(blank=True, null=True)
    
    # Metadata
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(blank=True, null=True, help_text="Fecha en que se cerró el ciclo")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    cerrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='ciclos_cerrados')
    
    class Meta:
        ordering = ['-anio']
        verbose_name = 'Ciclo de Cuotas'
        verbose_name_plural = 'Ciclos de Cuotas'
    
    def __str__(self):
        estado = 'Cerrado' if self.cerrado else ('Activo' if self.activo else 'Inactivo')
        return f"Ciclo Cuotas {self.anio} ({estado})"
    
    def save(self, *args, **kwargs):
        # Si se activa este ciclo, desactivar los demás
        if self.activo and not self.pk:
            CicloCuotas.objects.filter(activo=True).update(activo=False)
        elif self.activo and self.pk:
            CicloCuotas.objects.exclude(pk=self.pk).filter(activo=True).update(activo=False)
        super().save(*args, **kwargs)


class Rifa(models.Model):
    ciclo = models.CharField(max_length=10)           # "2025"
    nombre = models.CharField(max_length=200)         # "Rifa 2025"
    fecha_inicio = models.DateField()
    fecha_cierre = models.DateField()
    precio_numero = models.DecimalField(max_digits=10, decimal_places=2)
    numeros_por_talonario = models.IntegerField()
    talonarios_voluntarios = models.IntegerField(default=0)
    talonarios_honorarios_cia = models.IntegerField(default=0)
    talonarios_honorarios_cuerpo = models.IntegerField(default=0)
    talonarios_insignes = models.IntegerField(default=0)
    estado = models.CharField(max_length=20, default='activa')  # activa | cerrada
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='rifas_creadas')

    class Meta:
        ordering = ['-ciclo']

    def __str__(self):
        return f"{self.nombre} ({self.estado})"


class AsignacionRifa(models.Model):
    ESTADO_CHOICES = [
        ('no_retirada', 'No Retirada'),
        ('retirada', 'Retirada'),
        ('pagada', 'Pagada'),
        ('liberada', 'Liberada'),
    ]
    rifa = models.ForeignKey(Rifa, on_delete=models.PROTECT, related_name='asignaciones')
    voluntario = models.ForeignKey(Voluntario, on_delete=models.PROTECT, related_name='rifas_asignadas')
    talonarios_asignados = models.IntegerField()
    numeros = models.TextField(blank=True, default='[]')  # JSON: [{"desde":1,"hasta":100}]
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='no_retirada')
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    historial_liberaciones = models.TextField(blank=True, null=True)  # JSON
    fecha_retiro = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def monto_pendiente(self):
        return self.monto_total - self.monto_pagado

    def __str__(self):
        return f"{self.rifa} - {self.voluntario}"


class PagoRifa(models.Model):
    asignacion = models.ForeignKey(AsignacionRifa, on_delete=models.PROTECT, related_name='pagos')
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = models.DateField(default=timezone.now)
    metodo_pago = models.CharField(max_length=20, default='efectivo')  # efectivo | transferencia
    cuenta_bancaria = models.ForeignKey(CuentaBancaria, on_delete=models.SET_NULL, null=True, blank=True)
    numero_comprobante = models.CharField(max_length=100, blank=True)
    comprobante_base64 = models.TextField(null=True, blank=True)
    observaciones = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pago Rifa {self.asignacion} - ${self.monto}"


class PortalVoluntarioProfile(models.Model):
    """
    Vincula un voluntario con un usuario de acceso al portal de pagos.
    """
    voluntario = models.OneToOneField(
        Voluntario,
        on_delete=models.CASCADE,
        related_name='portal_profile'
    )
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='portal_profile'
    )
    activo = models.BooleanField(default=True)
    debe_cambiar_clave = models.BooleanField(default=True)
    ultimo_acceso = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['voluntario__apellido_paterno', 'voluntario__nombre']
        verbose_name = 'Perfil Portal Voluntario'
        verbose_name_plural = 'Perfiles Portal Voluntarios'

    def __str__(self):
        return f"{self.voluntario} -> {self.user.username}"


class SolicitudPagoPortal(models.Model):
    """
    Solicitud de pago enviada por el voluntario para revisión del tesorero.
    """
    TIPO_PAGO_CHOICES = [
        ('cuota', 'Cuota Social'),
        ('beneficio', 'Beneficio'),
        ('rifa', 'Rifa'),
    ]

    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('observada', 'Observada'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
        ('expirada', 'Expirada'),
    ]

    TIPO_PAGO_BENEFICIO_CHOICES = [
        ('normal', 'Normal'),
        ('extra', 'Extra'),
    ]

    voluntario = models.ForeignKey(
        Voluntario,
        on_delete=models.CASCADE,
        related_name='solicitudes_portal'
    )
    portal_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='solicitudes_portal'
    )

    tipo_pago = models.CharField(max_length=20, choices=TIPO_PAGO_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')

    # Referencias a la deuda/origen
    cuota_mes = models.IntegerField(blank=True, null=True)
    cuota_anio = models.IntegerField(blank=True, null=True)
    asignacion_beneficio = models.ForeignKey(
        AsignacionBeneficio,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='solicitudes_portal'
    )
    tipo_pago_beneficio = models.CharField(
        max_length=10,
        choices=TIPO_PAGO_BENEFICIO_CHOICES,
        default='normal'
    )
    asignacion_rifa = models.ForeignKey(
        AsignacionRifa,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        related_name='solicitudes_portal'
    )

    nombre_pago = models.CharField(max_length=200)
    cantidad = models.IntegerField(blank=True, null=True)
    monto_solicitado = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_pago = models.DateField(default=timezone.now)
    descripcion = models.TextField(blank=True, null=True)
    numero_comprobante = models.CharField(max_length=100, blank=True, null=True)
    comprobante = models.FileField(upload_to='portal/comprobantes/%Y/%m/', blank=True, null=True)

    feedback_tesorero = models.TextField(blank=True, null=True)
    observada_hasta = models.DateTimeField(blank=True, null=True)

    cuenta_bancaria_destino = models.ForeignKey(
        CuentaBancaria,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='solicitudes_portal'
    )

    revisada_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='solicitudes_portal_revisadas'
    )
    revisada_at = models.DateTimeField(blank=True, null=True)
    aprobada_at = models.DateTimeField(blank=True, null=True)

    pago_cuota = models.ForeignKey(
        PagoCuota,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='solicitudes_portal'
    )
    pago_beneficio = models.ForeignKey(
        PagoBeneficio,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='solicitudes_portal'
    )
    pago_rifa = models.ForeignKey(
        PagoRifa,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='solicitudes_portal'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Solicitud de Pago Portal'
        verbose_name_plural = 'Solicitudes de Pago Portal'

    def __str__(self):
        return f"{self.voluntario} - {self.get_tipo_pago_display()} - {self.get_estado_display()}"

    def clean(self):
        if self.tipo_pago == 'cuota':
            if not self.cuota_mes or not self.cuota_anio:
                raise ValidationError('La solicitud de cuota requiere mes y año.')
            if self.asignacion_beneficio_id or self.asignacion_rifa_id:
                raise ValidationError('La solicitud de cuota no debe vincular beneficios ni rifas.')

        elif self.tipo_pago == 'beneficio':
            if not self.asignacion_beneficio_id:
                raise ValidationError('La solicitud de beneficio requiere una asignación de beneficio.')
            if self.cantidad is None or self.cantidad <= 0:
                raise ValidationError('La solicitud de beneficio requiere una cantidad válida.')
            if self.cuota_mes or self.cuota_anio or self.asignacion_rifa_id:
                raise ValidationError('La solicitud de beneficio no debe mezclar referencias de otros módulos.')

        elif self.tipo_pago == 'rifa':
            if not self.asignacion_rifa_id:
                raise ValidationError('La solicitud de rifa requiere una asignación de rifa.')
            if self.cuota_mes or self.cuota_anio or self.asignacion_beneficio_id:
                raise ValidationError('La solicitud de rifa no debe mezclar referencias de otros módulos.')

    @property
    def puede_ser_corregida(self):
        return self.estado in ['observada', 'expirada']
