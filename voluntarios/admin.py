from django.contrib import admin
from .models import (
    Voluntario, Cargo, Sancion,
    TipoAsistencia, Asistencia,
    Uniforme, PiezaUniforme, ContadorUniformes,
    Cuota, PagoCuota, Beneficio, AsignacionBeneficio, PagoBeneficio,
    ConfiguracionCuotas, EstadoCuotasBombero, MovimientoFinanciero,
    Felicitacion, LogoCompania
)

@admin.register(Voluntario)
class VoluntarioAdmin(admin.ModelAdmin):
    list_display = ['clave_bombero', 'nombre_completo', 'rut', 'estado_bombero', 'fecha_ingreso', 'compania']
    list_filter = ['estado_bombero', 'compania', 'es_estudiante', 'cuotas_activas']
    search_fields = ['nombre', 'apellido_paterno', 'apellido_materno', 'rut', 'clave_bombero']
    ordering = ['fecha_ingreso']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('nombre', 'apellido_paterno', 'apellido_materno', 'rut', 'clave_bombero', 'foto')
        }),
        ('Datos Personales', {
            'fields': ('fecha_nacimiento', 'domicilio', 'telefono', 'email', 'profesion', 'grupo_sanguineo')
        }),
        ('Datos de Bombero', {
            'fields': ('fecha_ingreso', 'nro_registro', 'compania', 'estado_bombero')
        }),
        ('Renunciado', {
            'fields': ('fecha_renuncia', 'motivo_renuncia', 'oficionum_renuncia', 'documento_renuncia'),
            'classes': ('collapse',)
        }),
        ('Separado', {
            'fields': ('fecha_separacion', 'anios_separacion', 'fecha_fin_separacion', 'motivo_separacion', 'oficionum_separacion', 'documento_separacion'),
            'classes': ('collapse',)
        }),
        ('Expulsado', {
            'fields': ('fecha_expulsion', 'motivo_expulsion', 'oficionum_expulsion', 'documento_expulsion'),
            'classes': ('collapse',)
        }),
        ('Mártir', {
            'fields': ('fecha_martir', 'causa_martir', 'oficionum_martir', 'documento_martir'),
            'classes': ('collapse',)
        }),
        ('Fallecido', {
            'fields': ('fecha_fallecimiento', 'causa_fallecimiento', 'oficionum_fallecimiento', 'documento_fallecimiento'),
            'classes': ('collapse',)
        }),
        ('Antigüedad', {
            'fields': ('antiguedad_congelada', 'fecha_congelamiento', 'fecha_descongelamiento')
        }),
        ('Cuotas y Estudiante', {
            'fields': ('cuotas_activas', 'es_estudiante', 'fecha_inicio_estudiante', 'fecha_fin_estudiante', 'certificado_estudiante')
        }),
    )

@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'nombre_cargo', 'tipo_cargo', 'anio', 'fecha_inicio', 'fecha_fin']
    list_filter = ['tipo_cargo', 'anio']
    search_fields = ['voluntario__nombre', 'voluntario__apellido_paterno', 'nombre_cargo']
    ordering = ['-anio', '-fecha_inicio']

@admin.register(Sancion)
class SancionAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'tipo_sancion', 'fecha_desde', 'fecha_hasta', 'autoridad_sancionatoria']
    list_filter = ['tipo_sancion', 'autoridad_sancionatoria']
    search_fields = ['voluntario__nombre', 'voluntario__apellido_paterno', 'motivo']
    ordering = ['-fecha_desde']

# ==================== ASISTENCIAS ====================

@admin.register(TipoAsistencia)
class TipoAsistenciaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo']
    list_filter = ['activo']
    search_fields = ['nombre']

@admin.register(Asistencia)
class AsistenciaAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'tipo_asistencia', 'fecha_hora', 'presente', 'justificada']
    list_filter = ['tipo_asistencia', 'presente', 'justificada', 'fecha_hora']
    search_fields = ['voluntario__nombre', 'voluntario__apellido_paterno', 'voluntario__clave_bombero']
    ordering = ['-fecha_hora']
    date_hierarchy = 'fecha_hora'

# ==================== UNIFORMES ====================

class PiezaUniformeInline(admin.TabularInline):
    model = PiezaUniforme
    extra = 1
    fields = ['componente', 'nombre_personalizado', 'marca', 'serie', 'talla', 
              'condicion', 'estado_fisico', 'fecha_entrega', 'estado_pieza']
    readonly_fields = ['unidad', 'par_simple']

@admin.register(Uniforme)
class UniformeAdmin(admin.ModelAdmin):
    list_display = ['id', 'tipo_uniforme', 'bombero', 'estado', 'fecha_registro']
    list_filter = ['tipo_uniforme', 'estado', 'fecha_registro']
    search_fields = ['id', 'bombero__nombre', 'bombero__apellido_paterno']
    ordering = ['-fecha_registro']
    inlines = [PiezaUniformeInline]

@admin.register(PiezaUniforme)
class PiezaUniformeAdmin(admin.ModelAdmin):
    list_display = ['uniforme', 'componente', 'nombre_personalizado', 'condicion', 
                   'estado_fisico', 'estado_pieza', 'fecha_entrega']
    list_filter = ['estado_pieza', 'condicion', 'estado_fisico', 'fecha_entrega']
    search_fields = ['uniforme__id', 'componente', 'nombre_personalizado']
    ordering = ['-fecha_entrega']

@admin.register(ContadorUniformes)
class ContadorUniformesAdmin(admin.ModelAdmin):
    list_display = ['id', 'id_estructural', 'id_forestal', 'id_rescate', 'id_hazmat',
                   'id_tenida_cuartel', 'id_accesorios', 'id_parada']
    
    def has_add_permission(self, request):
        # Solo permitir 1 instancia (singleton)
        return ContadorUniformes.objects.count() == 0
    
    def has_delete_permission(self, request, obj=None):
        # No permitir eliminar el contador
        return False

# ==================== FINANZAS ====================

@admin.register(Cuota)
class CuotaAdmin(admin.ModelAdmin):
    list_display = ['mes', 'anio', 'monto']
    list_filter = ['anio', 'mes']
    ordering = ['-anio', '-mes']

@admin.register(PagoCuota)
class PagoCuotaAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'mes', 'anio', 'fecha_pago', 'monto_pagado', 'metodo_pago']
    list_filter = ['anio', 'mes', 'fecha_pago', 'metodo_pago']
    search_fields = ['voluntario__nombre', 'voluntario__clave_bombero', 'numero_comprobante']
    ordering = ['-anio', '-mes', '-fecha_pago']
    date_hierarchy = 'fecha_pago'

@admin.register(Beneficio)
class BeneficioAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'fecha_evento', 'precio_por_tarjeta', 'estado']
    list_filter = ['estado', 'fecha_evento']
    search_fields = ['nombre', 'descripcion']
    date_hierarchy = 'fecha_evento'

@admin.register(AsignacionBeneficio)
class AsignacionBeneficioAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'beneficio', 'tarjetas_asignadas', 'tarjetas_vendidas', 'tarjetas_extras_vendidas', 'estado_pago']
    list_filter = ['estado_pago', 'beneficio']
    search_fields = ['voluntario__nombre', 'voluntario__clave_bombero', 'beneficio__nombre']
    ordering = ['-beneficio__fecha_evento']

@admin.register(PagoBeneficio)
class PagoBeneficioAdmin(admin.ModelAdmin):
    list_display = ['asignacion', 'tipo_pago', 'cantidad_tarjetas', 'fecha_pago', 'monto', 'metodo_pago']
    list_filter = ['tipo_pago', 'fecha_pago', 'metodo_pago']
    search_fields = ['asignacion__voluntario__nombre', 'numero_comprobante']
    ordering = ['-fecha_pago']

# ==================== CONFIGURACIÓN TESORERÍA ====================

@admin.register(ConfiguracionCuotas)
class ConfiguracionCuotasAdmin(admin.ModelAdmin):
    list_display = ['precio_regular', 'precio_estudiante', 'ultima_actualizacion', 'actualizado_por']
    
    def has_add_permission(self, request):
        # Solo permitir una instancia
        return not ConfiguracionCuotas.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        # No permitir eliminar
        return False

@admin.register(EstadoCuotasBombero)
class EstadoCuotasBomberoAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'es_estudiante', 'cuotas_desactivadas', 'ultima_actualizacion']
    list_filter = ['es_estudiante', 'cuotas_desactivadas']
    search_fields = ['voluntario__nombre', 'voluntario__clave_bombero']
    ordering = ['voluntario__clave_bombero']

@admin.register(MovimientoFinanciero)
class MovimientoFinancieroAdmin(admin.ModelAdmin):
    list_display = ['fecha', 'tipo', 'categoria', 'monto', 'descripcion']
    list_filter = ['tipo', 'categoria', 'fecha']
    search_fields = ['descripcion', 'numero_comprobante']
    ordering = ['-fecha', '-created_at']
    date_hierarchy = 'fecha'

# ==================== FELICITACIONES ====================

@admin.register(Felicitacion)
class FelicitacionAdmin(admin.ModelAdmin):
    list_display = ['voluntario', 'tipo_felicitacion', 'fecha_felicitacion', 'autoridad_otorgante']
    list_filter = ['tipo_felicitacion', 'fecha_felicitacion']
    search_fields = ['voluntario__nombre', 'voluntario__clave_bombero', 'motivo', 'nombre_felicitacion']
    ordering = ['-fecha_felicitacion']
    date_hierarchy = 'fecha_felicitacion'


# ==================== LOGOS ====================

@admin.register(LogoCompania)
class LogoCompaniaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'usar_en_pdfs', 'usar_en_asistencias', 'usar_en_sidebar', 'fecha_carga', 'cargado_por']
    list_filter = ['usar_en_pdfs', 'usar_en_asistencias', 'usar_en_sidebar', 'fecha_carga']
    search_fields = ['nombre', 'descripcion']
    ordering = ['-fecha_carga']
    readonly_fields = ['fecha_carga', 'cargado_por']
    
    fieldsets = (
        ('Información del Logo', {
            'fields': ('nombre', 'descripcion')
        }),
        ('Contextos de Uso', {
            'fields': ('usar_en_pdfs', 'usar_en_asistencias', 'usar_en_sidebar')
        }),
        ('Imagen (Base64)', {
            'fields': ('imagen',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('fecha_carga', 'cargado_por'),
            'classes': ('collapse',)
        }),
    )
