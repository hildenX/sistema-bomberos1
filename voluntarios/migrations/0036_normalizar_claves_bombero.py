"""
Quita el '.0' que la carga masiva desde Excel dejó en las claves numéricas
('653.0' -> '653', '671.0-2' -> '671-2'). Las claves con letra no cambian.
"""
import re

from django.db import migrations

PATRON = re.compile(r'^(\d+)\.0(?=$|-)')


def normalizar_claves(apps, schema_editor):
    for nombre_modelo in ('Voluntario', 'DetalleAsistencia', 'RankingAsistencia'):
        modelo = apps.get_model('voluntarios', nombre_modelo)
        corregidos = 0
        for obj in modelo.objects.filter(clave_bombero__regex=r'^[0-9]+\.0($|-)'):
            obj.clave_bombero = PATRON.sub(r'\1', obj.clave_bombero.strip())
            obj.save(update_fields=['clave_bombero'])
            corregidos += 1
        print(f'  {nombre_modelo}: {corregidos} claves corregidas')


class Migration(migrations.Migration):

    dependencies = [
        ('voluntarios', '0035_eventoasistencia_disculpados'),
    ]

    operations = [
        migrations.RunPython(normalizar_claves, migrations.RunPython.noop),
    ]
