# Generated manually for nuevo sistema de uniformes
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('voluntarios', '0011_alter_uniforme_tipo'),
    ]

    operations = [
        # 1. Eliminar modelos antiguos
        migrations.DeleteModel(
            name='EntregaUniforme',
        ),
        migrations.DeleteModel(
            name='Uniforme',
        ),
        
        # 2. Crear nuevo modelo ContadorUniformes
        migrations.CreateModel(
            name='ContadorUniformes',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('id_estructural', models.IntegerField(default=1)),
                ('id_forestal', models.IntegerField(default=1)),
                ('id_rescate', models.IntegerField(default=1)),
                ('id_hazmat', models.IntegerField(default=1)),
                ('id_tenida_cuartel', models.IntegerField(default=1)),
                ('id_accesorios', models.IntegerField(default=1)),
                ('id_parada', models.IntegerField(default=1)),
                ('id_usar', models.IntegerField(default=1)),
                ('id_agreste', models.IntegerField(default=1)),
                ('id_um6', models.IntegerField(default=1)),
                ('id_gersa', models.IntegerField(default=1)),
            ],
            options={
                'verbose_name': 'Contador de Uniformes',
                'verbose_name_plural': 'Contadores de Uniformes',
            },
        ),
        
        # 3. Crear nuevo modelo Uniforme
        migrations.CreateModel(
            name='Uniforme',
            fields=[
                ('id', models.CharField(max_length=20, primary_key=True, serialize=False)),
                ('tipo_uniforme', models.CharField(choices=[
                    ('estructural', 'Estructural'), ('forestal', 'Forestal'),
                    ('rescate', 'Rescate'), ('hazmat', 'Hazmat'),
                    ('tenidaCuartel', 'Tenida de Cuartel'), ('accesorios', 'Accesorios'),
                    ('parada', 'Parada'), ('usar', 'USAR'), ('agreste', 'AGRESTE'),
                    ('um6', 'UM-6'), ('gersa', 'GERSA')
                ], max_length=20)),
                ('fecha_registro', models.DateTimeField(auto_now_add=True)),
                ('registrado_por', models.CharField(max_length=100)),
                ('observaciones', models.TextField(blank=True, null=True)),
                ('estado', models.CharField(choices=[
                    ('activo', 'Activo'), ('devuelto', 'Devuelto')
                ], default='activo', max_length=10)),
                ('fecha_devolucion', models.DateTimeField(blank=True, null=True)),
                ('devuelto_por', models.CharField(blank=True, max_length=100, null=True)),
                ('bombero', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='uniformes', to='voluntarios.voluntario')),
            ],
            options={
                'verbose_name': 'Uniforme',
                'verbose_name_plural': 'Uniformes',
                'ordering': ['-fecha_registro'],
            },
        ),
        
        # 4. Crear modelo PiezaUniforme
        migrations.CreateModel(
            name='PiezaUniforme',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('componente', models.CharField(max_length=100)),
                ('nombre_personalizado', models.CharField(blank=True, max_length=200, null=True)),
                ('marca', models.CharField(blank=True, max_length=100, null=True)),
                ('serie', models.CharField(blank=True, max_length=100, null=True)),
                ('talla', models.CharField(blank=True, max_length=20, null=True)),
                ('condicion', models.CharField(choices=[
                    ('nuevo', 'Nuevo'), ('semi-nuevo', 'Semi-Nuevo'), ('usado', 'Usado')
                ], max_length=20)),
                ('estado_fisico', models.CharField(choices=[
                    ('bueno', 'Bueno'), ('regular', 'Regular'), ('malo', 'Malo')
                ], max_length=20)),
                ('unidad', models.IntegerField(default=1)),
                ('par_simple', models.CharField(choices=[
                    ('Simple', 'Simple'), ('Par', 'Par')
                ], default='Simple', max_length=10)),
                ('fecha_entrega', models.DateField()),
                ('estado_pieza', models.CharField(choices=[
                    ('activo', 'Activo'), ('devuelto', 'Devuelto')
                ], default='activo', max_length=10)),
                ('fecha_devolucion', models.DateTimeField(blank=True, null=True)),
                ('devuelto_por', models.CharField(blank=True, max_length=100, null=True)),
                ('estado_devolucion', models.CharField(blank=True, choices=[
                    ('bueno', 'Bueno'), ('regular', 'Regular'), ('malo', 'Malo'), ('deteriorado', 'Muy Deteriorado')
                ], max_length=20, null=True)),
                ('condicion_devolucion', models.CharField(blank=True, choices=[
                    ('nuevo', 'Como Nuevo'), ('semi-nuevo', 'Semi-Nuevo'), ('usado', 'Usado'), ('muy_usado', 'Muy Usado')
                ], max_length=20, null=True)),
                ('observaciones_devolucion', models.TextField(blank=True, null=True)),
                ('ultima_modificacion', models.JSONField(blank=True, null=True)),
                ('historial_cambios', models.JSONField(blank=True, default=list)),
                ('uniforme', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='piezas', to='voluntarios.uniforme')),
            ],
            options={
                'verbose_name': 'Pieza de Uniforme',
                'verbose_name_plural': 'Piezas de Uniformes',
                'ordering': ['id'],
            },
        ),
    ]
