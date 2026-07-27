import json
from django.test import TestCase, Client
from .models import Voluntario, Cargo, Sancion, ItemInventario
from datetime import date, timedelta
from decimal import Decimal

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


class ItemInventarioModelTest(TestCase):

    def setUp(self):
        self.item = ItemInventario.objects.create(
            nombre='Pitón 52mm',
            categoria='Mangueras/Pitones',
            cantidad=Decimal('8'),
            unidad='unidades',
            tamano='52mm',
            responsable='Miguel Vásquez',
            ubicacion='Pañol',
            registrado_por='testuser'
        )

    def test_creation_defaults(self):
        """Un item recién creado tiene fecha_registro y fecha_actualizacion automáticas"""
        self.assertIsNotNone(self.item.fecha_registro)
        self.assertIsNotNone(self.item.fecha_actualizacion)

    def test_optional_fields_can_be_blank(self):
        """marca, estado, numero_serie, observaciones son opcionales"""
        item = ItemInventario.objects.create(
            nombre='Extintor',
            cantidad=Decimal('3'),
            responsable='Miguel Vásquez',
            ubicacion='Pañol',
            registrado_por='testuser'
        )
        self.assertEqual(item.marca, '')
        self.assertIsNone(item.estado or None)

    def test_cantidad_admite_decimales(self):
        """cantidad admite decimales (ej: litros a granel)"""
        item = ItemInventario.objects.create(
            nombre='Concentrado de espuma AFFF/AR',
            cantidad=Decimal('18.5'),
            unidad='litros',
            responsable='Miguel Vásquez',
            ubicacion='Pañol',
            registrado_por='testuser'
        )
        self.assertEqual(item.cantidad, Decimal('18.5'))

    def test_str_method(self):
        self.assertIn('Pitón 52mm', str(self.item))
        self.assertIn('8', str(self.item))


from django.contrib.auth.models import Group, User
from rest_framework.test import APIClient
from rest_framework import status


class ItemInventarioAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()

        director_group, _ = Group.objects.get_or_create(name='Director')
        self.director = User.objects.create_user(username='director1', password='pass12345')
        self.director.groups.add(director_group)

        ayudante_group, _ = Group.objects.get_or_create(name='Ayudante')
        self.ayudante = User.objects.create_user(username='ayudante1', password='pass12345')
        self.ayudante.groups.add(ayudante_group)

        self.item = ItemInventario.objects.create(
            nombre='Extintor',
            cantidad=Decimal('3'),
            responsable='Miguel Vásquez',
            ubicacion='Pañol',
            registrado_por='seed'
        )

    def test_ayudante_puede_ver_lista(self):
        self.client.force_authenticate(user=self.ayudante)
        response = self.client.get('/api/inventario/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ayudante_no_puede_crear(self):
        self.client.force_authenticate(user=self.ayudante)
        response = self.client.post('/api/inventario/', {
            'nombre': 'Casco', 'cantidad': '1'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_director_puede_crear(self):
        self.client.force_authenticate(user=self.director)
        response = self.client.post('/api/inventario/', {
            'nombre': 'Casco estructural', 'cantidad': '6'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_director_puede_editar_y_borrar(self):
        self.client.force_authenticate(user=self.director)
        response = self.client.patch(f'/api/inventario/{self.item.id}/', {'cantidad': '5'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.delete(f'/api/inventario/{self.item.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_anonimo_no_puede_ver(self):
        response = self.client.get('/api/inventario/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


from voluntarios.models import GrupoSolicitudPago, CuentaBancaria, SolicitudPagoPortal


class GrupoSolicitudPagoModelTest(TestCase):

    def setUp(self):
        self.voluntario = Voluntario.objects.create(
            nombre='Ana', apellido_paterno='Soto', apellido_materno='Diaz',
            rut='11222333-4', clave_bombero='099',
            fecha_nacimiento=date(1992, 5, 5),
            fecha_ingreso=date(2018, 1, 1),
            estado_bombero='activo'
        )
        self.portal_user = User.objects.create_user(username='asoto.01', password='pass12345')
        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='1234567', rut_titular='76.123.456-7',
            activa=True
        )

    def test_creacion_grupo(self):
        grupo = GrupoSolicitudPago.objects.create(
            voluntario=self.voluntario,
            portal_user=self.portal_user,
            fecha_pago=date.today(),
            cuenta_bancaria_destino=self.cuenta,
            monto_total=Decimal('21000'),
        )
        self.assertEqual(grupo.estado, 'pendiente')
        self.assertIsNotNone(grupo.created_at)

    def test_items_relacionados(self):
        grupo = GrupoSolicitudPago.objects.create(
            voluntario=self.voluntario,
            portal_user=self.portal_user,
            fecha_pago=date.today(),
            cuenta_bancaria_destino=self.cuenta,
            monto_total=Decimal('14000'),
        )
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario,
            portal_user=self.portal_user,
            tipo_pago='cuota',
            nombre_pago='Cuota 01/2026',
            monto_solicitado=Decimal('7000'),
            cuota_mes=1,
            cuota_anio=2026,
            grupo=grupo,
        )
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario,
            portal_user=self.portal_user,
            tipo_pago='cuota',
            nombre_pago='Cuota 02/2026',
            monto_solicitado=Decimal('7000'),
            cuota_mes=2,
            cuota_anio=2026,
            grupo=grupo,
        )
        self.assertEqual(grupo.items.count(), 2)

    def test_solicitud_sin_grupo_sigue_funcionando(self):
        solicitud = SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario,
            portal_user=self.portal_user,
            tipo_pago='cuota',
            nombre_pago='Cuota 03/2026',
            monto_solicitado=Decimal('7000'),
            cuota_mes=3,
            cuota_anio=2026,
        )
        self.assertIsNone(solicitud.grupo)


class PortalGrupoSolicitudAPITest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas
        self.client = Client()
        # Se crea el usuario 'cvera.26' antes que el Voluntario para que la
        # señal post_save (voluntarios/signals.py) que autogenera un
        # PortalVoluntarioProfile no pueda elegir por azar este mismo
        # username para su propio usuario autogenerado.
        self.portal_user = User.objects.create_user(username='cvera.26', password='Bomberos123!')
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-7', clave_bombero='077',
            fecha_nacimiento=date(1995, 3, 3),
            fecha_ingreso=date(2019, 1, 1),
            estado_bombero='activo'
        )
        # La señal post_save de Voluntario ya crea un PortalVoluntarioProfile
        # automáticamente; como el campo es OneToOne, actualizamos ese
        # perfil en vez de crear uno nuevo.
        profile = self.voluntario.portal_profile
        profile.user = self.portal_user
        profile.activo = True
        profile.debe_cambiar_clave = False
        profile.save()
        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='1234567', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False
        )
        self.client.force_login(self.portal_user)

    def test_crear_grupo_con_dos_cuotas(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        archivo = SimpleUploadedFile('voucher.png', b'contenido-fake', content_type='image/png')
        response = self.client.post('/api/portal/solicitudes/grupo/', {
            'items': json.dumps([
                {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': '7000'},
                {'tipo_pago': 'cuota', 'cuota_mes': 2, 'cuota_anio': 2026, 'monto': '7000'},
            ]),
            'fecha_pago': '2026-07-27',
            'cuenta_bancaria_destino_id': str(self.cuenta.id),
            'numero_comprobante': 'ABC123',
            'descripcion': 'Transferencia unica',
            'comprobante': archivo,
        })
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['grupo']['monto_total'], 14000.0)
        self.assertEqual(len(data['grupo']['items']), 2)

    def test_crear_grupo_sin_items_falla(self):
        response = self.client.post('/api/portal/solicitudes/grupo/', {
            'items': json.dumps([]),
            'fecha_pago': '2026-07-27',
            'cuenta_bancaria_destino_id': str(self.cuenta.id),
        })
        self.assertEqual(response.status_code, 400)

    def test_crear_grupo_con_monto_invalido_falla_con_400(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        casos = [
            ('abc', 'monto no numerico'),
            ('0', 'monto cero'),
            ('-5', 'monto negativo'),
        ]
        for monto_invalido, descripcion_caso in casos:
            with self.subTest(caso=descripcion_caso):
                archivo = SimpleUploadedFile('voucher.png', b'contenido-fake', content_type='image/png')
                response = self.client.post('/api/portal/solicitudes/grupo/', {
                    'items': json.dumps([
                        {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': monto_invalido},
                    ]),
                    'fecha_pago': '2026-07-27',
                    'cuenta_bancaria_destino_id': str(self.cuenta.id),
                    'comprobante': archivo,
                })
                self.assertEqual(response.status_code, 400, response.content)
                data = response.json()
                self.assertFalse(data['success'])
                self.assertIn('monto', data['error'].lower())

    def test_crear_grupo_con_monto_ausente_falla_con_400(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        archivo = SimpleUploadedFile('voucher.png', b'contenido-fake', content_type='image/png')
        response = self.client.post('/api/portal/solicitudes/grupo/', {
            'items': json.dumps([
                {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026},
            ]),
            'fecha_pago': '2026-07-27',
            'cuenta_bancaria_destino_id': str(self.cuenta.id),
            'comprobante': archivo,
        })
        self.assertEqual(response.status_code, 400, response.content)
        data = response.json()
        self.assertFalse(data['success'])


class TesoreriaGrupoAccionAPITest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas
        self.client = Client()
        # Se crea el usuario 'cvera.27' antes que el Voluntario para que la
        # señal post_save (voluntarios/signals.py) que autogenera un
        # PortalVoluntarioProfile no pueda elegir por azar este mismo
        # username para su propio usuario autogenerado.
        self.portal_user = User.objects.create_user(username='cvera.27', password='Bomberos123!')
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-8', clave_bombero='078',
            fecha_nacimiento=date(1995, 3, 3),
            fecha_ingreso=date(2019, 1, 1),
            estado_bombero='activo'
        )
        # La señal post_save de Voluntario ya crea un PortalVoluntarioProfile
        # automáticamente; como el campo es OneToOne, actualizamos ese
        # perfil en vez de crear uno nuevo.
        profile = self.voluntario.portal_profile
        profile.user = self.portal_user
        profile.activo = True
        profile.debe_cambiar_clave = False
        profile.save()
        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='7654321', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False
        )
        self.grupo = GrupoSolicitudPago.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            fecha_pago=date(2026, 7, 27), cuenta_bancaria_destino=self.cuenta,
            monto_total=Decimal('14000'),
        )
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            tipo_pago='cuota', nombre_pago='Cuota 01/2026',
            monto_solicitado=Decimal('7000'), cuota_mes=1, cuota_anio=2026,
            fecha_pago=date(2026, 7, 27), grupo=self.grupo,
        )
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            tipo_pago='cuota', nombre_pago='Cuota 02/2026',
            monto_solicitado=Decimal('7000'), cuota_mes=2, cuota_anio=2026,
            fecha_pago=date(2026, 7, 27), grupo=self.grupo,
        )

        director_group, _ = Group.objects.get_or_create(name='Director')
        self.tesorero = User.objects.create_user(username='director_test', password='pass12345')
        self.tesorero.groups.add(director_group)
        self.client.force_login(self.tesorero)

    def test_aprobar_grupo_registra_cada_cuota(self):
        response = self.client.post(
            f'/api/portal/tesoreria/solicitudes/grupo/{self.grupo.id}/accion/',
            data=json.dumps({'accion': 'aprobar'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.estado, 'aprobada')
        from voluntarios.models import PagoCuota
        self.assertEqual(PagoCuota.objects.filter(voluntario=self.voluntario).count(), 2)
        for item in self.grupo.items.all():
            self.assertEqual(item.estado, 'aprobada')
            self.assertIsNotNone(item.pago_cuota_id)

    def test_rechazar_grupo_exige_motivo(self):
        response = self.client.post(
            f'/api/portal/tesoreria/solicitudes/grupo/{self.grupo.id}/accion/',
            data=json.dumps({'accion': 'rechazar'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_rechazar_grupo_con_motivo(self):
        response = self.client.post(
            f'/api/portal/tesoreria/solicitudes/grupo/{self.grupo.id}/accion/',
            data=json.dumps({'accion': 'rechazar', 'feedback': 'Voucher ilegible'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.estado, 'rechazada')
        self.assertEqual(self.grupo.feedback_tesorero, 'Voucher ilegible')
        for item in self.grupo.items.all():
            self.assertEqual(item.estado, 'rechazada')
