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
                {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': '5000'},
                {'tipo_pago': 'cuota', 'cuota_mes': 2, 'cuota_anio': 2026, 'monto': '5000'},
            ]),
            'fecha_pago': '2026-07-27',
            'cuenta_bancaria_destino_id': str(self.cuenta.id),
            'numero_comprobante': 'ABC123',
            'descripcion': 'Transferencia unica',
            'comprobante': archivo,
        })
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['grupo']['monto_total'], 10000.0)
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


from django.core import mail


class NotificacionesPortalEmailTest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas, PortalVoluntarioProfile, GrupoSolicitudPago
        # Se crea el usuario 'cvera.28' antes que el Voluntario para que la
        # señal post_save (voluntarios/signals.py) que autogenera un
        # PortalVoluntarioProfile no pueda elegir por azar este mismo
        # username para su propio usuario autogenerado.
        self.portal_user = User.objects.create_user(username='cvera.28', password='Bomberos123!')
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-9', clave_bombero='079', email='cvera@example.com',
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
            tipo_cuenta='corriente', numero_cuenta='9998887', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False
        )
        self.grupo = GrupoSolicitudPago.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            fecha_pago=date(2026, 7, 27), cuenta_bancaria_destino=self.cuenta,
            monto_total=Decimal('7000'),
        )
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            tipo_pago='cuota', nombre_pago='Cuota 01/2026',
            monto_solicitado=Decimal('7000'), cuota_mes=1, cuota_anio=2026,
            fecha_pago=date(2026, 7, 27), grupo=self.grupo,
        )

        director_group, _ = Group.objects.get_or_create(name='Director')
        self.tesorero = User.objects.create_user(username='director_test2', password='pass12345')
        self.tesorero.groups.add(director_group)
        self.client = Client()
        self.client.force_login(self.tesorero)

    def test_aprobar_grupo_envia_email(self):
        mail.outbox = []
        response = self.client.post(
            f'/api/portal/tesoreria/solicitudes/grupo/{self.grupo.id}/accion/',
            data=json.dumps({'accion': 'aprobar'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('cvera@example.com', mail.outbox[0].to)

    def test_rechazar_grupo_envia_email_con_motivo(self):
        mail.outbox = []
        response = self.client.post(
            f'/api/portal/tesoreria/solicitudes/grupo/{self.grupo.id}/accion/',
            data=json.dumps({'accion': 'rechazar', 'feedback': 'Voucher ilegible'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('cvera@example.com', mail.outbox[0].to)
        self.assertIn('Voucher ilegible', mail.outbox[0].body)


class PortalDashboardGruposYTesoreriaListadoTest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas
        self.client = Client()
        # Se crea el usuario 'cvera.29' antes que el Voluntario para que la
        # señal post_save (voluntarios/signals.py) que autogenera un
        # PortalVoluntarioProfile no pueda elegir por azar este mismo
        # username para su propio usuario autogenerado.
        self.portal_user = User.objects.create_user(username='cvera.29', password='Bomberos123!')
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-9', clave_bombero='079',
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
            tipo_cuenta='corriente', numero_cuenta='1112223', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False
        )
        self.grupo = GrupoSolicitudPago.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            fecha_pago=date(2026, 7, 27), cuenta_bancaria_destino=self.cuenta,
            monto_total=Decimal('7000'),
        )
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            tipo_pago='cuota', nombre_pago='Cuota 01/2026',
            monto_solicitado=Decimal('7000'), cuota_mes=1, cuota_anio=2026,
            fecha_pago=date(2026, 7, 27), grupo=self.grupo,
        )

    def test_dashboard_incluye_grupos_solicitud(self):
        self.client.force_login(self.portal_user)
        response = self.client.get('/api/portal/dashboard/')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertIn('grupos_solicitud', data['dashboard'])
        self.assertEqual(len(data['dashboard']['grupos_solicitud']), 1)
        self.assertEqual(data['dashboard']['grupos_solicitud'][0]['id'], self.grupo.id)

    def test_tesoreria_listado_grupos_devuelve_grupos(self):
        director_group, _ = Group.objects.get_or_create(name='Director')
        tesorero = User.objects.create_user(username='director_test3', password='pass12345')
        tesorero.groups.add(director_group)
        self.client.force_login(tesorero)
        response = self.client.get('/api/portal/tesoreria/solicitudes/grupo/')
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertIn('grupos', data)
        self.assertEqual(len(data['grupos']), 1)
        self.assertEqual(data['grupos'][0]['id'], self.grupo.id)

    def test_tesoreria_listado_grupos_requiere_tesoreria(self):
        self.client.force_login(self.portal_user)
        response = self.client.get('/api/portal/tesoreria/solicitudes/grupo/')
        self.assertNotEqual(response.status_code, 200)



# ---------------------------------------------------------------------------
# Correcciones de la revision final de la rama portal-pagos-combinados
# (C1 cantidad de tarjetas, C2 atomicidad, C3 validaciones compartidas,
#  I3 grupo de tipo mixto, I4 validacion del comprobante, I5 mensajes).
# ---------------------------------------------------------------------------

def _archivo_comprobante(nombre='voucher.png', contenido=b'contenido-fake', content_type='image/png'):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(nombre, contenido, content_type=content_type)


class PortalGrupoBaseTest(TestCase):
    """setUp comun: voluntario con acceso al portal, cuenta, ciclo, beneficio y rifa."""

    rut = '18111222-3'
    clave_bombero = '181'
    username = 'cvera.40'

    def setUp(self):
        from voluntarios.models import (
            AsignacionBeneficio, AsignacionRifa, Beneficio, CicloCuotas, Rifa,
        )
        self.client = Client()
        # El usuario se crea antes que el Voluntario para que la senal
        # post_save que autogenera el perfil del portal no elija este username.
        self.portal_user = User.objects.create_user(username=self.username, password='Bomberos123!')
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut=self.rut, clave_bombero=self.clave_bombero,
            fecha_nacimiento=date(1995, 3, 3),
            fecha_ingreso=date(2019, 1, 1),
            estado_bombero='activo'
        )
        profile = self.voluntario.portal_profile
        profile.user = self.portal_user
        profile.activo = True
        profile.debe_cambiar_clave = False
        profile.save()

        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='5556667', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False
        )
        # Precio de cuota por defecto del sistema: $5000 (ConfiguracionCuotas).
        self.precio_cuota = Decimal('5000')

        self.beneficio = Beneficio.objects.create(
            nombre='Curanto 2026', fecha_evento=date(2026, 9, 1),
            precio_por_tarjeta=Decimal('2000'), precio_tarjeta_extra=Decimal('2500'),
            estado='activo'
        )
        self.asignacion_beneficio = AsignacionBeneficio.objects.create(
            beneficio=self.beneficio, voluntario=self.voluntario,
            tarjetas_asignadas=5,
            monto_total=Decimal('10000'), monto_pendiente=Decimal('10000'),
        )

        self.rifa = Rifa.objects.create(
            ciclo='2026', nombre='Rifa 2026',
            fecha_inicio=date(2026, 1, 1), fecha_cierre=date(2026, 12, 1),
            precio_numero=Decimal('1000'), numeros_por_talonario=20,
            estado='activa'
        )
        self.asignacion_rifa = AsignacionRifa.objects.create(
            rifa=self.rifa, voluntario=self.voluntario,
            talonarios_asignados=1, estado='retirada',
            monto_total=Decimal('20000'), monto_pagado=Decimal('0'),
        )

        self.client.force_login(self.portal_user)

    def _login_tesorero(self, username='director_fix'):
        director_group, _ = Group.objects.get_or_create(name='Director')
        tesorero = User.objects.create_user(username=username, password='pass12345')
        tesorero.groups.add(director_group)
        self.client.force_login(tesorero)
        return tesorero

    def _post_grupo(self, items, **extra):
        payload = {
            'items': json.dumps(items),
            'fecha_pago': '2026-07-27',
            'cuenta_bancaria_destino_id': str(self.cuenta.id),
            'numero_comprobante': 'ABC123',
            'comprobante': extra.pop('comprobante', _archivo_comprobante()),
        }
        payload.update(extra)
        return self.client.post('/api/portal/solicitudes/grupo/', payload)


class PortalGrupoValidacionesTest(PortalGrupoBaseTest):
    """C3 / I4 / I5: el endpoint de grupo aplica las mismas validaciones de dinero."""

    rut = '18111222-3'
    clave_bombero = '181'
    username = 'cvera.40'

    def test_cuota_con_monto_menor_al_real_es_rechazada(self):
        response = self._post_grupo([
            {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': '1'},
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('monto exacto', response.json()['error'])
        self.assertEqual(GrupoSolicitudPago.objects.count(), 0)

    def test_solicitud_duplicada_abierta_es_rechazada(self):
        SolicitudPagoPortal.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            tipo_pago='cuota', nombre_pago='Cuota 01/2026',
            monto_solicitado=self.precio_cuota, cuota_mes=1, cuota_anio=2026,
            estado='pendiente',
        )
        response = self._post_grupo([
            {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)},
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Ya existe una solicitud abierta', response.json()['error'])

    def test_beneficio_con_monto_que_no_calza_con_la_cantidad_es_rechazado(self):
        response = self._post_grupo([
            {
                'tipo_pago': 'beneficio',
                'asignacion_beneficio_id': self.asignacion_beneficio.id,
                'tipo_pago_beneficio': 'normal',
                'cantidad': 1,
                'monto': '10000',
            },
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('monto debe ser exacto', response.json()['error'])
        self.assertEqual(GrupoSolicitudPago.objects.count(), 0)

    def test_beneficio_con_cantidad_mayor_a_las_disponibles_es_rechazado(self):
        response = self._post_grupo([
            {
                'tipo_pago': 'beneficio',
                'asignacion_beneficio_id': self.asignacion_beneficio.id,
                'tipo_pago_beneficio': 'normal',
                'cantidad': 9,
                'monto': '18000',
            },
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('mas tarjetas de las disponibles', response.json()['error'])

    def test_beneficio_con_tipo_de_pago_invalido_es_rechazado(self):
        response = self._post_grupo([
            {
                'tipo_pago': 'beneficio',
                'asignacion_beneficio_id': self.asignacion_beneficio.id,
                'tipo_pago_beneficio': 'gratis',
                'cantidad': 1,
                'monto': '2000',
            },
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Tipo de pago de beneficio invalido', response.json()['error'])

    def test_rifa_con_monto_parcial_es_rechazada(self):
        response = self._post_grupo([
            {'tipo_pago': 'rifa', 'asignacion_rifa_id': self.asignacion_rifa.id, 'monto': '5000'},
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('monto pendiente exacto', response.json()['error'])

    def test_rifa_no_retirada_es_rechazada(self):
        self.asignacion_rifa.estado = 'no_retirada'
        self.asignacion_rifa.save()
        response = self._post_grupo([
            {'tipo_pago': 'rifa', 'asignacion_rifa_id': self.asignacion_rifa.id, 'monto': '20000'},
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('retirar los talonarios', response.json()['error'])

    def test_items_repetidos_en_el_mismo_carrito_son_rechazados(self):
        response = self._post_grupo([
            {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)},
            {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)},
        ])
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('repetido', response.json()['error'])
        self.assertEqual(GrupoSolicitudPago.objects.count(), 0)

    def test_comprobante_con_extension_no_permitida_es_rechazado(self):
        response = self._post_grupo(
            [{'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)}],
            comprobante=_archivo_comprobante('voucher.html', b'contenido-fake', 'text/html'),
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('comprobante debe ser un archivo', response.json()['error'])
        self.assertEqual(GrupoSolicitudPago.objects.count(), 0)

    def test_comprobante_demasiado_grande_es_rechazado(self):
        grande = b'x' * (10 * 1024 * 1024 + 1)
        response = self._post_grupo(
            [{'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)}],
            comprobante=_archivo_comprobante('voucher.png', grande),
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('no puede superar', response.json()['error'])
        self.assertEqual(GrupoSolicitudPago.objects.count(), 0)

    def test_fecha_de_pago_malformada_devuelve_mensaje_amigable(self):
        response = self._post_grupo(
            [{'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)}],
            fecha_pago='27-07-2026',
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response.json()['error'], 'Fecha de pago invalida')


class TesoreriaGrupoMixtoTest(PortalGrupoBaseTest):
    """I3 / C1: un grupo con cuota + beneficio + rifa reparte el dinero correctamente."""

    rut = '18111222-4'
    clave_bombero = '182'
    username = 'cvera.41'

    def test_aprobar_grupo_mixto_registra_un_pago_de_cada_tipo(self):
        from voluntarios.models import PagoBeneficio, PagoCuota, PagoRifa

        response = self._post_grupo([
            {'tipo_pago': 'cuota', 'cuota_mes': 1, 'cuota_anio': 2026, 'monto': str(self.precio_cuota)},
            {
                'tipo_pago': 'beneficio',
                'asignacion_beneficio_id': self.asignacion_beneficio.id,
                'tipo_pago_beneficio': 'normal',
                'cantidad': 3,
                'monto': '6000',
            },
            {'tipo_pago': 'rifa', 'asignacion_rifa_id': self.asignacion_rifa.id, 'monto': '20000'},
        ])
        self.assertEqual(response.status_code, 201, response.content)
        grupo_id = response.json()['grupo']['id']
        self.assertEqual(response.json()['grupo']['monto_total'], 31000.0)

        self._login_tesorero('director_mixto')
        accion = self.client.post(
            '/api/portal/tesoreria/solicitudes/grupo/%s/accion/' % grupo_id,
            data=json.dumps({'accion': 'aprobar'}),
            content_type='application/json',
        )
        self.assertEqual(accion.status_code, 200, accion.content)

        grupo = GrupoSolicitudPago.objects.get(id=grupo_id)
        self.assertEqual(grupo.estado, 'aprobada')

        pagos_cuota = PagoCuota.objects.filter(voluntario=self.voluntario)
        self.assertEqual(pagos_cuota.count(), 1)
        self.assertEqual(pagos_cuota.first().monto_pagado, self.precio_cuota)

        pagos_beneficio = PagoBeneficio.objects.filter(asignacion=self.asignacion_beneficio)
        self.assertEqual(pagos_beneficio.count(), 1)
        self.assertEqual(pagos_beneficio.first().cantidad_tarjetas, 3)
        self.assertEqual(pagos_beneficio.first().monto, Decimal('6000'))

        pagos_rifa = PagoRifa.objects.filter(asignacion=self.asignacion_rifa)
        self.assertEqual(pagos_rifa.count(), 1)
        self.assertEqual(pagos_rifa.first().monto, Decimal('20000'))

        # C1: las tarjetas vendidas suben segun la cantidad real, no siempre 1.
        self.asignacion_beneficio.refresh_from_db()
        self.assertEqual(self.asignacion_beneficio.tarjetas_vendidas, 3)
        self.assertEqual(self.asignacion_beneficio.tarjetas_disponibles, 2)
        self.assertEqual(self.asignacion_beneficio.monto_pagado, Decimal('6000'))
        self.assertEqual(self.asignacion_beneficio.monto_pendiente, Decimal('4000'))

        self.asignacion_rifa.refresh_from_db()
        self.assertEqual(self.asignacion_rifa.estado, 'pagada')
        self.assertEqual(self.asignacion_rifa.monto_pagado, Decimal('20000'))

        # I2: el voucher se guarda en base64 una sola vez para todo el grupo.
        con_base64 = [
            bool(pagos_cuota.first().comprobante_base64),
            bool(pagos_beneficio.first().comprobante_base64),
            bool(pagos_rifa.first().comprobante_base64),
        ]
        self.assertEqual(sum(1 for tiene in con_base64 if tiene), 1)
        # ...pero todos los items siguen apuntando al archivo del grupo.
        for item in grupo.items.all():
            self.assertTrue(item.comprobante)

    def test_beneficio_con_cantidad_mayor_a_uno_se_aprueba_completo(self):
        from voluntarios.models import PagoBeneficio

        response = self._post_grupo([
            {
                'tipo_pago': 'beneficio',
                'asignacion_beneficio_id': self.asignacion_beneficio.id,
                'tipo_pago_beneficio': 'normal',
                'cantidad': 5,
                'monto': '10000',
            },
        ])
        self.assertEqual(response.status_code, 201, response.content)
        grupo_id = response.json()['grupo']['id']

        self._login_tesorero('director_beneficio')
        accion = self.client.post(
            '/api/portal/tesoreria/solicitudes/grupo/%s/accion/' % grupo_id,
            data=json.dumps({'accion': 'aprobar'}),
            content_type='application/json',
        )
        self.assertEqual(accion.status_code, 200, accion.content)

        pago = PagoBeneficio.objects.get(asignacion=self.asignacion_beneficio)
        self.assertEqual(pago.cantidad_tarjetas, 5)
        self.assertEqual(pago.monto, Decimal('10000'))

        self.asignacion_beneficio.refresh_from_db()
        self.assertEqual(self.asignacion_beneficio.tarjetas_vendidas, 5)
        self.assertEqual(self.asignacion_beneficio.tarjetas_disponibles, 0)
        self.assertEqual(self.asignacion_beneficio.monto_pendiente, Decimal('0'))
        self.assertEqual(self.asignacion_beneficio.estado_pago, 'completo')


class TesoreriaGrupoAprobacionAtomicaTest(PortalGrupoBaseTest):
    """C2 / I1: la aprobacion es atomica y 'Observar' no aplica a grupos."""

    rut = '18111222-5'
    clave_bombero = '183'
    username = 'cvera.42'

    def _crear_grupo_con_dos_cuotas(self):
        grupo = GrupoSolicitudPago.objects.create(
            voluntario=self.voluntario, portal_user=self.portal_user,
            fecha_pago=date(2026, 7, 27), cuenta_bancaria_destino=self.cuenta,
            monto_total=self.precio_cuota * 2,
        )
        for mes in (1, 2):
            SolicitudPagoPortal.objects.create(
                voluntario=self.voluntario, portal_user=self.portal_user,
                tipo_pago='cuota', nombre_pago='Cuota %02d/2026' % mes,
                monto_solicitado=self.precio_cuota, cuota_mes=mes, cuota_anio=2026,
                fecha_pago=date(2026, 7, 27), grupo=grupo,
            )
        return grupo

    def test_si_un_item_falla_se_revierte_el_grupo_completo(self):
        from voluntarios.models import PagoCuota

        grupo = self._crear_grupo_con_dos_cuotas()
        # La cuota 02/2026 ya fue pagada por fuera: registrar_pago_cuota
        # levantara ValueError al procesar ese item del grupo.
        tesorero = self._login_tesorero('director_atomico')
        PagoCuota.objects.create(
            voluntario=self.voluntario, mes=2, anio=2026,
            fecha_pago=date(2026, 7, 1), monto_pagado=self.precio_cuota,
            created_by=tesorero,
        )

        response = self.client.post(
            '/api/portal/tesoreria/solicitudes/grupo/%s/accion/' % grupo.id,
            data=json.dumps({'accion': 'aprobar'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Ya existe un pago', response.json()['error'])

        # La cuota 01/2026 NO debe haber quedado registrada.
        self.assertEqual(PagoCuota.objects.filter(voluntario=self.voluntario, mes=1).count(), 0)
        self.assertEqual(PagoCuota.objects.filter(voluntario=self.voluntario).count(), 1)

        grupo.refresh_from_db()
        self.assertEqual(grupo.estado, 'pendiente')
        for item in grupo.items.all():
            self.assertEqual(item.estado, 'pendiente')
            self.assertIsNone(item.pago_cuota_id)

    def test_observar_no_esta_disponible_para_grupos(self):
        grupo = self._crear_grupo_con_dos_cuotas()
        self._login_tesorero('director_observar')

        response = self.client.post(
            '/api/portal/tesoreria/solicitudes/grupo/%s/accion/' % grupo.id,
            data=json.dumps({'accion': 'observar', 'feedback': 'Voucher borroso'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Observar no esta disponible', response.json()['error'])

        grupo.refresh_from_db()
        self.assertEqual(grupo.estado, 'pendiente')



class PortalSolicitudSimpleTest(PortalGrupoBaseTest):
    """El flujo de solicitud simple sigue funcionando tras compartir el validador."""

    rut = '18111222-6'
    clave_bombero = '184'
    username = 'cvera.43'

    def _post_simple(self, **extra):
        payload = {
            'tipo_pago': 'cuota',
            'nombre_pago': 'Cuota 01/2026',
            'monto_solicitado': str(self.precio_cuota),
            'cuota_mes': 1,
            'cuota_anio': 2026,
            'fecha_pago': '2026-07-27',
            'cuenta_bancaria_destino_id': str(self.cuenta.id),
            'comprobante': _archivo_comprobante(),
        }
        payload.update(extra)
        return self.client.post('/api/portal/solicitudes/', payload)

    def test_crear_solicitud_simple_de_cuota(self):
        response = self._post_simple()
        self.assertEqual(response.status_code, 201, response.content)
        solicitud = SolicitudPagoPortal.objects.get(id=response.json()['solicitud']['id'])
        self.assertEqual(solicitud.tipo_pago, 'cuota')
        self.assertEqual(solicitud.monto_solicitado, self.precio_cuota)
        self.assertIsNone(solicitud.grupo)

    def test_solicitud_simple_con_monto_incorrecto_es_rechazada(self):
        response = self._post_simple(monto_solicitado='1')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('monto exacto', response.json()['error'])

    def test_solicitud_simple_con_comprobante_invalido_es_rechazada(self):
        response = self._post_simple(comprobante=_archivo_comprobante('voucher.exe', b'x', 'application/octet-stream'))
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('comprobante debe ser un archivo', response.json()['error'])
