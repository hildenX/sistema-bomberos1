# 📧📄 Sistema de Comprobantes Automáticos con PDF

## ✅ TODO IMPLEMENTADO

El sistema ahora envía comprobantes por email AUTOMÁTICAMENTE con PDF adjunto cuando se registran pagos.

---

## 🎯 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ 1. ID Único por Comprobante
- Cada comprobante tiene el **ID del pago** como identificador único
- Formato: `Comprobante N° 45`

### ✅ 2. PDF Adjunto en Emails
- Cada email lleva un **PDF descargable**
- Nombres de archivo:
  - Cuotas: `Comprobante_Cuota_[ID]_[CLAVE].pdf`
  - Beneficios: `Comprobante_Beneficio_[ID]_[CLAVE].pdf`

### ✅ 3. Comprobantes para Cuotas Sociales
- Se envía automáticamente al pagar una cuota
- Template: `templates/emails/comprobante_cuota.html`
- Incluye:
  - 🚒 Logo bomberil (rojo)
  - 📋 ID único del comprobante
  - 👤 Datos del voluntario
  - 📅 Período y fecha de pago
  - 💰 Monto destacado
  - 📄 Método de pago
  - 📝 Observaciones (si las hay)

### ✅ 4. Comprobantes para Beneficios
- Se envía automáticamente al pagar beneficios (normales y extras)
- Template: `templates/emails/comprobante_beneficio.html`
- Incluye:
  - 🎁 Logo de beneficios (verde)
  - 📋 ID único del comprobante
  - 👤 Datos del voluntario
  - 🎫 Nombre del beneficio
  - 📊 Cantidad de tarjetas
  - 💰 Monto total
  - 📝 Observaciones (si las hay)

---

## 📁 ARCHIVOS CREADOS/MODIFICADOS

### **Nuevos:**
```
templates/emails/comprobante_cuota.html      → Email HTML cuotas
templates/emails/comprobante_beneficio.html  → Email HTML beneficios
voluntarios/utils_email.py                   → Funciones de envío + PDF
```

### **Modificados:**
```
config/settings.py                           → Configuración SMTP
voluntarios/cuotas_simple_views.py           → Envío en cuotas
voluntarios/beneficios_simple_views.py       → Envío en beneficios
```

### **Instalados:**
```
xhtml2pdf                                    → Generación de PDFs
```

---

## 🚀 CÓMO FUNCIONA

### **Para Cuotas:**
1. Usuario registra pago de cuota desde `cuotas-beneficios.html`
2. Sistema crea `PagoCuota` y `MovimientoFinanciero`
3. **AUTOMÁTICAMENTE:**
   - Renderiza template HTML del comprobante
   - Genera PDF del comprobante
   - Envía email con PDF adjunto al voluntario
4. Respuesta JSON incluye: `comprobante_enviado: true/false`

### **Para Beneficios:**
1. Usuario registra pago de beneficio (normal o extra)
2. Sistema crea `PagoBeneficio` y `MovimientoFinanciero`
3. **AUTOMÁTICAMENTE:**
   - Renderiza template HTML del comprobante
   - Genera PDF del comprobante
   - Envía email con PDF adjunto al voluntario
4. Respuesta JSON incluye: `comprobante_enviado: true/false`

---

## 📧 CONFIGURACIÓN DE EMAIL

### **Actual (Desarrollo):**
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'tu_email@gmail.com'
EMAIL_HOST_PASSWORD = 'xxxx xxxx xxxx xxxx'
```

**Los emails se envían REALMENTE por Gmail** ✅

---

## 🧪 CÓMO PROBAR

### **1. Reinicia Django:**
```bash
Ctrl + C
python manage.py runserver
```

### **2. Prueba Cuotas:**
1. Ve a: `http://localhost:8000/sistema.html`
2. Selecciona un voluntario **con email configurado**
3. Clic en **"💰 Cuotas"**
4. Selecciona un mes
5. Clic en **"✅ REGISTRAR PAGO"**
6. **Mira la consola de Django** → Deberías ver:
   ```
   [EMAIL DEBUG] Iniciando envío de comprobante...
   [PDF] Generando PDF del comprobante...
   [PDF] ✅ PDF generado exitosamente
   [EMAIL DEBUG] ✅ PDF adjuntado: Comprobante_Cuota_XX_CLAVE.pdf
   [EMAIL DEBUG] ✅✅✅ EMAIL ENVIADO EXITOSAMENTE!
   ```
7. **Revisa el email del voluntario** → Debe llegar con PDF adjunto 📄

### **3. Prueba Beneficios:**
1. Ve a: `http://localhost:8000/sistema.html`
2. Selecciona un voluntario
3. Clic en **"🎁 Beneficios"**
4. Paga tarjetas normales o extras
5. **Mira la consola de Django** → Similar a cuotas
6. **Revisa el email** → Debe llegar con PDF adjunto 📄

---

## 📊 EJEMPLO DE CONSOLA (EXITOSO)

```
============================================================
[EMAIL DEBUG] Iniciando envío de comprobante...
[EMAIL DEBUG] ✅ Email encontrado: cavadragon@hotmail.com
[EMAIL DEBUG] Renderizando template HTML...
[EMAIL DEBUG] ✅ Template renderizado correctamente
[PDF] Generando PDF del comprobante...
[PDF] ✅ PDF generado exitosamente
[EMAIL DEBUG] Preparando email...
[EMAIL DEBUG]   Subject: Comprobante de Pago - Cuota Enero 2025
[EMAIL DEBUG]   From: Sistema Bomberos <noreply@bomberos.cl>
[EMAIL DEBUG]   To: ['cavadragon@hotmail.com']
[EMAIL DEBUG]   SMTP: smtp.gmail.com:587
[EMAIL DEBUG]   User: letraslab@gmail.com
[EMAIL DEBUG] ✅ PDF adjuntado: Comprobante_Cuota_45_B001.pdf
[EMAIL DEBUG] Enviando email por SMTP...
[EMAIL DEBUG] ✅✅✅ EMAIL ENVIADO EXITOSAMENTE!
[EMAIL DEBUG] Result: 1
============================================================
```

---

## 📋 CONTENIDO DEL EMAIL

### **Voluntario recibe:**

1. **Email HTML bonito** (se ve en Gmail, Outlook, etc.)
   - Diseño profesional
   - Colores bomberiles
   - Todos los datos del pago

2. **PDF adjunto descargable** 
   - Nombre: `Comprobante_Cuota_45_B001.pdf`
   - Contenido: Mismo diseño del HTML
   - Puede guardarlo, imprimirlo, reenviarlo

3. **Versión texto plano** (para clientes sin HTML)
   - Todos los datos en formato texto simple

---

## ⚠️ IMPORTANTE

### **El voluntario DEBE tener email:**
- Si NO tiene email → No se envía (pero el pago SÍ se registra)
- Consola muestra: `⚠️ El voluntario NO tiene email configurado`

### **Verifica emails en los perfiles:**
```
sistema.html → Seleccionar voluntario → Editar → Campo Email
```

---

## 🎨 PERSONALIZACIÓN

### **Cambiar colores del comprobante:**
- Cuotas: Edita `templates/emails/comprobante_cuota.html`
  - Línea 30: `border-bottom: 3px solid #c8102e;` (rojo bomberil)
- Beneficios: Edita `templates/emails/comprobante_beneficio.html`
  - Línea 23: `border-bottom: 3px solid #10b981;` (verde)

### **Cambiar remitente:**
- Edita `config/settings.py` línea 183:
  ```python
  DEFAULT_FROM_EMAIL = 'Bomberos de Chile <contacto@bomberos.cl>'
  ```

---

## 🐛 TROUBLESHOOTING

### **No llega el email:**
1. Revisa la consola de Django
2. Verifica que el voluntario tenga email
3. Revisa carpeta de Spam/Correo no deseado
4. Verifica credenciales Gmail en `settings.py`

### **PDF no se genera:**
1. Reinstala librería: `python -m pip install --upgrade xhtml2pdf`
2. Revisa consola por errores de `[PDF]`

### **Error de formato de fecha:**
- Ya está solucionado con validación de `strftime`

---

¡El sistema está 100% funcional! 🎉📧📄

**Cada pago = Comprobante automático con PDF en el email del voluntario** ✅
