from django import forms
from .models import (
    Voluntario, Cargo, Sancion, 
    Asistencia, TipoAsistencia,
    Uniforme, EntregaUniforme,
    Cuota, PagoCuota, Beneficio, AsignacionBeneficio,
    Felicitacion
)

class VoluntarioForm(forms.ModelForm):
    class Meta:
        model = Voluntario
        fields = [
            'nombre', 'apellido_paterno', 'apellido_materno', 'rut', 'clave_bombero',
            'fecha_nacimiento', 'domicilio', 'telefono', 'email', 'profesion', 'grupo_sanguineo',
            'fecha_ingreso', 'nro_registro', 'compania', 'foto'
        ]
        widgets = {
            'fecha_nacimiento': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'fecha_ingreso': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'apellido_paterno': forms.TextInput(attrs={'class': 'form-control'}),
            'apellido_materno': forms.TextInput(attrs={'class': 'form-control'}),
            'rut': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '12345678-9'}),
            'clave_bombero': forms.TextInput(attrs={'class': 'form-control'}),
            'domicilio': forms.TextInput(attrs={'class': 'form-control'}),
            'telefono': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'profesion': forms.TextInput(attrs={'class': 'form-control'}),
            'grupo_sanguineo': forms.TextInput(attrs={'class': 'form-control'}),
            'nro_registro': forms.TextInput(attrs={'class': 'form-control'}),
            'compania': forms.TextInput(attrs={'class': 'form-control'}),
        }

class CambiarEstadoForm(forms.Form):
    ESTADO_CHOICES = [
        ('renunciado', 'Renunciado'),
        ('separado', 'Separado'),
        ('expulsado', 'Expulsado'),
        ('inactivo', 'Inactivo'),
    ]
    
    nuevo_estado = forms.ChoiceField(choices=ESTADO_CHOICES, widget=forms.Select(attrs={'class': 'form-control'}))
    fecha = forms.DateField(widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}))
    motivo = forms.CharField(widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 4}))
    oficio_numero = forms.CharField(required=False, widget=forms.TextInput(attrs={'class': 'form-control'}))
    anios_separacion = forms.IntegerField(required=False, widget=forms.NumberInput(attrs={'class': 'form-control'}))

class SancionForm(forms.ModelForm):
    class Meta:
        model = Sancion
        fields = ['voluntario', 'tipo_sancion', 'compania_autoridad', 'autoridad_sancionatoria',
                  'fecha_desde', 'dias_sancion', 'fecha_hasta', 'oficio_numero', 'fecha_oficio', 
                  'motivo', 'documento_oficio']
        widgets = {
            'voluntario': forms.Select(attrs={'class': 'form-control'}),
            'tipo_sancion': forms.Select(attrs={'class': 'form-control'}),
            'compania_autoridad': forms.TextInput(attrs={'class': 'form-control'}),
            'autoridad_sancionatoria': forms.TextInput(attrs={'class': 'form-control'}),
            'fecha_desde': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'dias_sancion': forms.NumberInput(attrs={'class': 'form-control'}),
            'fecha_hasta': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'oficio_numero': forms.TextInput(attrs={'class': 'form-control'}),
            'fecha_oficio': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'motivo': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
        }

class CargoForm(forms.ModelForm):
    class Meta:
        model = Cargo
        fields = ['voluntario', 'tipo_cargo', 'nombre_cargo', 'anio', 'fecha_inicio', 'fecha_fin', 'observaciones']
        widgets = {
            'voluntario': forms.Select(attrs={'class': 'form-control'}),
            'tipo_cargo': forms.Select(attrs={'class': 'form-control'}),
            'nombre_cargo': forms.TextInput(attrs={'class': 'form-control'}),
            'anio': forms.NumberInput(attrs={'class': 'form-control'}),
            'fecha_inicio': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'fecha_fin': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'observaciones': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class AsistenciaForm(forms.ModelForm):
    class Meta:
        model = Asistencia
        fields = ['voluntario', 'tipo_asistencia', 'fecha_hora', 'presente', 'justificada', 
                  'motivo_inasistencia', 'observaciones']
        widgets = {
            'voluntario': forms.Select(attrs={'class': 'form-control'}),
            'tipo_asistencia': forms.Select(attrs={'class': 'form-control'}),
            'fecha_hora': forms.DateTimeInput(attrs={'type': 'datetime-local', 'class': 'form-control'}),
            'presente': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'justificada': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'motivo_inasistencia': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'observaciones': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class UniformeForm(forms.ModelForm):
    class Meta:
        model = Uniforme
        fields = ['codigo', 'tipo', 'condicion', 'estado_fisico', 'tiene_jardinera', 
                  'tiene_chaqueta', 'tiene_casco', 'observaciones']
        widgets = {
            'codigo': forms.TextInput(attrs={'class': 'form-control'}),
            'tipo': forms.Select(attrs={'class': 'form-control'}),
            'condicion': forms.Select(attrs={'class': 'form-control'}),
            'estado_fisico': forms.Select(attrs={'class': 'form-control'}),
            'tiene_jardinera': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'tiene_chaqueta': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'tiene_casco': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'observaciones': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class EntregaUniformeForm(forms.ModelForm):
    class Meta:
        model = EntregaUniforme
        fields = ['uniforme', 'voluntario', 'fecha_entrega', 'estado_entrega', 'observaciones_entrega']
        widgets = {
            'uniforme': forms.Select(attrs={'class': 'form-control'}),
            'voluntario': forms.Select(attrs={'class': 'form-control'}),
            'fecha_entrega': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'estado_entrega': forms.TextInput(attrs={'class': 'form-control'}),
            'observaciones_entrega': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class CuotaForm(forms.ModelForm):
    class Meta:
        model = Cuota
        fields = ['mes', 'anio', 'monto', 'descripcion']
        widgets = {
            'mes': forms.NumberInput(attrs={'class': 'form-control', 'min': 1, 'max': 12}),
            'anio': forms.NumberInput(attrs={'class': 'form-control'}),
            'monto': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'descripcion': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class PagoCuotaForm(forms.ModelForm):
    class Meta:
        model = PagoCuota
        fields = ['voluntario', 'cuota', 'fecha_pago', 'monto_pagado', 'metodo_pago', 
                  'numero_comprobante', 'observaciones']
        widgets = {
            'voluntario': forms.Select(attrs={'class': 'form-control'}),
            'cuota': forms.Select(attrs={'class': 'form-control'}),
            'fecha_pago': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'monto_pagado': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'metodo_pago': forms.TextInput(attrs={'class': 'form-control'}),
            'numero_comprobante': forms.TextInput(attrs={'class': 'form-control'}),
            'observaciones': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }

class BeneficioForm(forms.ModelForm):
    class Meta:
        model = Beneficio
        fields = ['nombre', 'descripcion', 'monto', 'estado', 'cupos_totales', 'cupos_disponibles']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'descripcion': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'monto': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'estado': forms.Select(attrs={'class': 'form-control'}),
            'cupos_totales': forms.NumberInput(attrs={'class': 'form-control'}),
            'cupos_disponibles': forms.NumberInput(attrs={'class': 'form-control'}),
        }

class FelicitacionForm(forms.ModelForm):
    class Meta:
        model = Felicitacion
        fields = ['voluntario', 'motivo', 'fecha', 'otorgado_por', 'documento']
        widgets = {
            'voluntario': forms.Select(attrs={'class': 'form-control'}),
            'motivo': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'fecha': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'otorgado_por': forms.TextInput(attrs={'class': 'form-control'}),
        }
