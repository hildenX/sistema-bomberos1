"""
Quita las tarjetas de beneficio asignadas a voluntarios insignes, que no
venden beneficios. Solo borra asignaciones sin pagos ni tarjetas vendidas;
las demás se informan para revisarlas a mano.

Uso:
    python manage.py quitar_beneficios_insignes            # solo muestra
    python manage.py quitar_beneficios_insignes --aplicar  # borra
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from voluntarios.models import AsignacionBeneficio, PagoBeneficio
from voluntarios.utils_tesoreria import calcular_categoria_bombero


def _pesos(valor):
    return '$' + f"{int(valor):,}".replace(',', '.')


class Command(BaseCommand):
    help = 'Quita las tarjetas de beneficio asignadas a voluntarios insignes'

    def add_arguments(self, parser):
        parser.add_argument('--aplicar', action='store_true',
                            help='Borra de verdad (sin esto solo muestra lo que haría)')

    def handle(self, *args, **options):
        a_borrar, con_pagos = [], []
        for a in AsignacionBeneficio.objects.select_related('voluntario', 'beneficio'):
            if 'Insigne' not in calcular_categoria_bombero(a.voluntario.fecha_base_antiguedad):
                continue
            tiene_pagos = (a.monto_pagado > 0 or a.tarjetas_vendidas > 0
                           or PagoBeneficio.objects.filter(asignacion=a).exists())
            (con_pagos if tiene_pagos else a_borrar).append(a)

        for a in a_borrar:
            self.stdout.write(f"  quitar: {a.beneficio.nombre} | clave {a.voluntario.clave_bombero}"
                              f" | {a.tarjetas_asignadas} tarjetas | pendiente {_pesos(a.monto_pendiente)}")
        for a in con_pagos:
            self.stdout.write(self.style.WARNING(
                f"  revisar a mano (tiene pagos): {a.beneficio.nombre} | clave {a.voluntario.clave_bombero}"))

        total = sum(a.monto_pendiente for a in a_borrar)
        if not options['aplicar']:
            self.stdout.write(f"\nSe quitarían {len(a_borrar)} asignaciones ({_pesos(total)} pendientes)."
                              " Corre con --aplicar para hacerlo.")
            return

        with transaction.atomic():
            for a in a_borrar:
                a.delete()
        self.stdout.write(self.style.SUCCESS(
            f"\nQuitadas {len(a_borrar)} asignaciones de insignes ({_pesos(total)} pendientes)."))
