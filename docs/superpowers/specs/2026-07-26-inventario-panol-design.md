# Diseño: Módulo de Inventario / Pañol

**Fecha:** 2026-07-26
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto

El sistema no tiene forma de registrar el inventario de la bodega/pañol de la
compañía (mangueras, pitones, EPP, trajes, extintores, herramientas, equipos
Scott, insumos, etc.). Actualmente esta información solo existe en la cabeza
de Miguel Vásquez, el conductor rentado a cargo del pañol (no es voluntario
del sistema, por lo tanto no tiene un registro `Voluntario` asociado).

El usuario entregó un listado inicial de ~40 tipos de items con sus
cantidades actuales, que debe quedar precargado en el sistema al implementar
este módulo (ver "Datos iniciales" más abajo).

## Objetivo

1. Un lugar en la plataforma para ver y mantener el inventario del pañol.
2. Poder descargar ese inventario como Excel en cualquier momento.

## Modelo de datos

Nuevo modelo `ItemInventario` en `voluntarios/models.py` (siguiendo la
convención existente del proyecto de mantener todos los modelos en una sola
app `voluntarios`).

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `nombre` | CharField(200) | Sí | Ej: "Pitón 52mm", "Extintor" |
| `categoria` | CharField(100) | No | Texto libre (no lista fija). Ej: "Mangueras/Pitones", "EPP" |
| `cantidad` | DecimalField(10,2) | Sí | Admite decimales para casos como litros a granel |
| `unidad` | CharField(50) | No | Ej: "unidades", "pares", "cajas", "botellones", "bidón", "metros" |
| `marca` | CharField(100) | No | |
| `tamano` | CharField(100) | No | Diámetro/talla/volumen por unidad. Ej: "52mm", "6 litros c/u", "Talla L" |
| `estado` | CharField choices | No | `bueno` / `regular` / `malo`, sin default forzado |
| `numero_serie` | CharField(100) | No | Para extintores, equipos Scott, motosierra, etc. |
| `responsable` | CharField(150) | No | Texto libre, prellenado "Miguel Vásquez" en el formulario |
| `ubicacion` | CharField(150) | No | Texto libre, prellenado "Pañol" en el formulario |
| `observaciones` | TextField | No | Notas libres |
| `fecha_registro` | DateTimeField(auto_now_add) | — | Automático |
| `fecha_actualizacion` | DateTimeField(auto_now) | — | Automático |
| `registrado_por` | CharField(100) | — | Username de quien creó el registro (auditoría) |

**Regla clave del campo unidad vs. tamaño** (aclarada por el usuario): la
`cantidad` + `unidad` cuentan **envases/piezas**, nunca el volumen. El
volumen o medida de cada envase va en `tamano`.
- Ej: "54 botellones de agua mineral de 6 litros" → `cantidad=54`,
  `unidad="botellones"`, `tamano="6 litros c/u"`.
- Ej: "1 bidón de espuma AFFF/AR aprox 18 lts" → `cantidad=1`,
  `unidad="bidón"`, `tamano="~18 litros"`.

## Backend

### API REST
- `ItemInventarioSerializer` (DRF ModelSerializer, `fields = '__all__'`).
- `ItemInventarioViewSet` (DRF ModelViewSet) registrado en el router bajo
  `/api/inventario/`.
- Permisos (siguiendo el patrón de `CargoViewSet` en `views.py`):
  - `list` / `retrieve`: cualquier usuario autenticado (`IsAuthenticated`).
  - `create` / `update` / `partial_update` / `destroy`: solo
    `RolBomberos.DIRECTOR` o `RolBomberos.SUPER_ADMIN`
    (usar `PermisosPorModulo` / `requiere_rol` como en otros ViewSets).
- Al crear/actualizar vía la vista, guardar `registrado_por` con el
  username del usuario autenticado.

### Exportar a Excel
- Nueva vista `exportar_inventario_excel` (función, no ViewSet), siguiendo
  el patrón de `carga_masiva_views.py` (uso de `openpyxl`, `HttpResponse`
  con `Content-Type` de xlsx).
- Columnas en el orden de la tabla de arriba (excepto `fecha_actualizacion`
  y `registrado_por`, que son metadatos internos — no imprescindibles en el
  Excel, pero se pueden incluir al final si no complica el layout).
- Ruta: `GET /api/inventario/exportar-excel/` — accesible a cualquier
  usuario autenticado (igual que la lectura).

## Frontend

### Página `templates/inventario/lista.html`
- Sigue el patrón visual dark establecido en esta sesión (`global-dark.css`
  cargado al final con `?v=` actual, paleta roja/dorada, sin emojis).
- Estructura:
  - Header con título y botón "← Volver al Sistema".
  - Botón "Descargar Excel" (visible a todos).
  - Buscador de texto libre (filtra por nombre/categoría/marca en el
    cliente, igual que el buscador de voluntarios).
  - Botón "+ Agregar Item" (visible solo si el usuario es Director/Super
    Admin — ocultar con JS según `currentUser.role`, igual que otros
    módulos).
  - Lista de items agrupada por `categoria` (los sin categoría van en un
    grupo "Sin categoría"), cada grupo colapsable.
  - Cada fila muestra: nombre, cantidad + unidad, marca, tamaño, estado
    (badge de color), y botones Editar/Eliminar (solo Director/Super Admin).
  - Formulario de alta/edición en modal (mismo patrón modal usado en
    `cuentas-compania.html` / `admin-ciclos-beneficios.html` esta sesión).

### JS `static/js/inventario-django.js`
- Clase `SistemaInventario` (mismo patrón de las demás páginas: `fetch` a
  `/api/inventario/`, render de lista, manejo de modal, permisos por rol).
- Sin lógica de movimientos/historial — es CRUD directo sobre la cantidad
  actual (alcance definido: "solo stock actual", no historial).

### Navegación
- Nueva entrada en el nav dinámico de `sidebar-django.js` — visible a
  todos los roles logueados (la restricción de edición vive en la página,
  no en la visibilidad del link).
- Nueva URL en `voluntarios/urls.py` (Django, no API): `/inventario.html`
  → renderiza `templates/inventario/lista.html`.

## Datos iniciales

Se crea una migración de datos (`migrations/000X_seed_inventario.py` o un
management command) que precarga los ~40 items que el usuario entregó en el
chat, parseados a `nombre` / `cantidad` / `unidad` / `tamano` según la regla
de arriba. Casos ambiguos del listado original (ej. "3 gemelos 75mm/52mm x2",
"2 trifulcas 75mm x2/52mm x2") se interpretan como mejor esfuerzo y se dejan
señalados en `observaciones` para que Miguel/el usuario los revise y
corrija desde la UI si el parseo no fue exacto.

Todos los items iniciales llevan `responsable="Miguel Vásquez"` y
`ubicacion="Pañol"`.

## Fuera de alcance (explícitamente, por decisión del usuario)

- Historial de movimientos (quién sacó/devolvió algo y cuándo).
- Categorías con lista fija/dropdown (se usa texto libre).
- Fecha de vencimiento / próxima mantención (extintores, equipos Scott) —
  se puede agregar más adelante como columna nueva si se pide.
- Vincular `responsable` a un `Voluntario` del sistema (Miguel no es
  voluntario, el campo es texto libre para cualquier encargado futuro).

## Testing

- Verificar permisos: usuario no-admin no puede crear/editar/eliminar
  (API responde 403), pero sí puede ver la lista y descargar el Excel.
- Verificar que el Excel generado abre correctamente y tiene las columnas
  esperadas con los datos precargados.
- Verificar que el seed de datos iniciales corre una sola vez (migración
  idempotente o management command con chequeo de "ya existe").
