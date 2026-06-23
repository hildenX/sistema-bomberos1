from django.test import TestCase
from django.contrib.auth.models import User
from .models import Voluntario, Cargo, Sancion
from datetime import date, timedelta

class VoluntarioModelTest(TestCase):
    
    def setUp(self):
        """Crear voluntario de prueba"""
        self.voluntario = Voluntario.objects.create(
            nombre='Juan',
            apellido_paterno='Pérez',
            apellido_materno='González',
            rut='12345678-9',
            clave_bombero='001',
            fecha_nacimiento=date(1990, 1, 1),
            fecha_ingreso=date(2015, 1, 1),
            estado_bombero='activo'
        )
    
    def test_nombre_completo(self):
        """Test método nombre_completo"""
        self.assertEqual(
            self.voluntario.nombre_completo(),
            'Juan Pérez González'
        )
    
    def test_edad(self):
        """Test cálculo de edad"""
        edad = self.voluntario.edad()
        self.assertIsInstance(edad, int)
        self.assertGreater(edad, 0)
    
    def test_antiguedad(self):
        """Test cálculo de antigüedad"""
        antiguedad = self.voluntario.antiguedad_detallada()
        self.assertIn('años', antiguedad)
        self.assertIn('meses', antiguedad)
        self.assertIn('dias', antiguedad)
    
    def test_puede_reintegrarse_activo(self):
        """Voluntario activo no puede reintegrarse"""
        puede, mensaje = self.voluntario.puede_reintegrarse()
        self.assertFalse(puede)
    
    def test_puede_reintegrarse_renunciado(self):
        """Voluntario renunciado puede reintegrarse"""
        self.voluntario.estado_bombero = 'renunciado'
        self.voluntario.fecha_renuncia = date.today() - timedelta(days=30)
        self.voluntario.save()
        
        puede, mensaje = self.voluntario.puede_reintegrarse()
        self.assertTrue(puede)
    
    def test_str_method(self):
        """Test método __str__"""
        self.assertEqual(
            str(self.voluntario),
            '001 - Juan Pérez'
        )


class CargoModelTest(TestCase):
    
    def setUp(self):
        self.voluntario = Voluntario.objects.create(
            nombre='Test',
            apellido_paterno='Cargo',
            rut='11111111-1',
            clave_bombero='002',
            fecha_nacimiento=date(1990, 1, 1),
            fecha_ingreso=date(2015, 1, 1)
        )
        
        self.cargo = Cargo.objects.create(
            voluntario=self.voluntario,
            tipo_cargo='compania',
            nombre_cargo='Capitán',
            anio=2024
        )
    
    def test_cargo_creation(self):
        """Test creación de cargo"""
        self.assertEqual(self.cargo.nombre_cargo, 'Capitán')
        self.assertEqual(self.cargo.tipo_cargo, 'compania')
    
    def test_cargo_str(self):
        """Test método __str__"""
        self.assertIn('002', str(self.cargo))
        self.assertIn('Capitán', str(self.cargo))


class SancionModelTest(TestCase):
    
    def setUp(self):
        self.voluntario = Voluntario.objects.create(
            nombre='Test',
            apellido_paterno='Sancion',
            rut='22222222-2',
            clave_bombero='003',
            fecha_nacimiento=date(1990, 1, 1),
            fecha_ingreso=date(2015, 1, 1)
        )
        
        self.sancion = Sancion.objects.create(
            voluntario=self.voluntario,
            tipo_sancion='suspension',
            fecha_desde=date.today(),
            dias_sancion=15,
            oficio_numero='OF-123',
            fecha_oficio=date.today(),
            motivo='Prueba'
        )
    
    def test_sancion_creation(self):
        """Test creación de sanción"""
        self.assertEqual(self.sancion.tipo_sancion, 'suspension')
        self.assertEqual(self.sancion.dias_sancion, 15)
