# Diseño: Pagos combinados, notificaciones y página de contraseña del Portal de Voluntarios

**Fecha:** 2026-07-27
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto

El panel de pagos del Portal de Voluntarios (`templates/portal_voluntario/panel.html`) permite hoy enviar solicitudes de pago de un solo tipo a la vez (una cuota, o un beneficio, o una rifa), cada una con su propio comprobante. El usuario reportó tres problemas relacionados:

1. Si un voluntario debe varias cuotas atrasadas (ej. enero, febrero, marzo) y quiere pagarlas juntas con una sola transferencia, hoy tiene que enviar tres solicitudes separadas con tres comprobantes distintos, cuando en realidad hizo una sola transferencia.
2. Cuando el tesorero rechaza una solicitud, el voluntario no recibe ninguna notificación del motivo — se entera solo si entra al portal a revisar.
3. Cuando el tesorero aprueba un pago hecho desde el portal, no llega ningún comprobante por correo (a diferencia del flujo donde el tesorero registra el pago directamente, que sí envía comprobante).
4. "Cambiar contraseña" vive dentro del panel principal y debería ser una página aparte.

## Alcance de este spec

Cubre las 3 piezas acordadas:

- **A) Notificaciones por email** al aprobar (comprobante) y al rechazar (motivo) solicitudes del portal.
- **B) Página separada de "Cambiar contraseña"** con botón Volver.
- **C) Solicitudes de pago combinadas ("carrito")**: un solo comprobante que cubre varias cuotas/beneficios/rifas a la vez, con detección automática de cuotas atrasadas y desglose itemizado tanto en la vista del tesorero como en el email de aprobación.

No se modifica el flujo de solicitudes simples existente (una sola cuota/beneficio/rifa por solicitud) — sigue funcionando exactamente igual, solo se le agregan las notificaciones de A.

## C) Modelo de datos — `GrupoSolicitudPago`

Nuevo modelo en `voluntarios/models.py`:

| Campo | Tipo | Notas |
|---|---|---|
| `voluntario` | FK a Voluntario | |
| `portal_user` | FK a User | |
| `estado` | CharField choices | `pendiente` / `observada` / `rechazada` / `aprobada` (mismos valores que `SolicitudPagoPortal.ESTADO_CHOICES`) |
| `fecha_pago` | DateField | Fecha de la transferencia (compartida por todos los ítems) |
| `cuenta_bancaria_destino` | FK a CuentaBancaria, nullable | |
| `numero_comprobante` | CharField, nullable | |
| `comprobante` | FileField, nullable | El voucher único subido |
| `descripcion` | TextField, nullable | |
| `monto_total` | DecimalField | Suma de los montos de sus ítems, calculada al crear |
| `feedback_tesorero` | TextField, nullable | Motivo de rechazo/observación |
| `observada_hasta` | DateTimeField, nullable | |
| `revisada_por` | FK a User, nullable | |
| `revisada_at` / `aprobada_at` | DateTimeField, nullable | |
| `created_at` | DateTimeField auto_now_add | |

`SolicitudPagoPortal` gana un campo nuevo:

- `grupo` = FK a `GrupoSolicitudPago`, `null=True, blank=True, related_name='items'`.

Cuando `grupo` es `None`, la solicitud se comporta exactamente como hoy (flujo simple, sin cambios). Cuando `grupo` está seteado, la solicitud es un ítem de un grupo: no necesita su propio `comprobante`/`cuenta_bancaria_destino`/`fecha_pago` (esos viven en el grupo), solo `tipo_pago` + su referencia (`cuota_mes`/`cuota_anio`, o `asignacion_beneficio`, o `asignacion_rifa`) + `monto_solicitado` + `nombre_pago`.

Esto es no-destructivo: no se migra ni se toca el historial de solicitudes/pagos existente.

## C) Flujo del voluntario — el "carrito"

En `panel.html`:

- Cada botón "Solicitar pago" (cuotas, beneficios, rifa) deja de abrir el formulario directamente. En vez de eso, agrega el ítem a un carrito en memoria (JS, `localStorage` no — solo estado de la página) que se muestra en un panel lateral/inferior nuevo: "Ítems a pagar".
- **Auto-suma de cuotas atrasadas**: al agregar una cuota al carrito, el sistema revisa las cuotas del mismo ciclo con mes anterior y estado pendiente; si existen, se agregan automáticamente también (con aviso visual: "Se agregaron también Enero y Febrero, que están atrasadas").
- El carrito muestra cada ítem con su nombre y monto, botón para quitar ítems individuales, y el total sumado.
- Un solo formulario (fecha de pago, cuenta destino, N° de comprobante, descripción, un único archivo de voucher) se envía cuando el carrito tiene al menos un ítem.
- Al enviar: `POST /api/portal/solicitudes/grupo/` crea el `GrupoSolicitudPago` + sus `SolicitudPagoPortal` hijas, todas en estado `pendiente`.
- Si el carrito tiene un solo ítem, igual se envía como grupo (de un solo ítem) — simplifica el código, no hace falta mantener dos caminos de envío en el frontend. (El backend de solicitudes simples existente sigue existiendo para no romper nada, pero el frontend nuevo siempre usa el endpoint de grupo.)
- "Historial de solicitudes" pasa a listar grupos: cada tarjeta muestra el estado, el total, la lista itemizada de conceptos pagados, y si fue rechazada/observada, el motivo (`feedback_tesorero`).

## C) Flujo del tesorero

En `templates/tesoreria/solicitudes-pagos-portal.html`:

- La lista de solicitudes pendientes agrupa por `GrupoSolicitudPago`. Cada tarjeta muestra: voluntario, comprobante único (descarga/preview), fecha, N° de comprobante, y la tabla itemizada de conceptos con su monto individual y el total.
- Aprobar / Observar / Rechazar actúan sobre el grupo completo (`POST /api/portal/tesoreria/solicitudes/grupo/<id>/accion/`):
  - **Aprobar**: recorre cada ítem del grupo y llama a la función de registro que ya existe según su tipo (`registrar_pago_cuota`, `registrar_pago_beneficio`, `registrar_pago_rifa` — sin cambios, ya reparten el dinero correctamente cada uno a su lugar). Marca el grupo y todos sus ítems como `aprobada`.
  - **Rechazar/Observar**: exige motivo (igual que hoy para solicitudes simples), lo guarda en `feedback_tesorero` del grupo, marca grupo e ítems con el estado correspondiente.
- Las solicitudes simples antiguas (sin grupo, ya en la base de datos o que sigan llegando por algún camino residual) se siguen mostrando y aprobando con el flujo actual, sin cambios.

## A) Notificaciones por email

Nuevas funciones en `voluntarios/utils_email.py`:

- `enviar_comprobante_grupo(grupo, voluntario)`: email con tabla itemizada de todos los conceptos pagados + monto total, adjunta PDF (reutiliza `generar_pdf_comprobante`). Se llama al aprobar un grupo. Para solicitudes simples que no son parte de un grupo, se reutilizan las funciones ya existentes (`enviar_comprobante_cuota/beneficio/rifa`), que hoy no se llaman desde el flujo del portal — se agregan esas llamadas en `_aprobar_solicitud` de `portal_views.py`.
- `enviar_notificacion_rechazo(destinatario_nombre, email, motivo, items_descripcion)`: email simple indicando que la solicitud fue rechazada y el motivo escrito por el tesorero. Se usa tanto para solicitudes simples rechazadas como para grupos rechazados.
- Si el voluntario no tiene email cargado, se omite el envío silenciosamente (mismo comportamiento que ya tienen las funciones existentes) — no bloquea la aprobación/rechazo.

## B) Página de cambiar contraseña

- Nueva página `templates/portal_voluntario/cambiar-clave.html` + ruta `portal-cambiar-clave.html`.
- El bloque "Cambiar contraseña" se saca de `panel.html` y el botón que hoy lo muestra pasa a redirigir a esta página.
- La página nueva tiene un botón "← Volver" que regresa a `panel.html`, y al guardar exitosamente la contraseña también redirige automáticamente a `panel.html`.
- Reutiliza el endpoint existente `portal_change_password_view` (`/api/portal/auth/change-password/`) — no cambia el backend de contraseña, solo se mueve la UI.

## Testing

- Modelo: test de `GrupoSolicitudPago` — creación, cálculo de `monto_total`, relación con sus ítems.
- Vista de creación de grupo: test que verifica que se auto-agregan cuotas atrasadas anteriores al seleccionar una posterior.
- Vista de aprobación de grupo: test que verifica que cada ítem se registra en su lugar correcto (un `PagoCuota`, un `PagoBeneficio`, un `PagoRifa` distintos, con sus montos correctos) y que el grupo pasa a `aprobada`.
- Vista de rechazo de grupo: test que verifica que se exige motivo y que el estado pasa a `rechazada`.
- Envío de emails: test con `django.core.mail` backend `locmem` verificando que se encola un email al aprobar y uno al rechazar (sin verificar el contenido exacto del PDF).

## Fuera de alcance

- No se migran las solicitudes simples existentes a grupos.
- No se agrega historial de movimientos más allá de lo que ya provee `feedback_tesorero`.
- No se cambia la lógica de reparto de dinero por tipo de pago (`registrar_pago_cuota/beneficio/rifa`) — solo se reutiliza.
