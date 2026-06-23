from django.core.management.base import BaseCommand
from voluntarios.models import Cargo, Voluntario

class Command(BaseCommand):
    help = 'Listar todos los cargos registrados en la base de datos'

    def handle(self, *args, **options):
        cargos = Cargo.objects.all().order_by('-anio', '-fecha_inicio')
        
        if not cargos.exists():
            self.stdout.write(self.style.WARNING('No hay cargos registrados'))
            return

        self.stdout.write(self.style.SUCCESS(f'\n📋 TOTAL DE CARGOS: {cargos.count()}\n'))
        self.stdout.write('=' * 100)
        
        for cargo in cargos:
            voluntario = cargo.voluntario
            
            self.stdout.write(f'\n🔹 ID: {cargo.id}')
            self.stdout.write(f'   👤 Voluntario: {voluntario.nombre} {voluntario.apellido_paterno}')
            self.stdout.write(f'   🎖️  Clave: {voluntario.clave_bombero or "Sin clave"}')
            self.stdout.write(f'   📅 Año: {cargo.anio}')
            self.stdout.write(f'   💼 Tipo: {cargo.get_tipo_cargo_display()}')
            self.stdout.write(f'   🏆 Cargo: {cargo.nombre_cargo}')
            
            if cargo.fecha_inicio:
                self.stdout.write(f'   📆 Desde: {cargo.fecha_inicio}')
            if cargo.fecha_fin:
                self.stdout.write(f'   📆 Hasta: {cargo.fecha_fin}')
            else:
                self.stdout.write(f'   📆 Hasta: Vigente')
                
            if cargo.observaciones:
                self.stdout.write(f'   📝 Obs: {cargo.observaciones[:50]}...')
                
            self.stdout.write(f'   🕐 Registrado: {cargo.created_at.strftime("%d/%m/%Y %H:%M")}')
            self.stdout.write('─' * 100)
        
        self.stdout.write(self.style.SUCCESS('\n✅ Listado completo'))
