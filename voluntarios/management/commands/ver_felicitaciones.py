from django.core.management.base import BaseCommand
from voluntarios.models import Felicitacion


class Command(BaseCommand):
    help = 'Muestra todas las felicitaciones registradas'

    def handle(self, *args, **options):
        self.stdout.write("\n" + "="*100)
        self.stdout.write(self.style.SUCCESS(" FELICITACIONES EN BASE DE DATOS ".center(100, "=")))
        self.stdout.write("="*100 + "\n")

        felicitaciones = Felicitacion.objects.all().select_related('voluntario', 'created_by')
        total = felicitaciones.count()

        self.stdout.write(f"Total: {total}\n")

        if total == 0:
            self.stdout.write(self.style.WARNING("No hay felicitaciones registradas"))
        else:
            for i, f in enumerate(felicitaciones, 1):
                self.stdout.write(self.style.SUCCESS(f"\n[{i}] ID: {f.id}"))
                self.stdout.write(f"    Voluntario: {f.voluntario.clave_bombero} - {f.voluntario.nombre} {f.voluntario.apellido_paterno}")
                self.stdout.write(f"    Tipo: {f.get_tipo_felicitacion_display()}")
                if f.nombre_felicitacion:
                    self.stdout.write(f"    Nombre: {f.nombre_felicitacion}")
                self.stdout.write(f"    Fecha: {f.fecha_felicitacion}")
                self.stdout.write(f"    Oficio: {f.oficio_numero}")
                if f.fecha_oficio:
                    self.stdout.write(f"    Fecha oficio: {f.fecha_oficio}")
                if f.compania_otorgante:
                    self.stdout.write(f"    Compania: {f.compania_otorgante}")
                if f.autoridad_otorgante:
                    self.stdout.write(f"    Autoridad: {f.autoridad_otorgante}")
                motivo_corto = f.motivo[:70] + '...' if len(f.motivo) > 70 else f.motivo
                self.stdout.write(f"    Motivo: {motivo_corto}")
                self.stdout.write(f"    Documento: {'SI' if f.documento_felicitacion else 'NO'}")
                self.stdout.write(f"    Registrado por: {f.created_by.username if f.created_by else 'N/A'}")
                self.stdout.write(f"    Fecha registro: {f.created_at.strftime('%d/%m/%Y %H:%M')}")

        self.stdout.write("\n" + "="*100)
        self.stdout.write("TABLA: voluntarios_felicitacion")
        self.stdout.write("="*100 + "\n")
