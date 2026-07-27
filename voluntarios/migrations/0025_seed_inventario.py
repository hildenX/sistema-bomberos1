from decimal import Decimal
from django.db import migrations


ITEMS = [
    # (nombre, categoria, cantidad, unidad, marca, tamano, observaciones)
    ('Pitón', 'Mangueras/Pitones', Decimal('8'), 'unidades', '', '52mm', ''),
    ('Pitón', 'Mangueras/Pitones', Decimal('5'), 'unidades', '', '75mm', ''),
    ('Línea de manguera', 'Mangueras/Pitones', Decimal('9'), 'unidades', '', '75mm', ''),
    ('Gemelo', 'Mangueras/Pitones', Decimal('3'), 'unidades', '', '75mm/52mm', "Anotado en el listado original como '3 gemelos 75mm/52mm x2' — verificar si son 3 o 6 unidades."),
    ('Trifulca', 'Mangueras/Pitones', Decimal('2'), 'unidades', '', '75mm x2 / 52mm x2', "Anotado en el listado original como '2 trifulcas 75mm x2/52mm x2' — verificar interpretación."),
    ('Pitón monitor de base', 'Mangueras/Pitones', Decimal('1'), 'unidades', '', '75mm', 'Cantidad no especificada en el listado original, se asumió 1.'),
    ('Premezclador', 'Mangueras/Pitones', Decimal('1'), 'unidades', '', '52mm', ''),
    ('Pitón auxiliar TFT', 'Mangueras/Pitones', Decimal('1'), 'unidades', '', '38mm', ''),
    ('Expansor de media', 'Mangueras/Pitones', Decimal('2'), 'unidades', '', '52mm', ''),
    ('Filtro de succión', 'Mangueras/Pitones', Decimal('1'), 'unidades', '', '110mm', ''),
    ('Filtro de succión', 'Mangueras/Pitones', Decimal('1'), 'unidades', '', '75mm', ''),
    ('Extintor', 'Extintores', Decimal('3'), 'unidades', '', '', ''),
    ('Alfombra recta', 'Insumos', Decimal('1'), 'unidades', '', '15 metros de largo', ''),
    ('Silla de playa', 'Insumos', Decimal('28'), 'unidades', '', '', ''),
    ('Caja de insumos 10-4-1 y botiquín', 'Insumos', Decimal('1'), 'caja', '', '', ''),
    ('Casco estructural', 'EPP', Decimal('6'), 'unidades', '', '', ''),
    ('Casco de propósito liviano', 'EPP', Decimal('4'), 'unidades', '', '', ''),
    ('Traje nivel B', 'Trajes', Decimal('5'), 'unidades', '', '', ''),
    ('Traje nivel A', 'Trajes', Decimal('3'), 'unidades', '', '', ''),
    ('Traje aluminizado nivel A', 'Trajes', Decimal('1'), 'unidades', '', '', ''),
    ('Soporte lumbar B6', 'EPP', Decimal('2'), 'unidades', '', '', ''),
    ('Baliza', 'Herramientas', Decimal('1'), 'unidades', '', '', ''),
    ('Transonadora', 'Herramientas', Decimal('1'), 'unidades', '', '', "Escrito 'tranzonadora' en el listado original."),
    ('Motosierra', 'Herramientas', Decimal('1'), 'unidades', 'Stihl', '', ''),
    ('Uniformes de parada verdes', 'Trajes', Decimal('2'), 'cajas', '', '', ''),
    ('Vestón', 'Trajes', Decimal('12'), 'unidades', '', '', ''),
    ('Pantalón', 'Trajes', Decimal('15'), 'unidades', '', '', ''),
    ('Ifex', 'Herramientas', Decimal('1'), 'unidades', '', '', "Verificar nombre/modelo exacto del equipo 'ifex'."),
    ('Pro-Pak', 'Herramientas', Decimal('1'), 'unidades', '', '', ''),
    ('Baliza azul giratoria', 'Herramientas', Decimal('1'), 'unidades', '', '', ''),
    ('Botas estructurales', 'EPP', Decimal('5'), 'pares', '', '', ''),
    ('Botas químicas', 'EPP', Decimal('3'), 'pares', '', '', ''),
    ('Botellón de agua mineral sin gas', 'Insumos', Decimal('54'), 'botellones', '', '6 litros c/u', ''),
    ('Traje Be-Safe', 'Trajes', Decimal('10'), 'unidades', '', '', ''),
    ('Traje de supervivencia', 'Trajes', Decimal('4'), 'unidades', '', '', ''),
    ('Chaleco salvavidas', 'EPP', Decimal('5'), 'unidades', '', '', ''),
    ('Equipos Scott nuevos', 'Equipos Scott', Decimal('3'), 'cajas', '', '', 'Verificar cantidad de equipos por caja.'),
    ('Concentrado de espuma AFFF/AR', 'Insumos', Decimal('1'), 'bidón', '', '~18 litros', ''),
    ('Carretilla', 'Herramientas', Decimal('1'), 'unidades', '', '', ''),
    ('Soporte de pizarra', 'Insumos', Decimal('2'), 'unidades', '', '', ''),
    ('Estanque de cilindros de buceo', 'Equipos Scott', Decimal('2'), 'unidades', '', '', ''),
    ('Manguera rígida de premezclador', 'Mangueras/Pitones', Decimal('1'), 'unidades', '', '', ''),
]


def cargar_inventario_inicial(apps, schema_editor):
    ItemInventario = apps.get_model('voluntarios', 'ItemInventario')

    if ItemInventario.objects.exists():
        return

    for nombre, categoria, cantidad, unidad, marca, tamano, observaciones in ITEMS:
        ItemInventario.objects.create(
            nombre=nombre,
            categoria=categoria,
            cantidad=cantidad,
            unidad=unidad,
            marca=marca,
            tamano=tamano,
            responsable='Miguel Vásquez',
            ubicacion='Pañol',
            observaciones=observaciones,
            registrado_por='seed_inicial',
        )


def revertir_inventario_inicial(apps, schema_editor):
    ItemInventario = apps.get_model('voluntarios', 'ItemInventario')
    ItemInventario.objects.filter(registrado_por='seed_inicial').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('voluntarios', '0024_iteminventario'),
    ]

    operations = [
        migrations.RunPython(cargar_inventario_inicial, revertir_inventario_inicial),
    ]
