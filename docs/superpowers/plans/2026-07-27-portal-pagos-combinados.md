# Pagos Combinados del Portal de Voluntarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un voluntario del portal pague varias cuotas/beneficios/rifa con un solo comprobante (con auto-detección de cuotas atrasadas), que el tesorero apruebe/rechace ese conjunto de una vez repartiendo el dinero correctamente a cada concepto, que lleguen emails de comprobante (aprobación) y de motivo de rechazo, y mover "Cambiar contraseña" a una página separada.

**Architecture:** Nuevo modelo `GrupoSolicitudPago` (carrito) con `SolicitudPagoPortal.grupo` FK opcional — las solicitudes simples existentes (`grupo=None`) no se tocan. El frontend nuevo del voluntario siempre envía al endpoint de grupo (incluso para un solo ítem), simplificando a un solo camino de envío. La aprobación de un grupo reutiliza sin cambios las funciones ya existentes `registrar_pago_cuota`/`registrar_pago_beneficio`/`registrar_pago_rifa`, que ya reparten el dinero a su lugar correcto. Los emails reutilizan la infraestructura ya existente en `utils_email.py`.

**Tech Stack:** Django (backend), DRF no se usa en el portal (vistas funcionales `JsonResponse`), JS vanilla (`static/js/portal-voluntario.js`, `static/js/tesoreria-portal.js`), `django.core.mail.EmailMultiAlternatives` + `xhtml2pdf` para comprobantes en PDF.

## Global Constraints

- No se modifica el flujo de solicitudes simples existente (`SolicitudPagoPortal` sin grupo) más allá de agregarle el envío de email al aprobar/rechazar — su lógica de creación/validación en `_crear_o_actualizar_solicitud` no cambia.
- `registrar_pago_cuota`, `registrar_pago_beneficio`, `registrar_pago_rifa` (en `utils_tesoreria.py` y `portal_utils.py`) no se modifican — se reutilizan tal cual.
- Sin emojis en ninguna plantilla, email o mensaje de UI (regla del proyecto).
- Todo archivo estático nuevo o modificado que se cargue con `{% static %}` debe usar/incrementar su `?v=` de cache-busting.
- Si el voluntario no tiene email cargado, el envío se omite silenciosamente (no bloquea la aprobación/rechazo) — mismo comportamiento que las funciones de email existentes.
- Usar `django.test.TestCase` (no pytest), ejecutar con `python manage.py test voluntarios`.

---

### Task 1: Modelo `GrupoSolicitudPago` + campo `grupo` en `SolicitudPagoPortal`

**Files:**
- Modify: `voluntarios/models.py` (agregar `GrupoSolicitudPago` al final del archivo, agregar campo `grupo` a `SolicitudPagoPortal`)
- Modify: `voluntarios/tests.py` (agregar tests del modelo)
- Create: `voluntarios/migrations/00XX_grupo_solicitud_pago.py` (autogenerada)

**Interfaces:**
- Produces: modelo `GrupoSolicitudPago` con campos `voluntario`, `portal_user`, `estado`, `fecha_pago`, `cuenta_bancaria_destino`, `numero_comprobante`, `comprobante`, `descripcion`, `monto_total`, `feedback_tesorero`, `observada_hasta`, `revisada_por`, `revisada_at`, `aprobada_at`, `created_at`. `SolicitudPagoPortal.grupo` (FK nullable a `GrupoSolicitudPago`, `related_name='items'`).

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `voluntarios/tests.py`:

```python
from voluntarios.models import GrupoSolicitudPago, CuentaBancaria


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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python manage.py test voluntarios.tests.GrupoSolicitudPagoModelTest -v 2`
Expected: FAIL con `ImportError: cannot import name 'GrupoSolicitudPago'`

- [ ] **Step 3: Agregar el modelo**

Agregar al final de `voluntarios/models.py`:

```python
class GrupoSolicitudPago(models.Model):
    """
    Agrupa varias SolicitudPagoPortal (cuotas/beneficios/rifa) que el
    voluntario paga con un solo comprobante/transferencia.
    """
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('observada', 'Observada'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
        ('expirada', 'Expirada'),
    ]

    voluntario = models.ForeignKey(
        Voluntario,
        on_delete=models.CASCADE,
        related_name='grupos_solicitud_portal'
    )
    portal_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='grupos_solicitud_portal'
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')

    fecha_pago = models.DateField(default=timezone.now)
    cuenta_bancaria_destino = models.ForeignKey(
        CuentaBancaria,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='grupos_solicitud_portal'
    )
    numero_comprobante = models.CharField(max_length=100, blank=True, null=True)
    comprobante = models.FileField(upload_to='portal/comprobantes_grupo/%Y/%m/', blank=True, null=True)
    descripcion = models.TextField(blank=True, null=True)
    monto_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    feedback_tesorero = models.TextField(blank=True, null=True)
    observada_hasta = models.DateTimeField(blank=True, null=True)

    revisada_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='grupos_solicitud_revisados'
    )
    revisada_at = models.DateTimeField(blank=True, null=True)
    aprobada_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Grupo #{self.id} - {self.voluntario} - {self.estado}'
```

Modificar la clase `SolicitudPagoPortal` agregando este campo (junto a los demás `ForeignKey`, por ejemplo justo después de `cuenta_bancaria_destino`):

```python
    grupo = models.ForeignKey(
        GrupoSolicitudPago,
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name='items'
    )
```

- [ ] **Step 4: Generar y aplicar la migración**

Run: `python manage.py makemigrations voluntarios`
Expected: Crea una migración con `CreateModel` para `GrupoSolicitudPago` y `AddField` para `SolicitudPagoPortal.grupo`.

Run: `python manage.py migrate voluntarios`
Expected: `Applying voluntarios.00XX_..._gruposolicitudpago... OK`

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `python manage.py test voluntarios.tests.GrupoSolicitudPagoModelTest -v 2`
Expected: 3 tests, todos PASS

Run: `python manage.py test voluntarios` (verificar que no hay regresiones)
Expected: todos los tests existentes siguen en PASS

- [ ] **Step 6: Commit**

```bash
git add voluntarios/models.py voluntarios/tests.py voluntarios/migrations/
git commit -m "feat: agrega modelo GrupoSolicitudPago para pagos combinados del portal"
```

---

### Task 2: Backend — crear grupo de solicitudes (voluntario)

**Files:**
- Modify: `voluntarios/portal_utils.py` (agregar `serializar_grupo_solicitud`, `crear_grupo_solicitud`, y una utilidad `cuotas_atrasadas_incluidas`)
- Modify: `voluntarios/portal_views.py` (agregar `portal_solicitudes_grupo_view`)
- Modify: `voluntarios/urls.py` (registrar la ruta `portal/solicitudes/grupo/`)
- Modify: `voluntarios/tests.py` (tests de la vista)

**Interfaces:**
- Consumes: `GrupoSolicitudPago`, `SolicitudPagoPortal` (Task 1); `deudas_cuotas_portal`, `deudas_beneficios_portal`, `deudas_rifas_portal`, `_normalizar_decimal`, `_obtener_cuenta_destino`, `_require_portal_user`, `_json_error`, `_parse_request_data` (ya existen en `portal_views.py`/`portal_utils.py`).
- Produces: `crear_grupo_solicitud(profile, items, datos_comunes, archivo)` (función), `serializar_grupo_solicitud(grupo)` (función), endpoint `POST /api/portal/solicitudes/grupo/` (JSON: `{ "items": [{"tipo_pago": "cuota", "cuota_mes": 1, "cuota_anio": 2026, "monto": 7000}, ...], "fecha_pago": "2026-07-27", "cuenta_bancaria_destino_id": 1, "numero_comprobante": "123", "descripcion": "..." }`, multipart con `comprobante` como archivo).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `voluntarios/tests.py`:

```python
class PortalGrupoSolicitudAPITest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas
        self.client = Client()
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-7', clave_bombero='077',
            fecha_nacimiento=date(1995, 3, 3),
            fecha_ingreso=date(2019, 1, 1),
            estado_bombero='activo'
        )
        self.portal_user = User.objects.create_user(username='cvera.26', password='Bomberos123!')
        from voluntarios.models import PortalVoluntarioProfile
        PortalVoluntarioProfile.objects.create(
            voluntario=self.voluntario, user=self.portal_user, activo=True, debe_cambiar_clave=False
        )
        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='1234567', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False, monto_cuota=Decimal('7000')
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
```

`json` ya está importado al inicio de `voluntarios/tests.py`? Verificar: si no lo está, agregar `import json` junto a los demás imports del archivo.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python manage.py test voluntarios.tests.PortalGrupoSolicitudAPITest -v 2`
Expected: FAIL con 404 (la ruta no existe todavía)

- [ ] **Step 3: Implementar `crear_grupo_solicitud` y `serializar_grupo_solicitud` en `portal_utils.py`**

Agregar a `voluntarios/portal_utils.py` (necesita importar `GrupoSolicitudPago` en el bloque de imports de `.models` al inicio del archivo, y `Decimal` de `decimal`):

```python
from decimal import Decimal
from .models import GrupoSolicitudPago
```

(Agregar `GrupoSolicitudPago` al `from .models import (...)` existente en vez de una línea nueva de import, y agregar `from decimal import Decimal` junto a los imports existentes si no está.)

```python
@transaction.atomic
def crear_grupo_solicitud(profile, items, datos_comunes, archivo):
    """
    items: lista de dicts con al menos 'tipo_pago' y 'monto', mas las
    referencias segun tipo (cuota_mes/cuota_anio, asignacion_beneficio_id,
    tipo_pago_beneficio, cantidad, asignacion_rifa_id).
    datos_comunes: dict con 'fecha_pago' (date), 'cuenta_bancaria_destino'
    (CuentaBancaria), 'numero_comprobante', 'descripcion'.
    """
    if not items:
        raise ValueError('Debes seleccionar al menos un item para pagar')
    if not archivo:
        raise ValueError('Debes adjuntar un comprobante')

    monto_total = sum(Decimal(str(item['monto'])) for item in items)

    grupo = GrupoSolicitudPago.objects.create(
        voluntario=profile.voluntario,
        portal_user=profile.user,
        fecha_pago=datos_comunes['fecha_pago'],
        cuenta_bancaria_destino=datos_comunes['cuenta_bancaria_destino'],
        numero_comprobante=datos_comunes.get('numero_comprobante', ''),
        descripcion=datos_comunes.get('descripcion', ''),
        monto_total=monto_total,
        comprobante=archivo,
    )

    for item in items:
        tipo_pago = item['tipo_pago']
        monto = Decimal(str(item['monto']))

        if tipo_pago == 'cuota':
            mes = int(item['cuota_mes'])
            anio = int(item['cuota_anio'])
            cuotas_pendientes = deudas_cuotas_portal(profile.voluntario)['items']
            if not any(c['mes'] == mes and c['anio'] == anio for c in cuotas_pendientes):
                raise ValueError(f'La cuota {mes:02d}/{anio} ya no esta pendiente')
            SolicitudPagoPortal.objects.create(
                voluntario=profile.voluntario,
                portal_user=profile.user,
                tipo_pago='cuota',
                nombre_pago=f'Cuota {mes:02d}/{anio}',
                monto_solicitado=monto,
                cuota_mes=mes,
                cuota_anio=anio,
                cantidad=1,
                fecha_pago=datos_comunes['fecha_pago'],
                grupo=grupo,
            )
        elif tipo_pago == 'beneficio':
            asignacion = AsignacionBeneficio.objects.select_related('beneficio').get(
                id=int(item['asignacion_beneficio_id']),
                voluntario=profile.voluntario
            )
            tipo_beneficio = str(item.get('tipo_pago_beneficio', 'normal')).strip().lower() or 'normal'
            cantidad = int(item.get('cantidad') or 0)
            if cantidad <= 0:
                raise ValueError('La cantidad de tarjetas debe ser mayor a 0')
            SolicitudPagoPortal.objects.create(
                voluntario=profile.voluntario,
                portal_user=profile.user,
                tipo_pago='beneficio',
                nombre_pago=asignacion.beneficio.nombre,
                monto_solicitado=monto,
                asignacion_beneficio=asignacion,
                tipo_pago_beneficio=tipo_beneficio,
                cantidad=cantidad,
                fecha_pago=datos_comunes['fecha_pago'],
                grupo=grupo,
            )
        elif tipo_pago == 'rifa':
            asignacion = AsignacionRifa.objects.select_related('rifa').get(
                id=int(item['asignacion_rifa_id']),
                voluntario=profile.voluntario
            )
            SolicitudPagoPortal.objects.create(
                voluntario=profile.voluntario,
                portal_user=profile.user,
                tipo_pago='rifa',
                nombre_pago=asignacion.rifa.nombre,
                monto_solicitado=monto,
                asignacion_rifa=asignacion,
                cantidad=1,
                fecha_pago=datos_comunes['fecha_pago'],
                grupo=grupo,
            )
        else:
            raise ValueError(f'Tipo de pago invalido: {tipo_pago}')

    return grupo


def serializar_grupo_solicitud(grupo):
    estado_labels = {
        'pendiente': 'Pendiente',
        'observada': 'Observada',
        'aprobada': 'Pagado',
        'rechazada': 'Rechazado',
        'expirada': 'Expirada',
    }
    return {
        'id': grupo.id,
        'estado': grupo.estado,
        'estado_label': estado_labels.get(grupo.estado, grupo.estado),
        'fecha_pago': grupo.fecha_pago.isoformat() if grupo.fecha_pago else None,
        'numero_comprobante': grupo.numero_comprobante,
        'descripcion': grupo.descripcion,
        'monto_total': float(grupo.monto_total),
        'comprobante_url': grupo.comprobante.url if grupo.comprobante else None,
        'feedback_tesorero': grupo.feedback_tesorero,
        'observada_hasta': grupo.observada_hasta.isoformat() if grupo.observada_hasta else None,
        'created_at': grupo.created_at.isoformat() if grupo.created_at else None,
        'voluntario': {
            'id': grupo.voluntario_id,
            'nombre': grupo.voluntario.nombre_completo(),
            'rut': grupo.voluntario.rut,
        },
        'items': [serializar_solicitud(item) for item in grupo.items.all()],
    }
```

- [ ] **Step 4: Agregar la vista en `portal_views.py`**

Agregar `GrupoSolicitudPago` al bloque `from .models import (...)` de `portal_views.py`, y `crear_grupo_solicitud, serializar_grupo_solicitud` al bloque `from .portal_utils import (...)`. Luego agregar, después de `portal_solicitudes_view`:

```python
@csrf_exempt
@require_http_methods(["POST"])
def portal_solicitudes_grupo_view(request):
    profile, error = _require_portal_user(request)
    if error:
        return error

    try:
        data = _parse_request_data(request)
        items_raw = data.get('items')
        items = json.loads(items_raw) if isinstance(items_raw, str) else (items_raw or [])
        if not items:
            raise ValueError('Debes seleccionar al menos un item para pagar')

        fecha_raw = data.get('fecha_pago') or timezone.localdate().isoformat()
        fecha_pago = date.fromisoformat(str(fecha_raw))
        cuenta_destino = _obtener_cuenta_destino(data.get('cuenta_bancaria_destino_id'))
        archivo = request.FILES.get('comprobante')

        grupo = crear_grupo_solicitud(
            profile,
            items,
            {
                'fecha_pago': fecha_pago,
                'cuenta_bancaria_destino': cuenta_destino,
                'numero_comprobante': str(data.get('numero_comprobante', '')).strip(),
                'descripcion': str(data.get('descripcion', '')).strip(),
            },
            archivo,
        )
        return JsonResponse({'success': True, 'grupo': serializar_grupo_solicitud(grupo)}, status=201)
    except (ValueError, AsignacionBeneficio.DoesNotExist, AsignacionRifa.DoesNotExist) as exc:
        return _json_error(str(exc))
    except (json.JSONDecodeError, TypeError):
        return _json_error('JSON invalido')
```

- [ ] **Step 5: Registrar la URL**

En `voluntarios/urls.py`, agregar `portal_solicitudes_grupo_view` al `from . import portal_views` (si el archivo importa la vista por función individual, revisar el patrón actual: `from . import portal_views` importa el módulo completo, así que no hace falta tocar el import, solo agregar la ruta). Agregar esta línea junto a las demás rutas de `portal/solicitudes/`:

```python
    path('portal/solicitudes/grupo/', portal_views.portal_solicitudes_grupo_view, name='portal_solicitudes_grupo'),
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `python manage.py test voluntarios.tests.PortalGrupoSolicitudAPITest -v 2`
Expected: 2 tests, PASS

Run: `python manage.py test voluntarios`
Expected: sin regresiones

- [ ] **Step 7: Commit**

```bash
git add voluntarios/portal_utils.py voluntarios/portal_views.py voluntarios/urls.py voluntarios/tests.py
git commit -m "feat: endpoint para crear solicitudes de pago combinadas (grupo) en el portal"
```

---

### Task 3: Backend — aprobar/rechazar grupo (tesorero)

**Files:**
- Modify: `voluntarios/portal_views.py` (agregar `_aprobar_grupo`, `tesoreria_grupo_accion_view`)
- Modify: `voluntarios/urls.py` (registrar ruta)
- Modify: `voluntarios/tests.py` (tests)

**Interfaces:**
- Consumes: `_aprobar_solicitud` (patrón existente en `portal_views.py`), `registrar_pago_cuota`, `registrar_pago_beneficio`, `registrar_pago_rifa`.
- Produces: `POST /api/portal/tesoreria/solicitudes/grupo/<int:grupo_id>/accion/` con body `{"accion": "aprobar"|"observar"|"rechazar", "feedback": "..."}`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `voluntarios/tests.py`:

```python
class TesoreriaGrupoAccionAPITest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas, PortalVoluntarioProfile, GrupoSolicitudPago
        self.client = Client()
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-8', clave_bombero='078',
            fecha_nacimiento=date(1995, 3, 3),
            fecha_ingreso=date(2019, 1, 1),
            estado_bombero='activo'
        )
        self.portal_user = User.objects.create_user(username='cvera.27', password='Bomberos123!')
        PortalVoluntarioProfile.objects.create(
            voluntario=self.voluntario, user=self.portal_user, activo=True, debe_cambiar_clave=False
        )
        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='7654321', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False, monto_cuota=Decimal('7000')
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
```

`Group` debe estar importado en `tests.py` (`from django.contrib.auth.models import Group, User` — ya se agregó en una tarea previa de este proyecto; si no está, agregarlo).

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `python manage.py test voluntarios.tests.TesoreriaGrupoAccionAPITest -v 2`
Expected: FAIL con 404

- [ ] **Step 3: Implementar `_aprobar_grupo` y la vista**

Agregar en `voluntarios/portal_views.py`, después de `_aprobar_solicitud`:

```python
def _aprobar_grupo(grupo, reviewer):
    comprobante_base64 = _archivo_a_data_url(grupo.comprobante)

    for item in grupo.items.all():
        datos_pago = {
            'fecha_pago': grupo.fecha_pago,
            'metodo_pago': 'transferencia',
            'numero_comprobante': grupo.numero_comprobante,
            'observaciones': grupo.descripcion,
            'cuenta_bancaria': grupo.cuenta_bancaria_destino,
            'comprobante_base64': comprobante_base64,
        }

        if item.tipo_pago == 'cuota':
            pago = registrar_pago_cuota(
                item.voluntario_id, item.cuota_mes, item.cuota_anio,
                item.monto_solicitado, datos_pago, reviewer,
            )
            item.pago_cuota = pago
        elif item.tipo_pago == 'beneficio':
            pago = registrar_pago_beneficio(
                item.asignacion_beneficio_id, item.tipo_pago_beneficio,
                item.cantidad, item.monto_solicitado, datos_pago, reviewer,
            )
            item.pago_beneficio = pago
        else:
            pago = registrar_pago_rifa(
                item.asignacion_rifa_id, item.monto_solicitado,
                {**datos_pago, 'es_extra': item.asignacion_rifa.pagos.exists()},
                reviewer,
            )
            item.pago_rifa = pago

        item.estado = 'aprobada'
        item.feedback_tesorero = ''
        item.revisada_por = reviewer
        item.revisada_at = timezone.now()
        item.aprobada_at = timezone.now()
        item.save()

    grupo.estado = 'aprobada'
    grupo.feedback_tesorero = ''
    grupo.observada_hasta = None
    grupo.revisada_por = reviewer
    grupo.revisada_at = timezone.now()
    grupo.aprobada_at = timezone.now()
    grupo.save()


@csrf_exempt
@require_http_methods(["POST"])
def tesoreria_grupo_accion_view(request, grupo_id):
    _, error = _require_tesoreria(request)
    if error:
        return error

    try:
        grupo = GrupoSolicitudPago.objects.prefetch_related('items').get(id=grupo_id)
    except GrupoSolicitudPago.DoesNotExist:
        return _json_error('Grupo no encontrado', 404)

    if grupo.estado not in ['pendiente', 'observada']:
        return _json_error('El grupo ya fue cerrado', 400)

    try:
        data = _parse_request_data(request)
        accion = str(data.get('accion', '')).strip().lower()
        feedback = str(data.get('feedback', '')).strip()

        if accion == 'aprobar':
            _aprobar_grupo(grupo, request.user)
            return JsonResponse({'success': True, 'grupo': serializar_grupo_solicitud(grupo)})

        if accion == 'observar':
            if not feedback:
                return _json_error('Debes indicar retroalimentacion para observar el grupo')
            grupo.estado = 'observada'
            grupo.feedback_tesorero = feedback
            grupo.observada_hasta = crear_feedback_observacion()
            grupo.revisada_por = request.user
            grupo.revisada_at = timezone.now()
            grupo.save()
            grupo.items.update(estado='observada', feedback_tesorero=feedback)
            return JsonResponse({'success': True, 'grupo': serializar_grupo_solicitud(grupo)})

        if accion == 'rechazar':
            if not feedback:
                return _json_error('Debes indicar el motivo del rechazo')
            grupo.estado = 'rechazada'
            grupo.feedback_tesorero = feedback
            grupo.observada_hasta = None
            grupo.revisada_por = request.user
            grupo.revisada_at = timezone.now()
            grupo.save()
            grupo.items.update(estado='rechazada', feedback_tesorero=feedback)
            return JsonResponse({'success': True, 'grupo': serializar_grupo_solicitud(grupo)})

        return _json_error('Accion invalida')
    except ValueError as exc:
        return _json_error(str(exc))
    except json.JSONDecodeError:
        return _json_error('JSON invalido')
```

- [ ] **Step 4: Registrar la URL**

En `voluntarios/urls.py`, agregar junto a la ruta de accion existente:

```python
    path('portal/tesoreria/solicitudes/grupo/<int:grupo_id>/accion/', portal_views.tesoreria_grupo_accion_view, name='portal_tesoreria_grupo_accion'),
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `python manage.py test voluntarios.tests.TesoreriaGrupoAccionAPITest -v 2`
Expected: 3 tests, PASS

Run: `python manage.py test voluntarios`
Expected: sin regresiones

- [ ] **Step 6: Commit**

```bash
git add voluntarios/portal_views.py voluntarios/urls.py voluntarios/tests.py
git commit -m "feat: aprobar/observar/rechazar grupos de solicitudes de pago del portal"
```

---

### Task 4: Emails de comprobante y de rechazo

**Files:**
- Create: `templates/emails/comprobante_grupo.html`
- Modify: `voluntarios/utils_email.py` (agregar `enviar_comprobante_grupo`, `enviar_notificacion_rechazo`)
- Modify: `voluntarios/portal_views.py` (llamar los emails en `_aprobar_solicitud`, `_aprobar_grupo`, y en las ramas `rechazar` de `tesoreria_solicitud_accion_view` y `tesoreria_grupo_accion_view`)
- Modify: `config/settings.py` (agregar backend de test si falta — verificar, ver Step 1)
- Modify: `voluntarios/tests.py` (tests con `django.core.mail.outbox`)

**Interfaces:**
- Consumes: `generar_pdf_comprobante` (ya existe en `utils_email.py`), `GrupoSolicitudPago`, `SolicitudPagoPortal`.
- Produces: `enviar_comprobante_grupo(grupo, voluntario)` (bool), `enviar_notificacion_rechazo(voluntario, motivo, concepto)` (bool).

- [ ] **Step 1: Verificar que los tests usan un backend de email en memoria**

Django usa por defecto `locmem` durante los tests salvo que se sobreescriba explícitamente. Confirmar que `config/settings.py` no fuerza el backend SMTP dentro de un bloque `if TESTING` — no debería, ya que Django reemplaza `EMAIL_BACKEND` automáticamente al correr `manage.py test`. No se requiere cambio si no hay tal bloque (verificar con `grep -n "TESTING" config/settings.py`; si no hay match, no hacer nada en este paso).

- [ ] **Step 2: Escribir el test que falla**

Agregar a `voluntarios/tests.py`:

```python
from django.core import mail


class NotificacionesPortalEmailTest(TestCase):

    def setUp(self):
        from voluntarios.models import CicloCuotas, PortalVoluntarioProfile, GrupoSolicitudPago
        self.voluntario = Voluntario.objects.create(
            nombre='Cristian', apellido_paterno='Vera', apellido_materno='Arriagada',
            rut='19621524-9', clave_bombero='079', email='cvera@example.com',
            fecha_nacimiento=date(1995, 3, 3),
            fecha_ingreso=date(2019, 1, 1),
            estado_bombero='activo'
        )
        self.portal_user = User.objects.create_user(username='cvera.28', password='Bomberos123!')
        PortalVoluntarioProfile.objects.create(
            voluntario=self.voluntario, user=self.portal_user, activo=True, debe_cambiar_clave=False
        )
        self.cuenta = CuentaBancaria.objects.create(
            nombre='Cuenta Principal', banco='BancoEstado',
            tipo_cuenta='corriente', numero_cuenta='9998887', rut_titular='76.123.456-7',
            activa=True
        )
        CicloCuotas.objects.create(
            anio=2026, fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 12, 31),
            activo=True, cerrado=False, monto_cuota=Decimal('7000')
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
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `python manage.py test voluntarios.tests.NotificacionesPortalEmailTest -v 2`
Expected: FAIL — `len(mail.outbox)` es 0 (todavia no se envia nada)

- [ ] **Step 4: Crear la plantilla del comprobante de grupo**

Create `templates/emails/comprobante_grupo.html` (mismo estilo que `templates/emails/comprobante_cuota.html`, con una tabla itemizada):

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprobante de Pago</title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; margin: 20px; padding: 0; }
        .container { background: white; padding: 30px; border: 1px solid #ddd; }
        .header { text-align: center; border-bottom: 3px solid #c8102e; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #c8102e; margin: 0 0 10px 0; font-size: 24px; }
        .header p { color: #666; margin: 0; font-size: 14px; }
        .comprobante-numero { background: #c8102e; color: white; padding: 12px; text-align: center; font-weight: bold; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table th { background: #f5f5f5; text-align: left; padding: 8px; border-bottom: 2px solid #ddd; font-size: 13px; }
        table td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
        .total-row td { font-weight: bold; border-top: 2px solid #c8102e; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Comprobante de Pago</h1>
            <p>Sistema de Gestión de Bomberos</p>
        </div>
        <div class="comprobante-numero">Grupo N° {{ grupo.id }}</div>
        <p>Voluntario: <strong>{{ voluntario.nombre }} {{ voluntario.apellido_paterno }} {{ voluntario.apellido_materno }}</strong></p>
        <p>Clave: {{ voluntario.clave_bombero }} &middot; RUT: {{ voluntario.rut }}</p>
        <p>Fecha de Pago: {{ fecha_formateada }}</p>
        <table>
            <thead>
                <tr><th>Concepto</th><th>Monto</th></tr>
            </thead>
            <tbody>
                {% for item in items %}
                <tr><td>{{ item.nombre_pago }}</td><td>${{ item.monto_solicitado|floatformat:0 }}</td></tr>
                {% endfor %}
                <tr class="total-row"><td>Total Pagado</td><td>${{ monto_total|floatformat:0 }}</td></tr>
            </tbody>
        </table>
        <div class="footer">
            Este es un comprobante electrónico válido.<br>
            Sistema de Gestión de Bomberos - Proyecto SEIS
        </div>
    </div>
</body>
</html>
```

- [ ] **Step 5: Agregar las funciones de email**

Agregar al final de `voluntarios/utils_email.py`:

```python
def enviar_comprobante_grupo(grupo, voluntario):
    """
    Envía un comprobante único itemizado por email para un GrupoSolicitudPago aprobado.
    """
    try:
        if not voluntario.email:
            logger.warning(f'Voluntario {voluntario.clave_bombero} no tiene email configurado')
            return False

        items = list(grupo.items.all())
        fecha_formateada = grupo.fecha_pago.strftime('%d/%m/%Y') if hasattr(grupo.fecha_pago, 'strftime') else str(grupo.fecha_pago)

        context = {
            'grupo': grupo,
            'voluntario': voluntario,
            'items': items,
            'monto_total': grupo.monto_total,
            'fecha_formateada': fecha_formateada,
        }
        html_content = render_to_string('emails/comprobante_grupo.html', context)

        items_texto = '\n'.join(f'  - {item.nombre_pago}: ${item.monto_solicitado:,.0f}' for item in items)
        text_content = f"""
        COMPROBANTE DE PAGO
        Bomberos

        Comprobante de Grupo N° {grupo.id}

        Voluntario: {voluntario.nombre} {voluntario.apellido_paterno} {voluntario.apellido_materno}
        Clave: {voluntario.clave_bombero}
        RUT: {voluntario.rut}

        Fecha de Pago: {fecha_formateada}

        Conceptos pagados:
        {items_texto}

        MONTO TOTAL PAGADO: ${grupo.monto_total:,.0f}

        Este es un comprobante electrónico válido.
        Sistema de Gestión de Bomberos - Proyecto SEIS
        """

        msg = EmailMultiAlternatives(
            subject=f'Comprobante de Pago - Grupo #{grupo.id}',
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[voluntario.email],
        )
        msg.attach_alternative(html_content, "text/html")

        pdf_buffer = generar_pdf_comprobante(html_content)
        if pdf_buffer:
            msg.attach(f'Comprobante_Grupo_{grupo.id}_{voluntario.clave_bombero}.pdf', pdf_buffer.read(), 'application/pdf')

        msg.send(fail_silently=False)
        logger.info(f'Comprobante de grupo enviado a {voluntario.email} para grupo {grupo.id}')
        return True
    except Exception as e:
        logger.error(f'Error al enviar comprobante de grupo: {str(e)}')
        return False


def enviar_notificacion_rechazo(voluntario, motivo, concepto):
    """
    Envía un email notificando que una solicitud de pago (simple o grupo) fue rechazada.

    Args:
        voluntario: objeto Voluntario
        motivo: texto escrito por el tesorero (feedback_tesorero)
        concepto: descripcion corta de lo que se rechazo (ej. "Cuota 03/2026" o "Grupo #12")
    """
    try:
        if not voluntario.email:
            logger.warning(f'Voluntario {voluntario.clave_bombero} no tiene email configurado')
            return False

        subject = f'Solicitud de pago rechazada - {concepto}'
        text_content = f"""
        SOLICITUD DE PAGO RECHAZADA
        Bomberos

        Estimado/a {voluntario.nombre} {voluntario.apellido_paterno},

        Tu solicitud de pago "{concepto}" fue rechazada por el tesorero.

        Motivo: {motivo}

        Ingresa al portal de voluntarios para revisar el detalle y volver a enviar tu solicitud
        con la informacion corregida.

        Sistema de Gestión de Bomberos - Proyecto SEIS
        """
        html_content = f"""
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#7f1d1d;color:white;padding:20px;border-radius:8px 8px 0 0">
                <h2 style="margin:0">Solicitud de Pago Rechazada</h2>
            </div>
            <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
                <p>Estimado/a <strong>{voluntario.nombre} {voluntario.apellido_paterno}</strong>,</p>
                <p>Tu solicitud de pago <strong>{concepto}</strong> fue rechazada por el tesorero.</p>
                <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0">
                    <div style="font-size:0.8rem;color:#7f1d1d;text-transform:uppercase">Motivo</div>
                    <div style="font-size:1rem;color:#333;margin-top:4px">{motivo}</div>
                </div>
                <p>Ingresa al portal de voluntarios para revisar el detalle y volver a enviar tu solicitud.</p>
                <p style="font-size:0.8rem;color:#9ca3af;margin-top:20px">Sistema de Gestión de Bomberos - Proyecto SEIS</p>
            </div>
        </body></html>
        """

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[voluntario.email],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)
        logger.info(f'Notificacion de rechazo enviada a {voluntario.email}')
        return True
    except Exception as e:
        logger.error(f'Error al enviar notificacion de rechazo: {str(e)}')
        return False
```

- [ ] **Step 6: Conectar los emails en `portal_views.py`**

Agregar `enviar_comprobante_grupo, enviar_notificacion_rechazo` al import de `.utils_email` en `portal_views.py` (si no existe ese import, agregarlo: `from .utils_email import enviar_comprobante_grupo, enviar_notificacion_rechazo`).

En `_aprobar_grupo`, justo antes del `grupo.save()` final, agregar:

```python
    enviar_comprobante_grupo(grupo, grupo.voluntario)
```

En la rama `rechazar` de `tesoreria_grupo_accion_view`, justo despues de `grupo.items.update(...)`, agregar:

```python
            enviar_notificacion_rechazo(grupo.voluntario, feedback, f'Grupo #{grupo.id}')
```

Para las solicitudes simples (no agrupadas), en `_aprobar_solicitud` agregar antes del `solicitud.save()` final:

```python
    if solicitud.tipo_pago == 'cuota':
        from .utils_email import enviar_comprobante_cuota
        enviar_comprobante_cuota(pago, solicitud.voluntario)
    elif solicitud.tipo_pago == 'beneficio':
        from .utils_email import enviar_comprobante_beneficio
        enviar_comprobante_beneficio(pago, solicitud.voluntario, solicitud.asignacion_beneficio.beneficio)
    else:
        from .utils_email import enviar_comprobante_rifa
        enviar_comprobante_rifa(pago, solicitud.voluntario, solicitud.asignacion_rifa.rifa)
```

Y en la rama `rechazar` de `tesoreria_solicitud_accion_view`, justo despues de `solicitud.save()`, agregar:

```python
            enviar_notificacion_rechazo(solicitud.voluntario, feedback, solicitud.nombre_pago)
```

- [ ] **Step 7: Correr los tests para verificar que pasan**

Run: `python manage.py test voluntarios.tests.NotificacionesPortalEmailTest -v 2`
Expected: 2 tests, PASS

Run: `python manage.py test voluntarios`
Expected: sin regresiones

- [ ] **Step 8: Commit**

```bash
git add templates/emails/comprobante_grupo.html voluntarios/utils_email.py voluntarios/portal_views.py voluntarios/tests.py
git commit -m "feat: notificaciones por email de aprobacion y rechazo de pagos del portal"
```

---

### Task 5: Frontend del voluntario — carrito con auto-suma de cuotas atrasadas

**Files:**
- Modify: `templates/portal_voluntario/panel.html` (reemplazar el bloque `#solicitudFormPanel` por un carrito)
- Modify: `static/js/portal-voluntario.js` (reescribir la lógica de armado/envío de solicitudes)

**Interfaces:**
- Consumes: `POST /api/portal/solicitudes/grupo/` (Task 2), `GET /api/portal/dashboard/` (sin cambios — ya devuelve `cuotas.pendientes` ordenadas por mes/año, `beneficios`, `rifas`, `cuentas_bancarias`).
- Produces: variable global `carrito` (array de `{clave, tipo_pago, nombre_pago, monto, cuota_mes, cuota_anio, asignacion_beneficio_id, tipo_pago_beneficio, cantidad, asignacion_rifa_id}`) y funciones `window.agregarCuotaCarrito`, `window.agregarBeneficioCarrito`, `window.agregarRifaCarrito`, `window.quitarDelCarrito`.

- [ ] **Step 1: Reemplazar el formulario del panel por el carrito**

En `templates/portal_voluntario/panel.html`, reemplazar el bloque completo `<section id="solicitudFormPanel" class="panel">...</section>` (líneas 98-166) por:

```html
                <section id="solicitudFormPanel" class="panel">
                    <h2>Carrito de pago</h2>
                    <div id="carritoVacio" class="empty-state">Agrega cuotas, beneficios o rifas desde la izquierda para pagarlos juntos con un solo comprobante.</div>
                    <div id="carritoItems"></div>
                    <div id="carritoTotal" style="display:none; margin-top:10px; font-weight:700; font-size:1.1rem;"></div>

                    <form id="solicitudForm" enctype="multipart/form-data" style="display:none; margin-top:16px;">
                        <div>
                            <label for="fecha_pago">Fecha de pago</label>
                            <input id="fecha_pago" name="fecha_pago" type="date" required>
                        </div>

                        <div>
                            <label for="cuenta_bancaria_destino_id">Cuenta bancaria destino</label>
                            <select id="cuenta_bancaria_destino_id" name="cuenta_bancaria_destino_id" required></select>
                        </div>

                        <div>
                            <label for="numero_comprobante">Número de comprobante</label>
                            <input id="numero_comprobante" name="numero_comprobante">
                        </div>

                        <div>
                            <label for="descripcion">Descripción</label>
                            <textarea id="descripcion" name="descripcion" placeholder="Ej: transferencia realizada desde BancoEstado"></textarea>
                        </div>

                        <div>
                            <label for="comprobante">Voucher o comprobante</label>
                            <input id="comprobante" name="comprobante" type="file" accept="image/*,application/pdf" required>
                        </div>

                        <button class="primary-btn" type="submit">Enviar solicitud</button>
                        <div id="solicitudError" class="form-msg form-error"></div>
                        <div id="solicitudOk" class="form-msg form-ok"></div>
                    </form>
                </section>

                <section class="panel">
                    <a class="secondary-btn" href="/portal/cambiar-clave/" style="display:inline-block; text-decoration:none; text-align:center;">Cambiar contraseña</a>
                </section>
```

Y eliminar el bloque `<section class="panel"><h2>Cambiar contraseña</h2>...</section>` (líneas 168-182 del archivo original) — se reemplaza por el link de arriba.

- [ ] **Step 2: Reescribir la lógica del carrito en `portal-voluntario.js`**

Reemplazar en `static/js/portal-voluntario.js` desde `let dashboardCache = null;` hasta el final de `bindDashboardActions()` (líneas 52-140 del archivo original) por:

```javascript
    let dashboardCache = null;
    let carrito = [];

    function claveItem(tipo, ref) {
        return `${tipo}:${ref}`;
    }

    function renderCarrito() {
        const vacio = document.getElementById('carritoVacio');
        const itemsDiv = document.getElementById('carritoItems');
        const totalDiv = document.getElementById('carritoTotal');
        const form = document.getElementById('solicitudForm');

        if (!carrito.length) {
            vacio.style.display = 'block';
            itemsDiv.innerHTML = '';
            totalDiv.style.display = 'none';
            form.style.display = 'none';
            return;
        }

        vacio.style.display = 'none';
        form.style.display = 'grid';

        itemsDiv.innerHTML = carrito.map((item) => `
            <article class="request-card">
                <div>
                    <h4>${item.nombre_pago}</h4>
                    <p>${money(item.monto)}</p>
                </div>
                <button class="danger-btn" onclick="quitarDelCarrito('${item.clave}')">Quitar</button>
            </article>
        `).join('');

        const total = carrito.reduce((sum, item) => sum + item.monto, 0);
        totalDiv.style.display = 'block';
        totalDiv.textContent = `Total a pagar: ${money(total)}`;

        if (!document.getElementById('fecha_pago').value) {
            document.getElementById('fecha_pago').value = new Date().toISOString().slice(0, 10);
        }
    }

    function agregarAlCarrito(item) {
        if (carrito.some((existing) => existing.clave === item.clave)) return;
        carrito.push(item);
        renderCarrito();
    }

    function bindDashboardActions() {
        window.quitarDelCarrito = (clave) => {
            carrito = carrito.filter((item) => item.clave !== clave);
            renderCarrito();
        };

        window.agregarCuotaCarrito = (mes, anio, monto) => {
            agregarAlCarrito({
                clave: claveItem('cuota', `${anio}-${mes}`),
                tipo_pago: 'cuota',
                nombre_pago: `Cuota ${String(mes).padStart(2, '0')}/${anio}`,
                monto,
                cuota_mes: mes,
                cuota_anio: anio,
            });

            const atrasadas = (dashboardCache.cuotas.pendientes || [])
                .filter((c) => (c.anio < anio) || (c.anio === anio && c.mes < mes));
            if (atrasadas.length) {
                atrasadas.forEach((c) => agregarAlCarrito({
                    clave: claveItem('cuota', `${c.anio}-${c.mes}`),
                    tipo_pago: 'cuota',
                    nombre_pago: `Cuota ${String(c.mes).padStart(2, '0')}/${c.anio}`,
                    monto: c.monto,
                    cuota_mes: c.mes,
                    cuota_anio: c.anio,
                }));
                const ok = document.getElementById('solicitudOk');
                const nombres = atrasadas.map((c) => `${String(c.mes).padStart(2, '0')}/${c.anio}`).join(', ');
                ok.textContent = `Se agregaron también las cuotas atrasadas: ${nombres}.`;
            }
        };

        window.agregarBeneficioCarrito = (id, nombre, montoPendiente) => {
            agregarAlCarrito({
                clave: claveItem('beneficio', id),
                tipo_pago: 'beneficio',
                nombre_pago: nombre,
                monto: montoPendiente,
                asignacion_beneficio_id: id,
                tipo_pago_beneficio: 'normal',
                cantidad: 1,
            });
        };

        window.agregarRifaCarrito = (id, nombre, montoPendiente) => {
            agregarAlCarrito({
                clave: claveItem('rifa', id),
                tipo_pago: 'rifa',
                nombre_pago: nombre,
                monto: montoPendiente,
                asignacion_rifa_id: id,
            });
        };

        window.cerrarSesionPortal = async () => {
            await request('/api/portal/auth/logout/', { method: 'POST' });
            window.location.href = '/portal/';
        };
    }
```

- [ ] **Step 3: Actualizar `loadDashboard` para usar los botones nuevos**

En `static/js/portal-voluntario.js`, dentro de `loadDashboard()`, reemplazar los tres bloques `renderList('cuotasPendientes', ...)`, `renderList('beneficiosPendientes', ...)`, `renderList('rifasPendientes', ...)` (líneas 158-186 del archivo original) por:

```javascript
        renderList('cuotasPendientes', data.dashboard.cuotas.pendientes, '<div class="empty-state">No hay cuotas pendientes del ciclo activo.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Monto pendiente: ${money(item.monto)}</p>
                </div>
                <button class="primary-btn" onclick="agregarCuotaCarrito(${item.mes}, ${item.anio}, ${item.monto})">Agregar al carrito</button>
            </article>
        `);

        renderList('beneficiosPendientes', data.dashboard.beneficios, '<div class="empty-state">No hay beneficios pendientes.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Pendiente: ${money(item.monto_pendiente)} · Tarjetas disponibles: ${item.tarjetas_disponibles}</p>
                </div>
                <button class="primary-btn" onclick="agregarBeneficioCarrito(${item.asignacion_id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.monto_pendiente})">Agregar al carrito</button>
            </article>
        `);

        renderList('rifasPendientes', data.dashboard.rifas, '<div class="empty-state">No hay rifas activas pendientes.</div>', (item) => `
            <article class="debt-card">
                <div>
                    <h4>${item.nombre}</h4>
                    <p>Pendiente: ${money(item.monto_pendiente)} · Estado: ${item.estado}</p>
                </div>
                ${item.puede_pagar ? `<button class="primary-btn" onclick="agregarRifaCarrito(${item.asignacion_id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.monto_pendiente})">Agregar al carrito</button>` : `<span class="pill warning">Retira los talonarios antes de pagar</span>`}
            </article>
        `);
```

El bloque `renderList('solicitudesHistorial', ...)` se actualiza en el Task 6 (pasa a listar grupos); no tocar en este paso.

- [ ] **Step 4: Actualizar el submit del formulario para enviar el carrito completo**

En `static/js/portal-voluntario.js`, dentro de `initPanel()`, reemplazar el listener de `solicitudForm` (líneas 213-237 del archivo original) por:

```javascript
        document.getElementById('solicitudForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const error = document.getElementById('solicitudError');
            const ok = document.getElementById('solicitudOk');
            error.textContent = '';

            if (!carrito.length) {
                error.textContent = 'Agrega al menos un item al carrito.';
                return;
            }

            const formData = new FormData(form);
            formData.set('items', JSON.stringify(carrito));

            try {
                await request('/api/portal/solicitudes/grupo/', {
                    method: 'POST',
                    body: formData,
                });
                ok.textContent = 'Solicitud enviada correctamente.';
                form.reset();
                carrito = [];
                renderCarrito();
                await loadDashboard();
            } catch (err) {
                error.textContent = err.message;
            }
        });
```

Eliminar (en el mismo `initPanel()`) el bloque `document.getElementById('passwordForm').addEventListener(...)` (líneas 239-259 del archivo original) — la lógica de cambio de contraseña se mueve a la página nueva en el Task 7.

Al final de `loadDashboard()`, después de poblar `cuentaSelect`, agregar `renderCarrito();` para que el carrito se re-renderice si `loadDashboard` se vuelve a llamar tras enviar una solicitud:

```javascript
        renderCarrito();
```

- [ ] **Step 5: Verificación manual**

Levantar el servidor (`python manage.py runserver`), entrar al portal con un usuario de voluntario que tenga cuotas atrasadas de más de un mes, hacer clic en "Agregar al carrito" en la cuota más reciente, y confirmar:
- Se agregan automáticamente las cuotas anteriores impagas.
- El total suma correctamente.
- Se puede quitar un ítem individual con "Quitar".
- Al enviar, se crea un solo `GrupoSolicitudPago` con sus ítems (verificar en `/admin/` o con `python manage.py shell`).

- [ ] **Step 6: Commit**

```bash
git add templates/portal_voluntario/panel.html static/js/portal-voluntario.js
git commit -m "feat: carrito de pagos combinados con auto-suma de cuotas atrasadas en el portal"
```

---

### Task 6: Frontend del tesorero — vista agrupada e historial del voluntario

**Files:**
- Modify: `templates/tesoreria/solicitudes-pagos-portal.html` (bump de cache-busting del JS)
- Modify: `static/js/tesoreria-portal.js` (mostrar grupos itemizados, aprobar/rechazar por grupo)
- Modify: `static/js/portal-voluntario.js` (historial del voluntario listando grupos)

**Interfaces:**
- Consumes: `GET /api/portal/dashboard/` necesita devolver también `grupos_solicitud` — requiere un cambio menor en `portal_dashboard_view` (Task 6 Step 1). `POST /api/portal/tesoreria/solicitudes/grupo/<id>/accion/` (Task 3). Para listar los grupos del lado tesorero, se agrega un endpoint de listado simple.

- [ ] **Step 1: Exponer los grupos en el dashboard del voluntario**

En `voluntarios/portal_views.py`, dentro de `portal_dashboard_view`, agregar antes del `return JsonResponse(...)`:

```python
    grupos = GrupoSolicitudPago.objects.filter(portal_user=profile.user).prefetch_related('items').order_by('-created_at')
    grupos_serializados = [serializar_grupo_solicitud(g) for g in grupos]
```

Y dentro del dict `'dashboard': {...}`, agregar la clave:

```python
            'grupos_solicitud': grupos_serializados,
```

- [ ] **Step 2: Agregar endpoint de listado de grupos para el tesorero**

Agregar en `voluntarios/portal_views.py`, después de `tesoreria_solicitudes_portal_view`:

```python
@require_http_methods(["GET"])
def tesoreria_grupos_portal_view(request):
    _, error = _require_tesoreria(request)
    if error:
        return error

    estado = str(request.GET.get('estado', '')).strip().lower()
    qs = GrupoSolicitudPago.objects.select_related('voluntario', 'revisada_por').prefetch_related('items').order_by('-created_at')

    if estado and estado not in ['todos', 'all']:
        estado_real = 'aprobada' if estado == 'pagado' else estado
        qs = qs.filter(estado=estado_real)

    grupos = [serializar_grupo_solicitud(g) for g in qs[:100]]
    return JsonResponse({'success': True, 'grupos': grupos})
```

En `voluntarios/urls.py`, agregar:

```python
    path('portal/tesoreria/solicitudes/grupo/', portal_views.tesoreria_grupos_portal_view, name='portal_tesoreria_grupos'),
```

- [ ] **Step 3: Mostrar los grupos itemizados en la vista del tesorero**

En `static/js/tesoreria-portal.js`, ubicar la función `loadSolicitudes()` (línea 309 del archivo original). Agregar, inmediatamente después de su definición, una función paralela para grupos que reutiliza `renderSolicitudes`-style pero itemizado:

```javascript
    function renderGrupos(data) {
        const container = document.getElementById('gruposPortal');
        if (!container) return;

        if (!data.grupos.length) {
            container.innerHTML = '<div class="empty-state">No hay solicitudes combinadas.</div>';
            return;
        }

        container.innerHTML = data.grupos.map((grupo) => `
            <article class="request-card" style="flex-direction:column; align-items:stretch;">
                <div>
                    <h4>${grupo.voluntario.nombre} — Grupo #${grupo.id} — ${grupo.estado_label}</h4>
                    <p>${fmtDate(grupo.fecha_pago)} · Comprobante N° ${grupo.numero_comprobante || '—'} · Total ${money(grupo.monto_total)}</p>
                    ${grupo.comprobante_url ? renderComprobanteButton(grupo.comprobante_url) : ''}
                    <ul>
                        ${grupo.items.map((item) => `<li>${item.nombre_pago}: ${money(item.monto_solicitado)}</li>`).join('')}
                    </ul>
                    ${grupo.feedback_tesorero ? `<p>Feedback: ${escapeHtml(grupo.feedback_tesorero)}</p>` : ''}
                </div>
                ${grupo.estado === 'pendiente' ? `
                <div>
                    <button class="primary-btn" data-grupo-action="aprobar" data-grupo-id="${grupo.id}">Aprobar</button>
                    <button class="secondary-btn" data-grupo-action="observar" data-grupo-id="${grupo.id}">Observar</button>
                    <button class="danger-btn" data-grupo-action="rechazar" data-grupo-id="${grupo.id}">Rechazar</button>
                </div>` : ''}
            </article>
        `).join('');

        container.querySelectorAll('[data-grupo-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const grupoId = btn.dataset.grupoId;
                const action = btn.dataset.grupoAction;
                if (action === 'aprobar') {
                    accionGrupoPortal(grupoId, 'aprobar');
                } else {
                    abrirModalGestionGrupo(grupoId, action);
                }
            });
        });
    }

    async function accionGrupoPortal(id, accion, feedback = '') {
        await request(`/api/portal/tesoreria/solicitudes/grupo/${id}/accion/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accion, feedback }),
        });
        await loadGrupos();
    }

    async function loadGrupos() {
        const data = await request('/api/portal/tesoreria/solicitudes/grupo/');
        renderGrupos(data);
    }
```

Nota: `abrirModalGestionGrupo` puede reutilizar el mismo modal que `abrirModalGestionSolicitud` (línea 338 del archivo original) cambiando qué función de confirmación invoca; para no duplicar el modal, modificar `state.selectedAction`/`state.selectedSolicitudId` para aceptar también un modo `state.selectedGrupoId` y que `confirmarModalGestion()` llame `accionGrupoPortal` en vez de `accionSolicitudPortal` cuando `state.selectedGrupoId` está seteado. Implementación mínima: agregar antes de `function abrirModalGestionSolicitud(id, accion) {` (línea 338):

```javascript
    function abrirModalGestionGrupo(id, accion) {
        state.selectedGrupoId = id;
        state.selectedSolicitudId = null;
        state.selectedAction = accion;
        abrirModalGestionSolicitud(id, accion);
    }
```

Y en `confirmarModalGestion()` (línea 364 del archivo original), cambiar la línea `await accionSolicitudPortal(state.selectedSolicitudId, state.selectedAction, feedback);` por:

```javascript
        if (state.selectedGrupoId) {
            await accionGrupoPortal(state.selectedGrupoId, state.selectedAction, feedback);
            state.selectedGrupoId = null;
        } else {
            await accionSolicitudPortal(state.selectedSolicitudId, state.selectedAction, feedback);
        }
```

En `bindSolicitudesPage()` (línea 375 del archivo original), agregar la llamada a `loadGrupos()` junto a `loadSolicitudes()`.

- [ ] **Step 4: Agregar el contenedor `#gruposPortal` en la plantilla**

En `templates/tesoreria/solicitudes-pagos-portal.html`, agregar una sección nueva antes de la lista de solicitudes simples existente (buscar el contenedor de solicitudes con `grep -n "id=\"solicitudesPortal\"" templates/tesoreria/solicitudes-pagos-portal.html` para ubicar el punto exacto e insertar justo antes):

```html
                <section class="panel">
                    <h2>Solicitudes combinadas (carrito)</h2>
                    <div id="gruposPortal"></div>
                </section>
```

Bump el cache-busting del script en esa misma plantilla:

```html
    <script src="{% static 'js/tesoreria-portal.js' %}?v=2"></script>
```

(reemplaza el `<script src="{% static 'js/tesoreria-portal.js' %}"></script>` sin versión que existe hoy en la línea 1258)

- [ ] **Step 5: Historial del voluntario listando grupos**

En `static/js/portal-voluntario.js`, dentro de `loadDashboard()`, reemplazar el bloque `renderList('solicitudesHistorial', data.dashboard.solicitudes, ...)` (líneas 188-198 del archivo original) por una versión que lista grupos:

```javascript
        renderList('solicitudesHistorial', data.dashboard.grupos_solicitud, '<div class="empty-state">Todavía no envías solicitudes.</div>', (grupo) => `
            <article class="request-card" style="flex-direction:column; align-items:stretch;">
                <div>
                    <h4>Grupo #${grupo.id} · ${money(grupo.monto_total)} · ${grupo.estado_label}</h4>
                    <ul>
                        ${grupo.items.map((item) => `<li>${item.nombre_pago}: ${money(item.monto_solicitado)}</li>`).join('')}
                    </ul>
                    ${grupo.feedback_tesorero ? `<p>${grupo.feedback_tesorero}</p>` : ''}
                    ${grupo.observada_hasta ? `<p>Debes corregir antes de ${new Date(grupo.observada_hasta).toLocaleString('es-CL')}</p>` : ''}
                </div>
            </article>
        `);
```

(La corrección de solicitudes observadas —`editarSolicitudPortal`— queda fuera de alcance de este spec para el flujo de grupo; no se reimplementa aquí. `window.editarSolicitudPortal` puede quedar como código muerto sin uso desde el historial, no se elimina por no formar parte de este cambio.)

- [ ] **Step 6: Verificación manual**

Con el servidor corriendo: enviar un grupo desde el portal del voluntario (Task 5), entrar como Director/Tesorero a `/solicitudes-pagos-portal.html`, confirmar que aparece la sección "Solicitudes combinadas" con el desglose itemizado, aprobar el grupo, y confirmar que:
- Se crean los `PagoCuota`/`PagoBeneficio`/`PagoRifa` correctos (revisar en `/finanzas.html` o `/admin/`).
- Llega el email (revisar consola si `EMAIL_BACKEND` está en modo consola en desarrollo, o la bandeja real si está configurado SMTP).
- El historial del voluntario en `/portal/panel/` muestra el grupo como "Pagado" con el desglose.

- [ ] **Step 7: Commit**

```bash
git add voluntarios/portal_views.py voluntarios/urls.py static/js/tesoreria-portal.js static/js/portal-voluntario.js templates/tesoreria/solicitudes-pagos-portal.html
git commit -m "feat: vista de tesoreria para aprobar/rechazar solicitudes combinadas del portal"
```

---

### Task 7: Página separada para cambiar contraseña

**Files:**
- Create: `templates/portal_voluntario/cambiar-clave.html`
- Modify: `config/urls.py` (agregar ruta `portal/cambiar-clave/`)
- Modify: `static/js/portal-voluntario.js` (agregar `initCambiarClave`)

**Interfaces:**
- Consumes: `POST /api/portal/auth/change-password/` (ya existe, sin cambios).
- Produces: página `/portal/cambiar-clave/`.

- [ ] **Step 1: Registrar la ruta**

En `config/urls.py`, agregar junto a las rutas `path('portal/', ...)` / `path('portal/panel/', ...)` (líneas 170-171 del archivo original):

```python
    path('portal/cambiar-clave/', template('portal_voluntario/cambiar-clave.html'), name='portal_cambiar_clave_page'),
```

- [ ] **Step 2: Crear la plantilla**

Create `templates/portal_voluntario/cambiar-clave.html` (mismo estilo visual que `panel.html`, reutilizando las mismas variables CSS):

```html
{% load static %}
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cambiar Contraseña - Portal Voluntario</title>
    <style>
        :root { --bg:#0f0f0f; --panel:#1c1c1c; --ink:#f0f0f0; --muted:#888; --line:#2a2a2a; --accent:#c0392b; --accent-dark:#8b1429; --soft:#1a1a1a; }
        * { box-sizing:border-box; }
        body { margin:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:var(--bg); color:var(--ink); -webkit-font-smoothing:antialiased; }
        .shell { width:min(480px, calc(100% - 32px)); margin:60px auto; }
        .panel { background:var(--panel); border-radius:16px; padding:26px; box-shadow:0 4px 20px rgba(0,0,0,0.4); border:1px solid var(--line); }
        .panel h2 { margin:0 0 20px; font-size:1.3rem; font-weight:700; }
        form { display:grid; gap:14px; }
        label { display:block; font-weight:600; margin-bottom:6px; color:#999; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.5px; }
        input { width:100%; padding:12px 14px; border:1.5px solid #2a2a2a; border-radius:10px; background:#1a1a1a; color:#f0f0f0; font:inherit; font-size:0.95rem; }
        input:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(192,57,43,0.12); }
        .primary-btn, .secondary-btn { border:none; border-radius:10px; padding:12px 16px; cursor:pointer; font-weight:700; }
        .primary-btn { background:linear-gradient(135deg, var(--accent), var(--accent-dark)); color:#fff; }
        .secondary-btn { background:rgba(255,255,255,0.08); color:#ccc; border:1px solid #333; margin-bottom:16px; display:inline-block; text-decoration:none; text-align:center; width:fit-content; padding:10px 16px; }
        .form-msg { min-height:24px; font-weight:700; }
        .form-error { color:#e74c3c; }
        .form-ok { color:#2ecc71; }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="shell">
        <a class="secondary-btn" href="/portal/panel/">&larr; Volver</a>
        <section class="panel">
            <h2>Cambiar contraseña</h2>
            <form id="passwordForm">
                <div>
                    <label for="current_password">Contraseña actual</label>
                    <input id="current_password" name="current_password" type="password" required>
                </div>
                <div>
                    <label for="new_password">Nueva contraseña</label>
                    <input id="new_password" name="new_password" type="password" required>
                </div>
                <button class="primary-btn" type="submit">Actualizar contraseña</button>
                <div id="passwordMsg" class="form-msg"></div>
            </form>
        </section>
    </div>
    <script src="{% static 'js/portal-voluntario.js' %}?v=2"></script>
</body>
</html>
```

Bump también el `<script src="{% static 'js/portal-voluntario.js' %}">` en `templates/portal_voluntario/panel.html` a `?v=2` (agrega versión donde antes no tenía).

- [ ] **Step 3: Agregar la lógica JS de la página nueva**

En `static/js/portal-voluntario.js`, agregar una nueva función `initCambiarClave` y llamarla desde el listener de `DOMContentLoaded`:

```javascript
    async function initCambiarClave() {
        const form = document.getElementById('passwordForm');
        if (!form || document.getElementById('portalPanel')) return;

        const auth = await request('/api/portal/auth/check/');
        if (!auth.authenticated) {
            window.location.href = '/portal/';
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const msg = document.getElementById('passwordMsg');
            msg.className = 'form-msg';
            msg.textContent = '';
            try {
                await request('/api/portal/auth/change-password/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        current_password: form.current_password.value,
                        new_password: form.new_password.value,
                    })
                });
                msg.className = 'form-msg form-ok';
                msg.textContent = 'Contraseña actualizada. Volviendo al panel...';
                setTimeout(() => { window.location.href = '/portal/panel/'; }, 1200);
            } catch (err) {
                msg.className = 'form-msg form-error';
                msg.textContent = err.message;
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initLogin();
        initPanel();
        initCambiarClave();
    });
```

Esto reemplaza el bloque `document.addEventListener('DOMContentLoaded', () => { initLogin(); initPanel(); });` que está al final del archivo (línea 262-265 del original) — agregar la llamada a `initCambiarClave()` en ese mismo bloque en vez de duplicarlo.

- [ ] **Step 4: Verificación manual**

Entrar a `/portal/panel/`, hacer clic en "Cambiar contraseña" (el link agregado en Task 5 Step 1), confirmar que lleva a `/portal/cambiar-clave/`, que el botón "← Volver" regresa al panel, y que al cambiar la contraseña correctamente redirige automáticamente de vuelta a `/portal/panel/` tras ~1 segundo.

- [ ] **Step 5: Commit**

```bash
git add config/urls.py templates/portal_voluntario/cambiar-clave.html templates/portal_voluntario/panel.html static/js/portal-voluntario.js
git commit -m "feat: pagina separada para cambiar contraseña en el portal de voluntarios"
```

---

### Task 8: Deploy

**Files:** ninguno (solo despliegue)

- [ ] **Step 1: Correr el suite completo localmente**

Run: `python manage.py test voluntarios`
Expected: todos los tests PASS (incluye los ~10 tests nuevos de las Tasks 1-4)

- [ ] **Step 2: Push a GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Deploy y migraciones en el VPS**

```bash
ssh -i c:/Users/CAVAD/.ssh/bomberos_vps root@187.127.42.191 "cd /var/www/bomberos && git pull && source venv/bin/activate && python manage.py migrate && python manage.py collectstatic --noinput && systemctl restart bomberos && systemctl is-active bomberos"
```

Expected: `active` al final, migración `00XX_..._gruposolicitudpago` aplicada sin errores.

- [ ] **Step 4: Smoke-test en producción**

Entrar a `https://<dominio-vps>/portal/panel/` con un usuario de voluntario real, agregar una cuota al carrito, confirmar que aparecen las atrasadas automáticamente, y (si hay ambiente de prueba) enviar y aprobar una solicitud de prueba para confirmar que el email llega.
