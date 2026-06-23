# Configuración de Email - Sistema de Comprobantes Automáticos

## ✅ Sistema Implementado

El sistema ahora envía **comprobantes automáticos por email** cuando se registra un pago de cuota social.

---

## 🔧 Configuración Actual (Desarrollo)

Por defecto, el sistema está configurado para **imprimir los emails en la consola** durante desarrollo:

```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

Cuando registres un pago de cuota, verás el comprobante completo en la terminal/consola donde está corriendo Django.

---

## 📧 Configuración para Producción (Gmail)

Para enviar emails reales en producción, sigue estos pasos:

### 1. Habilitar "Contraseñas de aplicación" en Gmail

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Ve a **Seguridad**
3. Activa la **Verificación en dos pasos** (si no la tienes)
4. Busca **Contraseñas de aplicaciones**
5. Genera una nueva contraseña para "Correo"
6. Copia la contraseña generada (16 caracteres)

### 2. Modificar `config/settings.py`

Reemplaza la sección de EMAIL_CONFIGURATION con:

```python
# EMAIL CONFIGURATION - Producción con Gmail
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'tu_email@gmail.com'  # Tu email de Gmail
EMAIL_HOST_PASSWORD = 'xxxx xxxx xxxx xxxx'  # La contraseña de app de 16 caracteres
DEFAULT_FROM_EMAIL = 'Sistema Bomberos <tu_email@gmail.com>'
EMAIL_SUBJECT_PREFIX = '[Bomberos] '
```

### 3. Variables de Entorno (Recomendado)

Para mayor seguridad, usa variables de entorno:

Instala python-decouple:
```bash
pip install python-decouple
```

Crea archivo `.env`:
```
EMAIL_HOST_USER=tu_email@gmail.com
EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
```

En `settings.py`:
```python
from decouple import config

EMAIL_HOST_USER = config('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD')
```

---

## 📨 Otros Proveedores de Email

### Outlook/Hotmail
```python
EMAIL_HOST = 'smtp-mail.outlook.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
```

### Yahoo
```python
EMAIL_HOST = 'smtp.mail.yahoo.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
```

### Servidor SMTP Propio
```python
EMAIL_HOST = 'mail.tudominio.cl'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'noreply@tudominio.cl'
EMAIL_HOST_PASSWORD = 'tu_contraseña'
```

---

## 🧪 Pruebas

Para probar el envío de emails:

1. Asegúrate que el voluntario tenga email configurado en su perfil
2. Registra un pago de cuota social
3. Si estás en desarrollo: Revisa la consola/terminal
4. Si estás en producción: Revisa la bandeja de entrada del voluntario

---

## 📋 Estructura del Comprobante

El comprobante incluye:

- ✅ Logo y encabezado profesional
- ✅ Número de comprobante único
- ✅ Datos del voluntario (nombre, clave, RUT)
- ✅ Período de la cuota (mes y año)
- ✅ Fecha de pago
- ✅ Método de pago
- ✅ Monto pagado destacado
- ✅ Observaciones (si las hay)
- ✅ Versión HTML bonita + versión texto plano

---

## 🔍 Verificación en la Respuesta API

Cuando se registra un pago, la respuesta JSON incluye:

```json
{
  "id": 123,
  "voluntario": 45,
  "mes": 11,
  "anio": 2025,
  "monto": 5000.0,
  "fecha_pago": "2025-11-26",
  "metodo_pago": "Efectivo",
  "observaciones": "",
  "movimiento_creado": true,
  "comprobante_enviado": true  ← Indica si se envió el email
}
```

---

## ⚠️ Notas Importantes

1. **Gmail tiene límite de 500 emails por día** en cuentas gratuitas
2. Siempre usa **contraseñas de aplicación**, no tu contraseña real
3. Para producción seria, considera servicios como:
   - SendGrid
   - Amazon SES
   - Mailgun
4. El email solo se envía si el voluntario tiene email configurado

---

## 🛠️ Archivos Relacionados

- `config/settings.py` - Configuración de email
- `voluntarios/utils_email.py` - Función de envío
- `voluntarios/cuotas_simple_views.py` - Integración automática
- `templates/emails/comprobante_cuota.html` - Template del comprobante

---

¡Todo listo para enviar comprobantes automáticos! 🚀📧
