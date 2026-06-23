# Generated manually for Sistema de Tesorería

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('voluntarios', '0012_nuevo_sistema_uniformes'),
    ]

    operations = [
        # ============ CREAR NUEVOS MODELOS ============
        
        # ConfiguracionCuotas (Singleton)
        migrations.CreateModel(
            name='ConfiguracionCuotas',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('precio_regular', models.DecimalField(decimal_places=2, default=5000, help_text='Precio cuota mensual regular', max_digits=10)),
                ('precio_estudiante', models.DecimalField(decimal_places=2, default=3000, help_text='Precio cuota mensual estudiante', max_digits=10)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('ultima_actualizacion', models.DateTimeField(auto_now=True)),
                ('actualizado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Configuración de Cuotas',
                'verbose_name_plural': 'Configuración de Cuotas',
            },
        ),
        
        # EstadoCuotasBombero (NUEVO)
        migrations.CreateModel(
            name='EstadoCuotasBombero',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('es_estudiante', models.BooleanField(default=False, help_text='Si está activo, cobra precio estudiante')),
                ('fecha_activacion_estudiante', models.DateField(blank=True, null=True)),
                ('observaciones_estudiante', models.TextField(blank=True, null=True)),
                ('cuotas_desactivadas', models.BooleanField(default=False, help_text='Si está activo, NO aparece en lista de deudores')),
                ('motivo_desactivacion', models.CharField(blank=True, max_length=200, null=True)),
                ('fecha_desactivacion', models.DateTimeField(blank=True, null=True)),
                ('desactivado_por', models.CharField(blank=True, max_length=100, null=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('ultima_actualizacion', models.DateTimeField(auto_now=True)),
                ('voluntario', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='estado_cuotas', to='voluntarios.voluntario')),
            ],
            options={
                'verbose_name': 'Estado de Cuotas de Voluntario',
                'verbose_name_plural': 'Estados de Cuotas de Voluntarios',
            },
        ),
        
        # MovimientoFinanciero
        migrations.CreateModel(
            name='MovimientoFinanciero',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('ingreso', 'Ingreso'), ('egreso', 'Egreso')], max_length=10)),
                ('categoria', models.CharField(choices=[('cuota', 'Cuota Mensual'), ('beneficio', 'Beneficio'), ('donacion', 'Donación'), ('multa', 'Multa'), ('otro_ingreso', 'Otro Ingreso'), ('gasto_operacional', 'Gasto Operacional'), ('gasto_equipamiento', 'Gasto Equipamiento'), ('otro_egreso', 'Otro Egreso')], max_length=30)),
                ('monto', models.DecimalField(decimal_places=2, max_digits=10)),
                ('descripcion', models.TextField()),
                ('fecha', models.DateField(default=django.utils.timezone.now)),
                ('numero_comprobante', models.CharField(blank=True, max_length=100, null=True)),
                ('observaciones', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('pago_cuota', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='movimientos', to='voluntarios.pagocuota')),
                ('pago_beneficio', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='movimientos', to='voluntarios.pagobeneficio')),
            ],
            options={
                'verbose_name': 'Movimiento Financiero',
                'verbose_name_plural': 'Movimientos Financieros',
                'ordering': ['-fecha', '-created_at'],
            },
        ),
        
        # ============ MODIFICAR PAGOCUOTA ============
        
        # Agregar campos mes y anio
        migrations.AddField(
            model_name='pagocuota',
            name='mes',
            field=models.IntegerField(default=1),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='pagocuota',
            name='anio',
            field=models.IntegerField(default=2024),
            preserve_default=False,
        ),
        
        # Hacer cuota opcional temporalmente
        migrations.AlterField(
            model_name='pagocuota',
            name='cuota',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='voluntarios.cuota'),
        ),
        
        # Cambiar default de fecha_pago
        migrations.AlterField(
            model_name='pagocuota',
            name='fecha_pago',
            field=models.DateField(default=django.utils.timezone.now),
        ),
        
        # Actualizar Meta de PagoCuota
        migrations.AlterModelOptions(
            name='pagocuota',
            options={'ordering': ['-anio', '-mes', '-fecha_pago'], 'verbose_name': 'Pago de Cuota', 'verbose_name_plural': 'Pagos de Cuotas'},
        ),
        
        # ============ MODIFICAR BENEFICIO ============
        
        # Agregar nuevos campos
        migrations.AddField(
            model_name='beneficio',
            name='fecha_evento',
            field=models.DateField(default=django.utils.timezone.now, help_text='Fecha del evento'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='beneficio',
            name='tarjetas_voluntarios',
            field=models.IntegerField(default=5, help_text='0-19 años'),
        ),
        migrations.AddField(
            model_name='beneficio',
            name='tarjetas_honorarios_cia',
            field=models.IntegerField(default=3, help_text='20-24 años'),
        ),
        migrations.AddField(
            model_name='beneficio',
            name='tarjetas_honorarios_cuerpo',
            field=models.IntegerField(default=3, help_text='25-49 años'),
        ),
        migrations.AddField(
            model_name='beneficio',
            name='tarjetas_insignes',
            field=models.IntegerField(default=2, help_text='50+ años'),
        ),
        migrations.AddField(
            model_name='beneficio',
            name='precio_por_tarjeta',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='beneficio',
            name='precio_tarjeta_extra',
            field=models.DecimalField(decimal_places=2, default=0, help_text='Precio para ventas extras (más allá de las asignadas)', max_digits=10),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='beneficio',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL),
        ),
        
        # Remover campos antiguos
        migrations.RemoveField(
            model_name='beneficio',
            name='monto',
        ),
        migrations.RemoveField(
            model_name='beneficio',
            name='cupos_totales',
        ),
        migrations.RemoveField(
            model_name='beneficio',
            name='cupos_disponibles',
        ),
        
        # Actualizar estado choices
        migrations.AlterField(
            model_name='beneficio',
            name='estado',
            field=models.CharField(choices=[('activo', 'Activo'), ('cerrado', 'Cerrado')], default='activo', max_length=20),
        ),
        
        # Actualizar Meta
        migrations.AlterModelOptions(
            name='beneficio',
            options={'ordering': ['-fecha_evento'], 'verbose_name': 'Beneficio', 'verbose_name_plural': 'Beneficios'},
        ),
        
        # ============ MODIFICAR ASIGNACIONBENEFICIO ============
        
        # Agregar campos de tarjetas
        migrations.AddField(
            model_name='asignacionbeneficio',
            name='tarjetas_asignadas',
            field=models.IntegerField(default=0, help_text='Tarjetas asignadas según categoría'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='asignacionbeneficio',
            name='tarjetas_vendidas',
            field=models.IntegerField(default=0, help_text='Tarjetas vendidas (normal)'),
        ),
        migrations.AddField(
            model_name='asignacionbeneficio',
            name='tarjetas_extras_vendidas',
            field=models.IntegerField(default=0, help_text='Tarjetas vendidas extra'),
        ),
        migrations.AddField(
            model_name='asignacionbeneficio',
            name='tarjetas_liberadas',
            field=models.IntegerField(default=0, help_text='Tarjetas liberadas'),
        ),
        migrations.AddField(
            model_name='asignacionbeneficio',
            name='monto_pendiente',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='asignacionbeneficio',
            name='historial_liberaciones',
            field=models.TextField(blank=True, help_text='JSON con historial', null=True),
        ),
        
        # Actualizar monto_total y monto_pagado defaults
        migrations.AlterField(
            model_name='asignacionbeneficio',
            name='monto_total',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        
        # Actualizar estado_pago choices
        migrations.AlterField(
            model_name='asignacionbeneficio',
            name='estado_pago',
            field=models.CharField(choices=[('pendiente', 'Pendiente'), ('parcial', 'Parcial'), ('completo', 'Completo'), ('liberado', 'Liberado')], default='pendiente', max_length=20),
        ),
        
        # Remover fecha_asignacion
        migrations.RemoveField(
            model_name='asignacionbeneficio',
            name='fecha_asignacion',
        ),
        
        # Actualizar Meta
        migrations.AlterModelOptions(
            name='asignacionbeneficio',
            options={'ordering': ['-beneficio__fecha_evento'], 'verbose_name': 'Asignación de Beneficio', 'verbose_name_plural': 'Asignaciones de Beneficios'},
        ),
        
        # Agregar unique_together
        migrations.AlterUniqueTogether(
            name='asignacionbeneficio',
            unique_together={('beneficio', 'voluntario')},
        ),
        
        # Actualizar ForeignKey de beneficio para agregar related_name
        migrations.AlterField(
            model_name='asignacionbeneficio',
            name='beneficio',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='asignaciones', to='voluntarios.beneficio'),
        ),
        
        # ============ MODIFICAR PAGOBENEFICIO ============
        
        # Agregar tipo_pago y cantidad_tarjetas
        migrations.AddField(
            model_name='pagobeneficio',
            name='tipo_pago',
            field=models.CharField(choices=[('normal', 'Pago Normal'), ('extra', 'Venta Extra')], default='normal', max_length=10),
        ),
        migrations.AddField(
            model_name='pagobeneficio',
            name='cantidad_tarjetas',
            field=models.IntegerField(default=1),
        ),
        
        # Actualizar fecha_pago default
        migrations.AlterField(
            model_name='pagobeneficio',
            name='fecha_pago',
            field=models.DateField(default=django.utils.timezone.now),
        ),
        
        # Agregar unique_together en PagoCuota
        migrations.AlterUniqueTogether(
            name='pagocuota',
            unique_together={('voluntario', 'mes', 'anio')},
        ),
    ]
