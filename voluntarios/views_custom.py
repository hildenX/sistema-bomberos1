from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .models import *
from .forms import *

# ==================== VOLUNTARIOS ====================

@login_required
def crear_voluntario(request):
    if request.method == 'POST':
        form = VoluntarioForm(request.POST, request.FILES)
        if form.is_valid():
            voluntario = form.save(commit=False)
            voluntario.estado_bombero = 'activo'
            voluntario.created_by = request.user
            voluntario.save()
            messages.success(request, f'✅ Voluntario {voluntario.nombre_completo()} creado exitosamente')
            return redirect('sistema')
    else:
        form = VoluntarioForm()
    return render(request, 'voluntarios/crear.html', {'form': form})

@login_required
def editar_voluntario(request, pk):
    voluntario = get_object_or_404(Voluntario, pk=pk)
    if request.method == 'POST':
        form = VoluntarioForm(request.POST, request.FILES, instance=voluntario)
        if form.is_valid():
            form.save()
            messages.success(request, f'✅ Voluntario {voluntario.nombre_completo()} actualizado')
            return redirect('sistema')
    else:
        form = VoluntarioForm(instance=voluntario)
    return render(request, 'voluntarios/editar.html', {'form': form, 'voluntario': voluntario})

@login_required
def cambiar_estado_voluntario(request, pk):
    voluntario = get_object_or_404(Voluntario, pk=pk)
    if request.method == 'POST':
        form = CambiarEstadoForm(request.POST)
        if form.is_valid():
            estado = form.cleaned_data['nuevo_estado']
            fecha = form.cleaned_data['fecha']
            motivo = form.cleaned_data['motivo']
            oficio = form.cleaned_data.get('oficio_numero', '')
            
            # Guardar estado anterior
            estado_anterior = voluntario.estado_bombero
            
            # Actualizar estado
            voluntario.estado_bombero = estado
            
            # Campos específicos según estado
            if estado == 'renunciado':
                voluntario.fecha_renuncia = fecha
                voluntario.motivo_renuncia = motivo
                voluntario.oficionum_renuncia = oficio
                voluntario.antiguedad_congelada = True
                voluntario.fecha_congelamiento = fecha
            elif estado == 'separado':
                voluntario.fecha_separacion = fecha
                voluntario.motivo_separacion = motivo
                voluntario.oficionum_separacion = oficio
                voluntario.anios_separacion = form.cleaned_data.get('anios_separacion', 1)
                voluntario.antiguedad_congelada = True
                voluntario.fecha_congelamiento = fecha
            elif estado == 'expulsado':
                voluntario.fecha_expulsion = fecha
                voluntario.motivo_expulsion = motivo
                voluntario.oficionum_expulsion = oficio
            
            # Historial
            if not voluntario.historial_estados:
                voluntario.historial_estados = []
            voluntario.historial_estados.append({
                'estado_anterior': estado_anterior,
                'estado_nuevo': estado,
                'fecha': fecha.isoformat(),
                'motivo': motivo,
                'registrado_por': request.user.username
            })
            
            voluntario.save()
            messages.success(request, f'✅ Estado cambiado a {estado}')
            return redirect('sistema')
    else:
        form = CambiarEstadoForm()
    return render(request, 'voluntarios/cambiar_estado.html', {'form': form, 'voluntario': voluntario})

# ==================== SANCIONES ====================

@login_required
def crear_sancion(request):
    if request.method == 'POST':
        form = SancionForm(request.POST, request.FILES)
        if form.is_valid():
            sancion = form.save(commit=False)
            sancion.created_by = request.user
            sancion.save()
            messages.success(request, '✅ Sanción registrada exitosamente')
            return redirect('lista_sanciones')
    else:
        form = SancionForm()
    return render(request, 'sanciones/crear.html', {'form': form})

@login_required
def lista_sanciones(request):
    sanciones = Sancion.objects.all().select_related('voluntario')
    return render(request, 'sanciones/lista.html', {'sanciones': sanciones})

# ==================== CARGOS ====================

@login_required
def crear_cargo(request):
    if request.method == 'POST':
        form = CargoForm(request.POST)
        if form.is_valid():
            cargo = form.save(commit=False)
            cargo.created_by = request.user
            cargo.save()
            messages.success(request, '✅ Cargo registrado exitosamente')
            return redirect('lista_cargos')
    else:
        form = CargoForm()
    return render(request, 'cargos/crear.html', {'form': form})

@login_required
def lista_cargos(request):
    cargos = Cargo.objects.all().select_related('voluntario')
    return render(request, 'cargos/lista.html', {'cargos': cargos})

# ==================== ASISTENCIAS ====================

@login_required
def registrar_asistencia(request):
    if request.method == 'POST':
        form = AsistenciaForm(request.POST)
        if form.is_valid():
            asistencia = form.save(commit=False)
            asistencia.created_by = request.user
            asistencia.save()
            messages.success(request, '✅ Asistencia registrada')
            return redirect('lista_asistencias')
    else:
        form = AsistenciaForm()
    return render(request, 'asistencias/registrar.html', {'form': form})

@login_required
def lista_asistencias(request):
    asistencias = Asistencia.objects.all().select_related('voluntario', 'tipo_asistencia')
    return render(request, 'asistencias/lista.html', {'asistencias': asistencias})

# ==================== UNIFORMES ====================

@login_required
def crear_uniforme(request):
    if request.method == 'POST':
        form = UniformeForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, '✅ Uniforme registrado')
            return redirect('lista_uniformes')
    else:
        form = UniformeForm()
    return render(request, 'uniformes/crear.html', {'form': form})

@login_required
def entregar_uniforme(request):
    if request.method == 'POST':
        form = EntregaUniformeForm(request.POST)
        if form.is_valid():
            entrega = form.save(commit=False)
            entrega.created_by = request.user
            # Marcar uniforme como no disponible
            entrega.uniforme.disponible = False
            entrega.uniforme.save()
            entrega.save()
            messages.success(request, '✅ Uniforme entregado')
            return redirect('lista_uniformes')
    else:
        form = EntregaUniformeForm()
    return render(request, 'uniformes/entregar.html', {'form': form})

@login_required
def lista_uniformes(request):
    uniformes = Uniforme.objects.all()
    return render(request, 'uniformes/lista.html', {'uniformes': uniformes})

# ==================== TESORERÍA ====================

@login_required
def crear_cuota(request):
    if request.method == 'POST':
        form = CuotaForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, '✅ Cuota creada')
            return redirect('lista_cuotas')
    else:
        form = CuotaForm()
    return render(request, 'tesoreria/crear_cuota.html', {'form': form})

@login_required
def registrar_pago_cuota(request):
    if request.method == 'POST':
        form = PagoCuotaForm(request.POST)
        if form.is_valid():
            pago = form.save(commit=False)
            pago.created_by = request.user
            pago.save()
            messages.success(request, '✅ Pago registrado')
            return redirect('lista_pagos')
    else:
        form = PagoCuotaForm()
    return render(request, 'tesoreria/pagar_cuota.html', {'form': form})

@login_required
def lista_cuotas(request):
    cuotas = Cuota.objects.all()
    return render(request, 'tesoreria/lista_cuotas.html', {'cuotas': cuotas})

@login_required
def crear_beneficio(request):
    if request.method == 'POST':
        form = BeneficioForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, '✅ Beneficio creado')
            return redirect('lista_beneficios')
    else:
        form = BeneficioForm()
    return render(request, 'tesoreria/crear_beneficio.html', {'form': form})

@login_required
def lista_beneficios(request):
    beneficios = Beneficio.objects.all()
    return render(request, 'tesoreria/lista_beneficios.html', {'beneficios': beneficios})

# ==================== FELICITACIONES ====================

@login_required
def crear_felicitacion(request):
    if request.method == 'POST':
        form = FelicitacionForm(request.POST, request.FILES)
        if form.is_valid():
            felicitacion = form.save(commit=False)
            felicitacion.created_by = request.user
            felicitacion.save()
            messages.success(request, '✅ Felicitación registrada')
            return redirect('lista_felicitaciones')
    else:
        form = FelicitacionForm()
    return render(request, 'felicitaciones/crear.html', {'form': form})

@login_required
def lista_felicitaciones(request):
    felicitaciones = Felicitacion.objects.all().select_related('voluntario')
    return render(request, 'felicitaciones/lista.html', {'felicitaciones': felicitaciones})
